/**
 * Import background phases (docs/IMPORT.md §K4). Every chunk is a mutation that processes
 * rows until ~25 % of any transaction budget remains, then schedules itself. Each row runs
 * as a nested mutation (a subtransaction): a failing row rolls back alone and is recorded,
 * the chunk goes on. Rows and changes carry flags, so a repeated chunk never applies twice.
 */
import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { audit } from "./lib/audit";
import { SYSTEM_ACTOR } from "./lib/authz";
import { emitEvent } from "./lib/events";
import { createInput, diffProduct, ensureManufacturer, loadCurrent } from "./lib/importModel";
import {
  createProduct,
  deleteProductHard,
  setProductImages,
  updateProduct,
  type ProductPatch,
  type WriteMeta,
} from "./lib/productWriter";
import type { Actor } from "./lib/validators";

const ROWS_PER_CHUNK = 100;
const PRODUCTS_PER_SCAN = 200;
const RESERVE = 0.25;

/** True while every transaction budget still has more than 25 % left. */
async function hasBudget(ctx: MutationCtx): Promise<boolean> {
  const m = await ctx.meta.getTransactionMetrics();
  const metrics = [
    m.bytesRead,
    m.bytesWritten,
    m.databaseQueries,
    m.documentsRead,
    m.documentsWritten,
  ];
  return metrics.every((x) => x.remaining > (x.used + x.remaining) * RESERVE);
}

function errorMessage(error: unknown): string {
  if (error instanceof ConvexError) {
    const data = error.data as { message?: unknown };
    if (typeof data?.message === "string") return data.message;
  }
  return error instanceof Error ? error.message.slice(0, 300) : "Nepoznata greška.";
}

function metaFor(batch: Doc<"importBatches">, rollback = false): WriteMeta {
  return {
    actor: (rollback ? batch.rollbackActor : batch.actor) ?? SYSTEM_ACTOR,
    emit: false,
    priceReason: rollback ? "import_rollback" : "import",
    stockReason: rollback ? "import_rollback" : "import",
    importBatchId: batch._id,
  };
}

// ── Commit ─────────────────────────────────────────────────────────────────────────────

export const commitRow = internalMutation({
  args: { rowId: v.id("importRows") },
  returns: v.union(
    v.literal("created"),
    v.literal("updated"),
    v.literal("unchanged"),
    v.literal("skipped"),
  ),
  handler: async (ctx, { rowId }) => {
    const row = await ctx.db.get("importRows", rowId);
    if (!row || row.committed) return "skipped";
    const batch = await ctx.db.get("importBatches", row.batchId);
    if (!batch) return "skipped";
    const meta = metaFor(batch);
    const data = row.data;

    if (row.action === "create") {
      const manufacturerId =
        data.manufacturerId ?? (await ensureManufacturer(ctx, data.manufacturerName ?? "Nepoznat"));
      const productId = await createProduct(ctx, createInput(data, manufacturerId), meta);
      const product = (await ctx.db.get("products", productId))!;
      await queueImages(ctx, batch, productId, data.images);
      const saved = (await ctx.db.get("products", productId))!;
      await ctx.db.insert("importChanges", {
        batchId: batch._id,
        productId,
        action: "create",
        after: {
          sku: product.sku,
          name: product.name,
          retailPricePara: product.retailPricePara,
          stockQty: product.stockQty,
        },
        rowNumber: row.rowNumber,
        productUpdatedAtAfter: saved.updatedAt,
        rolledBack: false,
      });
      await ctx.db.patch("importRows", rowId, { committed: true, productId });
      return "created";
    }

    if (row.action === "update" && row.productId) {
      const product = await ctx.db.get("products", row.productId);
      if (!product)
        throw new ConvexError({ code: "NOT_FOUND", message: "Artikal je obrisan posle provere." });
      const newManufacturerId =
        data.newManufacturer && data.manufacturerName
          ? await ensureManufacturer(ctx, data.manufacturerName)
          : undefined;
      const diff = diffProduct(await loadCurrent(ctx, product, data), data, newManufacturerId);
      if (diff.changed.length === 0) {
        await ctx.db.patch("importRows", rowId, { committed: true });
        return "unchanged";
      }
      await updateProduct(ctx, product._id, diff.patch, meta);
      if (product.imageCount === 0) await queueImages(ctx, batch, product._id, data.images);
      const saved = (await ctx.db.get("products", product._id))!;
      await ctx.db.insert("importChanges", {
        batchId: batch._id,
        productId: product._id,
        action: "update",
        before: diff.before,
        after: diff.after,
        rowNumber: row.rowNumber,
        productUpdatedAtAfter: saved.updatedAt,
        rolledBack: false,
      });
      await ctx.db.patch("importRows", rowId, {
        committed: true,
        changedFields: diff.changed.slice(0, 40),
      });
      return "updated";
    }

    await ctx.db.patch("importRows", rowId, { committed: true });
    return "skipped";
  },
});

