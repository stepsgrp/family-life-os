import { useTRPC } from "@flos/api-client";
import { useQuery } from "@tanstack/react-query";
import { Body, Card, H2, Screen } from "@/components/ui";

export default function RemindersScreen() {
  const trpc = useTRPC();
  const reminders = useQuery(trpc.reminders.list.queryOptions());
  const label = { MEDICINE: "💊 Medicine", SCHOOL: "🎒 School", GENERAL: "🔔 Other" } as const;

  return (
    <Screen>
      {reminders.data?.length === 0 && <Body muted>No reminders. Parents can add them from the web app.</Body>}
      {reminders.data?.map((r) => (
        <Card key={r.id}>
          <Body muted style={{ fontSize: 12 }}>{label[r.kind]}</Body>
          <H2>{r.title}{r.dosage ? ` · ${r.dosage}` : ""}</H2>
          <Body muted>
            {r.member?.displayName ?? "Whole family"} ·{" "}
            {r.kind === "MEDICINE" ? `daily at ${r.timesOfDay.join(", ")}` : r.remindAt?.toLocaleString()}
          </Body>
          {r.notes && <Body>{r.notes}</Body>}
        </Card>
      ))}
    </Screen>
  );
}
