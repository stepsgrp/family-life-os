import { useAuth } from "@clerk/expo";
import { createApiClient, makeQueryClient, TRPCProvider, type AppRouter } from "@flos/api-client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { onlineManager, type QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import type { TRPCClient } from "@trpc/client";
import { useRef, useState } from "react";
import { Platform } from "react-native";
import { API_URL } from "./env";

// TanStack Query follows the device's real connectivity.
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => setOnline(!!state.isConnected && state.isInternetReachable !== false)),
);

const persister = createAsyncStoragePersister({ storage: AsyncStorage, key: "flos-query-cache" });

/**
 * Offline mutations are persisted to disk, but functions can't be serialized - so we
 * register a default mutationFn per mutation key. That lets mutations queued offline
 * (check off grocery item, complete chore) resume even after the app was killed.
 */
function registerOfflineMutations(queryClient: QueryClient, client: TRPCClient<AppRouter>) {
  const trpc = createTRPCOptionsProxy<AppRouter>({ client, queryClient });
  queryClient.setMutationDefaults(trpc.grocery.toggle.mutationKey(), {
    mutationFn: (input: { id: string; checked: boolean }) => client.grocery.toggle.mutate(input),
  });
  queryClient.setMutationDefaults(trpc.grocery.add.mutationKey(), {
    mutationFn: (input: { name: string; quantity?: string }) => client.grocery.add.mutate(input),
  });
  queryClient.setMutationDefaults(trpc.chores.markComplete.mutationKey(), {
    mutationFn: (input: { id: string; completed: boolean }) => client.chores.markComplete.mutate(input),
  });
}

export function ApiProvider({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [trpcClient] = useState(() =>
    createApiClient({
      apiUrl: API_URL,
      getToken: () => getTokenRef.current(),
      headers: { "x-client-platform": Platform.OS },
    }),
  );
  const [queryClient] = useState(() => {
    const qc = makeQueryClient();
    registerOfflineMutations(qc, trpcClient);
    return qc;
  });

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 1000 * 60 * 60 * 24,
        // Only persist the offline-first domains; AI results etc. stay in memory.
        dehydrateOptions: {
          shouldDehydrateQuery: (q) =>
            Array.isArray(q.queryKey[0]) &&
            ["grocery", "chores", "emergencyContacts", "family", "calendar"].includes(String(q.queryKey[0][0])),
        },
      }}
      onSuccess={() => {
        // Replay anything the user did while offline (possibly before an app restart).
        void queryClient.resumePausedMutations().then(() => queryClient.invalidateQueries());
      }}
    >
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
      </TRPCProvider>
    </PersistQueryClientProvider>
  );
}
