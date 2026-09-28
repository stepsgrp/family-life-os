import { Platform } from "react-native";
import Purchases, { type PurchasesPackage } from "react-native-purchases";
import { REVENUECAT_ANDROID_KEY, REVENUECAT_IOS_KEY } from "./env";

export const ENTITLEMENT_ID = "family"; // must match the entitlement in RevenueCat + API

let configured = false;

/**
 * RevenueCat wraps StoreKit (iOS) and Play Billing (Android). We log in with the
 * familyId so a purchase by any parent unlocks the plan for the whole family,
 * and the RevenueCat webhook updates the same Subscription row Stripe does.
 */
export async function initPurchases(familyId: string) {
  const apiKey = Platform.OS === "ios" ? REVENUECAT_IOS_KEY : REVENUECAT_ANDROID_KEY;
  if (!apiKey) return;
  if (!configured) {
    Purchases.configure({ apiKey, appUserID: familyId });
    configured = true;
  } else {
    await Purchases.logIn(familyId);
  }
}

export async function getFamilyPackages(): Promise<PurchasesPackage[]> {
  const offerings = await Purchases.getOfferings();
  return offerings.current?.availablePackages ?? [];
}

export async function buy(pkg: PurchasesPackage) {
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
}

export async function restore() {
  const info = await Purchases.restorePurchases();
  return info.entitlements.active[ENTITLEMENT_ID] !== undefined;
}
