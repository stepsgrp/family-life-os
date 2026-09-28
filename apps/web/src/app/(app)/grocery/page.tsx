"use client";

import { useTRPC, type RouterOutputs } from "@flos/api-client";
import { GROCERY_CATEGORIES } from "@flos/types";
import { groceryCategoryLabels } from "@flos/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button, Card, EmptyState, ErrorText, Input, PageHeader } from "@/components/ui";

type Item = RouterOutputs["grocery"]["list"][number];

export default function GroceryPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const listKey = trpc.grocery.list.queryKey();
  const items = useQuery(trpc.grocery.list.queryOptions());
  const [text, setText] = useState("");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: listKey });
  const add = useMutation(trpc.grocery.add.mutationOptions({ onSuccess: invalidate }));
  const clear = useMutation(trpc.grocery.clearChecked.mutationOptions({ onSuccess: invalidate }));
  const remove = useMutation(trpc.grocery.remove.mutationOptions({ onSuccess: invalidate }));
  const toggle = useMutation(
    trpc.grocery.toggle.mutationOptions({
      onMutate: async ({ id, checked }) => {
        await queryClient.cancelQueries({ queryKey: listKey });
        const previous = queryClient.getQueryData<Item[]>(listKey);
        queryClient.setQueryData<Item[]>(listKey, (old) => old?.map((i) => (i.id === id ? { ...i, checked } : i)));
        return { previous };
      },
      onError: (_e, _v, ctx) => ctx?.previous && queryClient.setQueryData(listKey, ctx.previous),
      onSettled: invalidate,
    }),
  );

  const open = (items.data ?? []).filter((i) => !i.checked);
  const done = (items.data ?? []).filter((i) => i.checked);
  const grouped = GROCERY_CATEGORIES.map((cat) => ({ cat, items: open.filter((i) => i.category === cat) })).filter((g) => g.items.length);

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Grocery list"
        subtitle={`${open.length} to buy · shared with the whole family`}
        actions={done.length > 0 && <Button variant="secondary" onClick={() => clear.mutate()}>Clear {done.length} checked</Button>}
      />
      <form
        className="mb-6 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          // "2 lbs chicken" -> quantity "2 lbs", name "chicken"
          const m = text.trim().match(/^([\d./]+\s*(?:x|lbs?|kg|g|oz|l|ml|dozen|pack|bags?|cans?)?)\s+(.+)$/i);
          if (!text.trim()) return;
          add.mutate(m ? { quantity: m[1]!.trim(), name: m[2]! } : { name: text.trim() });
          setText("");
        }}
      >
        <Input placeholder="Add an item, e.g. 2 lbs chicken" value={text} onChange={(e) => setText(e.target.value)} />
        <Button type="submit" loading={add.isPending}>Add</Button>
      </form>
      <ErrorText error={add.error} />

      {items.isLoading ? null : open.length === 0 && done.length === 0 ? (
        <EmptyState title="Your list is empty" hint="Add items above, or generate a list from this week's meal plan." />
      ) : (
        <div className="space-y-4">
          {grouped.map(({ cat, items }) => (
            <Card key={cat}>
              <h2 className="mb-2 text-sm font-semibold text-ink-500">{groceryCategoryLabels[cat]}</h2>
              <ul>
                {items.map((i) => (
                  <Row key={i.id} item={i} onToggle={() => toggle.mutate({ id: i.id, checked: true })} onRemove={() => remove.mutate({ id: i.id })} />
                ))}
              </ul>
            </Card>
          ))}
          {done.length > 0 && (
            <Card className="opacity-70">
              <h2 className="mb-2 text-sm font-semibold text-ink-500">In the cart</h2>
              <ul>
                {done.map((i) => (
                  <Row key={i.id} item={i} onToggle={() => toggle.mutate({ id: i.id, checked: false })} onRemove={() => remove.mutate({ id: i.id })} />
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ item, onToggle, onRemove }: { item: Item; onToggle: () => void; onRemove: () => void }) {
  return (
    <li className="group flex items-center gap-3 py-1.5">
      <input type="checkbox" checked={item.checked} onChange={onToggle} className="size-4 accent-brand-600" />
      <span className={`flex-1 ${item.checked ? "text-ink-500 line-through" : ""}`}>
        {item.name} {item.quantity && <span className="text-sm text-ink-500">· {item.quantity}</span>}
      </span>
      <button onClick={onRemove} className="text-sm text-ink-500 opacity-0 group-hover:opacity-100" aria-label="Remove">
        ✕
      </button>
    </li>
  );
}
