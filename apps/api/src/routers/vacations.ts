import { CreateVacationInput, Id } from "@flos/types";
import { z } from "zod";
import { familyProcedure, parentProcedure, router } from "../trpc";

const PackingItem = z.object({ item: z.string().min(1).max(80), memberId: z.string().optional(), packed: z.boolean() });

export const vacationsRouter = router({
  list: familyProcedure.query(({ ctx }) =>
    ctx.prisma.vacation.findMany({ where: { familyId: ctx.familyId }, orderBy: { startDate: "asc" } }),
  ),

  create: parentProcedure.input(CreateVacationInput).mutation(({ ctx, input }) =>
    ctx.prisma.vacation.create({
      data: {
        familyId: ctx.familyId,
        destination: input.destination,
        startDate: new Date(`${input.startDate}T00:00:00Z`),
        endDate: new Date(`${input.endDate}T00:00:00Z`),
        budget: input.budget,
      },
    }),
  ),

  updatePackingList: familyProcedure
    .input(z.object({ id: Id, packingList: z.array(PackingItem).max(300) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.vacation.updateMany({
        where: { id: input.id, familyId: ctx.familyId },
        data: { packingList: input.packingList },
      });
      return { ok: true };
    }),

  delete: parentProcedure.input(z.object({ id: Id })).mutation(async ({ ctx, input }) => {
    await ctx.prisma.vacation.deleteMany({ where: { id: input.id, familyId: ctx.familyId } });
    return { ok: true };
  }),
});
