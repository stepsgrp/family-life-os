import { getAuth } from "@clerk/fastify";
import { prisma, type FamilyMember } from "@flos/db";
import { FREE_LIMITS, type FamilyRole } from "@flos/types";
import { initTRPC, TRPCError } from "@trpc/server";
import type { CreateFastifyContextOptions } from "@trpc/server/adapters/fastify";
import superjson from "superjson";
import { ZodError } from "zod";
import { hasFamilyPlan } from "./lib/billing";

export async function createContext({ req }: CreateFastifyContextOptions) {
  const { userId } = getAuth(req);
  // Clients may belong to several families; they pick one with this header.
  const requestedFamilyId = req.headers["x-family-id"];

  let member: FamilyMember | null = null;
  if (userId) {
    member = await prisma.familyMember.findFirst({
      where: {
        clerkUserId: userId,
        ...(typeof requestedFamilyId === "string" ? { familyId: requestedFamilyId } : {}),
      },
      orderBy: { createdAt: "asc" },
    });
  }

  return { req, prisma, userId, member, log: req.log };
}
export type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

/** Signed in with Clerk, may not belong to a family yet (onboarding). */
export const authedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });
  return next({ ctx: { ...ctx, userId: ctx.userId } });
});

/** Signed in AND a member of a family. Adds ctx.familyId and ctx.role. */
export const familyProcedure = authedProcedure.use(({ ctx, next }) => {
  if (!ctx.member) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "NO_FAMILY" });
  }
  return next({
    ctx: { ...ctx, member: ctx.member, familyId: ctx.member.familyId, role: ctx.member.role },
  });
});

export const requireRole = (...roles: FamilyRole[]) =>
  familyProcedure.use(({ ctx, next }) => {
    if (!roles.includes(ctx.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: `Requires role: ${roles.join(" or ")}` });
    }
    return next();
  });

export const parentProcedure = requireRole("ADMIN_PARENT", "PARENT");
export const adminProcedure = requireRole("ADMIN_PARENT");
/** Anyone except young children. */
export const writerProcedure = requireRole("ADMIN_PARENT", "PARENT", "TEEN");

/** Metered AI access: unlimited on the Family plan, capped per month on Free. */
export const aiProcedure = familyProcedure.use(async ({ ctx, next }) => {
  if (ctx.role === "CHILD") throw new TRPCError({ code: "FORBIDDEN" });
  if (!(await hasFamilyPlan(ctx.familyId))) {
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const used = await ctx.prisma.aiUsage.count({
      where: { familyId: ctx.familyId, createdAt: { gte: monthStart } },
    });
    if (used >= FREE_LIMITS.aiRequestsPerMonth) {
      throw new TRPCError({ code: "FORBIDDEN", message: "AI_LIMIT_REACHED" });
    }
  }
  return next();
});
