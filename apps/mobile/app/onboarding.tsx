import { useTRPC } from "@flos/api-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Text } from "react-native";
import { Body, Button, Card, H2, Input, Screen } from "@/components/ui";

export default function Onboarding() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [invite, setInvite] = useState("");
  const done = () => queryClient.invalidateQueries({ queryKey: trpc.family.me.queryKey() });

  const create = useMutation(trpc.family.create.mutationOptions({ onSuccess: done }));
  const join = useMutation(trpc.family.acceptInvite.mutationOptions({ onSuccess: done }));
  const token = invite.trim().split("/join/").pop() ?? "";

  return (
    <Screen title="Welcome 👋">
      <Body muted>Start a new family, or join one with an invite link from a parent.</Body>
      <Card>
        <H2>Your name</H2>
        <Input placeholder="Maria" value={displayName} onChangeText={setDisplayName} />
      </Card>
      <Card>
        <H2>Create a family</H2>
        <Input placeholder="The Garcias" value={name} onChangeText={setName} />
        <Button
          title="Create family"
          loading={create.isPending}
          disabled={!name || !displayName}
          onPress={() => create.mutate({ name, displayName, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone })}
        />
      </Card>
      <Card>
        <H2>Join with an invite</H2>
        <Input placeholder="Paste invite link" autoCapitalize="none" value={invite} onChangeText={setInvite} />
        <Button title="Join family" variant="secondary" loading={join.isPending} disabled={token.length < 16 || !displayName} onPress={() => join.mutate({ token, displayName })} />
      </Card>
      {(create.error ?? join.error) && <Text style={{ color: "#DC2626" }}>{(create.error ?? join.error)?.message}</Text>}
    </Screen>
  );
}
