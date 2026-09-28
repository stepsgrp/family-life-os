import { useTRPC } from "@flos/api-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Text } from "react-native";
import type { PurchasesPackage } from "react-native-purchases";
import { Body, Button, Card, H2, Screen } from "@/components/ui";
import { buy, getFamilyPackages, restore } from "@/lib/purchases";

export default function BillingScreen() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const status = useQuery(trpc.billing.getSubscriptionStatus.queryOptions());
  const packages = useQuery({ queryKey: ["rc-packages"], queryFn: getFamilyPackages, staleTime: Infinity });
  const [busy, setBusy] = useState<string | null>(null);

  // The RevenueCat webhook updates the API; poll it briefly so the UI flips to "active".
  const refreshStatus = async () => {
    for (let i = 0; i < 5; i++) {
      const s = await queryClient.fetchQuery({ ...trpc.billing.getSubscriptionStatus.queryOptions(), staleTime: 0 });
      if (s.entitled) return;
      await new Promise((r) => setTimeout(r, 2000));
    }
  };

  const purchase = async (pkg: PurchasesPackage) => {
    setBusy(pkg.identifier);
    try {
      if (await buy(pkg)) await refreshStatus();
    } catch (e) {
      const err = e as { userCancelled?: boolean; message?: string };
      if (!err.userCancelled) Alert.alert("Purchase failed", err.message ?? "Please try again");
    } finally {
      setBusy(null);
    }
  };

  const s = status.data;
  if (s?.entitled) {
    return (
      <Screen>
        <Card>
          <H2>Family plan ✓</H2>
          <Body muted>
            {s.source === "STRIPE" ? "Purchased on the web - manage it at familylifeos.app." : "Manage your subscription in your device's store settings."}
          </Body>
          {s.currentPeriodEnd && <Body muted>Renews {s.currentPeriodEnd.toLocaleDateString()}</Body>}
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <H2>Unlock the Family plan</H2>
      <Body muted>Unlimited members and AI, 10 GB documents. One purchase covers the whole family on every device.</Body>
      {packages.data?.map((pkg) => (
        <Card key={pkg.identifier}>
          <Body style={{ fontWeight: "600" }}>{pkg.product.title}</Body>
          <Text style={{ fontSize: 22, fontWeight: "700" }}>{pkg.product.priceString}</Text>
          <Button title="Subscribe" loading={busy === pkg.identifier} onPress={() => purchase(pkg)} />
        </Card>
      ))}
      {packages.isError && <Body muted>Store is unavailable right now.</Body>}
      <Button title="Restore purchases" variant="secondary" onPress={async () => (await restore()) && refreshStatus()} />
    </Screen>
  );
}
