import { CreateChoreInput, Id, ListChoresInput, UpdateChoreInput, isParent } from "@flos/types";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { track } from "../lib/analytics";
import { sendPushToMembers } from "../lib/push";
import { publishChange } from "../lib/realtime";
import { familyProcedure, parentProcedure, router } from "../trpc";

function nextDueDate(due: Date, recurrence: "DAILY" | "WEEKLY" | "MONTHLY") {
  const next = new Date(due);
  if (recurrence === "DAILY") next.setUTCDate(next.getUTCDate() + 1);
  if (recurrence === "WEEKLY") next.setUTCDate(next.getUTCDate() + 7);
  if (recurrence === "MONTHLY") next.setUTCMonth(next.getUTCMonth() + 1);
  return next;
}

async function assertAssignee(prisma: import("@flos/db").PrismaClient, familyId: string, assigneeId?: string) {
  if (!assigneeId) return;
  const ok = await prisma.familyMember.count({ where: { id: assigneeId, familyId } });
  if (!ok) throw new TRPCError({ code: "BAD_REQUEST", message: "Assignee is not in this family" });
}

export const choresRouter = router({
  list: familyProcedure.input(ListChoresInput).query(({ ctx, input }) => {
    // Children only ever see their own chores.
    const assigneeId = ctx.role === "CHILD" ? ctx.member.id : input.assigneeId;
    return ctx.prisma.chore.findMany({
      where: {
        familyId: ctx.familyId,
        ...(assigneeId ? { assigneeId } : {}),
        ...(input.includeCompleted ? {} : { completedAt: null }),
      },
      include: { assignee: { select: { id: true, displayName: true, color: true } } },
      orderBy: [{ completedAt: "asc" }, { dueAt: "asc" }],
    });
  }),

  /** Points per member for the current month - drives the leaderboard. */
  leaderboard: familyProcedure.query(async ({ ctx }) => {
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const rows = await ctx.prisma.chore.groupBy({
      by: ["assigneeId"],
      where: { familyId: ctx.familyId, completedAt: { gte: monthStart }, assigneeId: { not: null } },
      _sum: { points: true },
    });
    return rows.map((r) => ({ memberId: r.assigneeId!, points: r._sum.points ?? 0 }));
  }),

  create: parentProcedure.input(CreateChoreInput).mutation(async ({ ctx, input }) => {
    await assertAssignee(ctx.prisma, ctx.familyId, input.assigneeId);
    const chore = await ctx.prisma.chore.create({ data: { ...input, familyId: ctx.familyId } });
    publishChange(ctx.familyId, "chores");
    if (chore.assigneeId && chore.assigneeId !== ctx.member.id) {
      void sendPushToMembers([chore.assigneeId], {
        title: "New chore for you",
        body: chore.title,
        data: { type: "chore_due", choreId: chore.id },
      });
    }
    return chore;
  }),

  update: parentProcedure.input(UpdateChoreInput).mutation(async ({ ctx, input }) => {
    const { id, ...data } = input;
    await assertAssignee(ctx.prisma, ctx.familyId, data.assigneeId);
    const { count } = await ctx.prisma.chore.updateMany({ where: { id, familyId: ctx.familyId }, data });
    if (count === 0) throw new TRPCError({ code: "NOT_FOUND" });
    publishChange(ctx.familyId, "chores");
    return ctx.prisma.chore.findUniqueOrThrow({ where: { id } });
  }),

  delete: parentProcedure.input(z.object({ id: Id })).mutation(async ({ ctx, input }) => {
    const { count } = await ctx.prisma.chore.deleteMany({ where: { id: input.id, familyId: ctx.familyId } });
    if (count === 0) throw new TRPCError({ code: "NOT_FOUND" });
    publishChange(ctx.familyId, "chores");
    return { ok: true };
  }),

  /** Any member can complete their own chore; parents can complete anyone's. */
  markComplete: familyProcedure
    .input(z.object({ id: Id, completed: z.boolean().default(true) }))
    .mutation(async ({ ctx, input }) => {
      const chore = await ctx.prisma.chore.findFirst({ where: { id: input.id, familyId: ctx.familyId } });
      if (!chore) throw new TRPCError({ code: "NOT_FOUND" });
      if (chore.assigneeId !== ctx.member.id && !isParent(ctx.role)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only complete your own chores" });
      }

      const updated = await ctx.prisma.$transaction(async (tx) => {
        const result = await tx.chore.update({
          where: { id: chore.id },
          data: { completedAt: input.completed ? new Date() : null },
        });
        // Recurring chore: completing it schedules the next occurrence.
        if (input.completed && !chore.completedAt && chore.recurrence !== "NONE" && chore.dueAt) {
          await tx.chore.create({
            data: {
              familyId: chore.familyId,
              title: chore.title,
              description: chore.description,
              assigneeId: chore.assigneeId,
              recurrence: chore.recurrence,
              points: chore.points,
              dueAt: nextDueDate(chore.dueAt, chore.recurrence),
            },
          });
        }
        return result;
      });

      if (input.completed) track(ctx.userId, "chore_completed", { familyId: ctx.familyId, points: chore.points });
      publishChange(ctx.familyId, "chores");
      return updated;
    }),
});
