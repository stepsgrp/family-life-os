import type { ExpoConfig } from "expo/config";

const IS_DEV = process.env.APP_VARIANT === "development";

const config: ExpoConfig = {
  name: IS_DEV ? "Family OS (Dev)" : "Family Life OS",
  slug: "family-life-os",
  scheme: "familylifeos",
  version: "1.0.0",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  ios: {
    bundleIdentifier: IS_DEV ? "com.familylifeos.app.dev" : "com.familylifeos.app",
    supportsTablet: true,
    infoPlist: { ITSAppUsesNonExemptEncryption: false },
  },
  android: {
    package: IS_DEV ? "com.familylifeos.app.dev" : "com.familylifeos.app",
    adaptiveIcon: { backgroundColor: "#4F46E5" },
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "@clerk/expo",
    ["expo-notifications", { color: "#4F46E5" }],
    ["@sentry/react-native/expo", { organization: process.env.SENTRY_ORG, project: process.env.SENTRY_PROJECT }],
  ],
  experiments: { typedRoutes: true },
  extra: {
    eas: { projectId: process.env.EAS_PROJECT_ID },
  },
};

export default config;