async function queueImages(
  ctx: MutationCtx,
  batch: Doc<"importBatches">,
  productId: Id<"products">,
  urls: readonly string[] | undefined,
): Promise<void> {
  if (!urls?.length) return;
  const now = Date.now();
  for (const [position, url] of urls.entries()) {
    await ctx.db.insert("imageFetchJobs", {
      batchId: batch._id,
      productId,
      url,
      status: "pending",
      attempts: 0,
      position,
      updatedAt: now,
    });
  }
  const fresh = (await ctx.db.get("importBatches", batch._id))!;
  const images = fresh.images ?? { total: 0, done: 0, failed: 0 };
  await ctx.db.patch("importBatches", batch._id, {
    images: { ...images, total: images.total + urls.length },
  });
}

export const deactivateOne = internalMutation({
  args: { batchId: v.id("importBatches"), productId: v.id("products") },
  returns: v.boolean(),
  handler: async (ctx, { batchId, productId }) => {
    const batch = await ctx.db.get("importBatches", batchId);
    const product = await ctx.db.get("products", productId);
    if (!batch || !product || !product.active) return false;
    await updateProduct(ctx, productId, { active: false }, metaFor(batch));
    const saved = (await ctx.db.get("products", productId))!;
    await ctx.db.insert("importChanges", {
      batchId,
      productId,
      action: "deactivate",
      before: { active: true },
      after: { active: false },
      productUpdatedAtAfter: saved.updatedAt,
      rolledBack: false,
    });
    return true;
  },
});

/** Whether the product appears in the batch (matched at staging or created on commit). */
async function inBatch(ctx: MutationCtx, batchId: Id<"importBatches">, productId: Id<"products">) {
  const row = await ctx.db
    .query("importRows")
    .withIndex("by_batchId_and_productId", (q) =>
      q.eq("batchId", batchId).eq("productId", productId),
    )
    .first();
  return row !== null;
}

