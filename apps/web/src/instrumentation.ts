import * as Sentry from "@sentry/nextjs";

export function register() {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || undefined,
    tracesSampleRate: 0.1,
    initialScope: { tags: { service: "web-server" } },
  });
}

export const onRequestError = Sentry.captureRequestError;
