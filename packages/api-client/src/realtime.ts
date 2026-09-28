import { familyChannel, RealtimeDomain } from "@flos/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

/**
 * Subscribes to the family's Supabase Realtime broadcast channel and invalidates the
 * matching tRPC queries whenever another member changes something. Works identically
 * in Next.js and Expo - pass each app's own Supabase client.
 *
 * Server side: apps/api/src/lib/realtime.ts -> publishChange(familyId, domain).
 */
export function useFamilyRealtime(supabase: SupabaseClient, familyId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!familyId) return;

    const channel = supabase
      .channel(familyChannel(familyId))
      .on("broadcast", { event: "changed" }, ({ payload }) => {
        const parsed = RealtimeDomain.safeParse(payload?.domain);
        if (!parsed.success) return;
        const domain = parsed.data;
        // tRPC query keys look like [["chores","list"], {input, type}]
        void queryClient.invalidateQueries({
          predicate: (q) => Array.isArray(q.queryKey[0]) && q.queryKey[0][0] === domain,
        });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, familyId, queryClient]);
}
