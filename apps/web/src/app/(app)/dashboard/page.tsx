"use client";

import { useTRPC } from "@flos/api-client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo } from "react";
import { Avatar, Card, PageHeader } from "@/components/ui";
import { useFamily } from "@/lib/hooks";

export default function Dashboard() {
  const trpc = useTRPC();
  const { me, memberById } = useFamily();

  const range = useMemo(() => {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + 1);
    return { from, to };
  }, []);

  const events = useQuery(trpc.calendar.list.queryOptions(range));
  const chores = useQuery(trpc.chores.list.queryOptions({ includeCompleted: false }));
  const grocery = useQuery(trpc.grocery.list.queryOptions());
  const reminders = useQuery(trpc.reminders.list.queryOptions());

  const myChores = (chores.data ?? []).filter((c) => c.assigneeId === me?.id);
  const toBuy = (grocery.data ?? []).filter((g) => !g.checked).length;
  const medicine = (reminders.data ?? []).filter((r) => r.kind === "MEDICINE");

  return (
    <>
      <PageHeader
        title={`Good ${new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, ${me?.displayName}`}
        subtitle={new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Today</h2>
            <Link href="/calendar" className="text-sm text-brand-600">Calendar →</Link>
          </div>
          {events.data?.length ? (
            <ul className="space-y-2">
              {events.data.map((e) => (
                <li key={e.id} className="flex items-center gap-3 rounded-lg bg-ink-100/60 px-3 py-2 dark:bg-slate-800">
                  <span className="w-20 text-sm text-ink-500">
                    {e.allDay ? "All day" : e.startsAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  </span>
                  <span className="flex-1 font-medium">{e.title}</span>
                  <span className="flex -space-x-1">
                    {e.attendeeIds.map((id) => {
                      const m = memberById.get(id);
                      return m ? <Avatar key={id} name={m.displayName} color={m.color} size={22} /> : null;
                    })}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-500">Nothing on the calendar today.</p>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold">✨ What&apos;s for dinner?</h2>
          <p className="text-sm text-ink-500">
            Get 3 ideas based on your grocery list, tonight&apos;s schedule and what you ate recently.
          </p>
          <Link href="/ai" className="mt-4 inline-block rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white">
            Suggest dinner
          </Link>
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">My chores</h2>
            <Link href="/chores" className="text-sm text-brand-600">All →</Link>
          </div>
          {myChores.length ? (
            <ul className="space-y-1 text-sm">
              {myChores.slice(0, 5).map((c) => (
                <li key={c.id} className="flex justify-between">
                  <span>{c.title}</span>
                  <span className="text-ink-500">{c.points} pt</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-500">All done 🎉</p>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold">Grocery</h2>
          <p className="text-3xl font-bold">{toBuy}</p>
          <p className="text-sm text-ink-500">items to buy</p>
          <Link href="/grocery" className="mt-3 inline-block text-sm text-brand-600">Open list →</Link>
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold">Medicine today</h2>
          {medicine.length ? (
            <ul className="space-y-1 text-sm">
              {medicine.map((r) => (
                <li key={r.id}>
                  <span className="font-medium">{r.title}</span>{" "}
                  <span className="text-ink-500">{r.member?.displayName} · {r.timesOfDay.join(", ")}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-500">No medicine schedules.</p>
          )}
        </Card>
      </div>
    </>
  );
}
