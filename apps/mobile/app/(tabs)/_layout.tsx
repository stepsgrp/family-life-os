import { Tabs } from "expo-router";
import { Text } from "react-native";
import { useTheme } from "@/lib/theme";

const icon = (emoji: string) => () => <Text style={{ fontSize: 20 }}>{emoji}</Text>;

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.colors.primary,
        tabBarStyle: { backgroundColor: t.colors.card, borderTopColor: t.colors.border },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: icon("🏠") }} />
      <Tabs.Screen name="calendar" options={{ title: "Calendar", tabBarIcon: icon("📅") }} />
      <Tabs.Screen name="grocery" options={{ title: "Grocery", tabBarIcon: icon("🛒") }} />
      <Tabs.Screen name="chores" options={{ title: "Chores", tabBarIcon: icon("🧹") }} />
      <Tabs.Screen name="more" options={{ title: "More", tabBarIcon: icon("☰") }} />
    </Tabs>
  );
}
