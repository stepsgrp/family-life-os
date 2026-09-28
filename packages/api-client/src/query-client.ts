import { QueryClient } from "@tanstack/react-query";

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Keep cached data around for a day so the mobile offline cache stays useful.
        gcTime: 1000 * 60 * 60 * 24,
        retry: (count, error) => {
          const code = (error as { data?: { code?: string } }).data?.code;
          if (code === "UNAUTHORIZED" || code === "FORBIDDEN" || code === "NOT_FOUND") return false;
          return count < 2;
        },
      },
      mutations: {
        // Paused (offline) mutations resume when connectivity returns.
        networkMode: "offlineFirst",
      },
    },
  });
}
