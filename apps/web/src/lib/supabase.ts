import { createClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

// Used only for Realtime broadcast subscriptions; data always goes through the API.
export const supabase = createClient(SUPABASE_URL || "http://localhost:54321", SUPABASE_ANON_KEY || "anon", {
  auth: { persistSession: false },
});
