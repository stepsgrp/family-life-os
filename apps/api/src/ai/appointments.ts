import { prisma } from "@flos/db";
import { AppointmentDraft } from "@flos/types";
import { z } from "zod";
import { searchPlaces } from "../lib/places";
import { defineTool, objectSchema, runStructuredAgent } from "./claude";
import { getCalendarTool, getMembersTool } from "./family-tools";

// Human-in-the-loop: Claude only researches and drafts. Nothing is sent until a
// parent approves the draft in the app (see routers/ai.ts -> approveAppointment).
const SYSTEM = `You help parents book appointments (doctor, dentist, haircut, tutor, vet, ...).
You never book or contact anyone yourself. Your job:
1. Use search_providers to find 3-5 real providers near the family that fit the request.
2. Check the family calendar for the requested period and propose 2-3 concrete time windows when
   the family member is free (and a parent could drive them).
3. Draft a short, polite booking request the parent can send by email or paste into the
   provider's contact form. Include the patient's first name, the reason, the proposed times,
   and ask the provider to confirm. Sign it with the parent's first name. No placeholders
   like [Your Name] - use the real names from get_family_members.

Pick the provider you recommend and explain briefly why for each provider.`;

const OUTPUT_SCHEMA = objectSchema({
  providers: {
    type: "array",
    items: objectSchema({
      placeId: { type: "string" },
      name: { type: "string" },
      phone: { type: ["string", "null"] },
      website: { type: ["string", "null"] },
      rating: { type: ["number", "null"] },
      whyChosen: { type: "string" },
    }),
  },
  recommendedPlaceId: { type: "string" },
  draftSubject: { type: "string" },
  draftMessage: { type: "string" },
});

export async function draftAppointment(
  familyId: string,
  opts: { request: string; requesterName: string; timezone: string },
) {
  const family = await prisma.family.findUniqueOrThrow({ where: { id: familyId } });

  const tools = [
    getMembersTool(familyId),
    getCalendarTool(familyId),
    defineTool(
      {
        name: "search_providers",
        description: "Search Google Places for providers near the family's home, e.g. 'pediatric dentist'.",
        input_schema: {
          type: "object",
          properties: { query: { type: "string" } },
          required: ["query"],
          additionalProperties: false,
        },
      },
      z.object({ query: z.string().min(2).max(120) }),
      async ({ query }) => searchPlaces({ query, lat: family.homeLat, lng: family.homeLng, maxResults: 6 }),
    ),
  ];

  const draft = await runStructuredAgent({
    familyId,
    feature: "appointment",
    system: SYSTEM,
    tools,
    prompt: [
      `Today is ${new Date().toISOString()} (timezone ${opts.timezone}).`,
      `Request from ${opts.requesterName} (parent): ${opts.request}`,
    ].join("\n"),
    outputSchema: OUTPUT_SCHEMA,
    parse: AppointmentDraft,
    effort: "high",
  });

  const recommended = draft.providers.find((p) => p.placeId === draft.recommendedPlaceId) ?? draft.providers[0];
  return prisma.appointmentRequest.create({
    data: {
      familyId,
      request: opts.request,
      candidates: draft.providers,
      providerPlaceId: recommended?.placeId,
      providerName: recommended?.name,
      providerPhone: recommended?.phone,
      draftSubject: draft.draftSubject,
      draftMessage: draft.draftMessage,
      status: "DRAFT",
    },
  });
}
