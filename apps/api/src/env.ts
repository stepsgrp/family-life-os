import { z } from "zod";

// Fail fast at boot if configuration is missing or malformed.
const Env = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().default(4000),
  PORT: z.coerce.number().optional(), // Railway/Render inject PORT
  WEB_ORIGIN: z.string().default("http://localhost:3000"),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().default("redis://localhost:6379"),

  CLERK_SECRET_KEY: z.string().min(1),
  CLERK_PUBLISHABLE_KEY: z.string().min(1),
  CLERK_WEBHOOK_SECRET: z.string().default(""),

  ANTHROPIC_API_KEY: z.string().default(""),
  GOOGLE_PLACES_API_KEY: z.string().default(""),
  RESEND_API_KEY: z.string().default(""),
  EMAIL_FROM: z.string().default("Family Life OS <noreply@example.com>"),

  SUPABASE_URL: z.string().default(""),
  SUPABASE_SERVICE_ROLE_KEY: z.string().default(""),

  R2_ACCOUNT_ID: z.string().default(""),
  R2_ACCESS_KEY_ID: z.string().default(""),
  R2_SECRET_ACCESS_KEY: z.string().default(""),
  R2_BUCKET: z.string().default("flos-documents"),

  STRIPE_SECRET_KEY: z.string().default(""),
  STRIPE_WEBHOOK_SECRET: z.string().default(""),
  STRIPE_PRICE_MONTHLY: z.string().default(""),
  STRIPE_PRICE_ANNUAL: z.string().default(""),
  REVENUECAT_WEBHOOK_AUTH: z.string().default(""),

  SENTRY_DSN: z.string().default(""),
  POSTHOG_KEY: z.string().default(""),
  BETTERSTACK_HEARTBEAT_URL: z.string().default(""),
});

export const env = Env.parse(process.env);
export const port = env.PORT ?? env.API_PORT;
