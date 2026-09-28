"use client";

import { useTRPC } from "@flos/api-client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Button, Card, ErrorText, PageHeader } from "@/components/ui";
import { useFamily } from "@/lib/hooks";

export default function BillingPage() {
  return (
    <Suspense>
      <Billing />
    </Suspense>
  );
}

function Billing() {
  const trpc = useTRPC();
  const params = useSearchParams();
  const { isAdmin } = useFamily();
  const status = useQuery(trpc.billing.getSubscriptionStatus.queryOptions());
  const checkout = useMutation(trpc.billing.createCheckoutSession.mutationOptions({ onSuccess: ({ url }) => window.location.assign(url) }));
  const portal = useMutation(trpc.billing.createPortalSession.mutationOptions({ onSuccess: ({ url }) => window.location.assign(url) }));

  const s = status.data;
  const storeName = s?.source === "APP_STORE" ? "the App Store" : s?.source === "PLAY_STORE" ? "Google Play" : null;

  return (
    <div className="max-w-2xl">
      <PageHeader title="Billing" subtitle="One subscription covers every family member on every device" />
      {params.get("status") === "success" && (
        <p className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-success">Welcome to the Family plan! It can take a few seconds to activate.</p>
      )}
      <Card>
        {s?.entitled ? (
          <>
            <p className="text-lg font-semibold">Family plan ✓</p>
            <p className="text-sm text-ink-500">
              {s.status === "TRIALING" ? "Free trial" : s.status === "CANCELED" ? "Canceled - access until" : "Renews"}{" "}
              {s.currentPeriodEnd?.toLocaleDateString()}
            </p>
            {storeName ? (
              <p className="mt-3 text-sm">Manage this subscription in {storeName} on the device you purchased it from.</p>
            ) : (
              isAdmin && <Button className="mt-4" variant="secondary" loading={portal.isPending} onClick={() => portal.mutate()}>Manage subscription</Button>
            )}
          </>
        ) : (
          <>
            <p className="text-lg font-semibold">Free plan</p>
            <p className="text-sm text-ink-500">Upgrade for unlimited members, unlimited AI and 10 GB documents. 14-day free trial.</p>
            {isAdmin ? (
              <div className="mt-4 flex gap-2">
                <Button loading={checkout.isPending} onClick={() => checkout.mutate({ interval: "monthly" })}>$6.99 / month</Button>
                <Button variant="secondary" loading={checkout.isPending} onClick={() => checkout.mutate({ interval: "annual" })}>$59.99 / year (save 28%)</Button>
              </div>
            ) : (
              <p className="mt-3 text-sm">Ask the family admin to upgrade.</p>
            )}
          </>
        )}
        <ErrorText error={checkout.error ?? portal.error} />
      </Card>
    </div>
  );
}
