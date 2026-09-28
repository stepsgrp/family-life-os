// Shared design tokens. Consumed by Tailwind on web (via tailwind-preset.js) and by
// NativeWind + plain StyleSheet on mobile, so both apps use one palette and scale.

export const colors = {
  brand: {
    50: "#EEF2FF",
    100: "#E0E7FF",
    500: "#6366F1",
    600: "#4F46E5",
    700: "#4338CA",
  },
  ink: { 900: "#0F172A", 700: "#334155", 500: "#64748B", 300: "#CBD5E1", 100: "#F1F5F9" },
  surface: { light: "#FFFFFF", dark: "#0B1120" },
  success: "#16A34A",
  warning: "#F59E0B",
  danger: "#DC2626",
} as const;

// Palette offered when a member picks their calendar color.
export const memberColors = [
  "#6366F1",
  "#EC4899",
  "#F59E0B",
  "#10B981",
  "#06B6D4",
  "#8B5CF6",
  "#EF4444",
  "#84CC16",
] as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 6, md: 10, lg: 16, full: 9999 } as const;
export const fontSize = { xs: 12, sm: 14, md: 16, lg: 18, xl: 22, xxl: 28 } as const;

export const groceryCategoryLabels: Record<string, string> = {
  produce: "🥦 Produce",
  dairy: "🥛 Dairy",
  meat: "🥩 Meat & Fish",
  bakery: "🥖 Bakery",
  pantry: "🥫 Pantry",
  frozen: "🧊 Frozen",
  household: "🧻 Household",
  other: "🛒 Other",
};
