import { Id } from "@flos/types";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { draftAppointment } from "../ai/appointments";
import { AiRefusalError } from "../ai/claude";
import { suggestDinner } from "../ai/dinner";
import { planWeekend } from "../ai/weekend";
import { track } from "../lib/analytics";
import { sendEmail } from "../lib/email";
import { aiProcedure, parentProcedure, router } from "../trpc";

function mapAiError(err: unknown): never {
  if (err instanceof AiRefusalError) throw new TRPCError({ code: "BAD_REQUEST", message: err.message });
  throw err;
}

export const aiRouter = router({
  suggestDinner: aiProcedure
    .input(z.object({ note: z.string().max(300).optional() }))
    .mutation(async ({ ctx, input }) => {
      const family = await ctx.prisma.family.findUniqueOrThrow({ where: { id: ctx.familyId } });
      const suggestions = await suggestDinner(ctx.familyId, { timezone: family.timezone, note: input.note }).catch(
        mapAiError,
      );
      track(ctx.userId, "ai_dinner_suggested", { familyId: ctx.familyId });
      return suggestions;
    }),

  /** Non-streaming variant; the streaming one is POST /ai/weekend/stream (see server.ts). */
  planWeekend: aiProcedure
    .input(z.object({ note: z.string().max(300).optional() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await planWeekend(ctx.familyId, { note: input.note }).catch(mapAiError);
      track(ctx.userId, "ai_weekend_planned", { familyId: ctx.familyId });
      return plan;
    }),

  // ---------- Appointments: draft -> parent reviews/edits -> approve -> send ----------
  draftAppointment: aiProcedure
    .use(({ ctx, next }) => {
      if (ctx.role !== "ADMIN_PARENT" && ctx.role !== "PARENT") throw new TRPCError({ code: "FORBIDDEN" });
      return next();
    })
    .input(z.object({ request: z.string().min(5).max(500), forMemberId: Id.optional() }))
    .mutation(async ({ ctx, input }) => {
      const family = await ctx.prisma.family.findUniqueOrThrow({ where: { id: ctx.familyId } });
      const draft = await draftAppointment(ctx.familyId, {
        request: input.request,
        requesterName: ctx.member.displayName,
        timezone: family.timezone,
      }).catch(mapAiError);
      if (input.forMemberId) {
        await ctx.prisma.appointmentRequest.update({ where: { id: draft.id }, data: { forMemberId: input.forMemberId } });
      }
      track(ctx.userId, "ai_appointment_drafted", { familyId: ctx.familyId });
      return draft;
    }),

  appointments: parentProcedure.query(({ ctx }) =>
    ctx.prisma.appointmentRequest.findMany({
      where: { familyId: ctx.familyId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ),

  /** Parent edits before approving: pick another provider, add the email, tweak text. */
  updateAppointmentDraft: parentProcedure
    .input(
      z.object({
        id: Id,
        providerPlaceId: z.string().optional(),
        providerName: z.string().max(200).optional(),
        providerPhone: z.string().max(40).nullable().optional(),
        providerEmail: z.string().email().nullable().optional(),
        draftSubject: z.string().max(200).optional(),
        draftMessage: z.string().max(5000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const { count } = await ctx.prisma.appointmentRequest.updateMany({
        where: { id, familyId: ctx.familyId, status: "DRAFT" },
        data,
      });
      if (count === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Draft not found or already sent" });
      return ctx.prisma.appointmentRequest.findUniqueOrThrow({ where: { id } });
    }),

  /**
   * The one-tap approval. If we have the provider's email we send it (reply-to the
   * parent, so the provider answers them directly). Otherwise the app shows Call /
   * Copy message / Open website actions and the request is marked APPROVED.
   */
  approveAppointment: parentProcedure
    .input(z.object({ id: Id, parentEmail: z.string().email().optional() }))
    .mutation(async ({ ctx, input }) => {
      const appt = await ctx.prisma.appointmentRequest.findFirst({
        where: { id: input.id, familyId: ctx.familyId, status: "DRAFT" },
      });
      if (!appt) throw new TRPCError({ code: "NOT_FOUND" });

      let status: "APPROVED" | "SENT" = "APPROVED";
      if (appt.providerEmail && appt.draftMessage) {
        await sendEmail({
          to: appt.providerEmail,
          subject: appt.draftSubject ?? "Appointment request",
          text: appt.draftMessage,
          replyTo: input.parentEmail,
        });
        status = "SENT";
      }
      return ctx.prisma.appointmentRequest.update({
        where: { id: appt.id },
        data: { status, approvedById: ctx.member.id },
      });
    }),

  setAppointmentStatus: parentProcedure
    .input(z.object({ id: Id, status: z.enum(["CONFIRMED", "CANCELED"]) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.appointmentRequest.updateMany({
        where: { id: input.id, familyId: ctx.familyId },
        data: { status: input.status },
      });
      return { ok: true };
    }),
});
