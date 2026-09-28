import type { GROCERY_CATEGORIES } from "@flos/types";

type Category = (typeof GROCERY_CATEGORIES)[number];

// Cheap keyword categorizer for the common case; no AI call needed per item.
const KEYWORDS: Record<Exclude<Category, "other">, string[]> = {
  produce: ["apple", "banana", "lettuce", "tomato", "onion", "garlic", "potato", "carrot", "spinach", "berry", "lemon", "lime", "avocado", "pepper", "cucumber", "broccoli", "herb", "cilantro", "fruit", "vegetable"],
  dairy: ["milk", "cheese", "yogurt", "butter", "cream", "egg"],
  meat: ["chicken", "beef", "pork", "turkey", "fish", "salmon", "shrimp", "bacon", "sausage", "lamb", "tuna"],
  bakery: ["bread", "bagel", "bun", "tortilla", "croissant", "muffin", "pita"],
  pantry: ["rice", "pasta", "flour", "sugar", "oil", "salt", "sauce", "bean", "cereal", "spice", "vinegar", "honey", "oat", "can", "stock", "broth", "noodle"],
  frozen: ["frozen", "ice cream", "pizza"],
  household: ["paper", "soap", "detergent", "towel", "tissue", "trash", "foil", "wrap", "shampoo", "toothpaste", "diaper"],
};

export function guessCategory(name: string): Category {
  const n = name.toLowerCase();
  for (const [category, words] of Object.entries(KEYWORDS)) {
    if (words.some((w) => n.includes(w))) return category as Category;
  }
  return "other";
}

/** Normalize an ingredient name so "Tomatoes" and "tomato" dedupe. */
export function normalizeIngredient(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/(oes|es|s)$/, (m) => (m === "oes" ? "o" : ""));
}
