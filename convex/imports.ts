/**
 * Excel import — staff API (docs/IMPORT.md §K4). The browser parses the file in a worker
 * and sends mapped raw cells in chunks; Convex re-validates every row with the same pure
 * validator (lib/import/row.ts), matches existing products, computes the dry-run diff,
 * and commits/rolls back in background chunks (convex/importCommit.ts).
 */
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { formatRsdPlain } from "../lib/domain/money";
import { IMPORT_FIELDS } from "../lib/import/fields";
import { createIssues, validateRow, type RawRow } from "../lib/import/row";
import { actorOf } from "./lib/authz";
import { audit } from "./lib/audit";
import { fail, invalid, notFound } from "./lib/errors";
import { staffMutation, staffQuery } from "./lib/functions";
import {
  diffProduct,
  loadCurrent,
  loadImportReference,
  matchProduct,
  rowContext,
} from "./lib/importModel";
import {
  cellsV,
  importFormatV,
  importModeV,
  importRowDataV,
  importStatusV,
  issueV,
  mappingEntryV,
  numberFormatV,
  rowActionV,
  valueMapsV,
  type ImportRowData,
  type RowAction,
} from "./lib/importValidators";
import { actorV } from "./lib/validators";

export const MAX_IMPORT_ROWS = 50_000;
export const MAX_IMPORT_BYTES = 25 * 1024 * 1024;
export const STAGE_CHUNK = 250;
export const DEACTIVATE_PHRASE = "DEAKTIVIRAJ";

const conflict = (message: string): never => fail("CONFLICT", message);

const MAPPABLE = new Set<string>([...IMPORT_FIELDS, "ignore"]);

// ── Reference data and presets ─────────────────────────────────────────────────────────

export const reference = staffQuery({
  args: {},
  returns: v.object({
    categories: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        slug: v.string(),
        parentName: v.optional(v.string()),
      }),
    ),
    manufacturers: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        slug: v.string(),
        aliases: v.array(v.string()),
      }),
    ),
    vehicles: v.object({
      brands: v.array(v.object({ id: v.string(), name: v.string(), aliases: v.array(v.string()) })),
      models: v.array(
        v.object({
          id: v.string(),
          brandId: v.string(),
          name: v.string(),
          aliases: v.array(v.string()),
        }),
      ),
      generations: v.array(
        v.object({
          id: v.string(),
          brandId: v.string(),
          modelId: v.string(),
          name: v.string(),
          aliases: v.array(v.string()),
          yearFrom: v.number(),
          yearTo: v.optional(v.number()),
        }),
      ),
      engines: v.array(v.object({ id: v.string(), name: v.string(), codes: v.array(v.string()) })),
      links: v.array(v.object({ generationId: v.string(), engineId: v.string() })),
    }),
    vatRateBp: v.number(),
  }),
  handler: async (ctx) => {
    const ref = await loadImportReference(ctx);
    return {
      categories: ref.categories,
      manufacturers: ref.manufacturers.map((m) => ({ ...m, aliases: [...m.aliases] })),
      vehicles: {
        brands: ref.vehicles.brands.map((b) => ({ ...b, aliases: [...b.aliases] })),
        models: ref.vehicles.models.map((m) => ({ ...m, aliases: [...m.aliases] })),
        generations: ref.vehicles.generations.map((g) => ({ ...g, aliases: [...g.aliases] })),
        engines: ref.vehicles.engines.map((e) => ({ ...e, codes: [...e.codes] })),
        links: [...ref.vehicles.links],
      },
      vatRateBp: ref.vatRateBp,
    };
  },
});

const presetV = v.object({
  _id: v.id("importMappingPresets"),
  name: v.string(),
  mapping: v.array(v.object({ headerNormalized: v.string(), field: v.string() })),
  isDefault: v.boolean(),
  updatedAt: v.number(),
});

export const presets = staffQuery({
  args: {},
  returns: v.array(presetV),
  handler: async (ctx) => {
    const rows = await ctx.db.query("importMappingPresets").withIndex("by_name").take(100);
    return rows.map((p) => ({
      _id: p._id,
      name: p.name,
      mapping: p.mapping,
      isDefault: p.isDefault,
      updatedAt: p.updatedAt,
    }));
  },
});

