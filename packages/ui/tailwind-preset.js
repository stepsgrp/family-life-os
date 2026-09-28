// Tailwind preset shared by apps/web (Tailwind) and apps/mobile (NativeWind).
// Keep values in sync with src/index.ts tokens.
/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        brand: { 50: "#EEF2FF", 100: "#E0E7FF", 500: "#6366F1", 600: "#4F46E5", 700: "#4338CA" },
        ink: { 900: "#0F172A", 700: "#334155", 500: "#64748B", 300: "#CBD5E1", 100: "#F1F5F9" },
        success: "#16A34A",
        warning: "#F59E0B",
        danger: "#DC2626",
      },
      borderRadius: { xl: "16px" },
    },
  },
};
