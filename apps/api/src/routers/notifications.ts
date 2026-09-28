import { Expo } from "expo-server-sdk";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { familyProcedure, router } from "../trpc";

export const notificationsRouter = router({
  /** Called by the mobile app after it obtains an Expo push token. Idempotent. */
  registerPushToken: familyProcedure
    .input(z.object({ token: z.string(), platform: z.enum(["ios", "android"]) }))
    .mutation(async ({ ctx, input }) => {
      if (!Expo.isExpoPushToken(input.token)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Not an Expo push token" });
      }
      // A device that switches accounts moves its token to the new member.
      await ctx.prisma.pushToken.upsert({
        where: { token: input.token },
        create: { token: input.token, platform: input.platform, memberId: ctx.member.id },
        update: { memberId: ctx.member.id, platform: input.platform },
      });
      return { ok: true };
    }),

  unregisterPushToken: familyProcedure.input(z.object({ token: z.string() })).mutation(async ({ ctx, input }) => {
    await ctx.prisma.pushToken.deleteMany({ where: { token: input.token, memberId: ctx.member.id } });
    return { ok: true };
  }),
});