export const savePreset = staffMutation({
  args: {
    name: v.string(),
    mapping: v.array(v.object({ headerNormalized: v.string(), field: v.string() })),
  },
  returns: v.id("importMappingPresets"),
  handler: async (ctx, { name, mapping }) => {
    const clean = name.trim().slice(0, 60);
    if (!clean) invalid("Upišite naziv šablona mapiranja.", "name");
    if (mapping.length === 0 || mapping.length > 80)
      invalid("Šablon mora imati 1–80 kolona.", "mapping");
    for (const m of mapping)
      if (!MAPPABLE.has(m.field)) invalid("Nepoznato polje u šablonu.", "mapping");
    const existing = await ctx.db
      .query("importMappingPresets")
      .withIndex("by_name", (q) => q.eq("name", clean))
      .first();
    const now = Date.now();
    let id: Id<"importMappingPresets">;
    if (existing) {
      await ctx.db.patch("importMappingPresets", existing._id, { mapping, updatedAt: now });
      id = existing._id;
    } else {
      id = await ctx.db.insert("importMappingPresets", {
        name: clean,
        mapping,
        createdBy: ctx.viewer.userId,
        isDefault: false,
        updatedAt: now,
      });
    }
    await audit(ctx, {
      actor: actorOf(ctx.viewer),
      action: "import.preset",
      entityType: "importPreset",
      entityId: id,
      summary: `Sačuvan šablon mapiranja „${clean}“ (${mapping.length} kolona)`,
    });
    return id;
  },
});

export const deletePreset = staffMutation({
  args: { presetId: v.id("importMappingPresets") },
  returns: v.null(),
  handler: async (ctx, { presetId }) => {
    const preset = await ctx.db.get("importMappingPresets", presetId);
    if (!preset) return null;
    await ctx.db.delete("importMappingPresets", presetId);
    await audit(ctx, {
      actor: actorOf(ctx.viewer),
      action: "import.preset_delete",
      entityType: "importPreset",
      entityId: presetId,
      summary: `Obrisan šablon mapiranja „${preset.name}“`,
    });
    return null;
  },
});

// ── Batch lifecycle ────────────────────────────────────────────────────────────────────

export const generateUploadUrl = staffMutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => await ctx.storage.generateUploadUrl(),
});

