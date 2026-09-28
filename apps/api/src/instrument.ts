import * as Sentry from "@sentry/node";

// One Sentry project for web, mobile and api; `service` tag tells them apart.
Sentry.init({
  dsn: process.env.SENTRY_DSN || undefined,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  initialScope: { tags: { service: "api" } },
});
