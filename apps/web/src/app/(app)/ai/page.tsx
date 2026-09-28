"use client";

import { useAuth } from "@clerk/nextjs";
import { streamWeekendPlan, useTRPC, type RouterOutputs } from "@flos/api-client";
import type { WeekendPlan } from "@flos/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Button, Card, ErrorText, Input, Label, PageHeader, friendlyError } from "@/components/ui";
import { API_URL } from "@/lib/env";
import { useFamily } from "@/lib/hooks";

export default function AiPage() {
  const { isParent } = useFamily();
  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader title="✨ AI helpers" subtitle="Powered by Claude. Suggestions use only your family's data." />
      <DinnerCard />
      <WeekendCard />
      {isParent && <AppointmentCard />}
    </div>
  );
}

// ---------------------------------------------------------------- Dinner
function DinnerCard() {
  const trpc = useTRPC();
  const [note, setNote] = useState("");
  const suggest = useMutation(trpc.ai.suggestDinner.mutationOptions());
  const addGrocery = useMutation(trpc.grocery.add.mutationOptions());

  return (
    <Card>
      <h2 className="text-lg font-semibold">🍽️ What should we have for dinner?</h2>
      <div className="mt-3 flex gap-2">
        <Input placeholder="Optional: 'something with the leftover chicken'" value={note} onChange={(e) => setNote(e.target.value)} />
        <Button loading={suggest.isPending} onClick={() => suggest.mutate({ note: note || undefined })}>Suggest</Button>
      </div>
      <ErrorText error={suggest.error} />
      {suggest.data && (
        <ol className="mt-4 grid gap-3 md:grid-cols-3">
          {suggest.data.map((s, i) => (
            <li key={s.name} className="rounded-lg bg-ink-100/70 p-3 dark:bg-slate-800">
              <p className="text-xs text-ink-500">#{i + 1} · {s.prepTimeMinutes} min</p>
              <p className="font-semibold">{s.name}</p>
              <p className="mt-1 text-sm text-ink-700 dark:text-slate-300">{s.reason}</p>
              {s.missingIngredients.length > 0 && (
                <div className="mt-2 text-xs">
                  <p className="text-ink-500">Need: {s.missingIngredients.join(", ")}</p>
                  <button
                    className="mt-1 text-brand-600"
                    onClick={() => s.missingIngredients.forEach((name) => addGrocery.mutate({ name }))}
                  >
                    + Add to grocery list
                  </button>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------- Weekend (streamed)
function WeekendCard() {
  const { getToken } = useAuth();
  const [note, setNote] = useState("");
  const [steps, setSteps] = useState<string[]>([]);
  const [draftChars, setDraftChars] = useState(0);
  const [plan, setPlan] = useState<WeekendPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const run = async () => {
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;
    setSteps([]);
    setPlan(null);
    setError(null);
    setDraftChars(0);
    setRunning(true);
    try {
      await streamWeekendPlan({
        apiUrl: API_URL,
        getToken: () => getToken(),
        note: note || undefined,
        signal: abort.signal,
        onEvent: (e) => {
          if (e.type === "status") setSteps((s) => [...s, e.label]);
          if (e.type === "delta") setDraftChars((n) => n + e.text.length);
          if (e.type === "done") setPlan(e.plan);
          if (e.type === "error") setError(friendlyError(e.message));
        },
      });
    } catch (err) {
      if (!abort.signal.aborted) setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card>
      <h2 className="text-lg font-semibold">🗺️ Plan our weekend</h2>
      <div className="mt-3 flex gap-2">
        <Input placeholder="Optional: 'low-budget, Emma has a birthday party Saturday'" value={note} onChange={(e) => setNote(e.target.value)} />
        <Button loading={running} onClick={run}>Plan it</Button>
      </div>
      {(running || steps.length > 0) && !plan && (
        <ul className="mt-4 space-y-1 text-sm text-ink-500">
          {steps.map((s, i) => (
            <li key={i}>✓ {s}</li>
          ))}
          {running && <li className="animate-pulse">{draftChars > 0 ? `Writing your plan… (${draftChars} chars)` : "Thinking…"}</li>}
        </ul>
      )}
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      {plan && (
        <div className="mt-4">
          <p className="mb-3 text-sm">{plan.summary}</p>
          <div className="grid gap-3 md:grid-cols-2">
            {(["Saturday", "Sunday"] as const).map((day) => (
              <div key={day} className="rounded-lg bg-ink-100/70 p-3 dark:bg-slate-800">
                <p className="mb-2 font-semibold">{day}</p>
                <ul className="space-y-2">
                  {plan.blocks.filter((b) => b.day === day).map((b, i) => (
                    <li key={i} className="text-sm">
                      <span className="text-xs uppercase tracking-wide text-ink-500">{b.half}</span>
                      <p className="font-medium">{b.activity}{b.place && <span className="font-normal text-ink-500"> · {b.place}</span>}</p>
                      <p className="text-ink-500">{b.reason}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------- Appointments (human-in-the-loop)
type Appointment = RouterOutputs["ai"]["appointments"][number];

function AppointmentCard() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [request, setRequest] = useState("");
  const list = useQuery(trpc.ai.appointments.queryOptions());
  const invalidate = () => queryClient.invalidateQueries({ queryKey: trpc.ai.appointments.queryKey() });
  const draft = useMutation(trpc.ai.draftAppointment.mutationOptions({ onSuccess: invalidate }));

  return (
    <Card>
      <h2 className="text-lg font-semibold">📞 Book an appointment</h2>
      <p className="text-sm text-ink-500">Claude finds providers and drafts the request. Nothing is sent until you approve it.</p>
      <div className="mt-3 flex gap-2">
        <Input placeholder="Book a dentist appointment for Emma next week" value={request} onChange={(e) => setRequest(e.target.value)} />
        <Button loading={draft.isPending} disabled={request.length < 5} onClick={() => draft.mutate({ request })}>Draft</Button>
      </div>
      <ErrorText error={draft.error} />
      <div className="mt-4 space-y-3">
        {list.data?.map((a) => (a.status === "DRAFT" ? <ApprovalPanel key={a.id} appt={a} onDone={invalidate} /> : <SentRow key={a.id} appt={a} />))}
      </div>
    </Card>
  );
}

function ApprovalPanel({ appt, onDone }: { appt: Appointment; onDone: () => void }) {
  const trpc = useTRPC();
  const { user } = useUserEmail();
  const candidates = (appt.candidates ?? []) as { placeId: string; name: string; phone: string | null; website: string | null; whyChosen: string; rating: number | null }[];
  const [placeId, setPlaceId] = useState(appt.providerPlaceId ?? "");
  const [email, setEmail] = useState(appt.providerEmail ?? "");
  const [subject, setSubject] = useState(appt.draftSubject ?? "");
  const [message, setMessage] = useState(appt.draftMessage ?? "");
  const provider = candidates.find((c) => c.placeId === placeId);

  const save = useMutation(trpc.ai.updateAppointmentDraft.mutationOptions());
  const approve = useMutation(trpc.ai.approveAppointment.mutationOptions({ onSuccess: onDone }));
  const cancel = useMutation(trpc.ai.setAppointmentStatus.mutationOptions({ onSuccess: onDone }));

  const onApprove = async () => {
    await save.mutateAsync({
      id: appt.id,
      providerPlaceId: placeId,
      providerName: provider?.name,
      providerPhone: provider?.phone ?? null,
      providerEmail: email || null,
      draftSubject: subject,
      draftMessage: message,
    });
    approve.mutate({ id: appt.id, parentEmail: user });
  };

  return (
    <div className="rounded-xl border border-brand-100 bg-brand-50/50 p-4 dark:border-brand-700/40 dark:bg-brand-700/10">
      <p className="text-xs uppercase tracking-wide text-brand-700">Needs your approval</p>
      <p className="font-medium">{appt.request}</p>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {candidates.map((c) => (
          <label key={c.placeId} className={`cursor-pointer rounded-lg p-2 text-sm ring-1 ${placeId === c.placeId ? "bg-white ring-brand-500 dark:bg-slate-900" : "ring-ink-300"}`}>
            <input type="radio" className="mr-2" checked={placeId === c.placeId} onChange={() => setPlaceId(c.placeId)} />
            <span className="font-medium">{c.name}</span> {c.rating && <span className="text-ink-500">★ {c.rating}</span>}
            <p className="text-xs text-ink-500">{c.whyChosen}</p>
          </label>
        ))}
      </div>
      <div className="mt-3 space-y-2">
        <div>
          <Label>Provider email (optional - add it to send from the app)</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <Label>Subject</Label>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <div>
          <Label>Message</Label>
          <textarea rows={7} value={message} onChange={(e) => setMessage(e.target.value)} className="w-full rounded-lg border border-ink-300 p-2 text-sm dark:border-slate-700 dark:bg-slate-900" />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button loading={approve.isPending || save.isPending} onClick={onApprove}>
          {email ? "✓ Approve & send email" : "✓ Approve"}
        </Button>
        {provider?.phone && <a href={`tel:${provider.phone}`} className="rounded-lg px-3 py-2 text-sm ring-1 ring-ink-300">📞 Call {provider.phone}</a>}
        {provider?.website && <a href={provider.website} target="_blank" rel="noreferrer" className="rounded-lg px-3 py-2 text-sm ring-1 ring-ink-300">🌐 Website</a>}
        <Button variant="ghost" onClick={() => navigator.clipboard.writeText(message)}>Copy message</Button>
        <Button variant="ghost" onClick={() => cancel.mutate({ id: appt.id, status: "CANCELED" })}>Discard</Button>
      </div>
      <ErrorText error={approve.error ?? save.error} />
    </div>
  );
}

function SentRow({ appt }: { appt: Appointment }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-ink-100/70 px-3 py-2 text-sm dark:bg-slate-800">
      <span>{appt.request} · <span className="text-ink-500">{appt.providerName}</span></span>
      <span className="text-xs font-medium">{appt.status}</span>
    </div>
  );
}

function useUserEmail() {
  // Clerk's primary email is used as reply-to so providers answer the parent directly.
  const { sessionClaims } = useAuth();
  return { user: (sessionClaims?.email as string | undefined) ?? undefined };
}
