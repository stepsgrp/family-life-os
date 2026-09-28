import { useTRPC } from "@flos/api-client";
import { useQuery } from "@tanstack/react-query";
import { Linking, Pressable } from "react-native";
import { Body, Card, H2, Screen } from "@/components/ui";
import { useTheme } from "@/lib/theme";

// Emergency contacts are persisted in the offline cache, so this works without signal.
export default function ContactsScreen() {
  const trpc = useTRPC();
  const t = useTheme();
  const contacts = useQuery(trpc.emergencyContacts.list.queryOptions());

  return (
    <Screen>
      <Pressable onPress={() => Linking.openURL("tel:911")}>
        <Card style={{ backgroundColor: t.colors.danger, borderColor: t.colors.danger }}>
          <Body style={{ color: "#fff", fontWeight: "700", fontSize: 18 }}>📞 Call 911</Body>
        </Card>
      </Pressable>
      {contacts.data?.map((c) => (
        <Pressable key={c.id} onPress={() => Linking.openURL(`tel:${c.phone}`)}>
          <Card>
            <H2>{c.name}</H2>
            <Body muted>{c.relationship}</Body>
            <Body style={{ color: t.colors.primary, fontWeight: "600" }}>📞 {c.phone}</Body>
            {c.notes && <Body>{c.notes}</Body>}
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}
