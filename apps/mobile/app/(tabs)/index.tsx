import { useTRPC } from "@flos/api-client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { useMemo } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Body, Card, Dot, H2, SyncBanner } from "@/components/ui";
import { useTheme } from "@/lib/theme";

export default function Home() {
  const trpc = useTRPC();
  const t = useTheme();
  const range = useMemo(() => {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    return { from, to: new Date(from.getTime() + 86400000) };
  }, []);

  const me = useQuery(trpc.family.me.queryOptions());
  const members = useQuery(trpc.family.members.queryOptions());
  const events = useQuery(trpc.calendar.list.queryOptions(range));
  const chores = useQuery(trpc.chores.list.queryOptions({ includeCompleted: false }));
  const grocery = useQuery(trpc.grocery.list.queryOptions());

  const colorOf = (id?: string) => members.data?.find((m) => m.id === id)?.color ?? t.colors.muted;
  const mine = chores.data?.filter((c) => c.assigneeId === me.data?.member.id) ?? [];
  const refreshing = events.isRefetching || chores.isRefetching;

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: t.colors.bg }}>
      <SyncBanner />
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void events.refetch(); void chores.refetch(); void grocery.refetch(); }} />}
      >
        <Text style={{ fontSize: 28, fontWeight: "700", color: t.colors.text }}>Hi {me.data?.member.displayName} 👋</Text>
        <Body muted>{me.data?.family.name}</Body>

        <Card>
          <H2>Today</H2>
          {events.data?.length ? (
            events.data.map((e) => (
              <View key={e.id} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Dot color={colorOf(e.attendeeIds[0] ?? e.createdById)} />
                <Body muted style={{ width: 70 }}>{e.allDay ? "All day" : e.startsAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</Body>
                <Body style={{ flex: 1 }}>{e.title}</Body>
              </View>
            ))
          ) : (
            <Body muted>Nothing scheduled today.</Body>
          )}
        </Card>

        <View style={{ flexDirection: "row", gap: 12 }}>
          <Card style={{ flex: 1 }}>
            <Body muted>My chores</Body>
            <Text style={{ fontSize: 28, fontWeight: "700", color: t.colors.text }}>{mine.length}</Text>
          </Card>
          <Card style={{ flex: 1 }}>
            <Body muted>To buy</Body>
            <Text style={{ fontSize: 28, fontWeight: "700", color: t.colors.text }}>{grocery.data?.filter((g) => !g.checked).length ?? 0}</Text>
          </Card>
        </View>

        <Link href="/ai/dinner" asChild>
          <Pressable>
            <Card style={{ backgroundColor: t.colors.primary, borderColor: t.colors.primary }}>
              <Text style={{ color: "#fff", fontSize: 17, fontWeight: "600" }}>✨ What&apos;s for dinner?</Text>
              <Text style={{ color: "#E0E7FF" }}>3 ideas from your grocery list and tonight&apos;s schedule</Text>
            </Card>
          </Pressable>
        </Link>
      </ScrollView>
    </SafeAreaView>
  );
}
