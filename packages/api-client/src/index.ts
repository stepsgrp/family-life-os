// Shared, fully typed tRPC client for apps/web and apps/mobile.
// Only the *type* of the router is imported from the API, so no server code ships to clients.
import type { AppRouter } from "@flos/api/router";
import { createTRPCClient, httpBatchLink, type TRPCClient } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import superjson from "superjson";

export type { AppRouter };
export type RouterInputs = inferRouterInputs<AppRouter>;
export type RouterOutputs = inferRouterOutputs<AppRouter>;

export const { TRPCProvider, useTRPC, useTRPCClient } = createTRPCContext<AppRouter>();

export interface CreateClientOptions {
  apiUrl: string;
  /** Returns a Clerk session JWT (useAuth().getToken on both web and Expo). */
  getToken: () => Promise<string | null>;
  /** Extra headers, e.g. x-client-platform for analytics. */
  headers?: Record<string, string>;
}

export function createApiClient(opts: CreateClientOptions): TRPCClient<AppRouter> {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${opts.apiUrl.replace(/\/$/, "")}/trpc`,
        transformer: superjson,
        async headers() {
          const token = await opts.getToken();
          return {
            ...opts.headers,
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          };
        },
      }),
    ],
  });
}

export { makeQueryClient } from "./query-client";
export { useFamilyRealtime } from "./realtime";
export { streamWeekendPlan, type WeekendStreamEvent } from "./stream";
