import { clerkClient } from "@clerk/fastify";
import {
  AcceptInviteInput,
  AddDependentInput,
  CreateFamilyInput,
  CreateInviteInput,
  FREE_LIMITS,
  Id,
  UpdateMemberInput,
  isParent,
} from "@flos/types";
import { memberColors } from "@flos/ui";
import { TRPCError } from "@trpc/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { track } from "../lib/analytics";
import { hasFamilyPlan } from "../lib/billing";
import { publishChange } from "../lib/realtime";
import { adminProcedure, authedProcedure, familyProcedure, parentProcedure, router } from "../trpc";

async function assertSeatAvailable(familyId: string, count: number) {
  if (count >= FREE_LIMITS.members && !(await hasFamilyPlan(familyId))) {
    throw new TRPCError({ code: "FORBIDDEN", message: "MEMBER_LIMIT_REACHED" });
  }
}

export const familyRouter = router({
  /** Used by clients right after sign-in to decide: onboarding or dashboard. */
  me: authedProcedure.query(async ({ ctx }) => {
    if (!ctx.member) return null;
    const family = await ctx.prisma.family.findUniqueOrThrow({ where: { id: ctx.member.familyId } });
    const memberships = await ctx.prisma.familyMember.findMany({
      where: { clerkUserId: ctx.userId },
      select: { family: { select: { id: true, name: true } } },
    });
    return { member: ctx.member, family, families: memberships.map((m) => m.family) };
  }),

  create: authedProcedure.input(CreateFamilyInput).mutation(async ({ ctx, input }) => {
    // Clerk Organization mirrors the family so Clerk's org switcher/invites stay usable.
    const clerk = clerkClient;
    const org = await clerk.organizations.createOrganization({ name: input.name, createdBy: ctx.userId });

    const family = await ctx.prisma.family.create({
      data: {
        clerkOrgId: org.id,
        name: input.name,
        timezone: input.timezone,
        subscription: { create: {} },
        members: {
          create: {
            clerkUserId: ctx.userId,
            displayName: input.displayName,
            role: "ADMIN_PARENT",
            color: memberColors[0],
          },
        },
      },
    });
    track(ctx.userId, "family_created", { familyId: family.id });
    return family;
  }),

  members: familyProcedure.query(({ ctx }) =>
    ctx.prisma.familyMember.findMany({
      where: { familyId: ctx.familyId },
      orderBy: { createdAt: "asc" },
    }),
  ),

  updateSettings: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(80).optional(),
        timezone: z.string().optional(),
        homeLat: z.number().min(-90).max(90).optional(),
        homeLng: z.number().min(-180).max(180).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const family = await ctx.prisma.family.update({ where: { id: ctx.familyId }, data: input });
      publishChange(ctx.familyId, "family");
      return family;
    }),

  updateMember: familyProcedure.input(UpdateMemberInput).mutation(async ({ ctx, input }) => {
    const { id, ...data } = input;
    // Members edit themselves; parents can edit anyone in the family.
    if (id !== ctx.member.id && !isParent(ctx.role)) throw new TRPCError({ code: "FORBIDDEN" });
    const target = await ctx.prisma.familyMember.findFirst({ where: { id, familyId: ctx.familyId } });
    if (!target) throw new TRPCError({ code: "NOT_FOUND" });
    const updated = await ctx.prisma.familyMember.update({ where: { id }, data });
    publishChange(ctx.familyId, "family");
    return updated;
  }),

  /** Add a child who has no login of their own (can still be assigned chores/events). */
  addDependent: parentProcedure.input(AddDependentInput).mutation(async ({ ctx, input }) => {
    const count = await ctx.prisma.familyMember.count({ where: { familyId: ctx.familyId } });
    await assertSeatAvailable(ctx.familyId, count);
    const member = await ctx.prisma.familyMember.create({
      data: { ...input, familyId: ctx.familyId, color: memberColors[count % memberColors.length] },
    });
    publishChange(ctx.familyId, "family");
    return member;
  }),

  removeMember: adminProcedure.input(z.object({ id: Id })).mutation(async ({ ctx, input }) => {
    if (input.id === ctx.member.id) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Transfer admin before leaving" });
    }
    const target = await ctx.prisma.familyMember.findFirst({
      where: { id: input.id, familyId: ctx.familyId },
      include: { family: true },
    });
    if (!target) throw new TRPCError({ code: "NOT_FOUND" });
    if (target.clerkUserId) {
      await clerkClient.organizations
        .deleteOrganizationMembership({ organizationId: target.family.clerkOrgId, userId: target.clerkUserId })
        .catch(() => undefined); // already removed in Clerk
    }
    await ctx.prisma.familyMember.delete({ where: { id: input.id } });
    publishChange(ctx.familyId, "family");
    return { ok: true };
  }),

  /** Returns a one-time invite link valid for 7 days. */
  createInvite: parentProcedure.input(CreateInviteInput).mutation(async ({ ctx, input }) => {
    const count = await ctx.prisma.familyMember.count({ where: { familyId: ctx.familyId } });
    await assertSeatAvailable(ctx.familyId, count);
    const token = randomBytes(24).toString("base64url");
    await ctx.prisma.familyInvite.create({
      data: {
        familyId: ctx.familyId,
        token,
        role: input.role,
        email: input.email,
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      },
    });
    return { token, path: `/join/${token}` };
  }),

  previewInvite: authedProcedure.input(z.object({ token: z.string() })).query(async ({ ctx, input }) => {
    const invite = await ctx.prisma.familyInvite.findUnique({
      where: { token: input.token },
      include: { family: { select: { name: true } } },
    });
    if (!invite || invite.usedAt || invite.expiresAt < new Date()) return null;
    return { familyName: invite.family.name, role: invite.role };
  }),

  acceptInvite: authedProcedure.input(AcceptInviteInput).mutation(async ({ ctx, input }) => {
    const invite = await ctx.prisma.familyInvite.findUnique({
      where: { token: input.token },
      include: { family: true },
    });
    if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Invite is invalid or expired" });
    }
    const existing = await ctx.prisma.familyMember.findFirst({
      where: { familyId: invite.familyId, clerkUserId: ctx.userId },
    });
    if (existing) return existing;

    const count = await ctx.prisma.familyMember.count({ where: { familyId: invite.familyId } });
    const member = await ctx.prisma.$transaction(async (tx) => {
      // Mark used first so a double-submit can't create two members.
      const claimed = await tx.familyInvite.updateMany({
        where: { id: invite.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (claimed.count === 0) throw new TRPCError({ code: "CONFLICT", message: "Invite already used" });
      return tx.familyMember.create({
        data: {
          familyId: invite.familyId,
          clerkUserId: ctx.userId,
          displayName: input.displayName,
          role: invite.role,
          color: memberColors[count % memberColors.length],
        },
      });
    });

    await clerkClient.organizations
      .createOrganizationMembership({
        organizationId: invite.family.clerkOrgId,
        userId: ctx.userId,
        role: invite.role === "PARENT" ? "org:admin" : "org:member",
      })
      .catch((err) => ctx.log.warn({ err }, "clerk org membership failed"));

    track(ctx.userId, "member_joined", { familyId: invite.familyId, role: invite.role });
    publishChange(invite.familyId, "family");
    return member;
  }),
});
