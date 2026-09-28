import { AddGroceryInput, Id, ToggleGroceryInput } from "@flos/types";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { guessCategory } from "../lib/grocery-categories";
import { publishChange } from "../lib/realtime";
import { familyProcedure, router } from "../trpc";

export const groceryRouter = router({
  list: familyProcedure.query(({ ctx }) =>
    ctx.prisma.groceryItem.findMany({
      where: { familyId: ctx.familyId },
      orderBy: [{ checked: "asc" }, { category: "asc" }, { createdAt: "asc" }],
    }),
  ),

  // Every member (kids included) can add to and check off the shared list.
  add: familyProcedure.input(AddGroceryInput).mutation(async ({ ctx, input }) => {
    const item = await ctx.prisma.groceryItem.create({
      data: {
        familyId: ctx.familyId,
        name: input.name.trim(),
        quantity: input.quantity,
        category: input.category ?? guessCategory(input.name),
        addedById: ctx.member.id,
      },
    });
    publishChange(ctx.familyId, "grocery");
    return item;
  }),

  toggle: familyProcedure.input(ToggleGroceryInput).mutation(async ({ ctx, input }) => {
    const { count } = await ctx.prisma.groceryItem.updateMany({
      where: { id: input.id, familyId: ctx.familyId },
      data: { checked: input.checked },
    });
    if (count === 0) throw new TRPCError({ code: "NOT_FOUND" });
    publishChange(ctx.familyId, "grocery");
    return { id: input.id, checked: input.checked };
  }),

  remove: familyProcedure.input(z.object({ id: Id })).mutation(async ({ ctx, input }) => {
    await ctx.prisma.groceryItem.deleteMany({ where: { id: input.id, familyId: ctx.familyId } });
    publishChange(ctx.familyId, "grocery");
    return { ok: true };
  }),

  clearChecked: familyProcedure.mutation(async ({ ctx }) => {
    const { count } = await ctx.prisma.groceryItem.deleteMany({
      where: { familyId: ctx.familyId, checked: true },
    });
    publishChange(ctx.familyId, "grocery");
    return { removed: count };
  }),
});
