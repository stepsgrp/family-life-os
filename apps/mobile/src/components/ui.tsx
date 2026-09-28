import { useMutationState } from "@tanstack/react-query";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/lib/theme";

export function Screen({ children, scroll = true, title }: { children: React.ReactNode; scroll?: boolean; title?: string }) {
  const t = useTheme();
  const body = (
    <>
      {title && <Text style={[styles.title, { color: t.colors.text }]}>{title}</Text>}
      {children}
    </>
  );
  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: t.colors.bg }}>
      <SyncBanner />
      {scroll ? <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>{body}</ScrollView> : <View style={{ flex: 1, padding: 16, gap: 12 }}>{body}</View>}
    </SafeAreaView>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const t = useTheme();
  return <View style={[styles.card, { backgroundColor: t.colors.card, borderColor: t.colors.border }, style]}>{children}</View>;
}

export function H2({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return <Text style={{ fontSize: 17, fontWeight: "600", color: t.colors.text }}>{children}</Text>;
}

export function Body({ children, muted, style }: { children: React.ReactNode; muted?: boolean; style?: object }) {
  const t = useTheme();
  return <Text style={[{ fontSize: 15, color: muted ? t.colors.muted : t.colors.text }, style]}>{children}</Text>;
}

export function Button({ title, onPress, loading, variant = "primary", disabled }: { title: string; onPress: () => void; loading?: boolean; variant?: "primary" | "secondary"; disabled?: boolean }) {
  const t = useTheme();
  const primary = variant === "primary";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: primary ? t.colors.primary : "transparent", borderColor: primary ? t.colors.primary : t.colors.border, opacity: pressed || disabled ? 0.7 : 1 },
      ]}
    >
      {loading ? <ActivityIndicator color={primary ? "#fff" : t.colors.text} /> : <Text style={{ color: primary ? "#fff" : t.colors.text, fontWeight: "600" }}>{title}</Text>}
    </Pressable>
  );
}

export function Input(props: TextInputProps) {
  const t = useTheme();
  return (
    <TextInput
      placeholderTextColor={t.colors.muted}
      {...props}
      style={[styles.input, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.card }, props.style]}
    />
  );
}

export function Dot({ color, size = 10 }: { color: string; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />;
}

/** Small banner shown while offline changes are queued or syncing. */
export function SyncBanner() {
  const pending = useMutationState({ filters: { status: "pending" }, select: (m) => m.state.isPaused });
  if (pending.length === 0) return null;
  const paused = pending.some(Boolean);
  return (
    <View style={[styles.sync, { backgroundColor: paused ? "#F59E0B" : "#4F46E5" }]}>
      {!paused && <ActivityIndicator size="small" color="#fff" />}
      <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>
        {paused ? `Offline - ${pending.length} change${pending.length > 1 ? "s" : ""} will sync` : "Syncing…"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: "700", marginBottom: 4 },
  card: { borderRadius: 16, padding: 14, borderWidth: StyleSheet.hairlineWidth, gap: 8 },
  button: { borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, alignItems: "center", borderWidth: 1 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  sync: { flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", paddingVertical: 6 },
});
