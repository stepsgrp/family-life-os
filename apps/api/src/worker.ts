import "./instrument";
import { prisma } from "@flos/db";
import * as Sentry from "@sentry/node";
import { Worker } from "bullmq";
import { env } from "./env";
import { notifyOverdueChores } from "./jobs/overdue-chores";
import { connection, QUEUE, registerSchedules, type JobName } from "./jobs/queues";
import { dispatchReminders } from "./jobs/reminders";
import { logger } from "./lib/logger";

// Runs as a separate process/service from the API so slow jobs never block requests.
await registerSchedules();

const worker = new Worker(
  QUEUE,
  async (job) => {
    switch (job.name as JobName) {
      case "overdue-chores":
        return notifyOverdueChores();
      case "dispatch-reminders":
        return dispatchReminders();
      case "heartbeat":
        await fetch(env.BETTERSTACK_HEARTBEAT_URL);
        return;
    }
  },
  { connection, concurrency: 2 },
);

worker.on("failed", (job, err) => {
  logger.error({ job: job?.name, err }, "job failed");
  Sentry.captureException(err, { tags: { job: job?.name } });
});

logger.info("worker started");

const shutdown = async () => {
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
