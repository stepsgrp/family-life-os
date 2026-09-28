"use client";

import { useTRPC } from "@flos/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button, Card, EmptyState, ErrorText, Input, Label, Modal, PageHeader, Select } from "@/components/ui";
import { useFamily } from "@/lib/hooks";

export default function RemindersPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { isParent, members } = useFamily();
  const [open, setOpen] = useState(false);
  const reminders = useQuery(trpc.reminders.list.queryOptions());
  const invalidate = () => queryClient.invalidateQueries({ queryKey: trpc.reminders.pathKey() });
  const remove = useMutation(trpc.reminders.delete.mutationOptions({ onSuccess: invalidate }));

  const groups = [
    { kind: "MEDICINE", title: "💊 Medicine" },
    { kind: "SCHOOL", title: "🎒 School" },
    { kind: "GENERAL", title: "🔔 Other" },
  ] as const;

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Reminders"
        subtitle="Push notifications go to the person and to parents' phones"
        actions={isParent && <Button onClick={() => setOpen(true)}>+ Reminder</Button>}
      />
      {reminders.data?.length === 0 && <EmptyState title="No reminders yet" hint="Add medicine schedules or school deadlines." />}
      <div className="space-y-4">
        {groups.map((g) => {
          const items = (reminders.data ?? []).filter((r) => r.kind === g.kind);
          if (!items.length) return null;
          return (
            <Card key={g.kind}>
              <h2 className="mb-2 font-semibold">{g.title}</h2>
              <ul className="divide-y divide-ink-100 dark:divide-slate-800">
                {items.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 py-2">
                    <div className="flex-1">
                      <p className="font-medium">
                        {r.title} {r.dosage && <span className="text-sm text-ink-500">· {r.dosage}</span>}
                      </p>
                      <p className="text-xs text-ink-500">
                        {r.member?.displayName ?? "Whole family"} ·{" "}
                        {r.kind === "MEDICINE" ? `daily at ${r.timesOfDay.join(", ")}` : r.remindAt?.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                      </p>
                    </div>
                    {isParent && (
                      <button className="text-sm text-ink-500 hover:text-danger" onClick={() => remove.mutate({ id: r.id })}>
                        Delete
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}
      </div>
      {open && <ReminderModal members={members} onClose={() => setOpen(false)} onSaved={invalidate} />}
    </div>
  );
}

function ReminderModal({ members, onClose, onSaved }: { members: { id: string; displayName: string }[]; onClose: () => void; onSaved: () => void }) {
  const trpc = useTRPC();
  const [kind, setKind] = useState<"MEDICINE" | "SCHOOL" | "GENERAL">("MEDICINE");
  const [title, setTitle] = useState("");
  const [memberId, setMemberId] = useState("");
  const [dosage, setDosage] = useState("");
  const [times, setTimes] = useState("08:00, 20:00");
  const [remindAt, setRemindAt] = useState("");
  const [notes, setNotes] = useState("");
  const create = useMutation(trpc.reminders.create.mutationOptions({ onSuccess: () => { onSaved(); onClose(); } }));

  return (
    <Modal open onClose={onClose} title="New reminder">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate({
            kind,
            title,
            notes: notes || undefined,
            memberId: memberId || undefined,
            dosage: kind === "MEDICINE" ? dosage || undefined : undefined,
            timesOfDay: kind === "MEDICINE" ? times.split(",").map((t) => t.trim()).filter(Boolean) : [],
            remindAt: kind !== "MEDICINE" && remindAt ? new Date(remindAt) : undefined,
          });
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Type</Label>
            <Select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
              <option value="MEDICINE">Medicine</option>
              <option value="SCHOOL">School</option>
              <option value="GENERAL">Other</option>
            </Select>
          </div>
          <div>
            <Label>For</Label>
            <Select value={memberId} onChange={(e) => setMemberId(e.target.value)}>
              <option value="">Whole family</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.displayName}</option>
              ))}
            </Select>
          </div>
        </div>
        <div>
          <Label>Title</Label>
          <Input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder={kind === "MEDICINE" ? "Amoxicillin" : "Field trip permission slip"} />
        </div>
        {kind === "MEDICINE" ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Dosage</Label>
              <Input value={dosage} onChange={(e) => setDosage(e.target.value)} placeholder="5 ml" />
            </div>
            <div>
              <Label>Times (24h, comma separated)</Label>
              <Input value={times} onChange={(e) => setTimes(e.target.value)} />
            </div>
          </div>
        ) : (
          <div>
            <Label>Remind at</Label>
            <Input required type="datetime-local" value={remindAt} onChange={(e) => setRemindAt(e.target.value)} />
          </div>
        )}
        <div>
          <Label>Notes</Label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <Button type="submit" className="w-full" loading={create.isPending}>Save reminder</Button>
        <ErrorText error={create.error} />
      </form>
    </Modal>
  );
}
