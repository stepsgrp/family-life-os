import { CreateRecipeInput, Id, Ingredient, SetMealInput, WeekInput } from "@flos/types";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { guessCategory, normalizeIngredient } from "../lib/grocery-categories";
import { publishChange } from "../lib/realtime";
import { familyProcedure, router, writerProcedure } from "../trpc";

const toDate = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);

export const mealsRouter = router({
  recipes: familyProcedure.query(({ ctx }) =>
    ctx.prisma.recipe.findMany({ where: { familyId: ctx.familyId }, orderBy: { name: "asc" } }),
  ),

  createRecipe: writerProcedure.input(CreateRecipeInput).mutation(async ({ ctx, input }) => {
    const recipe = await ctx.prisma.recipe.create({ data: { ...input, familyId: ctx.familyId } });
    publishChange(ctx.familyId, "meals");
    return recipe;
  }),

  deleteRecipe: writerProcedure.input(z.object({ id: Id })).mutation(async ({ ctx, input }) => {
    await ctx.prisma.recipe.deleteMany({ where: { id: input.id, familyId: ctx.familyId } });
    publishChange(ctx.familyId, "meals");
    return { ok: true };
  }),

  week: familyProcedure.input(WeekInput).query(({ ctx, input }) => {
    const start = toDate(input.weekStart);
    return ctx.prisma.mealPlanEntry.findMany({
      where: { familyId: ctx.familyId, date: { gte: start, lt: addDays(start, 7) } },
      include: { recipe: { select: { id: true, name: true, prepTimeMinutes: true } } },
      orderBy: [{ date: "asc" }, { slot: "asc" }],
    });
  }),

  setMeal: writerProcedure.input(SetMealInput).mutation(async ({ ctx, input }) => {
    if (input.recipeId) {
      const ok = await ctx.prisma.recipe.count({ where: { id: input.recipeId, familyId: ctx.familyId } });
      if (!ok) throw new TRPCError({ code: "NOT_FOUND", message: "Recipe not found" });
    }
    const date = toDate(input.date);
    const entry = await ctx.prisma.mealPlanEntry.upsert({
      where: { familyId_date_slot: { familyId: ctx.familyId, date, slot: input.slot } },
      create: { familyId: ctx.familyId, date, slot: input.slot, recipeId: input.recipeId, title: input.title },
      update: { recipeId: input.recipeId ?? null, title: input.title },
    });
    publishChange(ctx.familyId, "meals");
    return entry;
  }),

  clearMeal: writerProcedure.input(z.object({ id: Id })).mutation(async ({ ctx, input }) => {
    await ctx.prisma.mealPlanEntry.deleteMany({ where: { id: input.id, familyId: ctx.familyId } });
    publishChange(ctx.familyId, "meals");
    return { ok: true };
  }),

  /**
   * Collect ingredients across the week's planned recipes, dedupe by normalized name,
   * skip anything already on the (unchecked) grocery list, and add the rest.
   */
  generateGroceryList: writerProcedure.input(WeekInput).mutation(async ({ ctx, input }) => {
    const start = toDate(input.weekStart);
    const entries = await ctx.prisma.mealPlanEntry.findMany({
      where: { familyId: ctx.familyId, date: { gte: start, lt: addDays(start, 7) }, recipeId: { not: null } },
      include: { recipe: true },
    });

    const merged = new Map<string, { name: string; quantities: string[]; category: string; mealId: string }>();
    for (const entry of entries) {
      const parsed = z.array(Ingredient).safeParse(entry.recipe?.ingredients);
      if (!parsed.success) continue;
      for (const ing of parsed.data) {
        const key = normalizeIngredient(ing.name);
        const existing = merged.get(key);
        if (existing) {
          if (ing.quantity) existing.quantities.push(ing.quantity);
        } else {
          merged.set(key, {
            name: ing.name,
            quantities: ing.quantity ? [ing.quantity] : [],
            category: ing.category !== "other" ? ing.category : guessCategory(ing.name),
            mealId: entry.id,
          });
        }
      }
    }

    const onList = await ctx.prisma.groceryItem.findMany({
      where: { familyId: ctx.familyId, checked: false },
      select: { name: true },
    });
    const onListKeys = new Set(onList.map((i) => normalizeIngredient(i.name)));
    const toAdd = [...merged.entries()].filter(([key]) => !onListKeys.has(key)).map(([, v]) => v);

    if (toAdd.length) {
      await ctx.prisma.groceryItem.createMany({
        data: toAdd.map((i) => ({
          familyId: ctx.familyId,
          name: i.name,
          quantity: i.quantities.length ? i.quantities.join(" + ") : null,
          category: i.category,
          addedById: ctx.member.id,
          sourceMealId: i.mealId,
        })),
      });
      publishChange(ctx.familyId, "grocery");
    }
    return { added: toAdd.length, skippedAlreadyOnList: merged.size - toAdd.length };
  }),
});
