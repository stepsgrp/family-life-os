import { colors, fontSize, radius, spacing } from "@flos/ui";
import { useColorScheme } from "react-native";

// Same tokens as the web app (packages/ui), resolved for light/dark mode.
export function useTheme() {
  const dark = useColorScheme() === "dark";
  return {
    dark,
    spacing,
    radius,
    fontSize,
    colors: {
      ...colors,
      bg: dark ? "#020617" : colors.ink[100],
      card: dark ? "#0F172A" : colors.surface.light,
      text: dark ? "#F1F5F9" : colors.ink[900],
      muted: dark ? "#94A3B8" : colors.ink[500],
      border: dark ? "#1E293B" : colors.ink[300],
      primary: colors.brand[600],
    },
  };
}
export type Theme = ReturnType<typeof useTheme>;
