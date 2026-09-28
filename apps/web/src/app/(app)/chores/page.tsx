"use client";

import { useTRPC } from "@flos/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Avatar, Button, Card, EmptyState, ErrorText, Input, Label, Modal, PageHeader, Select } from "@/components/ui";
import { useFamily } from "@/lib/hooks";

export default function ChoresPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { me, members, memberById, isParent } = useFamily();
  const [filter, setFilter] = useState<string>("");
  const [open, setOpen] = useState(false);

  const chores = useQuery(trpc.chores.list.queryOptions({ assigneeId: filter || undefined, includeCompleted: false }));
  const board = useQuery(trpc.chores.leaderboard.queryOptions());
  const invalidate = () => queryClient.invalidateQueries({ queryKey: trpc.chores.pathKey() });
  const complete = useMutation(trpc.chores.markComplete.mutationOptions({ onSuccess: invalidate }));
  const remove = useMutation(trpc.chores.delete.mutationOptions({ onSuccess: invalidate }));

  const now = new Date();

  return (
    <>
      <PageHeader
        title="Chores"
        subtitle="Finish chores to earn points - the monthly leader picks Friday's movie 🍿"
        actions={isParent && <Button onClick={() => setOpen(true)}>+ Chore</Button>}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {isParent && (
            <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="max-w-xs">
              <option value="">Everyone</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.displayName}</option>
              ))}
            </Select>
          )}
          {chores.data?.length === 0 && <EmptyState title="No open chores" hint="Nice work, everyone!" />}
          {chores.data?.map((c) => {
            const overdue = c.dueAt && c.dueAt < now;
            const canComplete = c.assigneeId === me?.id || isParent;
            return (
              <Card key={c.id} className="flex items-center gap-3 py-3">
                <input
                  type="checkbox"
                  className="size-5 accent-brand-600"
                  disabled={!canComplete}
                  onChange={() => complete.mutate({ id: c.id, completed: true })}
                />
                <div className="flex-1">
                  <p className="font-medium">{c.title}</p>
                  <p className={`text-xs ${overdue ? "text-danger" : "text-ink-500"}`}>
                    {c.dueAt ? `${overdue ? "Overdue · " : "Due "}${c.dueAt.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}` : "No due date"}
                    {c.recurrence !== "NONE" && ` · repeats ${c.recurrence.toLowerCase()}`}
                  </p>
                </div>
                <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">{c.points} pt</span>
                {c.assignee && <Avatar name={c.assignee.displayName} color={c.assignee.color} />}
                {isParent && (
                  <button onClick={() => remove.mutate({ id: c.id })} className="text-sm text-ink-500 hover:text-danger" aria-label="Delete">
                    ✕
                  </button>
                )}
              </Card>
            );
          })}
          <ErrorText error={complete.error} />
        </div>

        <Card>
          <h2 className="mb-3 font-semibold">🏆 This month</h2>
          <ol className="space-y-2">
            {(board.data ?? [])
              .sort((a, b) => b.points - a.points)
              .map((row, i) => {
                const m = memberById.get(row.memberId);
                if (!m) return null;
                return (
                  <li key={row.memberId} className="flex items-center gap-2">
                    <span className="w-5 text-sm text-ink-500">{i + 1}</span>
                    <Avatar name={m.displayName} color={m.color} size={24} />
                    <span className="flex-1">{m.displayName}</span>
                    <span className="font-semibold">{row.points}</span>
                  </li>
                );
              })}
          </ol>
        </Card>
      </div>
      {open && <ChoreModal members={members} onClose={() => setOpen(false)} onSaved={invalidate} />}
    </>
  );
}

function ChoreModal({ members, onClose, onSaved }: { members: { id: string; displayName: string }[]; onClose: () => void; onSaved: () => void }) {
  const trpc = useTRPC();
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [recurrence, setRecurrence] = useState<"NONE" | "DAILY" | "WEEKLY" | "MONTHLY">("NONE");
  const [points, setPoints] = useState(1);
  const create = useMutation(trpc.chores.create.mutationOptions({ onSuccess: () => { onSaved(); onClose(); } }));

  return (
    <Modal open onClose={onClose} title="New chore">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate({ title, assigneeId: assigneeId || undefined, dueAt: dueAt ? new Date(dueAt) : undefined, recurrence, points });
        }}
      >
        <div>
          <Label>Chore</Label>
          <Input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Unload the dishwasher" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Assign to</Label>
            <Select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.displayName}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Points</Label>
            <Input type="number" min={0} max={100} value={points} onChange={(e) => setPoints(Number(e.target.value))} />
          </div>
          <div>
            <Label>Due</Label>
            <Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
          </div>
          <div>
            <Label>Repeats</Label>
            <Select value={recurrence} onChange={(e) => setRecurrence(e.target.value as typeof recurrence)}>
              <option value="NONE">Never</option>
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
            </Select>
          </div>
        </div>
        <Button type="submit" className="w-full" loading={create.isPending}>Create chore</Button>
        <ErrorText error={create.error} />
      </form>
    </Modal>
  );
}
