"use client";

import { useTRPC, type RouterOutputs } from "@flos/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Avatar, Button, ErrorText, Input, Label, Modal, PageHeader } from "@/components/ui";
import { startOfWeek, useFamily } from "@/lib/hooks";

type CalEvent = RouterOutputs["calendar"]["list"][number];
type View = "month" | "week";

const DAY_MS = 86400000;
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

function visibleRange(cursor: Date, view: View) {
  if (view === "week") {
    const from = startOfWeek(cursor);
    return { from, to: new Date(from.getTime() + 7 * DAY_MS), days: 7 };
  }
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const from = startOfWeek(first);
  return { from, to: new Date(from.getTime() + 42 * DAY_MS), days: 42 };
}

export default function CalendarPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { members, memberById, me } = useFamily();
  const [view, setView] = useState<View>("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [editing, setEditing] = useState<{ date: Date; event?: CalEvent } | null>(null);

  const { from, to, days } = visibleRange(cursor, view);
  const listInput = { from, to };
  const listKey = trpc.calendar.list.queryKey(listInput);
  const events = useQuery(trpc.calendar.list.queryOptions(listInput));

  // Optimistic update helper: patch the cached list, roll back on error.
  const optimistic = <TVars,>(apply: (list: CalEvent[], vars: TVars) => CalEvent[]) => ({
    onMutate: async (vars: TVars) => {
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueryData<CalEvent[]>(listKey);
      queryClient.setQueryData<CalEvent[]>(listKey, (old) => apply(old ?? [], vars));
      return { previous };
    },
    onError: (_err: unknown, _vars: TVars, context: { previous?: CalEvent[] } | undefined) => {
      if (context?.previous) queryClient.setQueryData(listKey, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: trpc.calendar.list.pathKey() }),
  });

  const create = useMutation(
    trpc.calendar.create.mutationOptions(
      optimistic((list, vars) => [
        ...list,
        {
          id: `temp-${Date.now()}`,
          familyId: "",
          title: vars.title,
          description: vars.description ?? null,
          location: vars.location ?? null,
          startsAt: new Date(vars.startsAt),
          endsAt: new Date(vars.endsAt),
          allDay: vars.allDay ?? false,
          googleEventId: null,
          createdById: me?.id ?? "",
          createdAt: new Date(),
          updatedAt: new Date(),
          attendeeIds: vars.attendeeIds ?? [],
        },
      ]),
    ),
  );
  const update = useMutation(
    trpc.calendar.update.mutationOptions(
      optimistic((list, vars) =>
        list.map((e) =>
          e.id === vars.id
            ? {
                ...e,
                ...(vars.title ? { title: vars.title } : {}),
                ...(vars.startsAt ? { startsAt: new Date(vars.startsAt) } : {}),
                ...(vars.endsAt ? { endsAt: new Date(vars.endsAt) } : {}),
                ...(vars.attendeeIds ? { attendeeIds: vars.attendeeIds } : {}),
              }
            : e,
        ),
      ),
    ),
  );
  const remove = useMutation(
    trpc.calendar.delete.mutationOptions(optimistic((list, vars) => list.filter((e) => e.id !== vars.id))),
  );

  const dayList = useMemo(() => Array.from({ length: days }, (_, i) => new Date(from.getTime() + i * DAY_MS)), [from, days]);

  /** Drag-to-reschedule: move the event to the dropped day, keeping its time and duration. */
  const onDrop = (eventId: string, day: Date) => {
    const ev = events.data?.find((e) => e.id === eventId);
    if (!ev || sameDay(ev.startsAt, day)) return;
    const start = new Date(day);
    start.setHours(ev.startsAt.getHours(), ev.startsAt.getMinutes(), 0, 0);
    const duration = ev.endsAt.getTime() - ev.startsAt.getTime();
    update.mutate({ id: ev.id, startsAt: start, endsAt: new Date(start.getTime() + duration) });
  };

  const shift = (dir: number) => {
    const next = new Date(cursor);
    if (view === "month") next.setMonth(next.getMonth() + dir);
    else next.setDate(next.getDate() + 7 * dir);
    setCursor(next);
  };

  return (
    <>
      <PageHeader
        title="Family calendar"
        subtitle={cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        actions={
          <>
            <Button variant="secondary" onClick={() => shift(-1)}>←</Button>
            <Button variant="secondary" onClick={() => setCursor(new Date())}>Today</Button>
            <Button variant="secondary" onClick={() => shift(1)}>→</Button>
            <Button variant="secondary" onClick={() => setView(view === "month" ? "week" : "month")}>
              {view === "month" ? "Week view" : "Month view"}
            </Button>
            <Button onClick={() => setEditing({ date: new Date() })}>+ Event</Button>
          </>
        }
      />

      <div className="mb-3 flex flex-wrap gap-3 text-sm">
        {members.map((m) => (
          <span key={m.id} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ background: m.color }} />
            {m.displayName}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 overflow-hidden rounded-xl bg-ink-300/40 [gap:1px] dark:bg-slate-800">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="bg-white px-2 py-1.5 text-xs font-medium text-ink-500 dark:bg-slate-900">{d}</div>
        ))}
        {dayList.map((day) => {
          const dayEvents = (events.data ?? []).filter((e) => sameDay(e.startsAt, day));
          const outside = view === "month" && day.getMonth() !== cursor.getMonth();
          return (
            <div
              key={day.toISOString()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => onDrop(e.dataTransfer.getData("text/event-id"), day)}
              onDoubleClick={() => setEditing({ date: day })}
              className={`bg-white p-1.5 dark:bg-slate-900 ${view === "week" ? "min-h-96" : "min-h-28"} ${outside ? "opacity-40" : ""}`}
            >
              <div className={`mb-1 text-xs ${sameDay(day, new Date()) ? "inline-flex size-6 items-center justify-center rounded-full bg-brand-600 text-white" : "text-ink-500"}`}>
                {day.getDate()}
              </div>
              <div className="space-y-1">
                {dayEvents.map((ev) => {
                  const owner = memberById.get(ev.attendeeIds[0] ?? ev.createdById);
                  return (
                    <button
                      key={ev.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData("text/event-id", ev.id)}
                      onClick={() => setEditing({ date: ev.startsAt, event: ev })}
                      className="block w-full truncate rounded px-1.5 py-0.5 text-left text-xs text-white"
                      style={{ background: owner?.color ?? "#64748B", opacity: ev.id.startsWith("temp-") ? 0.6 : 1 }}
                    >
                      {!ev.allDay && ev.startsAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} {ev.title}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-ink-500">Tip: drag an event to another day to reschedule. Double-click a day to add an event.</p>
      <ErrorText error={update.error ?? create.error ?? remove.error} />

      {editing && (
        <EventModal
          key={editing.event?.id ?? editing.date.toISOString()}
          initial={editing}
          members={members}
          onClose={() => setEditing(null)}
          onSave={(data) => {
            if (editing.event) update.mutate({ id: editing.event.id, ...data });
            else create.mutate(data);
            setEditing(null);
          }}
          onDelete={editing.event ? () => { remove.mutate({ id: editing.event!.id }); setEditing(null); } : undefined}
        />
      )}
    </>
  );
}

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function EventModal({
  initial,
  members,
  onClose,
  onSave,
  onDelete,
}: {
  initial: { date: Date; event?: CalEvent };
  members: { id: string; displayName: string; color: string }[];
  onClose: () => void;
  onSave: (data: { title: string; location?: string; startsAt: Date; endsAt: Date; allDay: boolean; attendeeIds: string[] }) => void;
  onDelete?: () => void;
}) {
  const defaultStart = new Date(initial.date);
  if (!initial.event) defaultStart.setHours(Math.max(new Date().getHours() + 1, 8), 0, 0, 0);
  const [title, setTitle] = useState(initial.event?.title ?? "");
  const [location, setLocation] = useState(initial.event?.location ?? "");
  const [start, setStart] = useState(toLocalInput(initial.event?.startsAt ?? defaultStart));
  const [end, setEnd] = useState(toLocalInput(initial.event?.endsAt ?? new Date(defaultStart.getTime() + 3600000)));
  const [allDay, setAllDay] = useState(initial.event?.allDay ?? false);
  const [attendees, setAttendees] = useState<string[]>(initial.event?.attendeeIds ?? []);

  return (
    <Modal open onClose={onClose} title={initial.event ? "Edit event" : "New event"}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ title, location: location || undefined, startsAt: new Date(start), endsAt: new Date(end), allDay, attendeeIds: attendees });
        }}
      >
        <div>
          <Label>Title</Label>
          <Input required autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Soccer practice" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Starts</Label>
            <Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div>
            <Label>Ends</Label>
            <Input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} /> All day
        </label>
        <div>
          <Label>Location</Label>
          <Input value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
        <div>
          <Label>Who&apos;s going?</Label>
          <div className="flex flex-wrap gap-2">
            {members.map((m) => {
              const on = attendees.includes(m.id);
              return (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => setAttendees(on ? attendees.filter((a) => a !== m.id) : [...attendees, m.id])}
                  className={`flex items-center gap-1.5 rounded-full py-1 pl-1 pr-3 text-sm ring-1 ${on ? "ring-2" : "opacity-60 ring-ink-300"}`}
                  style={on ? { boxShadow: `0 0 0 2px ${m.color}` } : undefined}
                >
                  <Avatar name={m.displayName} color={m.color} size={22} />
                  {m.displayName}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex justify-between pt-2">
          {onDelete ? <Button type="button" variant="danger" onClick={onDelete}>Delete</Button> : <span />}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit">Save</Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
