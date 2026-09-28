"use client";

import { useTRPC } from "@flos/api-client";
import { memberColors } from "@flos/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { Avatar, Button, Card, ErrorText, Input, Label, PageHeader, Select } from "@/components/ui";
import { useFamily } from "@/lib/hooks";

export default function SettingsPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { members, me, isParent, isAdmin, family } = useFamily();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: trpc.family.pathKey() });

  const [inviteRole, setInviteRole] = useState<"PARENT" | "TEEN" | "CHILD">("PARENT");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [kidName, setKidName] = useState("");

  const invite = useMutation(
    trpc.family.createInvite.mutationOptions({ onSuccess: (r) => setInviteLink(`${window.location.origin}${r.path}`) }),
  );
  const addKid = useMutation(trpc.family.addDependent.mutationOptions({ onSuccess: () => { setKidName(""); invalidate(); } }));
  const updateMember = useMutation(trpc.family.updateMember.mutationOptions({ onSuccess: invalidate }));
  const removeMember = useMutation(trpc.family.removeMember.mutationOptions({ onSuccess: invalidate }));
  const updateFamily = useMutation(trpc.family.updateSettings.mutationOptions({ onSuccess: invalidate }));

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Family settings"
        subtitle={family?.name}
        actions={isAdmin && <Link href="/settings/billing" className="rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white">Billing</Link>}
      />

      <Card>
        <h2 className="mb-3 font-semibold">Members</h2>
        <ul className="divide-y divide-ink-100 dark:divide-slate-800">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-3 py-2">
              <Avatar name={m.displayName} color={m.color} />
              <div className="flex-1">
                <p className="font-medium">{m.displayName} {m.id === me?.id && <span className="text-xs text-ink-500">(you)</span>}</p>
                <p className="text-xs text-ink-500">{m.role.replace("_", " ").toLowerCase()}{!m.clerkUserId && " · no login"}</p>
              </div>
              {(isParent || m.id === me?.id) && (
                <div className="flex gap-1">
                  {memberColors.map((c) => (
                    <button
                      key={c}
                      aria-label={`Color ${c}`}
                      onClick={() => updateMember.mutate({ id: m.id, color: c })}
                      className={`size-4 rounded-full ${m.color === c ? "ring-2 ring-offset-1" : ""}`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              )}
              {isAdmin && m.id !== me?.id && (
                <button className="text-xs text-ink-500 hover:text-danger" onClick={() => confirm(`Remove ${m.displayName}?`) && removeMember.mutate({ id: m.id })}>
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      </Card>

      {isParent && (
        <Card>
          <h2 className="mb-3 font-semibold">Invite someone</h2>
          <div className="flex gap-2">
            <Select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as typeof inviteRole)} className="w-40">
              <option value="PARENT">Parent</option>
              <option value="TEEN">Teen</option>
              <option value="CHILD">Child</option>
            </Select>
            <Button loading={invite.isPending} onClick={() => invite.mutate({ role: inviteRole })}>Create invite link</Button>
          </div>
          {inviteLink && (
            <div className="mt-3 flex gap-2">
              <Input readOnly value={inviteLink} />
              <Button variant="secondary" onClick={() => navigator.clipboard.writeText(inviteLink)}>Copy</Button>
            </div>
          )}
          <p className="mt-2 text-xs text-ink-500">Links work once and expire in 7 days.</p>
          <ErrorText error={invite.error} />

          <h3 className="mb-2 mt-6 text-sm font-semibold">Add a child without a login</h3>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); addKid.mutate({ displayName: kidName, role: "CHILD" }); }}>
            <Input required placeholder="Name" value={kidName} onChange={(e) => setKidName(e.target.value)} />
            <Button type="submit" variant="secondary" loading={addKid.isPending}>Add</Button>
          </form>
          <ErrorText error={addKid.error} />
        </Card>
      )}

      {isAdmin && family && (
        <Card>
          <h2 className="mb-3 font-semibold">Home location</h2>
          <p className="mb-3 text-sm text-ink-500">Used by AI weekend plans and appointment search for nearby places and weather.</p>
          <Button
            variant="secondary"
            onClick={() =>
              navigator.geolocation.getCurrentPosition((pos) =>
                updateFamily.mutate({ homeLat: pos.coords.latitude, homeLng: pos.coords.longitude }),
              )
            }
          >
            📍 Use my current location
          </Button>
          {family.homeLat != null && <p className="mt-2 text-xs text-ink-500">Set ({family.homeLat.toFixed(3)}, {family.homeLng?.toFixed(3)})</p>}
          <div className="mt-4">
            <Label>Timezone</Label>
            <Input defaultValue={family.timezone} onBlur={(e) => e.target.value !== family.timezone && updateFamily.mutate({ timezone: e.target.value })} />
          </div>
        </Card>
      )}
    </div>
  );
}
