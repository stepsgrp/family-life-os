import { prisma, type Subscription } from "@flos/db";
import Stripe from "stripe";
import { env } from "../env";

export const stripe = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY) : null;

export const ENTITLEMENT_ID = "family"; // same id in RevenueCat and our DB

/**
 * One entitlement check regardless of where the family paid (Stripe web, App Store,
 * Play Store). Both webhook handlers write into the same Subscription row, so this is
 * the single source of truth.
 */
export function isEntitled(sub: Subscription | null, now = new Date()): boolean {
  if (!sub || sub.tier !== "FAMILY") return false;
  if (sub.status === "EXPIRED") return false;
  // CANCELED keeps access until the paid period ends; PAST_DUE gets a grace period.
  if (sub.currentPeriodEnd && sub.currentPeriodEnd < now) {
    const graceMs = sub.status === "PAST_DUE" ? 3 * 24 * 3600 * 1000 : 0;
    return sub.currentPeriodEnd.getTime() + graceMs > now.getTime();
  }
  return true;
}

export async function hasFamilyPlan(familyId: string) {
  const sub = await prisma.subscription.findUnique({ where: { familyId } });
  return isEntitled(sub);
}
