import { useTRPC } from "@flos/api-client";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Text } from "react-native";
import { Body, Button, Card, H2, Input, Screen } from "@/components/ui";

export default function DinnerScreen() {
  const trpc = useTRPC();
  const [note, setNote] = useState("");
  const suggest = useMutation(trpc.ai.suggestDinner.mutationOptions());
  const addGrocery = useMutation(trpc.grocery.add.mutationOptions());

  return (
    <Screen>
      <Input placeholder="Optional: 'use the leftover chicken'" value={note} onChangeText={setNote} />
      <Button title={suggest.isPending ? "Thinking…" : "Suggest dinner"} loading={suggest.isPending} onPress={() => suggest.mutate({ note: note || undefined })} />
      {suggest.error && <Text style={{ color: "#DC2626" }}>{suggest.error.message}</Text>}
      {suggest.data?.map((s, i) => (
        <Card key={s.name}>
          <Body muted style={{ fontSize: 12 }}>#{i + 1} · {s.prepTimeMinutes} min</Body>
          <H2>{s.name}</H2>
          <Body>{s.reason}</Body>
          {s.missingIngredients.length > 0 && (
            <>
              <Body muted>Need: {s.missingIngredients.join(", ")}</Body>
              <Button title="Add missing to grocery list" variant="secondary" onPress={() => s.missingIngredients.forEach((name) => addGrocery.mutate({ name }))} />
            </>
          )}
        </Card>
      ))}
    </Screen>
  );
}
