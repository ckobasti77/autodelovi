/**
 * Upload verification (docs/ARCHITECTURE.md §E7): after a file is attached, its magic bytes
 * are checked; a mismatch deletes the blob, marks the upload rejected and detaches it.
 */
import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction, internalMutation } from "./_generated/server";
import { SYSTEM_ACTOR } from "./lib/authz";
import { setProductImages } from "./lib/productWriter";

export type SniffedKind = "jpeg" | "png" | "webp" | "avif" | "heic" | "xlsx" | "xls" | "unknown";

/** Detects the real file type from its first bytes. */
export function sniffBytes(bytes: Uint8Array): SniffedKind {
  const at = (i: number) => bytes[i] ?? -1;
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return "jpeg";
  if (at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4e && at(3) === 0x47) return "png";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";
  if (ascii(4, 8) === "ftyp") {
    const brand = ascii(8, 12);
    if (brand === "avif" || brand === "avis") return "avif";
    if (["heic", "heix", "mif1", "msf1", "heim", "heis"].includes(brand)) return "heic";
  }
  if (at(0) === 0x50 && at(1) === 0x4b && at(2) === 0x03 && at(3) === 0x04) return "xlsx";
  if (at(0) === 0xd0 && at(1) === 0xcf && at(2) === 0x11 && at(3) === 0xe0) return "xls";
  return "unknown";
}

const IMAGE_KINDS: SniffedKind[] = ["jpeg", "png", "webp", "avif", "heic"];

export const sniff = internalAction({
  args: { storageId: v.id("_storage") },
  returns: v.null(),
  handler: async (ctx, { storageId }) => {
    const blob = await ctx.storage.get(storageId);
    if (!blob) return null;
    const head = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
    const kind = sniffBytes(head);
    await ctx.runMutation(internal.files.recordSniff, { storageId, kind });
    return null;
  },
});

export const recordSniff = internalMutation({
  args: { storageId: v.id("_storage"), kind: v.string() },
  returns: v.null(),
  handler: async (ctx, { storageId, kind }) => {
    const upload = await ctx.db
      .query("uploads")
      .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
      .first();
    if (!upload) return null;
    const now = Date.now();
    const expectsImage = upload.purpose !== "import_file";
    const ok = expectsImage
      ? IMAGE_KINDS.includes(kind as SniffedKind)
      : kind === "xlsx" || kind === "xls" || kind === "unknown";
    if (ok) {
      await ctx.db.patch("uploads", upload._id, { checkedAt: now });
      return null;
    }
    await ctx.db.patch("uploads", upload._id, {
      status: "rejected",
      checkedAt: now,
      rejectReason: `Sadržaj fajla nije slika (${kind}).`,
    });
    if (upload.attachedTo?.type === "inquiry") {
      const inquiry = await ctx.db.get("inquiries", upload.attachedTo.id as Id<"inquiries">);
      if (inquiry) {
        await ctx.db.patch("inquiries", inquiry._id, {
          photos: inquiry.photos.filter((p) => p !== storageId),
        });
      }
    }
    if (upload.attachedTo?.type === "product") {
      const productId = upload.attachedTo.id as Id<"products">;
      const content = await ctx.db
        .query("productContent")
        .withIndex("by_productId", (q) => q.eq("productId", productId))
        .unique();
      if (content) {
        const images = content.images.filter((img) => img.storageId !== storageId);
        await setProductImages(ctx, productId, images, { actor: SYSTEM_ACTOR, emit: true });
      }
    }
    await ctx.storage.delete(storageId);
    return null;
  },
});