export const commitChunk = internalMutation({
  args: { batchId: v.id("importBatches") },
  returns: v.null(),
  handler: async (ctx, { batchId }) => {
    const batch = await ctx.db.get("importBatches", batchId);
    if (!batch || batch.status !== "committing") return null;
    const phase = batch.phase ?? "rows";

    if (phase === "rows") {
      const after = batch.cursor ? Number(batch.cursor) : -1;
      const rows = await ctx.db
        .query("importRows")
        .withIndex("by_batchId_and_rowNumber", (q) =>
          q.eq("batchId", batchId).gt("rowNumber", after),
        )
        .take(ROWS_PER_CHUNK);
      let cursor = after;
      let created = 0;
      let updated = 0;
      let failed = 0;
      let processed = 0;
      for (const row of rows) {
        if (!(await hasBudget(ctx))) break;
        cursor = row.rowNumber;
        processed++;
        if (row.committed || (row.action !== "create" && row.action !== "update")) continue;
        try {
          const result = await ctx.runMutation(internal.importCommit.commitRow, { rowId: row._id });
          if (result === "created") created++;
          else if (result === "updated") updated++;
        } catch (error) {
          failed++;
          await ctx.db.patch("importRows", row._id, {
            committed: true,
            commitError: errorMessage(error),
          });
        }
      }
      const fresh = (await ctx.db.get("importBatches", batchId))!;
      const done = rows.length < ROWS_PER_CHUNK && processed === rows.length;
      await ctx.db.patch("importBatches", batchId, {
        cursor: String(cursor),
        counts: {
          ...fresh.counts,
          committed: fresh.counts.committed + created + updated,
          created: (fresh.counts.created ?? 0) + created,
          updated: (fresh.counts.updated ?? 0) + updated,
          failed: fresh.counts.failed + failed,
        },
        progress: { ...fresh.progress, committedRows: fresh.progress.committedRows + processed },
        ...(done
          ? { phase: batch.deactivateMissing ? "deactivate" : "finalize", cursor: undefined }
          : {}),
        updatedAt: Date.now(),
      });
      await ctx.scheduler.runAfter(0, internal.importCommit.commitChunk, { batchId });
      return null;
    }

    if (phase === "deactivate") {
      const page = await ctx.db
        .query("products")
        .withIndex("by_active_and_contentUpdatedAt", (q) => q.eq("active", true))
        .paginate({ numItems: PRODUCTS_PER_SCAN, cursor: batch.cursor ?? null });
      let deactivated = 0;
      for (const product of page.page) {
        if (product.isDemo || product.deletedAt !== undefined) continue;
        if (await inBatch(ctx, batchId, product._id)) continue;
        if (
          await ctx.runMutation(internal.importCommit.deactivateOne, {
            batchId,
            productId: product._id,
          })
        )
          deactivated++;
      }
      const fresh = (await ctx.db.get("importBatches", batchId))!;
      await ctx.db.patch("importBatches", batchId, {
        counts: { ...fresh.counts, deactivated: fresh.counts.deactivated + deactivated },
        ...(page.isDone
          ? { phase: "finalize", cursor: undefined }
          : { cursor: page.continueCursor }),
        updatedAt: Date.now(),
      });
      await ctx.scheduler.runAfter(0, internal.importCommit.commitChunk, { batchId });
      return null;
    }

    // finalize
    const counts = batch.counts;
    const created = counts.created ?? 0;
    const updated = counts.updated ?? 0;
    await ctx.db.patch("importBatches", batchId, {
      status: "committed",
      phase: "done",
      committedAt: Date.now(),
      updatedAt: Date.now(),
    });
    const actor: Actor = batch.actor ?? SYSTEM_ACTOR;
    await audit(ctx, {
      actor,
      action: "import.commit",
      entityType: "importBatch",
      entityId: batchId,
      summary: `Uvoz ${batch.fileName}: ${created} novih, ${updated} izmenjenih, ${counts.deactivated} deaktiviranih, ${counts.failed} neuspelih`,
    });
    await emitEvent(ctx, {
      type: "import.completed",
      aggregateType: "import",
      aggregateId: batchId,
      payload: {
        kind: "import",
        batchId,
        fileName: batch.fileName,
        created,
        updated,
        failed: counts.failed,
        deactivated: counts.deactivated,
      },
      dedupeKey: `import.completed:${batchId}`,
      actor,
    });
    if ((batch.images?.total ?? 0) > 0) {
      await ctx.scheduler.runAfter(0, internal.importImages.run, { batchId });
    }
    return null;
  },
});

/** Counts active non-demo products absent from a validated full import (preview of deactivation). */
export const countMissingChunk = internalMutation({
  args: { batchId: v.id("importBatches") },
  returns: v.null(),
  handler: async (ctx, { batchId }) => {
    const batch = await ctx.db.get("importBatches", batchId);
    if (!batch?.missing || batch.missing.done || batch.status !== "validated") return null;
    const page = await ctx.db
      .query("products")
      .withIndex("by_active_and_contentUpdatedAt", (q) => q.eq("active", true))
      .paginate({ numItems: 400, cursor: batch.missing.cursor ?? null });
    let count = 0;
    for (const product of page.page) {
      if (product.isDemo || product.deletedAt !== undefined) continue;
      if (!(await inBatch(ctx, batchId, product._id))) count++;
    }
    await ctx.db.patch("importBatches", batchId, {
      missing: {
        scanned: batch.missing.scanned + page.page.length,
        count: batch.missing.count + count,
        done: page.isDone,
        ...(page.isDone ? {} : { cursor: page.continueCursor }),
      },
    });
    if (!page.isDone)
      await ctx.scheduler.runAfter(0, internal.importCommit.countMissingChunk, { batchId });
    return null;
  },
});

