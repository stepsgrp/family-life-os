import { z } from "zod";

// ---------- Roles ----------
export const FamilyRole = z.enum(["ADMIN_PARENT", "PARENT", "TEEN", "CHILD"]);
export type FamilyRole = z.infer<typeof FamilyRole>;

export const PARENT_ROLES: readonly FamilyRole[] = ["ADMIN_PARENT", "PARENT"];
export const isParent = (role: FamilyRole) => PARENT_ROLES.includes(role);

// ---------- Common ----------
export const Id = z.string().min(1);
export const DateRange = z.object({ from: z.date(), to: z.date() });

// ---------- Family ----------
export const CreateFamilyInput = z.object({
  name: z.string().min(1).max(80),
  displayName: z.string().min(1).max(40),
  timezone: z.string().default("America/New_York"),
});
export const CreateInviteInput = z.object({
  role: FamilyRole.exclude(["ADMIN_PARENT"]),
  email: z.string().email().optional(),
});
export const AcceptInviteInput = z.object({
  token: z.string().min(16),
  displayName: z.string().min(1).max(40),
});
export const UpdateMemberInput = z.object({
  id: Id,
  displayName: z.string().min(1).max(40).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  birthDate: z.date().nullable().optional(),
  interests: z.array(z.string().max(40)).max(20).optional(),
  dietaryRestrictions: z.array(z.string().max(40)).max(20).optional(),
});
export const AddDependentInput = z.object({
  displayName: z.string().min(1).max(40),
  role: z.enum(["TEEN", "CHILD"]),
  birthDate: z.date().optional(),
});

// ---------- Calendar ----------
export const CreateEventInput = z
  .object({
    title: z.string().min(1).max(120),
    description: z.string().max(2000).optional(),
    location: z.string().max(200).optional(),
    startsAt: z.date(),
    endsAt: z.date(),
    allDay: z.boolean().default(false),
    attendeeIds: z.array(Id).default([]),
  })
  .refine((e) => e.endsAt >= e.startsAt, { message: "End must be after start", path: ["endsAt"] });
export const UpdateEventInput = z.object({
  id: Id,
  title: z.string().min(1).max(120).optional(),
  description: z.string().max(2000).nullable().optional(),
  location: z.string().max(200).nullable().optional(),
  startsAt: z.date().optional(),
  endsAt: z.date().optional(),
  allDay: z.boolean().optional(),
  attendeeIds: z.array(Id).optional(),
});

// ---------- Grocery ----------
export const GROCERY_CATEGORIES = [
  "produce",
  "dairy",
  "meat",
  "bakery",
  "pantry",
  "frozen",
  "household",
  "other",
] as const;
export const GroceryCategory = z.enum(GROCERY_CATEGORIES);
export const AddGroceryInput = z.object({
  name: z.string().min(1).max(80),
  quantity: z.string().max(40).optional(),
  category: GroceryCategory.optional(),
});
export const ToggleGroceryInput = z.object({ id: Id, checked: z.boolean() });

// ---------- Meals ----------
export const MealSlot = z.enum(["BREAKFAST", "LUNCH", "DINNER"]);
export const Ingredient = z.object({
  name: z.string().min(1),
  quantity: z.string().optional(),
  category: GroceryCategory.default("other"),
});
export type Ingredient = z.infer<typeof Ingredient>;
export const CreateRecipeInput = z.object({
  name: z.string().min(1).max(120),
  prepTimeMinutes: z.number().int().positive().max(600).optional(),
  ingredients: z.array(Ingredient).max(60),
  instructions: z.string().max(10000).optional(),
  tags: z.array(z.string().max(30)).max(10).default([]),
});
export const SetMealInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slot: MealSlot,
  recipeId: Id.nullable().optional(),
  title: z.string().min(1).max(120),
});
export const WeekInput = z.object({ weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

// ---------- Chores ----------
export const ChoreRecurrence = z.enum(["NONE", "DAILY", "WEEKLY", "MONTHLY"]);
export const CreateChoreInput = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(1000).optional(),
  assigneeId: Id.optional(),
  dueAt: z.date().optional(),
  recurrence: ChoreRecurrence.default("NONE"),
  points: z.number().int().min(0).max(100).default(1),
});
export const UpdateChoreInput = CreateChoreInput.partial().extend({ id: Id });
export const ListChoresInput = z.object({
  assigneeId: Id.optional(),
  includeCompleted: z.boolean().default(false),
});

