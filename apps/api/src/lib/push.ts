import { prisma } from "@flos/db";
import type { PushData } from "@flos/types";
import { Expo, type ExpoPushMessage } from "expo-server-sdk";
import { logger } from "./logger";

const expo = new Expo();

export interface PushNotification {
  title: string;
  body: string;
  data: PushData;
}

/** Send a push to every device registered to the given family members. */
export async function sendPushToMembers(memberIds: string[], notification: PushNotification) {
  if (memberIds.length === 0) return;
  const tokens = await prisma.pushToken.findMany({ where: { memberId: { in: memberIds } } });

  const messages: ExpoPushMessage[] = tokens
    .filter((t) => Expo.isExpoPushToken(t.token))
    .map((t) => ({
      to: t.token,
      title: notification.title,
      body: notification.body,
      data: notification.data as unknown as Record<string, unknown>,
      sound: "default",
      priority: "high",
    }));

  for (const chunk of expo.chunkPushNotifications(messages)) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      // Remove tokens for uninstalled apps so we stop sending to them.
      const dead = tickets
        .map((ticket, i) =>
          ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered"
            ? (chunk[i]?.to as string)
            : null,
        )
        .filter((t): t is string => !!t);
      if (dead.length) await prisma.pushToken.deleteMany({ where: { token: { in: dead } } });
    } catch (err) {
      logger.error({ err }, "expo push send failed");
    }
  }
}

export async function sendPushToFamily(familyId: string, notification: PushNotification, exceptMemberId?: string) {
  const members = await prisma.familyMember.findMany({
    where: { familyId, ...(exceptMemberId ? { id: { not: exceptMemberId } } : {}) },
    select: { id: true },
  });
  await sendPushToMembers(members.map((m) => m.id), notification);
}
