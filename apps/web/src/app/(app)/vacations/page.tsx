"use client";

import { useTRPC } from "@flos/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button, Card, EmptyState, ErrorText, Input, Label, PageHeader } from "@/components/ui";
import { useFamily } from "@/lib/hooks";

type PackingItem = { item: string; memberId?: string; packed: boolean };

export default function VacationsPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { isParent } = useFamily();
  const trips = useQuery(trpc.vacations.list.queryOptions());
  const invalidate = () => queryClient.invalidateQueries({ queryKey: trpc.vacations.pathKey() });
  const create = useMutation(trpc.vacations.create.mutationOptions({ onSuccess: invalidate }));
  const [form, setForm] = useState({ destination: "", startDate: "", endDate: "" });

  return (
    <div className="max-w-4xl">
      <PageHeader title="🏖️ Vacations" subtitle="Trips, countdowns and a shared packing list" />
      {isParent && (
        <Card className="mb-6">
          <form
            className="grid gap-3 sm:grid-cols-4"
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate(form);
              setForm({ destination: "", startDate: "", endDate: "" });
            }}
          >
            <div><Label>Destination</Label><Input required value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} /></div>
            <div><Label>From</Label><Input required type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
            <div><Label>To</Label><Input required type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div>
            <div className="flex items-end"><Button type="submit" className="w-full">Add trip</Button></div>
          </form>
          <ErrorText error={create.error} />
        </Card>
      )}
      {trips.data?.length === 0 && <EmptyState title="No trips planned" hint="Somewhere sunny, maybe?" />}
      <div className="space-y-4">
        {trips.data?.map((t) => (
          <Trip key={t.id} trip={{ ...t, packingList: (t.packingList as PackingItem[] | null) ?? [] }} onChange={invalidate} />
        ))}
      </div>
    </div>
  );
}

function Trip({ trip, onChange }: { trip: { id: string; destination: string; startDate: Date; endDate: Date; packingList: PackingItem[] }; onChange: () => void }) {
  const trpc = useTRPC();
  const [item, setItem] = useState("");
  const update = useMutation(trpc.vacations.updatePackingList.mutationOptions({ onSuccess: onChange }));
  const days = Math.ceil((trip.startDate.getTime() - Date.now()) / 86400000);
  const save = (packingList: PackingItem[]) => update.mutate({ id: trip.id, packingList });

  return (
    <Card>
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">{trip.destination}</h2>
        <span className="text-sm text-ink-500">
          {trip.startDate.toLocaleDateString(undefined, { timeZone: "UTC" })} – {trip.endDate.toLocaleDateString(undefined, { timeZone: "UTC" })}
          {days > 0 && ` · ${days} days to go`}
        </span>
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!item.trim()) return;
          save([...trip.packingList, { item: item.trim(), packed: false }]);
          setItem("");
        }}
      >
        <Input placeholder="Add to packing list" value={item} onChange={(e) => setItem(e.target.value)} />
        <Button type="submit" variant="secondary">Add</Button>
      </form>
      <ul className="mt-3 columns-2 text-sm">
        {trip.packingList.map((p, i) => (
          <li key={i} className="flex items-center gap-2 py-0.5">
            <input
              type="checkbox"
              checked={p.packed}
              onChange={() => save(trip.packingList.map((x, j) => (j === i ? { ...x, packed: !x.packed } : x)))}
            />
            <span className={p.packed ? "text-ink-500 line-through" : ""}>{p.item}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
