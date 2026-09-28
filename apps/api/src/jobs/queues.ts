import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { env } from "../env";

// BullMQ requires maxRetriesPerRequest: null on its connections.
export const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

export const QUEUE = "scheduled";
export const scheduledQueue = new Queue(QUEUE, { connection });

export type JobName = "overdue-chores" | "dispatch-reminders" | "heartbeat";

/** Idempotent: safe to call on every worker boot. */
export async function registerSchedules() {
  // Nightly at 02:00 UTC.
  await scheduledQueue.upsertJobScheduler("overdue-chores", { pattern: "0 2 * * *" }, { name: "overdue-chores" });
  // Every minute: medicine (HH:mm schedule) and one-off school/general reminders.
  await scheduledQueue.upsertJobScheduler("dispatch-reminders", { every: 60_000 }, { name: "dispatch-reminders" });
  // Better Stack heartbeat: alerts if the worker stops running.
  if (env.BETTERSTACK_HEARTBEAT_URL) {
    await scheduledQueue.upsertJobScheduler("heartbeat", { every: 5 * 60_000 }, { name: "heartbeat" });
  }
}
