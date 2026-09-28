import { prisma } from "@flos/db";
import { sendPushToFamily, sendPushToMembers, type PushNotification } from "../lib/push";

/** "HH:mm" for `now` in the given IANA timezone. */
export function localTime(now: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
}

/**
 * Runs every minute. Medicine reminders fire at each "HH:mm" in the family's
 * timezone; school/general reminders fire once at remindAt.
 * lastFiredAt guards against double-sends if a job is retried.
 */
export async function dispatchReminders(now = new Date()) {
  const minuteAgo = new Date(now.getTime() - 60_000);

  // --- Medicine (recurring daily times) ---
  const medicine = await prisma.reminder.findMany({
    where: {
      active: true,
      kind: "MEDICINE",
      OR: [{ lastFiredAt: null }, { lastFiredAt: { lt: minuteAgo } }],
    },
    include: { family: { select: { timezone: true } }, member: { select: { displayName: true } } },
  });

  for (const r of medicine) {
    if (!r.timesOfDay.includes(localTime(now, r.family.timezone))) continue;
    const who = r.member?.displayName;
    const notification: PushNotification = {
      title: `💊 ${r.title}`,
      body: [who ? `Time for ${who}'s medicine` : "Medicine time", r.dosage].filter(Boolean).join(" - "),
      data: { type: "medicine_reminder", reminderId: r.id },
    };
    await notify(r.familyId, r.memberId, notification);
    await prisma.reminder.update({ where: { id: r.id }, data: { lastFiredAt: now } });
  }

  // --- One-off (school / general) ---
  const due = await prisma.reminder.findMany({
    where: { active: true, kind: { in: ["SCHOOL", "GENERAL"] }, remindAt: { lte: now }, lastFiredAt: null },
    take: 1000,
  });
  for (const r of due) {
    await notify(r.familyId, r.memberId, {
      title: r.kind === "SCHOOL" ? `🎒 ${r.title}` : r.title,
      body: r.notes ?? "Reminder",
      data: { type: "school_reminder", reminderId: r.id },
    });
    await prisma.reminder.update({ where: { id: r.id }, data: { lastFiredAt: now, active: false } });
  }
}

/** Reminder for a child also goes to the parents (young kids may not have phones). */
async function notify(familyId: string, memberId: string | null, n: PushNotification) {
  if (!memberId) return sendPushToFamily(familyId, n);
  const parents = await prisma.familyMember.findMany({
    where: { familyId, role: { in: ["ADMIN_PARENT", "PARENT"] } },
    select: { id: true },
  });
  await sendPushToMembers([...new Set([memberId, ...parents.map((p) => p.id)])], n);
}
