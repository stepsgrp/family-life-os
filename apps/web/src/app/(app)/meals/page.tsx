"use client";

import { useTRPC } from "@flos/api-client";
import { GROCERY_CATEGORIES } from "@flos/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button, Card, ErrorText, Input, Label, Modal, PageHeader, Select } from "@/components/ui";
import { startOfWeek, toISODate } from "@/lib/hooks";

const SLOTS = ["BREAKFAST", "LUNCH", "DINNER"] as const;
type Slot = (typeof SLOTS)[number];

export default function MealsPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [slotEdit, setSlotEdit] = useState<{ date: string; slot: Slot } | null>(null);
  const [recipeOpen, setRecipeOpen] = useState(false);

  const weekISO = toISODate(weekStart);
  const week = useQuery(trpc.meals.week.queryOptions({ weekStart: weekISO }));
  const recipes = useQuery(trpc.meals.recipes.queryOptions());
  const invalidate = () => queryClient.invalidateQueries({ queryKey: trpc.meals.pathKey() });

  const setMeal = useMutation(trpc.meals.setMeal.mutationOptions({ onSuccess: invalidate }));
  const clearMeal = useMutation(trpc.meals.clearMeal.mutationOptions({ onSuccess: invalidate }));
  const generate = useMutation(
    trpc.meals.generateGroceryList.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries({ queryKey: trpc.grocery.pathKey() }),
    }),
  );

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
  const entryFor = (date: string, slot: Slot) =>
    week.data?.find((e) => e.date.toISOString().slice(0, 10) === date && e.slot === slot);

  const moveWeek = (n: number) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7 * n);
    setWeekStart(d);
  };

  return (
    <>
      <PageHeader
        title="Meal planner"
        subtitle={`Week of ${weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`}
        actions={
          <>
            <Button variant="secondary" onClick={() => moveWeek(-1)}>←</Button>
            <Button variant="secondary" onClick={() => moveWeek(1)}>→</Button>
            <Button variant="secondary" onClick={() => setRecipeOpen(true)}>+ Recipe</Button>
            <Button loading={generate.isPending} onClick={() => generate.mutate({ weekStart: weekISO })}>
              🛒 Generate grocery list from this week&apos;s meals
            </Button>
          </>
        }
      />
      {generate.data && (
        <p className="mb-4 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">
          Added {generate.data.added} ingredients to the grocery list
          {generate.data.skippedAlreadyOnList > 0 && ` (${generate.data.skippedAlreadyOnList} already on it)`}.
        </p>
      )}
      <ErrorText error={generate.error} />

      <div className="grid gap-3 md:grid-cols-7">
        {days.map((d) => {
          const iso = toISODate(d);
          return (
            <Card key={iso} className="p-3">
              <p className="mb-2 text-sm font-semibold">
                {d.toLocaleDateString(undefined, { weekday: "short" })} <span className="text-ink-500">{d.getDate()}</span>
              </p>
              <div className="space-y-2">
                {SLOTS.map((slot) => {
                  const entry = entryFor(iso, slot);
                  return (
                    <button
                      key={slot}
                      onClick={() => setSlotEdit({ date: iso, slot })}
                      className="block w-full rounded-lg border border-dashed border-ink-300 p-2 text-left text-xs hover:border-brand-500 dark:border-slate-700"
                    >
                      <span className="block text-[10px] uppercase tracking-wide text-ink-500">{slot.toLowerCase()}</span>
                      {entry ? <span className="font-medium">{entry.title}</span> : <span className="text-ink-300">+ add</span>}
                    </button>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>

      {slotEdit && (
        <SlotModal
          key={`${slotEdit.date}-${slotEdit.slot}`}
          slot={slotEdit}
          current={entryFor(slotEdit.date, slotEdit.slot)}
          recipes={recipes.data ?? []}
          onClose={() => setSlotEdit(null)}
          onSave={(title, recipeId) => {
            setMeal.mutate({ ...slotEdit, title, recipeId });
            setSlotEdit(null);
          }}
          onClear={(id) => {
            clearMeal.mutate({ id });
            setSlotEdit(null);
          }}
        />
      )}
      {recipeOpen && <RecipeModal onClose={() => setRecipeOpen(false)} onSaved={invalidate} />}
    </>
  );
}

function SlotModal({
  slot,
  current,
  recipes,
  onClose,
  onSave,
  onClear,
}: {
  slot: { date: string; slot: Slot };
  current?: { id: string; title: string; recipeId: string | null };
  recipes: { id: string; name: string }[];
  onClose: () => void;
  onSave: (title: string, recipeId: string | null) => void;
  onClear: (id: string) => void;
}) {
  const [recipeId, setRecipeId] = useState(current?.recipeId ?? "");
  const [title, setTitle] = useState(current?.title ?? "");
  return (
    <Modal open onClose={onClose} title={`${slot.slot.toLowerCase()} · ${slot.date}`}>
      <div className="space-y-3">
        <div>
          <Label>Recipe (its ingredients feed the grocery list)</Label>
          <Select
            value={recipeId}
            onChange={(e) => {
              setRecipeId(e.target.value);
              const r = recipes.find((x) => x.id === e.target.value);
              if (r) setTitle(r.name);
            }}
          >
            <option value="">- No recipe -</option>
            {recipes.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Meal name</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Leftovers" />
        </div>
        <div className="flex justify-between pt-2">
          {current ? <Button variant="danger" onClick={() => onClear(current.id)}>Clear</Button> : <span />}
          <Button disabled={!title} onClick={() => onSave(title, recipeId || null)}>Save</Button>
        </div>
      </div>
    </Modal>
  );
}

function RecipeModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const trpc = useTRPC();
  const [name, setName] = useState("");
  const [prep, setPrep] = useState("");
  const [ingredients, setIngredients] = useState("");
  const create = useMutation(trpc.meals.createRecipe.mutationOptions({ onSuccess: () => { onSaved(); onClose(); } }));

  return (
    <Modal open onClose={onClose} title="New recipe">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate({
            name,
            prepTimeMinutes: prep ? Number(prep) : undefined,
            // One ingredient per line: "2 cups | rice | pantry" or just "rice"
            ingredients: ingredients
              .split("\n")
              .map((l) => l.split("|").map((s) => s.trim()))
              .filter((p) => p.some(Boolean))
              .map((p) =>
                p.length >= 2
                  ? {
                      quantity: p[0] || undefined,
                      name: p[1]!,
                      category: (GROCERY_CATEGORIES as readonly string[]).includes(p[2] ?? "") ? (p[2] as (typeof GROCERY_CATEGORIES)[number]) : "other",
                    }
                  : { name: p[0]!, category: "other" as const },
              ),
            tags: [],
          });
        }}
      >
        <div>
          <Label>Name</Label>
          <Input required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label>Prep time (minutes)</Label>
          <Input type="number" min={1} value={prep} onChange={(e) => setPrep(e.target.value)} />
        </div>
        <div>
          <Label>Ingredients - one per line, optionally &quot;qty | name | category&quot;</Label>
          <textarea
            rows={6}
            value={ingredients}
            onChange={(e) => setIngredients(e.target.value)}
            className="w-full rounded-lg border border-ink-300 p-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            placeholder={"1 lb | ground beef | meat\n1 | onion | produce\ntaco shells"}
          />
        </div>
        <Button type="submit" loading={create.isPending} className="w-full">Save recipe</Button>
        <ErrorText error={create.error} />
      </form>
    </Modal>
  );
}
