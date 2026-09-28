import { CreateEventInput, DateRange, Id, UpdateEventInput, isParent } from "@flos/types";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { track } from "../lib/analytics";
import { sendPushToMembers } from "../lib/push";
import { publishChange } from "../lib/realtime";
import { familyProcedure, router, writerProcedure } from "../trpc";

const include = { attendees: { select: { memberId: true } } } as const;

async function assertMembersInFamily(
  prisma: import("@flos/db").PrismaClient,
  familyId: string,
  ids: string[],
) {
  if (ids.length === 0) return;
  const count = await prisma.familyMember.count({ where: { familyId, id: { in: ids } } });
  if (count !== new Set(ids).size) throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown attendee" });
}

export const calendarRouter = router({
  list: familyProcedure.input(DateRange).query(async ({ ctx, input }) => {
    const events = await ctx.prisma.calendarEvent.findMany({
      where: {
        familyId: ctx.familyId,
        startsAt: { lt: input.to },
        endsAt: { gte: input.from },
        // Children only see events they're attending.
        ...(ctx.role === "CHILD" ? { attendees: { some: { memberId: ctx.member.id } } } : {}),
      },
      include,
      orderBy: { startsAt: "asc" },
    });
    return events.map(({ attendees, ...e }) => ({ ...e, attendeeIds: attendees.map((a) => a.memberId) }));
  }),

  create: writerProcedure.input(CreateEventInput).mutation(async ({ ctx, input }) => {
    const { attendeeIds, ...data } = input;
    await assertMembersInFamily(ctx.prisma, ctx.familyId, attendeeIds);
    const event = await ctx.prisma.calendarEvent.create({
      data: {
        ...data,
        familyId: ctx.familyId,
        createdById: ctx.member.id,
        attendees: { create: attendeeIds.map((memberId) => ({ memberId })) },
      },
    });
    publishChange(ctx.familyId, "calendar");
    track(ctx.userId, "event_created", { familyId: ctx.familyId, attendees: attendeeIds.length });
    void sendPushToMembers(
      attendeeIds.filter((id) => id !== ctx.member.id),
      {
        title: "New family event",
        body: `${event.title} - ${event.startsAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}`,
        data: { type: "calendar_event", eventId: event.id },
      },
    );
    return { ...event, attendeeIds };
  }),

  /** Also used for drag-to-reschedule (only startsAt/endsAt sent). */
  update: writerProcedure.input(UpdateEventInput).mutation(async ({ ctx, input }) => {
    const { id, attendeeIds, ...data } = input;
    const existing = await ctx.prisma.calendarEvent.findFirst({ where: { id, familyId: ctx.familyId } });
    if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
    if (ctx.role === "TEEN" && existing.createdById !== ctx.member.id) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Teens can only edit their own events" });
    }
    if (attendeeIds) await assertMembersInFamily(ctx.prisma, ctx.familyId, attendeeIds);

    const event = await ctx.prisma.calendarEvent.update({
      where: { id },
      data: {
        ...data,
        ...(attendeeIds
          ? { attendees: { deleteMany: {}, create: attendeeIds.map((memberId) => ({ memberId })) } }
          : {}),
      },
      include,
    });
    publishChange(ctx.familyId, "calendar");
    const { attendees, ...rest } = event;
    return { ...rest, attendeeIds: attendees.map((a) => a.memberId) };
  }),

  delete: writerProcedure.input(z.object({ id: Id })).mutation(async ({ ctx, input }) => {
    const existing = await ctx.prisma.calendarEvent.findFirst({ where: { id: input.id, familyId: ctx.familyId } });
    if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
    if (!isParent(ctx.role) && existing.createdById !== ctx.member.id) throw new TRPCError({ code: "FORBIDDEN" });
    await ctx.prisma.calendarEvent.delete({ where: { id: input.id } });
    publishChange(ctx.familyId, "calendar");
    return { ok: true };
  }),
});
