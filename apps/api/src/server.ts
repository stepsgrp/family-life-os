import "./instrument"; // Sentry must load before everything else
import { clerkPlugin } from "@clerk/fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { prisma } from "@flos/db";
import * as Sentry from "@sentry/node";
import { fastifyTRPCPlugin, type FastifyTRPCPluginOptions } from "@trpc/server/adapters/fastify";
import Fastify from "fastify";
import { env, port } from "./env";
import { shutdownAnalytics } from "./lib/analytics";
import { logger } from "./lib/logger";
import { appRouter, type AppRouter } from "./router";
import { aiStreamRoutes } from "./routes/ai-stream";
import { webhookRoutes } from "./routes/webhooks";
import { createContext } from "./trpc";

const app = Fastify({ loggerInstance: logger, trustProxy: true, routerOptions: { maxParamLength: 5000 } });
Sentry.setupFastifyErrorHandler(app);

await app.register(helmet);
await app.register(cors, {
  origin: [env.WEB_ORIGIN],
  credentials: true,
  allowedHeaders: ["Authorization", "Content-Type", "x-family-id", "x-client-platform", "trpc-accept"],
});
await app.register(rateLimit, {
  max: 300,
  timeWindow: "1 minute",
  // Rate limit per signed-in user when possible, otherwise per IP.
  keyGenerator: (req) => req.headers.authorization?.slice(-32) ?? req.ip,
});

// Health check (Better Stack / Railway / Render hit this).
app.get("/health", async () => {
  await prisma.$queryRaw`SELECT 1`;
  return { status: "ok", time: new Date().toISOString() };
});

// Webhooks are registered in their own encapsulated scope (raw body parser, no Clerk).
await app.register(webhookRoutes);

// Everything below requires a Clerk session (verified from the Bearer token).
await app.register(async (authed) => {
  await authed.register(clerkPlugin);

  await authed.register(fastifyTRPCPlugin, {
    prefix: "/trpc",
    trpcOptions: {
      router: appRouter,
      createContext,
      onError({ path, error }) {
        if (error.code === "INTERNAL_SERVER_ERROR") {
          logger.error({ path, err: error.cause ?? error }, "tRPC error");
          Sentry.captureException(error.cause ?? error);
        }
      },
    } satisfies FastifyTRPCPluginOptions<AppRouter>["trpcOptions"],
  });

  await authed.register(aiStreamRoutes);
});

const shutdown = async () => {
  await app.close();
  await shutdownAnalytics();
  await prisma.$disconnect();
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

await app.listen({ port, host: "0.0.0.0" });
