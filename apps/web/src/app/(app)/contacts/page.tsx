"use client";

import { useTRPC } from "@flos/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button, Card, EmptyState, ErrorText, Input, Label, PageHeader } from "@/components/ui";
import { useFamily } from "@/lib/hooks";

export default function ContactsPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { isParent } = useFamily();
  const contacts = useQuery(trpc.emergencyContacts.list.queryOptions());
  const invalidate = () => queryClient.invalidateQueries({ queryKey: trpc.emergencyContacts.pathKey() });
  const create = useMutation(trpc.emergencyContacts.create.mutationOptions({ onSuccess: invalidate }));
  const remove = useMutation(trpc.emergencyContacts.delete.mutationOptions({ onSuccess: invalidate }));
  const [form, setForm] = useState({ name: "", relationship: "", phone: "" });

  return (
    <div className="max-w-3xl">
      <PageHeader title="🚑 Emergency contacts" subtitle="Available to every family member, even offline on mobile" />
      <Card className="mb-4 border-l-4 border-danger">
        <p className="font-semibold">Emergency? Call <a href="tel:911" className="text-danger underline">911</a> first.</p>
      </Card>
      {contacts.data?.length === 0 && <EmptyState title="No contacts yet" hint="Add doctors, grandparents, neighbors, poison control…" />}
      <div className="grid gap-3 sm:grid-cols-2">
        {contacts.data?.map((c) => (
          <Card key={c.id}>
            <p className="font-semibold">{c.name}</p>
            <p className="text-sm text-ink-500">{c.relationship}</p>
            <a href={`tel:${c.phone}`} className="mt-2 inline-block font-medium text-brand-600">📞 {c.phone}</a>
            {c.notes && <p className="mt-1 text-sm">{c.notes}</p>}
            {isParent && (
              <button className="mt-2 block text-xs text-ink-500 hover:text-danger" onClick={() => remove.mutate({ id: c.id })}>Remove</button>
            )}
          </Card>
        ))}
      </div>
      {isParent && (
        <Card className="mt-6">
          <h2 className="mb-3 font-semibold">Add contact</h2>
          <form
            className="grid gap-3 sm:grid-cols-4"
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate({ ...form, priority: 0 });
              setForm({ name: "", relationship: "", phone: "" });
            }}
          >
            <div><Label>Name</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Relationship</Label><Input required value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value })} /></div>
            <div><Label>Phone</Label><Input required type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="flex items-end"><Button type="submit" className="w-full" loading={create.isPending}>Add</Button></div>
          </form>
          <ErrorText error={create.error} />
        </Card>
      )}
    </div>
  );
}
