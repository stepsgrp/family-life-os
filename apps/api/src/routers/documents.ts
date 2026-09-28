import { FREE_LIMITS, Id, RequestUploadInput } from "@flos/types";
import { TRPCError } from "@trpc/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { hasFamilyPlan } from "../lib/billing";
import { publishChange } from "../lib/realtime";
import { deleteObject, presignDownload, presignUpload } from "../lib/storage";
import { familyProcedure, parentProcedure, router, writerProcedure } from "../trpc";

const ALLOWED_TYPES = /^(application\/pdf|image\/(png|jpeg|heic|webp)|text\/plain)$/;

export const documentsRouter = router({
  list: familyProcedure.input(z.object({ folder: z.string().optional() })).query(({ ctx, input }) =>
    ctx.prisma.document.findMany({
      where: {
        familyId: ctx.familyId,
        visibleTo: { has: ctx.role },
        ...(input.folder ? { folder: input.folder } : {}),
      },
      orderBy: { createdAt: "desc" },
    }),
  ),

  /**
   * Step 1 of upload: create the row and return a presigned PUT URL.
   * The client uploads directly to R2, so the API never buffers files.
   */
  requestUpload: writerProcedure.input(RequestUploadInput).mutation(async ({ ctx, input }) => {
    if (!ALLOWED_TYPES.test(input.mimeType)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Unsupported file type" });
    }
    if (!(await hasFamilyPlan(ctx.familyId))) {
      const used = await ctx.prisma.document.aggregate({
        where: { familyId: ctx.familyId },
        _sum: { sizeBytes: true },
      });
      if ((used._sum.sizeBytes ?? 0) + input.sizeBytes > FREE_LIMITS.documentStorageMb * 1024 * 1024) {
        throw new TRPCError({ code: "FORBIDDEN", message: "STORAGE_LIMIT_REACHED" });
      }
    }
    const safeName = input.name.replace(/[^\w.\- ]/g, "_");
    const storageKey = `${ctx.familyId}/${randomUUID()}/${safeName}`;
    const doc = await ctx.prisma.document.create({
      data: {
        familyId: ctx.familyId,
        name: input.name,
        storageKey,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        folder: input.folder,
        visibleTo: input.visibleTo,
        uploadedById: ctx.member.id,
      },
    });
    const uploadUrl = await presignUpload(storageKey, input.mimeType, input.sizeBytes);
    publishChange(ctx.familyId, "documents");
    return { document: doc, uploadUrl };
  }),

  getDownloadUrl: familyProcedure.input(z.object({ id: Id })).query(async ({ ctx, input }) => {
    const doc = await ctx.prisma.document.findFirst({
      where: { id: input.id, familyId: ctx.familyId, visibleTo: { has: ctx.role } },
    });
    if (!doc) throw new TRPCError({ code: "NOT_FOUND" });
    return { url: await presignDownload(doc.storageKey, doc.name) };
  }),

  delete: parentProcedure.input(z.object({ id: Id })).mutation(async ({ ctx, input }) => {
    const doc = await ctx.prisma.document.findFirst({ where: { id: input.id, familyId: ctx.familyId } });
    if (!doc) throw new TRPCError({ code: "NOT_FOUND" });
    await deleteObject(doc.storageKey);
    await ctx.prisma.document.delete({ where: { id: doc.id } });
    publishChange(ctx.familyId, "documents");
    return { ok: true };
  }),
});
