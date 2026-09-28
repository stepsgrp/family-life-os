"use client";

import { useTRPC } from "@flos/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, ErrorText, Input, Label } from "@/components/ui";

export default function JoinFamily() {
  const { token } = useParams<{ token: string }>();
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const preview = useQuery(trpc.family.previewInvite.queryOptions({ token }));
  const [displayName, setDisplayName] = useState("");

  const accept = useMutation(
    trpc.family.acceptInvite.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: trpc.family.me.queryKey() });
        router.replace("/dashboard");
      },
    }),
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center p-6">
      <Card className="w-full">
        {preview.isLoading ? (
          <p className="text-ink-500">Checking invite…</p>
        ) : !preview.data ? (
          <p>This invite link is invalid or has expired. Ask a parent for a new one.</p>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              accept.mutate({ token, displayName });
            }}
          >
            <h1 className="text-xl font-semibold">Join {preview.data.familyName}</h1>
            <p className="text-sm text-ink-500">You&apos;ll join as {preview.data.role.toLowerCase().replace("_", " ")}.</p>
            <div>
              <Label>Your name in the family</Label>
              <Input required value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" loading={accept.isPending}>
              Join family
            </Button>
            <ErrorText error={accept.error} />
          </form>
        )}
      </Card>
    </main>
  );
}
