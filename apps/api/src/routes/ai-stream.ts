import { FREE_LIMITS } from "@flos/types";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AiRefusalError } from "../ai/claude";
import { planWeekend } from "../ai/weekend";
import { env } from "../env";
import { track } from "../lib/analytics";
import { hasFamilyPlan } from "../lib/billing";
import { createContext } from "../trpc";

/**
 * POST /ai/weekend/stream - Server-Sent Events.
 *   event: status  {label}      a tool is running ("Checking the weekend forecast")
 *   event: delta   {text}       raw JSON text as Claude writes the final plan
 *   event: done    {plan}       the validated WeekendPlan
 *   event: error   {message}
 * Clients: packages/api-client/src/stream.ts (fetch + ReadableStream, works in the
 * browser and in Expo via expo/fetch). POST so the Clerk bearer token goes in a header.
 */
export async function aiStreamRoutes(app: FastifyInstance) {
  app.post("/ai/weekend/stream", async (req, reply) => {
    const ctx = await createContext({ req, res: reply, info: undefined as never });
    if (!ctx.member || ctx.member.role === "CHILD") return reply.code(403).send({ error: "FORBIDDEN" });

    const familyId = ctx.member.familyId;
    if (!(await hasFamilyPlan(familyId))) {
      const monthStart = new Date();
      monthStart.setUTCDate(1);
      monthStart.setUTCHours(0, 0, 0, 0);
      const used = await ctx.prisma.aiUsage.count({ where: { familyId, createdAt: { gte: monthStart } } });
      if (used >= FREE_LIMITS.aiRequestsPerMonth) return reply.code(403).send({ error: "AI_LIMIT_REACHED" });
    }

    const body = z.object({ note: z.string().max(300).optional() }).safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: "BAD_REQUEST" });

    reply.hijack();
    const res = reply.raw;
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      // hijack() bypasses @fastify/cors, so set the header for the web app ourselves.
      ...(req.headers.origin === env.WEB_ORIGIN ? { "Access-Control-Allow-Origin": env.WEB_ORIGIN } : {}),
    });
    const send = (event: string, data: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

    const abort = new AbortController();
    req.raw.on("close", () => abort.abort());

    try {
      const plan = await planWeekend(familyId, {
        note: body.data.note,
        signal: abort.signal,
        onEvent: (e) => (e.type === "tool" ? send("status", { label: e.label }) : send("delta", { text: e.delta })),
      });
      send("done", { plan });
      track(ctx.userId!, "ai_weekend_planned", { familyId, streamed: true });
    } catch (err) {
      if (!abort.signal.aborted) {
        req.log.error({ err }, "weekend stream failed");
        send("error", { message: err instanceof AiRefusalError ? err.message : "Planning failed, please retry" });
      }
    } finally {
      res.end();
    }
  });
}
