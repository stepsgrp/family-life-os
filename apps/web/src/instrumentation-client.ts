import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || undefined,
  tracesSampleRate: 0.1,
  // Propagate trace headers to the API so web -> api errors link up in Sentry.
  tracePropagationTargets: [process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"],
  initialScope: { tags: { service: "web" } },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