export const createBatch = staffMutation({
  args: {
    fileName: v.string(),
    fileSize: v.number(),
    format: importFormatV,
    encoding: v.optional(v.union(v.literal("utf-8"), v.literal("windows-1250"))),
    delimiter: v.optional(v.string()),
    sheetName: v.optional(v.string()),
    headerRow: v.number(),
    numberFormat: numberFormatV,
    warnAmbiguous: v.boolean(),
    mode: importModeV,
    mapping: v.array(mappingEntryV),
    presetId: v.optional(v.id("importMappingPresets")),
    valueMaps: v.optional(valueMapsV),
    total: v.number(),
    sourceFileId: v.optional(v.id("_storage")),
  },
  returns: v.id("importBatches"),
  handler: async (ctx, args) => {
    if (args.fileSize > MAX_IMPORT_BYTES) invalid("Fajl je veći od 25 MB.", "file");
    if (!Number.isInteger(args.total) || args.total < 1 || args.total > MAX_IMPORT_ROWS)
      invalid("Fajl mora imati od 1 do 50.000 redova.", "file");
    if (args.mapping.length === 0 || args.mapping.length > 80)
      invalid("Neispravno mapiranje kolona.", "mapping");
    for (const m of args.mapping)
      if (!MAPPABLE.has(m.field)) invalid("Nepoznato polje u mapiranju.", "mapping");
    const batchId = await ctx.db.insert("importBatches", {
      fileName: args.fileName.slice(0, 200),
      fileSize: args.fileSize,
      ...(args.sourceFileId ? { sourceFileId: args.sourceFileId } : {}),
      format: args.format,
      ...(args.encoding ? { encoding: args.encoding } : {}),
      ...(args.delimiter ? { delimiter: args.delimiter.slice(0, 2) } : {}),
      ...(args.sheetName ? { sheetName: args.sheetName.slice(0, 100) } : {}),
      headerRow: args.headerRow,
      numberFormat: args.numberFormat,
      warnAmbiguous: args.warnAmbiguous,
      mode: args.mode,
      deactivateMissing: false,
      mapping: args.mapping.map((m) => ({ ...m, header: m.header.slice(0, 120) })),
      ...(args.presetId ? { presetId: args.presetId } : {}),
      ...(args.valueMaps ? { valueMaps: args.valueMaps } : {}),
      status: "staging",
      counts: {
        total: args.total,
        create: 0,
        update: 0,
        unchanged: 0,
        skip: 0,
        error: 0,
        warning: 0,
        committed: 0,
        failed: 0,
        deactivated: 0,
      },
      progress: { stagedRows: 0, committedRows: 0, rolledBackRows: 0 },
      createdBy: ctx.viewer.userId,
      actor: actorOf(ctx.viewer),
      updatedAt: Date.now(),
    });
    if (args.sourceFileId) {
      const taken = await ctx.db
        .query("uploads")
        .withIndex("by_storageId", (q) => q.eq("storageId", args.sourceFileId!))
        .first();
      if (taken) invalid("Fajl je već priložen.", "file");
      await ctx.db.insert("uploads", {
        storageId: args.sourceFileId,
        purpose: "import_file",
        uploaderKey: `u:${ctx.viewer.userId}`,
        status: "attached",
        attachedTo: { type: "importBatch", id: batchId },
      });
      await ctx.scheduler.runAfter(0, internal.files.sniff, { storageId: args.sourceFileId });
    }
    return batchId;
  },
});

async function requireBatch(
  ctx: { db: QueryCtx["db"] },
  batchId: Id<"importBatches">,
): Promise<Doc<"importBatches">> {
  const batch = await ctx.db.get("importBatches", batchId);
  if (!batch) return notFound("Uvoz ne postoji.");
  return batch;
}

export const stageRows = staffMutation({
  args: {
    batchId: v.id("importBatches"),
    rows: v.array(v.object({ rowNumber: v.number(), cells: cellsV })),
  },
  returns: v.object({
    create: v.number(),
    update: v.number(),
    unchanged: v.number(),
    skip: v.number(),
    error: v.number(),
  }),
  handler: async (ctx, { batchId, rows }) => {
    const batch = await requireBatch(ctx, batchId);
    if (batch.status !== "staging") conflict("Uvoz više nije u pripremi.");
    if (rows.length > STAGE_CHUNK) invalid(`Najviše ${STAGE_CHUNK} redova po slanju.`, "rows");
    const ref = await loadImportReference(ctx);
    const rctx = rowContext(ref, batch);
    const tally: Record<RowAction, number> = {
      create: 0,
      update: 0,
      unchanged: 0,
      skip: 0,
      error: 0,
    };
    let warnings = 0;
    let staged = 0;
    for (const r of rows) {
      const already = await ctx.db
        .query("importRows")
        .withIndex("by_batchId_and_rowNumber", (q) =>
          q.eq("batchId", batchId).eq("rowNumber", r.rowNumber),
        )
        .first();
      if (already) continue; // a retried chunk
      const result = validateRow(r.cells as RawRow, rctx);
      // The validator works with string ids from the same reference data.
      const data = result.data as ImportRowData;
      const errors = [...result.errors];
      const warns = [...result.warnings];
      if (data.sku) {
        const dup = await ctx.db
          .query("importRows")
          .withIndex("by_batchId_and_sku", (q) => q.eq("batchId", batchId).eq("sku", data.sku))
          .first();
        if (dup)
          errors.push({
            code: "SKU_DUPLICATE",
            field: "sku",
            message: `Šifra ${data.sku} se ponavlja u fajlu (prvi put u redu ${dup.rowNumber}).`,
          });
      }
      let action: RowAction = "error";
      let productId: Id<"products"> | undefined;
      let matchKey: "sku" | "oem_manufacturer" | undefined;
      let changed: string[] = [];
      const match = await matchProduct(ctx, data, batch.mode);
      if (match.product) {
        productId = match.product._id;
        matchKey = match.matchKey;
        if (match.warning) warns.push(match.warning);
      } else if (match.error) errors.push(match.error);
      if (errors.length === 0) {
        if (match.product) {
          const diff = diffProduct(await loadCurrent(ctx, match.product, data), data);
          changed = diff.changed;
          action = changed.length > 0 ? "update" : "unchanged";
        } else if (batch.mode === "stock_price") {
          action = "skip";
          warns.push({
            code: "SKU_NOT_FOUND",
            field: "sku",
            message: `Šifra ${data.sku ?? ""} ne postoji — u režimu „samo lager i cene“ red se preskače.`,
          });
        } else {
          const missing = createIssues(result.data);
          if (missing.length > 0) errors.push(...missing);
          else action = "create";
        }
      }
      if (errors.length > 0) action = "error";
      tally[action]++;
      if (warns.length > 0) warnings++;
      staged++;
      await ctx.db.insert("importRows", {
        batchId,
        rowNumber: r.rowNumber,
        ...(data.sku ? { sku: data.sku } : {}),
        data,
        ...(errors.length > 0 || warns.length > 0 ? { raw: r.cells } : {}),
        action,
        errors: errors.slice(0, 20),
        warnings: warns.slice(0, 20),
        ...(productId ? { productId } : {}),
        ...(matchKey ? { matchKey } : {}),
        changedFields: changed.slice(0, 40),
        committed: false,
      });
    }
    const c = batch.counts;
    await ctx.db.patch("importBatches", batchId, {
      counts: {
        ...c,
        create: c.create + tally.create,
        update: c.update + tally.update,
        unchanged: c.unchanged + tally.unchanged,
        skip: c.skip + tally.skip,
        error: c.error + tally.error,
        warning: c.warning + warnings,
      },
      progress: { ...batch.progress, stagedRows: batch.progress.stagedRows + staged },
      updatedAt: Date.now(),
    });
    return tally;
  },
});

