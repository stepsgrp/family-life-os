import { prisma } from "@flos/db";
import { sendPushToMembers } from "../lib/push";
import { logger } from "../lib/logger";

/** Push a reminder to the assignee of every overdue chore (once per chore). */
export async function notifyOverdueChores(now = new Date()) {
  const overdue = await prisma.chore.findMany({
    where: {
      completedAt: null,
      dueAt: { lt: now },
      assigneeId: { not: null },
      overdueNotifiedAt: null,
    },
    select: { id: true, title: true, assigneeId: true },
    take: 5000,
  });

  for (const chore of overdue) {
    await sendPushToMembers([chore.assigneeId!], {
      title: "Chore overdue",
      body: `"${chore.title}" is past due - finish it to earn your points!`,
      data: { type: "chore_due", choreId: chore.id },
    });
  }

  if (overdue.length) {
    await prisma.chore.updateMany({
      where: { id: { in: overdue.map((c) => c.id) } },
      data: { overdueNotifiedAt: now },
    });
  }
  logger.info({ count: overdue.length }, "overdue chore notifications sent");
  return overdue.length;
}
