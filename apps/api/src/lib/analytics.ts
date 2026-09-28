import { PostHog } from "posthog-node";
import { env } from "../env";

// Server-side events are the reliable ones (not blocked by ad blockers).
const posthog = env.POSTHOG_KEY ? new PostHog(env.POSTHOG_KEY, { host: "https://us.i.posthog.com" }) : null;

export type AnalyticsEvent =
  | "family_created"
  | "member_joined"
  | "event_created"
  | "chore_completed"
  | "ai_dinner_suggested"
  | "ai_weekend_planned"
  | "ai_appointment_drafted"
  | "subscription_started"
  | "subscription_canceled";

export function track(distinctId: string, event: AnalyticsEvent, properties: Record<string, unknown> = {}) {
  posthog?.capture({ distinctId, event, properties });
}

export async function shutdownAnalytics() {
  await posthog?.shutdown();
}
