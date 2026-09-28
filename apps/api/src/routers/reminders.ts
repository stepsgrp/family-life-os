import { CreateReminderInput, Id } from "@flos/types";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publishChange } from "../lib/realtime";
import { familyProcedure, parentProcedure, router } from "../trpc";

export const remindersRouter = router({
  list: familyProcedure.query(({ ctx }) =>
    ctx.prisma.reminder.findMany({
      where: {
        familyId: ctx.familyId,
        active: true,
        ...(ctx.role === "CHILD" ? { memberId: ctx.member.id } : {}),
      },
      include: { member: { select: { id: true, displayName: true, color: true } } },
      orderBy: [{ kind: "asc" }, { remindAt: "asc" }],
    }),
  ),

  create: parentProcedure.input(CreateReminderInput).mutation(async ({ ctx, input }) => {
    if (input.memberId) {
      const ok = await ctx.prisma.familyMember.count({ where: { id: input.memberId, familyId: ctx.familyId } });
      if (!ok) throw new TRPCError({ code: "BAD_REQUEST" });
    }
    const reminder = await ctx.prisma.reminder.create({ data: { ...input, familyId: ctx.familyId } });
    publishChange(ctx.familyId, "reminders");
    return reminder;
  }),

  setActive: parentProcedure
    .input(z.object({ id: Id, active: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.reminder.updateMany({
        where: { id: input.id, familyId: ctx.familyId },
        data: { active: input.active },
      });
      publishChange(ctx.familyId, "reminders");
      return { ok: true };
    }),

  delete: parentProcedure.input(z.object({ id: Id })).mutation(async ({ ctx, input }) => {
    await ctx.prisma.reminder.deleteMany({ where: { id: input.id, familyId: ctx.familyId } });
    publishChange(ctx.familyId, "reminders");
    return { ok: true };
  }),
});
