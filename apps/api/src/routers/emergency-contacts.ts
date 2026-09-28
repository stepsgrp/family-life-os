import { EmergencyContactInput, Id } from "@flos/types";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publishChange } from "../lib/realtime";
import { familyProcedure, parentProcedure, router } from "../trpc";

// Everyone in the family (kids included) can read emergency contacts.
export const emergencyContactsRouter = router({
  list: familyProcedure.query(({ ctx }) =>
    ctx.prisma.emergencyContact.findMany({
      where: { familyId: ctx.familyId },
      orderBy: [{ priority: "desc" }, { name: "asc" }],
    }),
  ),

  create: parentProcedure.input(EmergencyContactInput).mutation(async ({ ctx, input }) => {
    const contact = await ctx.prisma.emergencyContact.create({ data: { ...input, familyId: ctx.familyId } });
    publishChange(ctx.familyId, "emergencyContacts");
    return contact;
  }),

  update: parentProcedure
    .input(EmergencyContactInput.partial().extend({ id: Id }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const { count } = await ctx.prisma.emergencyContact.updateMany({ where: { id, familyId: ctx.familyId }, data });
      if (count === 0) throw new TRPCError({ code: "NOT_FOUND" });
      publishChange(ctx.familyId, "emergencyContacts");
      return { ok: true };
    }),

  delete: parentProcedure.input(z.object({ id: Id })).mutation(async ({ ctx, input }) => {
    await ctx.prisma.emergencyContact.deleteMany({ where: { id: input.id, familyId: ctx.familyId } });
    publishChange(ctx.familyId, "emergencyContacts");
    return { ok: true };
  }),
});