export const finalizeStaging = staffMutation({
  args: { batchId: v.id("importBatches") },
  returns: v.null(),
  handler: async (ctx, { batchId }) => {
    const batch = await requireBatch(ctx, batchId);
    if (batch.status !== "staging") conflict("Uvoz više nije u pripremi.");
    await ctx.db.patch("importBatches", batchId, {
      status: "validated",
      validatedAt: Date.now(),
      counts: { ...batch.counts, total: batch.progress.stagedRows },
      ...(batch.mode === "full" ? { missing: { scanned: 0, count: 0, done: false } } : {}),
      updatedAt: Date.now(),
    });
    if (batch.mode === "full") {
      await ctx.scheduler.runAfter(0, internal.importCommit.countMissingChunk, { batchId });
    }
    return null;
  },
});

export const cancel = staffMutation({
  args: { batchId: v.id("importBatches") },
  returns: v.null(),
  handler: async (ctx, { batchId }) => {
    const batch = await requireBatch(ctx, batchId);
    if (batch.status !== "staging" && batch.status !== "validated")
      conflict("Otkazati se može samo uvoz koji još nije pokrenut.");
    await ctx.db.patch("importBatches", batchId, { status: "cancelled", updatedAt: Date.now() });
    await ctx.scheduler.runAfter(0, internal.importCommit.purgeRows, { batchId });
    return null;
  },
});

