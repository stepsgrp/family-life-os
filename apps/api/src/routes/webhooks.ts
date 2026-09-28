import { prisma, type SubscriptionStatus } from "@flos/db";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { timingSafeEqual } from "node:crypto";
import type Stripe from "stripe";
import { Webhook } from "svix";
import { env } from "../env";
import { track } from "../lib/analytics";
import { stripe } from "../lib/billing";

/** Returns false if we've already processed this provider event (webhooks retry). */
async function firstDelivery(id: string, provider: string) {
  try {
    await prisma.webhookEvent.create({ data: { id: `${provider}:${id}`, provider } });
    return true;
  } catch {
    return false; // unique violation -> duplicate
  }
}

const rawBody = (req: FastifyRequest) => req.body as Buffer;

// ---------------------------------------------------------------------------
// Stripe (web subscriptions)
// ---------------------------------------------------------------------------
function stripeStatus(s: Stripe.Subscription.Status): SubscriptionStatus {
  switch (s) {
    case "active":
      return "ACTIVE";
    case "trialing":
      return "TRIALING";
    case "past_due":
    case "unpaid":
      return "PAST_DUE";
    case "canceled":
      return "CANCELED";
    default:
      return "EXPIRED";
  }
}

async function syncStripeSubscription(sub: Stripe.Subscription) {
  const familyId = sub.metadata.familyId;
  if (!familyId) return;
  // current_period_end lives on subscription items in current Stripe API versions.
  const periodEnd = sub.items.data[0]?.current_period_end;
  const status = stripeStatus(sub.status);
  await prisma.subscription.upsert({
    where: { familyId },
    create: {
      familyId,
      tier: status === "EXPIRED" ? "FREE" : "FAMILY",
      status,
      source: "STRIPE",
      stripeCustomerId: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
      stripeSubscriptionId: sub.id,
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
    },
    update: {
      tier: status === "EXPIRED" ? "FREE" : "FAMILY",
      status,
      source: "STRIPE",
      stripeSubscriptionId: sub.id,
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
    },
  });
}

// ---------------------------------------------------------------------------
// RevenueCat (App Store + Play Store). appUserID == familyId.
// ---------------------------------------------------------------------------
interface RevenueCatEvent {
  id: string;
  type: string;
  app_user_id: string;
  store: "APP_STORE" | "PLAY_STORE" | "STRIPE" | string;
  expiration_at_ms: number | null;
  entitlement_ids?: string[] | null;
}

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export async function webhookRoutes(app: FastifyInstance) {
  // Signature checks need the exact bytes, so parse JSON bodies as raw Buffers here.
  app.addContentTypeParser("application/json", { parseAs: "buffer" }, (_req, body, done) => done(null, body));

  app.post("/webhooks/stripe", async (req, reply) => {
    if (!stripe) return reply.code(503).send();
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        rawBody(req),
        req.headers["stripe-signature"] as string,
        env.STRIPE_WEBHOOK_SECRET,
      );
    } catch {
      return reply.code(400).send({ error: "Invalid signature" });
    }
    if (!(await firstDelivery(event.id, "stripe"))) return { received: true };

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription as string);
          await syncStripeSubscription(sub);
          track(session.client_reference_id ?? "unknown", "subscription_started", { source: "stripe" });
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.created":
        await syncStripeSubscription(event.data.object);
        break;
      case "customer.subscription.deleted":
        await syncStripeSubscription(event.data.object);
        track(event.data.object.metadata.familyId ?? "unknown", "subscription_canceled", { source: "stripe" });
        break;
    }
    return { received: true };
  });

  app.post("/webhooks/revenuecat", async (req, reply) => {
    const auth = req.headers.authorization ?? "";
    if (!env.REVENUECAT_WEBHOOK_AUTH || !safeEqual(auth, `Bearer ${env.REVENUECAT_WEBHOOK_AUTH}`)) {
      return reply.code(401).send();
    }
    const { event } = JSON.parse(rawBody(req).toString("utf8")) as { event: RevenueCatEvent };
    if (!(await firstDelivery(event.id, "revenuecat"))) return { received: true };

    const family = await prisma.family.findUnique({ where: { id: event.app_user_id } });
    if (!family) return { received: true }; // anonymous RC user, ignore

    const source = event.store === "PLAY_STORE" ? "PLAY_STORE" : event.store === "APP_STORE" ? "APP_STORE" : null;
    if (!source) return { received: true }; // Stripe purchases are handled by the Stripe webhook

    const periodEnd = event.expiration_at_ms ? new Date(event.expiration_at_ms) : null;
    const base = { source, currentPeriodEnd: periodEnd } as const;

    const map: Record<string, { tier: "FREE" | "FAMILY"; status: SubscriptionStatus } | undefined> = {
      INITIAL_PURCHASE: { tier: "FAMILY", status: "ACTIVE" },
      RENEWAL: { tier: "FAMILY", status: "ACTIVE" },
      UNCANCELLATION: { tier: "FAMILY", status: "ACTIVE" },
      PRODUCT_CHANGE: { tier: "FAMILY", status: "ACTIVE" },
      CANCELLATION: { tier: "FAMILY", status: "CANCELED" }, // access continues until expiry
      BILLING_ISSUE: { tier: "FAMILY", status: "PAST_DUE" },
      EXPIRATION: { tier: "FREE", status: "EXPIRED" },
    };
    const next = map[event.type];
    if (next) {
      await prisma.subscription.upsert({
        where: { familyId: family.id },
        create: { familyId: family.id, ...base, ...next },
        update: { ...base, ...next },
      });
      if (event.type === "INITIAL_PURCHASE") track(family.id, "subscription_started", { source });
      if (event.type === "EXPIRATION") track(family.id, "subscription_canceled", { source });
    }
    return { received: true };
  });

  // Clerk: clean up when a user deletes their account.
  app.post("/webhooks/clerk", async (req, reply) => {
    let evt: { type: string; data: { id?: string } };
    try {
      evt = new Webhook(env.CLERK_WEBHOOK_SECRET).verify(rawBody(req).toString("utf8"), {
        "svix-id": req.headers["svix-id"] as string,
        "svix-timestamp": req.headers["svix-timestamp"] as string,
        "svix-signature": req.headers["svix-signature"] as string,
      }) as typeof evt;
    } catch {
      return reply.code(400).send();
    }
    if (evt.type === "user.deleted" && evt.data.id) {
      await prisma.familyMember.deleteMany({ where: { clerkUserId: evt.data.id } });
    }
    return { received: true };
  });
}