// ── Rollback ───────────────────────────────────────────────────────────────────────────

/** Product-document fields an import writes; compared on rollback besides `updatedAt`. */
const DOC_FIELDS = [
  "sku",
  "name",
  "categoryId",
  "manufacturerId",
  "quality",
  "mpn",
  "ean",
  "retailPricePara",
  "stockQty",
  "leadTimeDays",
  "lowStockThreshold",
  "active",
] as const;

/** Every snapshotted document field still holds the imported value (nobody changed it since). */
function stillAsImported(product: Doc<"products">, after: Record<string, unknown>): boolean {
  return DOC_FIELDS.every((field) => {
    if (!(field in after)) return true;
    const current = product[field] ?? null;
    return current === (after[field] ?? null);
  });
}

/** `null` in a snapshot means „the field was empty“ → cleared on rollback. */
function restorePatch(before: Record<string, unknown> | undefined): ProductPatch {
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(before ?? {}))
    patch[key] = value === null ? undefined : value;
  return patch as ProductPatch;
}

async function removeBatchImages(
  ctx: MutationCtx,
  batch: Doc<"importBatches">,
  productId: Id<"products">,
  meta: WriteMeta,
): Promise<void> {
  const jobs = await ctx.db
    .query("imageFetchJobs")
    .withIndex("by_batchId_and_productId", (q) =>
      q.eq("batchId", batch._id).eq("productId", productId),
    )
    .take(50);
  const stored = new Set(
    jobs.map((j) => j.storageId).filter((id): id is Id<"_storage"> => id !== undefined),
  );
  for (const job of jobs)
    if (job.status === "pending")
      await ctx.db.patch("imageFetchJobs", job._id, { status: "skipped" });
  if (stored.size === 0) return;
  const content = await ctx.db
    .query("productContent")
    .withIndex("by_productId", (q) => q.eq("productId", productId))
    .unique();
  if (content) {
    await setProductImages(
      ctx,
      productId,
      content.images.filter((img) => !stored.has(img.storageId)),
      meta,
    );
  }
  for (const id of stored) await ctx.storage.delete(id);
}

export const rollbackOne = internalMutation({
  args: { changeId: v.id("importChanges") },
  returns: v.union(v.literal("done"), v.literal("skipped")),
  handler: async (ctx, { changeId }) => {
    const change = await ctx.db.get("importChanges", changeId);
    if (!change || change.rolledBack) return "done";
    const batch = (await ctx.db.get("importBatches", change.batchId))!;
    const meta = metaFor(batch, true);
    const product = await ctx.db.get("products", change.productId);
    const finish = (reason?: string) =>
      ctx.db.patch("importChanges", changeId, {
        rolledBack: true,
        ...(reason ? { rollbackSkippedReason: reason } : {}),
      });
    if (!product) return await finish("Artikal više ne postoji.").then(() => "skipped" as const);
    const touched =
      product.updatedAt !== change.productUpdatedAtAfter || !stillAsImported(product, change.after);

    if (change.action === "update") {
      if (touched)
        return await finish("Izmenjen posle uvoza — nije vraćen.").then(() => "skipped" as const);
      await removeBatchImages(ctx, batch, product._id, meta);
      await updateProduct(ctx, product._id, restorePatch(change.before), meta);
      return await finish().then(() => "done" as const);
    }
    if (change.action === "deactivate") {
      if (touched)
        return await finish("Izmenjen posle uvoza — nije ponovo aktiviran.").then(
          () => "skipped" as const,
        );
      await updateProduct(ctx, product._id, { active: true }, meta);
      return await finish().then(() => "done" as const);
    }
    // create
    const ordered = await ctx.db
      .query("orderItems")
      .withIndex("by_productId", (q) => q.eq("productId", product._id))
      .first();
    if (touched || ordered) {
      if (product.active) await updateProduct(ctx, product._id, { active: false }, meta);
      return await finish(
        ordered
          ? "Već je poručen — deaktiviran umesto brisanja."
          : "Izmenjen posle uvoza — deaktiviran umesto brisanja.",
      ).then(() => "skipped" as const);
    }
    const content = await ctx.db
      .query("productContent")
      .withIndex("by_productId", (q) => q.eq("productId", product._id))
      .unique();
    const jobs = await ctx.db
      .query("imageFetchJobs")
      .withIndex("by_batchId_and_productId", (q) =>
        q.eq("batchId", batch._id).eq("productId", product._id),
      )
      .take(50);
    for (const job of jobs) await ctx.db.patch("imageFetchJobs", job._id, { status: "skipped" });
    for (const img of content?.images ?? []) {
      if (img.storageId !== product.primaryImageId) await ctx.storage.delete(img.storageId);
    }
    await deleteProductHard(ctx, product._id);
    return await finish().then(() => "done" as const);
  },
});