export const commit = staffMutation({
  args: {
    batchId: v.id("importBatches"),
    deactivateMissing: v.boolean(),
    confirmPhrase: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { batchId, deactivateMissing, confirmPhrase }) => {
    const batch = await requireBatch(ctx, batchId);
    if (batch.status === "committing" || batch.status === "committed") return null; // idempotent
    if (batch.status !== "validated") conflict("Uvoz nije spreman za upis.");
    if (deactivateMissing) {
      if (batch.mode !== "full")
        invalid("Deaktiviranje važi samo za pun uvoz.", "deactivateMissing");
      if ((confirmPhrase ?? "").trim().toUpperCase() !== DEACTIVATE_PHRASE)
        invalid(`Za deaktiviranje upišite ${DEACTIVATE_PHRASE}.`, "confirmPhrase");
    }
    await ctx.db.patch("importBatches", batchId, {
      status: "committing",
      deactivateMissing,
      phase: "rows",
      cursor: undefined,
      actor: actorOf(ctx.viewer),
      updatedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.importCommit.commitChunk, { batchId });
    return null;
  },
});

/** Re-schedules a background phase that stopped (e.g. after a deploy); safe to repeat. */
export const resume = staffMutation({
  args: { batchId: v.id("importBatches") },
  returns: v.null(),
  handler: async (ctx, { batchId }) => {
    const batch = await requireBatch(ctx, batchId);
    if (batch.status === "committing")
      await ctx.scheduler.runAfter(0, internal.importCommit.commitChunk, { batchId });
    else if (batch.status === "rolling_back")
      await ctx.scheduler.runAfter(0, internal.importCommit.rollbackChunk, { batchId });
    else conflict("Uvoz nije u toku.");
    await ctx.db.patch("importBatches", batchId, { updatedAt: Date.now() });
    return null;
  },
});

export const rollback = staffMutation({
  args: { batchId: v.id("importBatches") },
  returns: v.null(),
  handler: async (ctx, { batchId }) => {
    const batch = await requireBatch(ctx, batchId);
    if (batch.status === "rolling_back" || batch.status === "rolled_back") return null;
    if (batch.status !== "committed" && batch.status !== "failed")
      conflict("Poništiti se može samo završen uvoz.");
    await ctx.db.patch("importBatches", batchId, {
      status: "rolling_back",
      cursor: undefined,
      rollbackActor: actorOf(ctx.viewer),
      updatedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.importCommit.rollbackChunk, { batchId });
    return null;
  },
});

// ── Reads ──────────────────────────────────────────────────────────────────────────────

const countsV = v.object({
  total: v.number(),
  create: v.number(),
  update: v.number(),
  unchanged: v.number(),
  skip: v.number(),
  error: v.number(),
  warning: v.number(),
  committed: v.number(),
  failed: v.number(),
  deactivated: v.number(),
  created: v.optional(v.number()),
  updated: v.optional(v.number()),
  rollbackSkipped: v.optional(v.number()),
});

const batchSummaryV = v.object({
  _id: v.id("importBatches"),
  _creationTime: v.number(),
  fileName: v.string(),
  fileSize: v.number(),
  format: importFormatV,
  encoding: v.union(v.string(), v.null()),
  sheetName: v.union(v.string(), v.null()),
  mode: importModeV,
  numberFormat: numberFormatV,
  deactivateMissing: v.boolean(),
  status: importStatusV,
  phase: v.union(v.string(), v.null()),
  counts: countsV,
  progress: v.object({
    stagedRows: v.number(),
    committedRows: v.number(),
    rolledBackRows: v.number(),
  }),
  missing: v.union(
    v.object({ scanned: v.number(), count: v.number(), done: v.boolean() }),
    v.null(),
  ),
  images: v.union(v.object({ total: v.number(), done: v.number(), failed: v.number() }), v.null()),
  actor: v.union(actorV, v.null()),
  rollbackActor: v.union(actorV, v.null()),
  mapping: v.array(mappingEntryV),
  validatedAt: v.union(v.number(), v.null()),
  committedAt: v.union(v.number(), v.null()),
  rolledBackAt: v.union(v.number(), v.null()),
  failureReason: v.union(v.string(), v.null()),
  updatedAt: v.number(),
  hasSourceFile: v.boolean(),
});

function summary(b: Doc<"importBatches">) {
  return {
    _id: b._id,
    _creationTime: b._creationTime,
    fileName: b.fileName,
    fileSize: b.fileSize,
    format: b.format,
    encoding: b.encoding ?? null,
    sheetName: b.sheetName ?? null,
    mode: b.mode,
    numberFormat: b.numberFormat,
    deactivateMissing: b.deactivateMissing,
    status: b.status,
    phase: b.phase ?? null,
    counts: b.counts,
    progress: b.progress,
    missing: b.missing
      ? { scanned: b.missing.scanned, count: b.missing.count, done: b.missing.done }
      : null,
    images: b.images ?? null,
    actor: b.actor ?? null,
    rollbackActor: b.rollbackActor ?? null,
    mapping: b.mapping,
    validatedAt: b.validatedAt ?? null,
    committedAt: b.committedAt ?? null,
    rolledBackAt: b.rolledBackAt ?? null,
    failureReason: b.failureReason ?? null,
    updatedAt: b.updatedAt ?? b._creationTime,
    hasSourceFile: b.sourceFileId !== undefined,
  };
}

export const batch = staffQuery({
  args: { batchId: v.id("importBatches") },
  returns: v.union(batchSummaryV, v.null()),
  handler: async (ctx, { batchId }) => {
    const b = await ctx.db.get("importBatches", batchId);
    return b ? summary(b) : null;
  },
});

export const history = staffQuery({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(batchSummaryV),
  handler: async (ctx, { paginationOpts }) => {
    const page = await ctx.db.query("importBatches").order("desc").paginate(paginationOpts);
    return { ...page, page: page.page.map(summary) };
  },
});

const rowV = v.object({
  _id: v.id("importRows"),
  rowNumber: v.number(),
  sku: v.union(v.string(), v.null()),
  data: importRowDataV,
  action: rowActionV,
  errors: v.array(issueV),
  warnings: v.array(issueV),
  productId: v.union(v.id("products"), v.null()),
  matchKey: v.union(v.string(), v.null()),
  changedFields: v.array(v.string()),
  committed: v.boolean(),
  commitError: v.union(v.string(), v.null()),
  raw: v.union(cellsV, v.null()),
});

function rowOut(r: Doc<"importRows">) {
  return {
    _id: r._id,
    rowNumber: r.rowNumber,
    sku: r.sku ?? null,
    data: r.data,
    action: r.action,
    errors: r.errors,
    warnings: r.warnings,
    productId: r.productId ?? null,
    matchKey: r.matchKey ?? null,
    changedFields: r.changedFields,
    committed: r.committed,
    commitError: r.commitError ?? null,
    raw: r.raw ?? null,
  };
}

export const rows = staffQuery({
  args: {
    batchId: v.id("importBatches"),
    action: v.optional(rowActionV),
    withWarnings: v.optional(v.boolean()),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(rowV),
  handler: async (ctx, { batchId, action, withWarnings, paginationOpts }) => {
    const base = action
      ? ctx.db
          .query("importRows")
          .withIndex("by_batchId_and_action", (q) => q.eq("batchId", batchId).eq("action", action))
      : ctx.db
          .query("importRows")
          .withIndex("by_batchId_and_rowNumber", (q) => q.eq("batchId", batchId));
    const query = withWarnings ? base.filter((q) => q.neq(q.field("warnings"), [])) : base;
    const page = await query.paginate(paginationOpts);
    return { ...page, page: page.page.map(rowOut) };
  },
});

/** Up to 5 rows per action with before → after of the changed fields (dry-run diff). */
export const samples = staffQuery({
  args: { batchId: v.id("importBatches") },
  returns: v.array(
    v.object({
      action: rowActionV,
      rows: v.array(
        v.object({
          rowNumber: v.number(),
          sku: v.union(v.string(), v.null()),
          name: v.union(v.string(), v.null()),
          changes: v.array(
            v.object({
              field: v.string(),
              before: v.union(v.string(), v.null()),
              after: v.union(v.string(), v.null()),
            }),
          ),
          issues: v.array(issueV),
          /** New products: category · price · stock. */
          details: v.union(v.string(), v.null()),
        }),
      ),
    }),
  ),
  handler: async (ctx, { batchId }) => {
    const out = [];
    for (const action of ["create", "update", "unchanged", "skip", "error"] as const) {
      const list = await ctx.db
        .query("importRows")
        .withIndex("by_batchId_and_action", (q) => q.eq("batchId", batchId).eq("action", action))
        .take(5);
      const rowsOut = [];
      for (const r of list) {
        let changes: { field: string; before: string | null; after: string | null }[] = [];
        let name = r.data.name ?? null;
        if (action === "update" && r.productId) {
          const product = await ctx.db.get("products", r.productId);
          if (product) {
            name = product.name;
            const diff = diffProduct(await loadCurrent(ctx, product, r.data), r.data);
            changes = diff.changed.map((field) => ({
              field,
              before: preview(diff.before[field]),
              after: preview(diff.after[field]),
            }));
          }
        }
        rowsOut.push({
          rowNumber: r.rowNumber,
          sku: r.sku ?? null,
          name,
          changes,
          issues: action === "error" ? r.errors.slice(0, 3) : r.warnings.slice(0, 3),
          details:
            action === "create"
              ? [
                  r.data.categoryLabel,
                  r.data.retailPricePara !== undefined
                    ? formatRsdPlain(r.data.retailPricePara)
                    : undefined,
                  `${r.data.stockQty ?? 0} kom.`,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : null,
        });
      }
      out.push({ action, rows: rowsOut });
    }
    return out;
  },
});

/** Short text for a diff value (numbers as-is, lists by count). */
function preview(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) {
    if (value.length === 0) return "—";
    if (typeof value[0] === "object" && value[0] && "raw" in value[0])
      return value
        .map((x: { raw: string }) => x.raw)
        .join("; ")
        .slice(0, 200);
    return `${value.length}`;
  }
  if (typeof value === "object") return JSON.stringify(value).slice(0, 200);
  return String(value).slice(0, 200);
}

export const changes = staffQuery({
  args: { batchId: v.id("importBatches"), paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(
    v.object({
      _id: v.id("importChanges"),
      productId: v.id("products"),
      sku: v.union(v.string(), v.null()),
      name: v.union(v.string(), v.null()),
      action: v.union(v.literal("create"), v.literal("update"), v.literal("deactivate")),
      fields: v.array(v.string()),
      rowNumber: v.union(v.number(), v.null()),
      rolledBack: v.boolean(),
      rollbackSkippedReason: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx, { batchId, paginationOpts }) => {
    const page = await ctx.db
      .query("importChanges")
      .withIndex("by_batchId", (q) => q.eq("batchId", batchId))
      .paginate(paginationOpts);
    const out = [];
    for (const c of page.page) {
      const product = await ctx.db.get("products", c.productId);
      out.push({
        _id: c._id,
        productId: c.productId,
        sku: product?.sku ?? (typeof c.after.sku === "string" ? c.after.sku : null),
        name: product?.name ?? (typeof c.after.name === "string" ? c.after.name : null),
        action: c.action,
        fields: Object.keys(c.action === "update" ? (c.before ?? {}) : c.after),
        rowNumber: c.rowNumber ?? null,
        rolledBack: c.rolledBack,
        rollbackSkippedReason: c.rollbackSkippedReason ?? null,
      });
    }
    return { ...page, page: out };
  },
});

export const imageJobs = staffQuery({
  args: { batchId: v.id("importBatches") },
  returns: v.object({
    pending: v.number(),
    failed: v.array(
      v.object({
        url: v.string(),
        error: v.union(v.string(), v.null()),
        productId: v.id("products"),
      }),
    ),
  }),
  handler: async (ctx, { batchId }) => {
    const pending = await ctx.db
      .query("imageFetchJobs")
      .withIndex("by_batchId_and_status", (q) => q.eq("batchId", batchId).eq("status", "pending"))
      .take(1_000);
    const failed = await ctx.db
      .query("imageFetchJobs")
      .withIndex("by_batchId_and_status", (q) => q.eq("batchId", batchId).eq("status", "failed"))
      .take(50);
    return {
      pending: pending.length,
      failed: failed.map((j) => ({ url: j.url, error: j.error ?? null, productId: j.productId })),
    };
  },
});

/** Signed URL of the original uploaded file (records). */
export const sourceFileUrl = staffQuery({
  args: { batchId: v.id("importBatches") },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, { batchId }) => {
    const b = await ctx.db.get("importBatches", batchId);
    if (!b?.sourceFileId) return null;
    return await ctx.storage.getUrl(b.sourceFileId);
  },
});