// ---------- Reminders ----------
export const ReminderKind = z.enum(["SCHOOL", "MEDICINE", "GENERAL"]);
export const CreateReminderInput = z
  .object({
    kind: ReminderKind,
    title: z.string().min(1).max(120),
    notes: z.string().max(1000).optional(),
    memberId: Id.optional(),
    dosage: z.string().max(60).optional(),
    timesOfDay: z.array(z.string().regex(/^\d{2}:\d{2}$/)).max(8).default([]),
    remindAt: z.date().optional(),
  })
  .refine((r) => (r.kind === "MEDICINE" ? r.timesOfDay.length > 0 : !!r.remindAt), {
    message: "Medicine reminders need times of day; other reminders need a date/time",
  });

// ---------- Documents ----------
export const RequestUploadInput = z.object({
  name: z.string().min(1).max(200),
  mimeType: z.string().max(100),
  sizeBytes: z.number().int().positive().max(25 * 1024 * 1024),
  folder: z.string().max(40).default("General"),
  visibleTo: z.array(FamilyRole).min(1).default(["ADMIN_PARENT", "PARENT"]),
});

// ---------- Emergency contacts ----------
export const EmergencyContactInput = z.object({
  name: z.string().min(1).max(80),
  relationship: z.string().min(1).max(60),
  phone: z.string().min(3).max(30),
  email: z.string().email().optional(),
  notes: z.string().max(500).optional(),
  priority: z.number().int().min(0).max(100).default(0),
});

// ---------- Vacations ----------
export const CreateVacationInput = z.object({
  destination: z.string().min(1).max(120),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  budget: z.number().int().positive().optional(),
});

// ---------- AI outputs (shared so clients can render them type-safely) ----------
export const DinnerSuggestion = z.object({
  name: z.string(),
  prepTimeMinutes: z.number(),
  missingIngredients: z.array(z.string()),
  reason: z.string(),
});
export const DinnerSuggestions = z.object({ suggestions: z.array(DinnerSuggestion) });
export type DinnerSuggestion = z.infer<typeof DinnerSuggestion>;

export const WeekendBlock = z.object({
  day: z.enum(["Saturday", "Sunday"]),
  half: z.enum(["morning", "afternoon", "evening"]),
  activity: z.string(),
  place: z.string().nullable(),
  reason: z.string(),
});
export const WeekendPlan = z.object({ summary: z.string(), blocks: z.array(WeekendBlock) });
export type WeekendPlan = z.infer<typeof WeekendPlan>;

export const AppointmentDraft = z.object({
  providers: z.array(
    z.object({
      placeId: z.string(),
      name: z.string(),
      phone: z.string().nullable(),
      website: z.string().nullable(),
      rating: z.number().nullable(),
      whyChosen: z.string(),
    }),
  ),
  recommendedPlaceId: z.string(),
  draftSubject: z.string(),
  draftMessage: z.string(),
});
export type AppointmentDraft = z.infer<typeof AppointmentDraft>;

// ---------- Realtime ----------
// Realtime messages never carry family data - only "this domain changed, refetch".
// That keeps the broadcast channel safe even if a channel name leaks.
export const RealtimeDomain = z.enum([
  "calendar",
  "grocery",
  "meals",
  "chores",
  "reminders",
  "documents",
  "emergencyContacts",
  "family",
]);
export type RealtimeDomain = z.infer<typeof RealtimeDomain>;
export const familyChannel = (familyId: string) => `family:${familyId}`;

// ---------- Push notification payloads (deep-link targets) ----------
export type PushData =
  | { type: "medicine_reminder"; reminderId: string }
  | { type: "school_reminder"; reminderId: string }
  | { type: "chore_due"; choreId: string }
  | { type: "calendar_event"; eventId: string };

// ---------- Plans ----------
export const FREE_LIMITS = {
  members: 4,
  aiRequestsPerMonth: 10,
  documentStorageMb: 100,
} as const;
