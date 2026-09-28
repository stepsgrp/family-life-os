import { useTRPC, type RouterOutputs } from "@flos/api-client";
import { isParent } from "@flos/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Body, Card, Dot, SyncBanner } from "@/components/ui";
import { useTheme } from "@/lib/theme";

type Chore = RouterOutputs["chores"]["list"][number];

// Offline-friendly like the grocery list: completions queue while offline.
export default function ChoresScreen() {
  const trpc = useTRPC();
  const t = useTheme();
  const queryClient = useQueryClient();
  const input = { includeCompleted: false };
  const listKey = trpc.chores.list.queryKey(input);
  const me = useQuery(trpc.family.me.queryOptions());
  const chores = useQuery(trpc.chores.list.queryOptions(input));
  const board = useQuery(trpc.chores.leaderboard.queryOptions());

  const complete = useMutation(
    trpc.chores.markComplete.mutationOptions({
      onMutate: async ({ id }) => {
        await queryClient.cancelQueries({ queryKey: listKey });
        queryClient.setQueryData<Chore[]>(listKey, (old) => old?.filter((c) => c.id !== id));
      },
      onSettled: () => queryClient.invalidateQueries({ queryKey: trpc.chores.pathKey() }),
    }),
  );

  const myId = me.data?.member.id;
  const parent = me.data ? isParent(me.data.member.role) : false;
  const myPoints = board.data?.find((b) => b.memberId === myId)?.points ?? 0;
  const now = new Date();

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: t.colors.bg }}>
      <SyncBanner />
      <FlatList
        contentContainerStyle={{ padding: 16, gap: 10 }}
        data={chores.data ?? []}
        keyExtractor={(c) => c.id}
        refreshing={chores.isRefetching}
        onRefresh={() => chores.refetch()}
        ListHeaderComponent={
          <View style={{ gap: 4, marginBottom: 8 }}>
            <Text style={{ fontSize: 28, fontWeight: "700", color: t.colors.text }}>Chores</Text>
            <Body muted>🏆 You have {myPoints} points this month</Body>
          </View>
        }
        renderItem={({ item }) => {
          const canComplete = item.assigneeId === myId || parent;
          const overdue = item.dueAt && item.dueAt < now;
          return (
            <Card style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Pressable
                disabled={!canComplete}
                onPress={() => complete.mutate({ id: item.id, completed: true })}
                style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: canComplete ? t.colors.primary : t.colors.border }}
                accessibilityLabel={`Complete ${item.title}`}
              />
              <View style={{ flex: 1 }}>
                <Body style={{ fontWeight: "600" }}>{item.title}</Body>
                <Body muted style={{ color: overdue ? t.colors.danger : t.colors.muted, fontSize: 13 }}>
                  {item.dueAt ? `${overdue ? "Overdue" : "Due"} ${item.dueAt.toLocaleDateString()}` : "Anytime"} · {item.points} pt
                </Body>
              </View>
              {item.assignee && <Dot color={item.assignee.color} size={12} />}
            </Card>
          );
        }}
        ListEmptyComponent={chores.isLoading ? null : <Body muted>No open chores 🎉</Body>}
      />
    </SafeAreaView>
  );
}
