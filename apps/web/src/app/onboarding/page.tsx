"use client";

import { useTRPC } from "@flos/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, Card, ErrorText, Input, Label } from "@/components/ui";

export default function Onboarding() {
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const me = useQuery(trpc.family.me.queryOptions());
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [invite, setInvite] = useState("");

  useEffect(() => {
    if (me.data) router.replace("/dashboard");
  }, [me.data, router]);

  const create = useMutation(
    trpc.family.create.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: trpc.family.me.queryKey() });
        router.replace("/dashboard");
      },
    }),
  );

  const token = invite.trim().split("/join/").pop() ?? "";

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Welcome to Family Life OS 👋</h1>
        <p className="mt-2 text-ink-500">Start a new family, or join one you were invited to.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-semibold">Create a family</h2>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate({
                name,
                displayName,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              });
            }}
          >
            <div>
              <Label>Family name</Label>
              <Input required placeholder="The Garcias" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>Your name</Label>
              <Input required placeholder="Maria" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
            <Button type="submit" loading={create.isPending} className="w-full">
              Create family
            </Button>
            <ErrorText error={create.error} />
          </form>
        </Card>
        <Card>
          <h2 className="mb-4 font-semibold">Join with an invite</h2>
          <div className="space-y-3">
            <div>
              <Label>Invite link or code</Label>
              <Input placeholder="https://.../join/abc123" value={invite} onChange={(e) => setInvite(e.target.value)} />
            </div>
            <Button variant="secondary" className="w-full" disabled={token.length < 16} onClick={() => router.push(`/join/${token}`)}>
              Continue
            </Button>
          </div>
        </Card>
      </div>
    </main>
  );
}
