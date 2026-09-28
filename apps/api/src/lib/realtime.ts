import { familyChannel, type RealtimeDomain } from "@flos/types";
import { env } from "../env";
import { logger } from "./logger";

/**
 * Broadcast "domain changed" to every connected member of a family via Supabase
 * Realtime's REST broadcast endpoint. Payload has no family data - clients just refetch
 * through the authenticated API. Fire-and-forget: a failed broadcast only delays sync.
 *
 * Client side: packages/api-client/src/realtime.ts -> useFamilyRealtime().
 */
export function publishChange(familyId: string, domain: RealtimeDomain) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return;

  void fetch(`${env.SUPABASE_URL}/realtime/v1/api/broadcast`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      messages: [{ topic: familyChannel(familyId), event: "changed", payload: { domain } }],
    }),
  })
    .then((res) => {
      if (!res.ok) logger.warn({ status: res.status, familyId, domain }, "realtime broadcast failed");
    })
    .catch((err) => logger.warn({ err }, "realtime broadcast error"));
}
