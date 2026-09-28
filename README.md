# 🏡 Family Life OS

One app for the whole family: shared calendar, grocery list, meal planner, chores, school and medicine reminders, vacations, emergency contacts, shared documents, and AI helpers (dinner ideas, weekend plans, assisted appointment booking). It runs on **web, iOS and Android** from one TypeScript monorepo, with one subscription across all three.

```
apps/
  api/      Fastify + tRPC API, BullMQ worker, webhooks, Claude AI agents
  web/      Next.js 16 (App Router) + Tailwind 4
  mobile/   Expo SDK 57 (React Native 0.86) + Expo Router
packages/
  db/          Prisma 7 schema, migrations, client (Postgres)
  types/       Zod schemas shared by server and clients
  api-client/  Typed tRPC client, realtime hook, SSE stream client (web + mobile)
  ui/          Design tokens (colors, spacing, member palette)
```

## Architecture

```
 Web (Next.js, Vercel)      iOS / Android (Expo, EAS)
        │  tRPC over HTTPS + Clerk JWT   │
        └──────────────┬─────────────────┘
                       ▼
         API (Fastify + tRPC, Railway) ──► Claude API (tool use)
          │        │         │               Google Places, Open-Meteo
          │        │         └──► Cloudflare R2 (presigned uploads)
          │        └──► Supabase Realtime broadcast ("chores changed")
          ▼                                   │
     Postgres (Neon/Supabase)          clients refetch via tRPC
          ▲
 Worker (BullMQ + Redis): nightly overdue chores, per-minute reminders ──► Expo Push
 Webhooks: Stripe (web billing) + RevenueCat (App/Play Store) ──► one Subscription row
```

Key design decisions:

- **Tenancy is enforced server-side.** Every table has `familyId`; procedures read it from the authenticated member (`ctx.familyId`) and never from client input. Integration tests cover cross-family access.
- **Roles** (`ADMIN_PARENT`, `PARENT`, `TEEN`, `CHILD`) are enforced by tRPC middleware (`parentProcedure`, `writerProcedure`, ...), with per-row rules on top (children see only their own chores; documents carry a `visibleTo` role list).
- **Realtime messages carry no data**, only "domain X changed". Clients refetch through the authenticated API, so a leaked channel name exposes nothing.
- **One entitlement, three stores.** The Stripe and RevenueCat webhooks both write the family's `Subscription` row; `billing.getSubscriptionStatus` gives the same answer on every platform. RevenueCat's `appUserID` is the `familyId`, so one parent's purchase covers the whole family.
- **AI is metered and grounded.** Every Claude tool is closed over the caller's `familyId`. The free tier gets 10 AI requests per month (`AiUsage` table), and appointment booking is human-in-the-loop: Claude drafts, a parent approves, and only then is anything sent.
- **Mobile works offline** for grocery, chores, emergency contacts and calendar. The TanStack Query cache is persisted to AsyncStorage, and mutations queue while offline (surviving app restarts) and replay when the device reconnects.

## Tech stack

| Layer | Choice | Free tier |
|---|---|---|
| Monorepo | pnpm workspaces + Turborepo | Free |
| Web | Next.js 16 on Vercel | Hobby |
| Mobile | Expo SDK 57 + EAS Build | 30 builds/mo |
| API | Fastify 5 + tRPC 11 on Railway (or Render) | Trial credit |
| Database | Postgres (Neon or Supabase) + Prisma 7 | 0.5–1 GB |
| Jobs | BullMQ + Redis | See note below |
| Realtime | Supabase Realtime (broadcast) | Included |
| Auth | Clerk (Organizations mirror families) | 10k MAU |
| Payments | Stripe (web) + RevenueCat (iOS/Android) | Per-transaction only |
| Files | Cloudflare R2 | 10 GB, no egress fees |
| Push | Expo Push Service | Free |
| AI | Claude API (`claude-opus-5`) | Pay as you go |
| Places / weather | Google Places API (New) / Open-Meteo | $200 credit / free |
| Email | Resend | 3k/mo |
| Errors / analytics | Sentry / PostHog | 5k errors / 1M events |
| CI/CD | GitHub Actions | 2,000 min/mo |

> **Redis note:** BullMQ polls Redis constantly, which exhausts Upstash's free command quota quickly. Use Railway's Redis plugin (or any always-on Redis) for the worker. Upstash is fine for caching or rate limiting.

## Local development

Prerequisites: Node 22+, pnpm 11 (`corepack enable`), Docker.

```bash
pnpm install                 # also generates the Prisma client
cp .env.example .env         # fill in keys (see "Accounts to create" below)
pnpm infra:up                # Postgres (pgvector) + Redis in Docker
                             # ports busy? POSTGRES_PORT=55432 REDIS_PORT=56379 pnpm infra:up
pnpm --filter @flos/db migrate:deploy
pnpm db:seed                 # optional demo family

pnpm --filter @flos/api dev         # API on :4000
pnpm --filter @flos/api dev:worker  # background jobs
pnpm --filter @flos/web dev         # web on :3000
pnpm --filter @flos/mobile dev      # Expo (needs a dev build, see below)
```

