import { useTRPC } from "@flos/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Pressable, SectionList, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Body, Button, Card, Dot, H2, Input, SyncBanner } from "@/components/ui";
import { useTheme } from "@/lib/theme";

// Mobile shows a 14-day agenda (better than a month grid on a phone).
export default function CalendarScreen() {
  const trpc = useTRPC();
  const t = useTheme();
  const queryClient = useQueryClient();
  const range = useMemo(() => {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    return { from, to: new Date(from.getTime() + 14 * 86400000) };
  }, []);
  const events = useQuery(trpc.calendar.list.queryOptions(range));
  const members = useQuery(trpc.family.members.queryOptions());
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState("");
  const [attendees, setAttendees] = useState<string[]>([]);

  const create = useMutation(
    trpc.calendar.create.mutationOptions({
      onSuccess: () => {
        setAdding(false);
        setTitle("");
        setWhen("");
        setAttendees([]);
        return queryClient.invalidateQueries({ queryKey: trpc.calendar.pathKey() });
      },
    }),
  );

  const colorOf = (id?: string) => members.data?.find((m) => m.id === id)?.color ?? t.colors.muted;
  const sections = useMemo(() => {
    const map = new Map<string, NonNullable<typeof events.data>>();
    for (const e of events.data ?? []) {
      const key = e.startsAt.toDateString();
      map.set(key, [...(map.get(key) ?? []), e]);
    }
    return [...map.entries()].map(([day, data]) => ({ title: day, data }));
  }, [events.data]);

  // Accepts "2026-10-03 15:30" style input; a native date picker can replace this.
  const parsed = when ? new Date(when.replace(" ", "T")) : null;

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: t.colors.bg }}>
      <SyncBanner />
      <SectionList
        contentContainerStyle={{ padding: 16, gap: 8 }}
        sections={sections}
        keyExtractor={(e) => e.id}
        refreshing={events.isRefetching}
        onRefresh={() => events.refetch()}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 8 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: 28, fontWeight: "700", color: t.colors.text }}>Calendar</Text>
              <Pressable onPress={() => setAdding(!adding)}>
                <Text style={{ color: t.colors.primary, fontWeight: "600", fontSize: 16 }}>{adding ? "Cancel" : "+ Event"}</Text>
              </Pressable>
            </View>
            {adding && (
              <Card>
                <Input placeholder="Title" value={title} onChangeText={setTitle} />
                <Input placeholder="YYYY-MM-DD HH:MM" value={when} onChangeText={setWhen} autoCapitalize="none" />
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {members.data?.map((m) => {
                    const on = attendees.includes(m.id);
                    return (
                      <Pressable
                        key={m.id}
                        onPress={() => setAttendees(on ? attendees.filter((a) => a !== m.id) : [...attendees, m.id])}
                        style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 99, borderWidth: 1.5, borderColor: on ? m.color : t.colors.border }}
                      >
                        <Dot color={m.color} />
                        <Body>{m.displayName}</Body>
                      </Pressable>
                    );
                  })}
                </View>
                <Button
                  title="Save event"
                  loading={create.isPending}
                  disabled={!title || !parsed || isNaN(parsed.getTime())}
                  onPress={() => parsed && create.mutate({ title, startsAt: parsed, endsAt: new Date(parsed.getTime() + 3600000), allDay: false, attendeeIds: attendees })}
                />
              </Card>
            )}
          </View>
        }
        renderSectionHeader={({ section }) => <H2>{section.title}</H2>}
        renderItem={({ item }) => (
          <Card style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ width: 4, alignSelf: "stretch", borderRadius: 2, backgroundColor: colorOf(item.attendeeIds[0] ?? item.createdById) }} />
            <View style={{ flex: 1 }}>
              <Body style={{ fontWeight: "600" }}>{item.title}</Body>
              <Body muted>{item.allDay ? "All day" : `${item.startsAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} – ${item.endsAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`}{item.location ? ` · ${item.location}` : ""}</Body>
            </View>
          </Card>
        )}
        ListEmptyComponent={<Body muted>No events in the next two weeks.</Body>}
      />
    </SafeAreaView>
  );
}
