import { ClerkProvider, useAuth } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { useFamilyRealtime, useTRPC } from "@flos/api-client";
import * as Sentry from "@sentry/react-native";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { PostHogProvider } from "posthog-react-native";
import { useEffect } from "react";
import { ActivityIndicator, Platform, View } from "react-native";
import { ApiProvider } from "@/lib/api";
import { CLERK_PUBLISHABLE_KEY, POSTHOG_KEY, SENTRY_DSN } from "@/lib/env";
import { initPurchases } from "@/lib/purchases";
import { getExpoPushToken, listenForNotificationTaps } from "@/lib/push";
import { supabase } from "@/lib/supabase";

Sentry.init({
  dsn: SENTRY_DSN || undefined,
  tracesSampleRate: 0.1,
  initialScope: { tags: { service: "mobile" } },
});

function RootLayout() {
  const app = (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} tokenCache={tokenCache}>
      <ApiProvider>
        <AuthGate />
      </ApiProvider>
    </ClerkProvider>
  );
  return POSTHOG_KEY ? <PostHogProvider apiKey={POSTHOG_KEY} autocapture={{ captureScreens: false }}>{app}</PostHogProvider> : app;
}

export default Sentry.wrap(RootLayout);

/** Routes users to sign-in, onboarding, or the app - and wires up per-family services. */
function AuthGate() {
  const { isLoaded, isSignedIn } = useAuth();
  const trpc = useTRPC();
  const segments = useSegments();
  const router = useRouter();

  const me = useQuery({ ...trpc.family.me.queryOptions(), enabled: !!isSignedIn });
  const registerToken = useMutation(trpc.notifications.registerPushToken.mutationOptions());
  const familyId = me.data?.family.id;

  useFamilyRealtime(supabase, familyId);

  useEffect(() => {
    if (!isLoaded) return;
    const inAuth = segments[0] === "sign-in";
    const inOnboarding = segments[0] === "onboarding";
    if (!isSignedIn) {
      if (!inAuth) router.replace("/sign-in");
    } else if (me.isSuccess && !me.data) {
      if (!inOnboarding) router.replace("/onboarding");
    } else if (me.data && (inAuth || inOnboarding)) {
      router.replace("/(tabs)");
    }
  }, [isLoaded, isSignedIn, me.isSuccess, me.data, segments, router]);

  // Once we know the family: push token + RevenueCat identity.
  useEffect(() => {
    if (!familyId) return;
    void initPurchases(familyId);
    void getExpoPushToken().then((token) => {
      if (token) registerToken.mutate({ token, platform: Platform.OS === "ios" ? "ios" : "android" });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyId]);

  useEffect(() => listenForNotificationTaps(), []);

  if (!isLoaded || (isSignedIn && me.isLoading)) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerBackTitle: "Back" }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="ai/dinner" options={{ title: "Dinner ideas" }} />
        <Stack.Screen name="ai/weekend" options={{ title: "Weekend plan" }} />
        <Stack.Screen name="reminders" options={{ title: "Reminders" }} />
        <Stack.Screen name="contacts" options={{ title: "Emergency contacts" }} />
        <Stack.Screen name="billing" options={{ title: "Family plan", presentation: "modal" }} />
      </Stack>
    </>
  );
}
