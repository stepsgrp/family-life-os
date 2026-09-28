import { prisma } from "@flos/db";
import { WeekendPlan } from "@flos/types";
import { z } from "zod";
import { searchPlaces } from "../lib/places";
import { getDailyForecast } from "../lib/weather";
import { type AgentEvent, defineTool, objectSchema, runStructuredAgent } from "./claude";
import { getCalendarTool, getMembersTool } from "./family-tools";

const SYSTEM = `You plan weekends for families inside Family Life OS.
Build a Saturday + Sunday plan split into morning / afternoon / evening blocks.

Use the tools to:
- check the calendar so you never schedule over existing commitments (turn those into blocks as-is),
- check the weather forecast (outdoor ideas only when it's dry and comfortable),
- look up each member's age and interests so every child gets something they'll enjoy,
- search for real nearby places; only name places the search returned.

Leave at least one block unscheduled or low-key per day - families need downtime.
"reason" is one short sentence per block. "summary" is two sentences max.`;

const OUTPUT_SCHEMA = objectSchema({
  summary: { type: "string" },
  blocks: {
    type: "array",
    items: objectSchema({
      day: { type: "string", enum: ["Saturday", "Sunday"] },
      half: { type: "string", enum: ["morning", "afternoon", "evening"] },
      activity: { type: "string" },
      place: { type: ["string", "null"] },
      reason: { type: "string" },
    }),
  },
});

export const WEEKEND_TOOL_LABELS: Record<string, string> = {
  get_calendar: "Checking your family calendar",
  get_weather: "Checking the weekend forecast",
  get_family_members: "Looking at everyone's ages and interests",
  search_places: "Finding places nearby",
};

/** Upcoming Saturday/Sunday as YYYY-MM-DD (today counts if it's already the weekend). */
export function upcomingWeekend(now = new Date()) {
  const day = now.getUTCDay();
  const offset = day === 6 ? 0 : day === 0 ? -1 : 6 - day;
  const sat = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offset));
  const sun = new Date(sat.getTime() + 86400000);
  return { saturday: sat.toISOString().slice(0, 10), sunday: sun.toISOString().slice(0, 10) };
}

export async function planWeekend(
  familyId: string,
  opts: { note?: string; onEvent?: (e: AgentEvent) => void; signal?: AbortSignal },
) {
  const family = await prisma.family.findUniqueOrThrow({ where: { id: familyId } });
  const { saturday, sunday } = upcomingWeekend();

  const tools = [
    getCalendarTool(familyId),
    getMembersTool(familyId),
    defineTool(
      {
        name: "get_weather",
        description: "Daily weather forecast (Celsius) for the family's home area for the upcoming weekend.",
        input_schema: { type: "object", properties: {}, additionalProperties: false },
      },
      z.object({}),
      async () => {
        if (family.homeLat == null || family.homeLng == null) return { error: "Home location not set" };
        return getDailyForecast(family.homeLat, family.homeLng, saturday, sunday);
      },
    ),
    defineTool(
      {
        name: "search_places",
        description:
          "Search for real family-friendly places or events near the family's home, e.g. 'indoor trampoline park' or 'farmers market'.",
        input_schema: {
          type: "object",
          properties: { query: { type: "string" } },
          required: ["query"],
          additionalProperties: false,
        },
      },
      z.object({ query: z.string().min(2).max(120) }),
      async ({ query }) =>
        (await searchPlaces({ query, lat: family.homeLat, lng: family.homeLng, maxResults: 5 })).map((p) => ({
          name: p.name,
          address: p.address,
          rating: p.rating,
        })),
    ),
  ];

  return runStructuredAgent({
    familyId,
    feature: "weekend",
    system: SYSTEM,
    tools,
    prompt: [
      `Plan the weekend of Saturday ${saturday} and Sunday ${sunday}. Family timezone: ${family.timezone}.`,
      opts.note ? `Parent's request: ${opts.note}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    outputSchema: OUTPUT_SCHEMA,
    parse: WeekendPlan,
    effort: "medium",
    toolLabels: WEEKEND_TOOL_LABELS,
    onEvent: opts.onEvent,
    signal: opts.signal,
  });
}