export const rollbackChunk = internalMutation({
  args: { batchId: v.id("importBatches") },
  returns: v.null(),
  handler: async (ctx, { batchId }) => {
    const batch = await ctx.db.get("importBatches", batchId);
    if (!batch || batch.status !== "rolling_back") return null;
    const page = await ctx.db
      .query("importChanges")
      .withIndex("by_batchId", (q) => q.eq("batchId", batchId))
      .order("desc")
      .paginate({ numItems: ROWS_PER_CHUNK, cursor: batch.cursor ?? null });
    let processed = 0;
    let skipped = 0;
    let stopped = false;
    for (const change of page.page) {
      if (!(await hasBudget(ctx))) {
        stopped = true;
        break;
      }
      processed++;
      if (change.rolledBack) continue;
      try {
        const result = await ctx.runMutation(internal.importCommit.rollbackOne, {
          changeId: change._id,
        });
        if (result === "skipped") skipped++;
      } catch (error) {
        skipped++;
        await ctx.db.patch("importChanges", change._id, {
          rolledBack: true,
          rollbackSkippedReason: `Greška: ${errorMessage(error)}`,
        });
      }
    }
    const fresh = (await ctx.db.get("importBatches", batchId))!;
    const progress = {
      ...fresh.progress,
      rolledBackRows: fresh.progress.rolledBackRows + processed,
    };
    const counts = {
      ...fresh.counts,
      rollbackSkipped: (fresh.counts.rollbackSkipped ?? 0) + skipped,
    };
    if (stopped) {
      // Same page again: rolled-back changes are skipped by their flag.
      await ctx.db.patch("importBatches", batchId, { progress, counts, updatedAt: Date.now() });
      await ctx.scheduler.runAfter(0, internal.importCommit.rollbackChunk, { batchId });
      return null;
    }
    if (!page.isDone) {
      await ctx.db.patch("importBatches", batchId, {
        progress,
        counts,
        cursor: page.continueCursor,
        updatedAt: Date.now(),
      });
      await ctx.scheduler.runAfter(0, internal.importCommit.rollbackChunk, { batchId });
      return null;
    }
    await ctx.db.patch("importBatches", batchId, {
      status: "rolled_back",
      progress,
      counts,
      cursor: undefined,
      rolledBackAt: Date.now(),
      ...(batch.rollbackActor?.userId ? { rolledBackBy: batch.rollbackActor.userId } : {}),
      updatedAt: Date.now(),
    });
    await audit(ctx, {
      actor: batch.rollbackActor ?? SYSTEM_ACTOR,
      action: "import.rollback",
      entityType: "importBatch",
      entityId: batchId,
      summary: `Poništen uvoz ${batch.fileName}${counts.rollbackSkipped ? ` (${counts.rollbackSkipped} artikala nije vraćeno)` : ""}`,
    });
    return null;
  },
});

/** Removes staged rows of a cancelled batch in chunks (records keep the batch itself). */
export const purgeRows = internalMutation({
  args: { batchId: v.id("importBatches") },
  returns: v.null(),
  handler: async (ctx, { batchId }) => {
    const rows = await ctx.db
      .query("importRows")
      .withIndex("by_batchId_and_rowNumber", (q) => q.eq("batchId", batchId))
      .take(500);
    for (const r of rows) await ctx.db.delete("importRows", r._id);
    if (rows.length === 500)
      await ctx.scheduler.runAfter(0, internal.importCommit.purgeRows, { batchId });
    return null;
  },
});
