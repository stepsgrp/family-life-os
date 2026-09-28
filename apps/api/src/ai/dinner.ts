import { prisma } from "@flos/db";
import { DinnerSuggestions } from "@flos/types";
import { z } from "zod";
import { defineTool, objectSchema, runStructuredAgent } from "./claude";
import { getCalendarTool, getMembersTool } from "./family-tools";

const SYSTEM = `You are the dinner planner inside Family Life OS, a family organizer app.
Suggest exactly 3 dinner ideas for tonight, ranked best first.

Before answering, use the tools to check:
- what is already on the grocery list (prefer meals that use it, and keep missingIngredients short),
- tonight's calendar load (a busy evening means meals of 30 minutes or less),
- meals from the past 2 weeks (don't repeat them),
- every member's dietary restrictions (never violate them).

For each suggestion, "reason" is one friendly sentence a parent would read on their phone,
naming the specific fact that drove the pick (e.g. "Soccer runs until 6:30, so this is a 20-minute meal").`;

const OUTPUT_SCHEMA = objectSchema({
  suggestions: {
    type: "array",
    items: objectSchema({
      name: { type: "string" },
      prepTimeMinutes: { type: "integer" },
      missingIngredients: { type: "array", items: { type: "string" } },
      reason: { type: "string" },
    }),
  },
});

export async function suggestDinner(familyId: string, opts: { now?: Date; timezone: string; note?: string }) {
  const now = opts.now ?? new Date();

  const tools = [
    defineTool(
      {
        name: "get_grocery_list",
        description: "Get items currently on the family grocery list (unchecked = still to buy, checked = bought).",
        input_schema: { type: "object", properties: {}, additionalProperties: false },
      },
      z.object({}),
      async () =>
        prisma.groceryItem.findMany({
          where: { familyId },
          select: { name: true, quantity: true, category: true, checked: true },
          take: 200,
        }),
    ),
    getCalendarTool(familyId),
    defineTool(
      {
        name: "get_recent_meals",
        description: "Get dinners planned or eaten in the past N days (default 14).",
        input_schema: {
          type: "object",
          properties: { days: { type: "integer", minimum: 1, maximum: 60 } },
          additionalProperties: false,
        },
      },
      z.object({ days: z.number().int().min(1).max(60).default(14) }),
      async ({ days }) => {
        const since = new Date(now.getTime() - days * 86400000);
        const meals = await prisma.mealPlanEntry.findMany({
          where: { familyId, slot: "DINNER", date: { gte: since, lte: now } },
          select: { date: true, title: true },
          orderBy: { date: "desc" },
        });
        return meals.map((m) => ({ date: m.date.toISOString().slice(0, 10), title: m.title }));
      },
    ),
    getMembersTool(familyId),
  ];

  const result = await runStructuredAgent({
    familyId,
    feature: "dinner",
    system: SYSTEM,
    tools,
    prompt: [
      `Current time: ${now.toISOString()} (family timezone: ${opts.timezone}).`,
      opts.note ? `Note from the parent: ${opts.note}` : "",
      "What should we have for dinner tonight?",
    ]
      .filter(Boolean)
      .join("\n"),
    outputSchema: OUTPUT_SCHEMA,
    parse: DinnerSuggestions,
    effort: "medium",
  });
  return result.suggestions.slice(0, 3);
}
