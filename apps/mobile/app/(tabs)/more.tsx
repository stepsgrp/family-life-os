import { useClerk } from "@clerk/expo";
import { useTRPC } from "@flos/api-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, type Href } from "expo-router";
import { Pressable, View } from "react-native";
import { Body, Card, Screen } from "@/components/ui";
import { useTheme } from "@/lib/theme";

const ITEMS: { href: Href; icon: string; label: string; hint: string }[] = [
  { href: "/ai/dinner", icon: "🍽️", label: "AI dinner ideas", hint: "Based on your list and schedule" },
  { href: "/ai/weekend", icon: "🗺️", label: "AI weekend planner", hint: "Weather, calendar and nearby places" },
  { href: "/reminders", icon: "💊", label: "Reminders", hint: "Medicine and school" },
  { href: "/contacts", icon: "🚑", label: "Emergency contacts", hint: "Works offline" },
  { href: "/billing", icon: "⭐", label: "Family plan", hint: "Subscription" },
];

export default function More() {
  const t = useTheme();
  const trpc = useTRPC();
  const { signOut } = useClerk();
  const queryClient = useQueryClient();
  const status = useQuery(trpc.billing.getSubscriptionStatus.queryOptions());

  return (
    <Screen title="More">
      {ITEMS.map((item) => (
        <Link key={item.label} href={item.href} asChild>
          <Pressable>
            <Card style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Body style={{ fontSize: 24 }}>{item.icon}</Body>
              <View style={{ flex: 1 }}>
                <Body style={{ fontWeight: "600" }}>{item.label}</Body>
                <Body muted style={{ fontSize: 13 }}>
                  {item.href === "/billing" ? (status.data?.entitled ? "Active ✓" : "Free plan - upgrade") : item.hint}
                </Body>
              </View>
              <Body muted>›</Body>
            </Card>
          </Pressable>
        </Link>
      ))}
      <Pressable
        onPress={async () => {
          queryClient.clear(); // don't leave one family's cached data on a shared device
          await signOut();
        }}
      >
        <Body style={{ color: t.colors.danger, textAlign: "center", marginTop: 12 }}>Sign out</Body>
      </Pressable>
    </Screen>
  );
}
