"use client";

import { useAuth } from "@clerk/nextjs";
import { createApiClient, makeQueryClient, TRPCProvider } from "@flos/api-client";
import { QueryClientProvider } from "@tanstack/react-query";
import posthog from "posthog-js";
import { useEffect, useRef, useState } from "react";
import { API_URL, POSTHOG_KEY } from "@/lib/env";

export function Providers({ children }: { children: React.ReactNode }) {
  const { getToken, userId } = useAuth();
  // Keep the latest getToken without re-creating the client on every render.
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [queryClient] = useState(makeQueryClient);
  const [trpcClient] = useState(() =>
    createApiClient({
      apiUrl: API_URL,
      getToken: () => getTokenRef.current(),
      headers: { "x-client-platform": "web" },
    }),
  );

  useEffect(() => {
    if (!POSTHOG_KEY) return;
    posthog.init(POSTHOG_KEY, { api_host: "https://us.i.posthog.com", capture_pageview: "history_change" });
  }, []);
  useEffect(() => {
    if (POSTHOG_KEY && userId) posthog.identify(userId);
  }, [userId]);

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
