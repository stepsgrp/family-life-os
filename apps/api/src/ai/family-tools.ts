import { prisma } from "@flos/db";
import { z } from "zod";
import { defineTool } from "./claude";

// Tools shared by several AI features. Every tool closes over familyId from the
// authenticated context - Claude can never query another family's data.

export const getMembersTool = (familyId: string) =>
  defineTool(
    {
      name: "get_family_members",
      description:
        "List the family's members with their role, age in years (if known), interests and dietary restrictions.",
      input_schema: { type: "object", properties: {}, additionalProperties: false },
    },
    z.object({}),
    async () => {
      const members = await prisma.familyMember.findMany({ where: { familyId } });
      const now = Date.now();
      return members.map((m) => ({
        id: m.id,
        name: m.displayName,
        role: m.role,
        age: m.birthDate ? Math.floor((now - m.birthDate.getTime()) / (365.25 * 86400000)) : null,
        interests: m.interests,
        dietaryRestrictions: m.dietaryRestrictions,
      }));
    },
  );

export const getCalendarTool = (familyId: string) =>
  defineTool(
    {
      name: "get_calendar",
      description:
        "Get the family's calendar events that overlap a time window. Use ISO 8601 timestamps.",
      input_schema: {
        type: "object",
        properties: {
          from: { type: "string", description: "ISO 8601 start" },
          to: { type: "string", description: "ISO 8601 end" },
        },
        required: ["from", "to"],
        additionalProperties: false,
      },
    },
    z.object({ from: z.coerce.date(), to: z.coerce.date() }),
    async ({ from, to }) => {
      const events = await prisma.calendarEvent.findMany({
        where: { familyId, startsAt: { lt: to }, endsAt: { gte: from } },
        include: { attendees: { include: { member: { select: { displayName: true } } } } },
        orderBy: { startsAt: "asc" },
        take: 50,
      });
      return events.map((e) => ({
        title: e.title,
        startsAt: e.startsAt.toISOString(),
        endsAt: e.endsAt.toISOString(),
        allDay: e.allDay,
        attendees: e.attendees.map((a) => a.member.displayName),
      }));
    },
  );
