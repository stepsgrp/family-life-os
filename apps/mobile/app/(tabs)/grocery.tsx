import { useTRPC, type RouterOutputs } from "@flos/api-client";
import { GROCERY_CATEGORIES } from "@flos/types";
import { groceryCategoryLabels } from "@flos/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Pressable, SectionList, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Body, H2, Input, SyncBanner } from "@/components/ui";
import { useTheme } from "@/lib/theme";

type Item = RouterOutputs["grocery"]["list"][number];

/**
 * Offline-friendly: the list is served from the persisted cache, check-offs and adds
 * apply optimistically and queue as paused mutations until connectivity returns
 * (see src/lib/api.tsx for the persistence + resume wiring).
 */
export default function GroceryScreen() {
  const trpc = useTRPC();
  const t = useTheme();
  const queryClient = useQueryClient();
  const listKey = trpc.grocery.list.queryKey();
  const items = useQuery(trpc.grocery.list.queryOptions());
  const [text, setText] = useState("");

  const patch = (fn: (old: Item[]) => Item[]) => queryClient.setQueryData<Item[]>(listKey, (old) => fn(old ?? []));

  const toggle = useMutation(
    trpc.grocery.toggle.mutationOptions({
      onMutate: async ({ id, checked }) => {
        await queryClient.cancelQueries({ queryKey: listKey });
        patch((old) => old.map((i) => (i.id === id ? { ...i, checked } : i)));
      },
      onSettled: () => queryClient.invalidateQueries({ queryKey: listKey }),
    }),
  );

  const add = useMutation(
    trpc.grocery.add.mutationOptions({
      onMutate: async ({ name }) => {
        await queryClient.cancelQueries({ queryKey: listKey });
        const now = new Date();
        patch((old) => [
          ...old,
          { id: `temp-${now.getTime()}`, familyId: "", name, quantity: null, category: "other", checked: false, addedById: null, sourceMealId: null, createdAt: now, updatedAt: now },
        ]);
      },
      onSettled: () => queryClient.invalidateQueries({ queryKey: listKey }),
    }),
  );

  const sections = useMemo(() => {
    const open = (items.data ?? []).filter((i) => !i.checked);
    const done = (items.data ?? []).filter((i) => i.checked);
    const s = GROCERY_CATEGORIES.map((c) => ({ title: groceryCategoryLabels[c] ?? c, data: open.filter((i) => i.category === c) })).filter((x) => x.data.length);
    if (done.length) s.push({ title: "✓ In the cart", data: done });
    return s;
  }, [items.data]);

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: t.colors.bg }}>
      <SyncBanner />
      <SectionList
        contentContainerStyle={{ padding: 16 }}
        sections={sections}
        keyExtractor={(i) => i.id}
        keyboardShouldPersistTaps="handled"
        refreshing={items.isRefetching}
        onRefresh={() => items.refetch()}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 12 }}>
            <Text style={{ fontSize: 28, fontWeight: "700", color: t.colors.text }}>Grocery</Text>
            <Input
              placeholder="Add item and press return"
              value={text}
              onChangeText={setText}
              returnKeyType="done"
              onSubmitEditing={() => {
                if (text.trim()) add.mutate({ name: text.trim() });
                setText("");
              }}
            />
          </View>
        }
        renderSectionHeader={({ section }) => (
          <View style={{ paddingTop: 12, paddingBottom: 4 }}>
            <H2>{section.title}</H2>
          </View>
        )}
        renderItem={({ item }) => (
          <Pressable
            disabled={item.id.startsWith("temp-")}
            onPress={() => toggle.mutate({ id: item.id, checked: !item.checked })}
            style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: t.colors.border }}
          >
            <View
              style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: t.colors.primary, backgroundColor: item.checked ? t.colors.primary : "transparent", alignItems: "center", justifyContent: "center" }}
            >
              {item.checked && <Text style={{ color: "#fff", fontSize: 13 }}>✓</Text>}
            </View>
            <Body muted={item.checked} style={{ flex: 1, textDecorationLine: item.checked ? "line-through" : "none" }}>
              {item.name}
              {item.quantity ? ` · ${item.quantity}` : ""}
            </Body>
          </Pressable>
        )}
        ListEmptyComponent={items.isLoading ? null : <Body muted>Your list is empty.</Body>}
      />
    </SafeAreaView>
  );
}
