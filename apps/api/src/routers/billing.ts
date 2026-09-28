import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { env } from "../env";
import { isEntitled, stripe } from "../lib/billing";
import { adminProcedure, familyProcedure, router } from "../trpc";

export const billingRouter = router({
  /** Same answer whether the family paid on web (Stripe), iOS, or Android. */
  getSubscriptionStatus: familyProcedure.query(async ({ ctx }) => {
    const sub = await ctx.prisma.subscription.findUnique({ where: { familyId: ctx.familyId } });
    return {
      entitled: isEntitled(sub),
      tier: sub?.tier ?? "FREE",
      status: sub?.status ?? "ACTIVE",
      source: sub?.source ?? null,
      currentPeriodEnd: sub?.currentPeriodEnd ?? null,
      // Mobile uses this as the RevenueCat appUserID so purchases attach to the family.
      revenueCatAppUserId: ctx.familyId,
    };
  }),

  createCheckoutSession: adminProcedure
    .input(z.object({ interval: z.enum(["monthly", "annual"]) }))
    .mutation(async ({ ctx, input }) => {
      if (!stripe) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Stripe not configured" });
      const sub = await ctx.prisma.subscription.upsert({
        where: { familyId: ctx.familyId },
        create: { familyId: ctx.familyId },
        update: {},
      });
      if (isEntitled(sub) && sub.source !== "STRIPE") {
        throw new TRPCError({ code: "CONFLICT", message: "Already subscribed through the app store" });
      }

      let customerId = sub.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({ metadata: { familyId: ctx.familyId } });
        customerId = customer.id;
        await ctx.prisma.subscription.update({ where: { id: sub.id }, data: { stripeCustomerId: customerId } });
      }

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        client_reference_id: ctx.familyId,
        line_items: [
          { price: input.interval === "annual" ? env.STRIPE_PRICE_ANNUAL : env.STRIPE_PRICE_MONTHLY, quantity: 1 },
        ],
        subscription_data: { metadata: { familyId: ctx.familyId }, trial_period_days: 14 },
        allow_promotion_codes: true,
        success_url: `${env.WEB_ORIGIN}/settings/billing?status=success`,
        cancel_url: `${env.WEB_ORIGIN}/settings/billing?status=canceled`,
      });
      return { url: session.url! };
    }),

  createPortalSession: adminProcedure.mutation(async ({ ctx }) => {
    if (!stripe) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Stripe not configured" });
    const sub = await ctx.prisma.subscription.findUnique({ where: { familyId: ctx.familyId } });
    if (!sub?.stripeCustomerId) throw new TRPCError({ code: "NOT_FOUND", message: "No Stripe customer" });
    const portal = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${env.WEB_ORIGIN}/settings/billing`,
    });
    return { url: portal.url };
  }),
});
