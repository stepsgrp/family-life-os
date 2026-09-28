import { aiRouter } from "./routers/ai";
import { billingRouter } from "./routers/billing";
import { calendarRouter } from "./routers/calendar";
import { choresRouter } from "./routers/chores";
import { documentsRouter } from "./routers/documents";
import { emergencyContactsRouter } from "./routers/emergency-contacts";
import { familyRouter } from "./routers/family";
import { groceryRouter } from "./routers/grocery";
import { mealsRouter } from "./routers/meals";
import { notificationsRouter } from "./routers/notifications";
import { remindersRouter } from "./routers/reminders";
import { vacationsRouter } from "./routers/vacations";
import { router } from "./trpc";

// Top-level keys double as realtime domains (see @flos/types RealtimeDomain),
// so a broadcast for "chores" invalidates every chores.* query on clients.
export const appRouter = router({
  family: familyRouter,
  calendar: calendarRouter,
  grocery: groceryRouter,
  meals: mealsRouter,
  chores: choresRouter,
  reminders: remindersRouter,
  documents: documentsRouter,
  emergencyContacts: emergencyContactsRouter,
  vacations: vacationsRouter,
  notifications: notificationsRouter,
  billing: billingRouter,
  ai: aiRouter,
});

export type AppRouter = typeof appRouter;
