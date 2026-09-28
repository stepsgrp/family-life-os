import { useAuth } from "@clerk/expo";
import { streamWeekendPlan } from "@flos/api-client";
import type { WeekendPlan } from "@flos/types";
import { fetch as expoFetch } from "expo/fetch";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Body, Button, Card, H2, Input, Screen } from "@/components/ui";
import { API_URL } from "@/lib/env";

export default function WeekendScreen() {
  const { getToken } = useAuth();
  const [note, setNote] = useState("");
  const [steps, setSteps] = useState<string[]>([]);
  const [plan, setPlan] = useState<WeekendPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const run = async () => {
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;
    setSteps([]);
    setPlan(null);
    setError(null);
    setRunning(true);
    try {
      await streamWeekendPlan({
        apiUrl: API_URL,
        getToken: () => getToken(),
        note: note || undefined,
        signal: abort.signal,
        // expo/fetch supports streaming response bodies on iOS and Android.
        fetchImpl: expoFetch as unknown as typeof fetch,
        onEvent: (e) => {
          if (e.type === "status") setSteps((s) => [...s, e.label]);
          if (e.type === "done") setPlan(e.plan);
          if (e.type === "error") setError(e.message);
        },
      });
    } catch (err) {
      if (!abort.signal.aborted) setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setRunning(false);
    }
  };

  return (
    <Screen>
      <Input placeholder="Optional: 'rainy day ideas, low budget'" value={note} onChangeText={setNote} />
      <Button title="Plan our weekend" loading={running} onPress={run} />
      {steps.map((s, i) => (
        <Body key={i} muted>✓ {s}</Body>
      ))}
      {running && !plan && (
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <ActivityIndicator />
          <Body muted>Putting it together…</Body>
        </View>
      )}
      {error && <Text style={{ color: "#DC2626" }}>{error}</Text>}
      {plan && (
        <>
          <Body>{plan.summary}</Body>
          {(["Saturday", "Sunday"] as const).map((day) => (
            <Card key={day}>
              <H2>{day}</H2>
              {plan.blocks
                .filter((b) => b.day === day)
                .map((b, i) => (
                  <View key={i} style={{ gap: 2 }}>
                    <Body muted style={{ fontSize: 12, textTransform: "uppercase" }}>{b.half}</Body>
                    <Body style={{ fontWeight: "600" }}>{b.activity}{b.place ? ` · ${b.place}` : ""}</Body>
                    <Body muted>{b.reason}</Body>
                  </View>
                ))}
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}
