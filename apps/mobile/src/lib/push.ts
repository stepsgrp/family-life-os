import type { PushData } from "@flos/types";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { Platform } from "react-native";

// Show notifications while the app is in the foreground too.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Ask permission (first launch) and return this device's Expo push token. */
export async function getExpoPushToken(): Promise<string | null> {
  if (!Device.isDevice) return null; // simulators can't receive push

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Family reminders",
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  let granted = existing.granted;
  if (!granted && existing.canAskAgain) {
    granted = (await Notifications.requestPermissionsAsync()).granted;
  }
  if (!granted) return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  const { data } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
  return data;
}

/** Deep-link targets for each notification type sent by the API. */
export function routeForPush(data: Partial<PushData> | undefined) {
  switch (data?.type) {
    case "medicine_reminder":
    case "school_reminder":
      return "/reminders" as const;
    case "chore_due":
      return "/(tabs)/chores" as const;
    case "calendar_event":
      return "/(tabs)/calendar" as const;
    default:
      return null;
  }
}

/** Handle taps on notifications, including the one that cold-started the app. */
export function listenForNotificationTaps() {
  const open = (response: Notifications.NotificationResponse | null) => {
    const route = routeForPush(response?.notification.request.content.data as Partial<PushData>);
    if (route) router.push(route);
  };
  open(Notifications.getLastNotificationResponse());
  const sub = Notifications.addNotificationResponseReceivedListener(open);
  return () => sub.remove();
}
