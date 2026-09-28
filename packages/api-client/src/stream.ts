import { WeekendPlan } from "@flos/types";

export type WeekendStreamEvent =
  | { type: "status"; label: string }
  | { type: "delta"; text: string }
  | { type: "done"; plan: WeekendPlan }
  | { type: "error"; message: string };

interface StreamOptions {
  apiUrl: string;
  getToken: () => Promise<string | null>;
  note?: string;
  signal?: AbortSignal;
  /** Pass `fetch` from "expo/fetch" on React Native (supports streaming bodies). */
  fetchImpl?: typeof fetch;
  onEvent: (event: WeekendStreamEvent) => void;
}

/** Consume POST /ai/weekend/stream (Server-Sent Events) on web or mobile. */
export async function streamWeekendPlan(opts: StreamOptions): Promise<void> {
  const token = await opts.getToken();
  const doFetch = opts.fetchImpl ?? fetch;
  const res = await doFetch(`${opts.apiUrl.replace(/\/$/, "")}/ai/weekend/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ note: opts.note }),
    signal: opts.signal,
  });

  if (!res.ok || !res.body) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    opts.onEvent({ type: "error", message: body.error ?? `Request failed (${res.status})` });
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let split: number;
    while ((split = buffer.indexOf("\n\n")) !== -1) {
      const raw = buffer.slice(0, split);
      buffer = buffer.slice(split + 2);
      const event = raw.match(/^event: (.+)$/m)?.[1];
      const data = raw.match(/^data: (.+)$/m)?.[1];
      if (!event || !data) continue;
      const payload = JSON.parse(data);
      if (event === "status") opts.onEvent({ type: "status", label: payload.label });
      else if (event === "delta") opts.onEvent({ type: "delta", text: payload.text });
      else if (event === "done") opts.onEvent({ type: "done", plan: WeekendPlan.parse(payload.plan) });
      else if (event === "error") opts.onEvent({ type: "error", message: payload.message });
    }
  }
}