Changing the schema: edit `packages/db/prisma/schema.prisma`, then run `pnpm db:migrate` (creates and applies a migration).

Mobile: Clerk's native sign-in (`AuthView`), RevenueCat and push all need native code, so use a **development build** rather than Expo Go:

```bash
cd apps/mobile
npx eas build --profile development --platform ios   # or android; install on device
pnpm dev
```

Set `EXPO_PUBLIC_API_URL` to your machine's LAN IP (e.g. `http://192.168.1.10:4000`) so a phone can reach the API.

### Tests

```bash
pnpm turbo run lint typecheck test                               # everything (same as CI)
TEST_DATABASE_URL=postgresql://flos:flos@localhost:5432/flos pnpm test:integration
```

Integration tests (`apps/api/src/routers/routers.int.test.ts`) call the real routers against Postgres. They cover role checks, children seeing only their own chores, recurring chores, cross-family isolation, meal-plan-to-grocery dedupe, single-use invites and the overdue-chore job. They are skipped when `TEST_DATABASE_URL` isn't set.

## Accounts to create

| Service | What to configure |
|---|---|
| **Clerk** | Enable Organizations. Add a webhook to `https://<api>/webhooks/clerk` (event `user.deleted`). Copy the publishable and secret keys. For native iOS sign-in, add your bundle id under Native Applications. |
| **Neon / Supabase** | Create a Postgres DB and copy the pooled connection string to `DATABASE_URL`. |
| **Supabase** | Realtime is used for broadcast only. Copy the URL, anon key and service-role key. |
| **Cloudflare R2** | Create the `flos-documents` bucket and an API token. Add a CORS rule allowing `PUT` from your web origin. |
| **Anthropic** | Create an API key (`ANTHROPIC_API_KEY`). |
| **Google Cloud** | Enable the Places API (New) and create a key restricted to it. |
| **Stripe** | Create a "Family Plan" product with monthly and annual prices (`STRIPE_PRICE_*`). Add a webhook to `https://<api>/webhooks/stripe` for `checkout.session.completed` and `customer.subscription.*`. Enable the Customer Portal. |
| **RevenueCat** | Create products in App Store Connect and Play Console. Create entitlement **`family`** and an offering. Add a webhook to `https://<api>/webhooks/revenuecat` with the Authorization header `Bearer <REVENUECAT_WEBHOOK_AUTH>`. |
| **Expo** | `eas init` (sets `EAS_PROJECT_ID`), then configure iOS push (APNs key) and Android FCM credentials with `eas credentials`. |
| **Resend** | Verify your sending domain (used for approved appointment emails). |
| **Sentry / PostHog / Better Stack** | One Sentry project (events are tagged `service: api/web/mobile`), a PostHog project key, and a Better Stack heartbeat URL (`BETTERSTACK_HEARTBEAT_URL`) plus an uptime monitor on `/health`. |

## Deployment

CI (`.github/workflows/ci.yml`) runs on every PR: lint, typecheck and tests for **affected packages only** (`turbo --affected`), with a Postgres service for the integration tests.

Deploy (`.github/workflows/deploy.yml`) runs on merge to `main`, and only for the apps a change touches:

1. **Migrations**: `prisma migrate deploy` against production.
2. **API + worker → Railway**: two services built from the same `apps/api/Dockerfile`. The `worker` service overrides the start command to `node dist/worker.js`.
3. **Web → Vercel**: `vercel build` + `vercel deploy --prebuilt`. Set the project's root directory to `apps/web`.
4. **Mobile → EAS Build** (iOS + Android), only when `apps/mobile` or shared packages change. Submit with `eas submit`.

Required GitHub secrets: `DATABASE_URL`, `RAILWAY_TOKEN`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `EXPO_TOKEN`. App secrets live in each platform's environment settings (Railway, Vercel, EAS), not in GitHub.

## Plans and limits

- **Free**: 4 members, 10 AI requests per month, 100 MB of documents (`FREE_LIMITS` in `packages/types`).
- **Family** ($6.99/mo or $59.99/yr, 14-day trial): unlimited members and AI.

Limits are enforced in the API (`aiProcedure`, `assertSeatAvailable`, `documents.requestUpload`), never only in the UI.

## Roadmap

- Google Calendar two-way sync (the `googleEventId` column is ready)
- A native date picker and month grid on mobile (mobile currently has a 14-day agenda)
- AI vacation itineraries (reusing the weekend-planner agent with a `Vacation` target)
- Per-member notification preferences and quiet hours
- Row-level security on Supabase if you move data access beyond the API
