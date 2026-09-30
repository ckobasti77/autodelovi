/// <reference types="vite/client" />
/**
 * Step 16 — Excel import: authorization, staging (validation, matching, duplicates, retried
 * chunks), commit through productWriter with records, idempotency, failure isolation,
 * rollback (restore, delete, skip when touched), stock/price mode, OEM + manufacturer
 * fallback, deactivate-missing and image fetching.
 */
import { afterEach, describe, expect, test, vi } from "vitest";

import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { errorCode, makeT, setupWorld, type T, type World } from "./test.setup";

type Cells = Record<string, string | number | boolean | null>;

const MAPPING = [
  { column: 0, header: "Šifra", field: "sku" },
  { column: 1, header: "Naziv", field: "name" },
  { column: 2, header: "Kategorija", field: "category" },
  { column: 3, header: "Proizvođač", field: "manufacturer" },
  { column: 4, header: "MP cena", field: "priceRetail" },
  { column: 5, header: "Količina", field: "stock" },
];

async function newBatch(
  w: World,
  rows: Cells[],
  opts: { mode?: "full" | "stock_price"; fileName?: string } = {},
): Promise<Id<"importBatches">> {
  const batchId = await w.asStaff.mutation(api.imports.createBatch, {
    fileName: opts.fileName ?? "cenovnik.xlsx",
    fileSize: 12_000,
    format: "xlsx",
    headerRow: 0,
    numberFormat: "sr",
    warnAmbiguous: false,
    mode: opts.mode ?? "full",
    mapping: MAPPING,
    total: rows.length,
  });
  await w.asStaff.mutation(api.imports.stageRows, {
    batchId,
    rows: rows.map((cells, i) => ({ rowNumber: i + 2, cells })),
  });
  await w.asStaff.mutation(api.imports.finalizeStaging, { batchId });
  return batchId;
}

async function rowsOf(w: World, batchId: Id<"importBatches">) {
  return (
    await w.asStaff.query(api.imports.rows, {
      batchId,
      paginationOpts: { numItems: 100, cursor: null },
    })
  ).page;
}

async function names(t: T) {
  return await t.run(async (ctx) => {
    const cat = async (slug: string) =>
      (await ctx.db
        .query("categories")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .unique())!.name;
    return { disc: await cat("kocioni-diskovi"), pads: await cat("kocione-plocice") };
  });
}

async function product(t: T, sku: string) {
  return await t.run(async (ctx) =>
    ctx.db
      .query("products")
      .withIndex("by_sku", (q) => q.eq("sku", sku))
      .first(),
  );
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("authorization", () => {
  test("only staff can use the import API", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    for (const who of [w.anon, w.asCustomerA, w.asMechA]) {
      expect(await errorCode(() => who.query(api.imports.reference, {}))).toMatch(
        /UNAUTHENTICATED|FORBIDDEN/,
      );
      expect(
        await errorCode(() =>
          who.mutation(api.imports.createBatch, {
            fileName: "x.csv",
            fileSize: 10,
            format: "csv",
            headerRow: 0,
            numberFormat: "sr",
            warnAmbiguous: false,
            mode: "full",
            mapping: MAPPING,
            total: 1,
          }),
        ),
      ).toMatch(/UNAUTHENTICATED|FORBIDDEN/);
    }
    const batchId = await newBatch(w, [{ sku: "T-DISC", priceRetail: "13.990" }]);
    for (const who of [w.anon, w.asCustomerA, w.asMechA]) {
      expect(
        await errorCode(() =>
          who.mutation(api.imports.commit, { batchId, deactivateMissing: false }),
        ),
      ).toMatch(/UNAUTHENTICATED|FORBIDDEN/);
      expect(await errorCode(() => who.mutation(api.imports.rollback, { batchId }))).toMatch(
        /UNAUTHENTICATED|FORBIDDEN/,
      );
      expect(await errorCode(() => who.query(api.imports.batch, { batchId }))).toMatch(
        /UNAUTHENTICATED|FORBIDDEN/,
      );
      expect(
        await errorCode(() =>
          who.query(api.exportsAdmin.productsPage, {
            paginationOpts: { numItems: 5, cursor: null },
          }),
        ),
      ).toMatch(/UNAUTHENTICATED|FORBIDDEN/);
    }
  });
});

describe("staging", () => {
  test("validates, matches and diffs every row; a retried chunk is not staged twice", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const n = await names(t);
    const rows: Cells[] = [
      {
        sku: "IMP-1",
        name: "Disk zadnji 272 mm",
        category: n.disc,
        manufacturer: "ATE",
        priceRetail: "8.490,00",
        stock: "3",
      },
      { sku: "T-DISC", priceRetail: "13.990" },
      { sku: "T-PADS", priceRetail: "5.000" },
      { sku: "IMP-1", name: "Duplikat", category: n.disc, manufacturer: "ATE", priceRetail: "1" },
      {
        sku: "IMP-2",
        name: "Nepoznato",
        category: "Nepostojeća kategorija",
        manufacturer: "ATE",
        priceRetail: "10",
      },
      { sku: "IMP-3", category: n.pads, manufacturer: "ATE", priceRetail: "10" },
      {
        sku: "IMP-4",
        name: "Negativno",
        category: n.pads,
        manufacturer: "ATE",
        priceRetail: "10",
        stock: "-3",
      },
      {
        sku: "IMP-5",
        name: "Loša cena",
        category: n.pads,
        manufacturer: "ATE",
        priceRetail: "12,99a",
      },
    ];
    const batchId = await w.asStaff.mutation(api.imports.createBatch, {
      fileName: "cenovnik.xlsx",
      fileSize: 12_000,
      format: "xlsx",
      headerRow: 0,
      numberFormat: "sr",
      warnAmbiguous: false,
      mode: "full",
      mapping: MAPPING,
      total: rows.length,
    });
    const chunk = rows.map((cells, i) => ({ rowNumber: i + 2, cells }));
    await w.asStaff.mutation(api.imports.stageRows, { batchId, rows: chunk });
    await w.asStaff.mutation(api.imports.stageRows, { batchId, rows: chunk }); // retry
    await w.asStaff.mutation(api.imports.finalizeStaging, { batchId });

    const staged = await rowsOf(w, batchId);
    expect(staged).toHaveLength(8);
    const by = (rowNumber: number) => staged.find((r) => r.rowNumber === rowNumber)!;
    expect(by(2).action).toBe("create");
    expect(by(2).data).toMatchObject({ retailPricePara: 849_000, stockQty: 3 });
    expect(by(3)).toMatchObject({
      action: "update",
      changedFields: ["retailPricePara"],
      matchKey: "sku",
    });
    expect(by(4).action).toBe("unchanged");
    expect(by(5).errors[0]?.code).toBe("SKU_DUPLICATE");
    expect(by(6).errors[0]?.code).toBe("CATEGORY_UNKNOWN");
    expect(by(7).errors.map((e) => e.code)).toContain("NAME_MISSING");
    expect(by(8).errors[0]?.code).toBe("STOCK_NEGATIVE");
    expect(by(9).errors[0]?.code).toBe("PRICE_INVALID");
    expect(by(6).raw).toMatchObject({ category: "Nepostojeća kategorija" });

    const batch = (await w.asStaff.query(api.imports.batch, { batchId }))!;
    expect(batch.status).toBe("validated");
    expect(batch.counts).toMatchObject({ total: 8, create: 1, update: 1, unchanged: 1, error: 5 });

    const samples = await w.asStaff.query(api.imports.samples, { batchId });
    const update = samples.find((s) => s.action === "update")!.rows[0]!;
    expect(update.changes).toEqual([
      { field: "retailPricePara", before: "1000000", after: "1399000" },
    ]);
    expect(
      await errorCode(() => w.asStaff.mutation(api.imports.stageRows, { batchId, rows: chunk })),
    ).toBe("CONFLICT");
  });

  test("stock/price mode skips unknown SKUs and ignores catalog columns", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const batchId = await newBatch(
      w,
      [
        { sku: "T-FILTER", name: "Ne menja se", stock: "12", priceRetail: "1.100" },
        { sku: "NEPOSTOJI-9", stock: "5" },
      ],
      { mode: "stock_price" },
    );
    const staged = await rowsOf(w, batchId);
    expect(staged[0]).toMatchObject({ action: "update" });
    expect(staged[0]!.changedFields.sort()).toEqual(["retailPricePara", "stockQty"]);
    expect(staged[1]).toMatchObject({ action: "skip" });
    expect(staged[1]!.warnings[0]?.code).toBe("SKU_NOT_FOUND");
  });

  test("OEM number + manufacturer find a product when the SKU is unknown", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const batchId = await w.asStaff.mutation(api.imports.createBatch, {
      fileName: "dobavljac.csv",
      fileSize: 100,
      format: "csv",
      encoding: "windows-1250",
      delimiter: ";",
      headerRow: 0,
      numberFormat: "sr",
      warnAmbiguous: false,
      mode: "full",
      mapping: [
        { column: 0, header: "Kat. br.", field: "oem" },
        { column: 1, header: "Brend", field: "manufacturer" },
        { column: 2, header: "Lager", field: "stock" },
      ],
      total: 1,
    });
    await w.asStaff.mutation(api.imports.stageRows, {
      batchId,
      rows: [{ rowNumber: 2, cells: { oem: "5Q0698151B", manufacturer: "Brembo", stock: "9" } }],
    });
    const [row] = await rowsOf(w, batchId);
    expect(row).toMatchObject({
      action: "update",
      matchKey: "oem_manufacturer",
      productId: w.products.pads,
    });
  });
});

describe("commit and rollback", () => {
  test("commits through the product writer with records, once, and rolls back", async () => {
    vi.useFakeTimers();
    const t = makeT();
    const w = await setupWorld(t);
    const n = await names(t);
    const batchId = await newBatch(w, [
      {
        sku: "IMP-1",
        name: "Disk zadnji 272 mm",
        category: n.disc,
        manufacturer: "ATE",
        priceRetail: "8.490",
        stock: "3",
      },
      { sku: "T-DISC", priceRetail: "13.990", stock: "7" },
      {
        sku: "IMP-2",
        name: "Bez kategorije",
        category: "Nema je",
        manufacturer: "ATE",
        priceRetail: "10",
      },
      {
        sku: "IMP-3",
        name: "Nov proizvođač",
        category: n.pads,
        manufacturer: "Novi Brend DOO",
        priceRetail: "2.000",
      },
    ]);
    await w.asStaff.mutation(api.imports.commit, { batchId, deactivateMissing: false });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    // A repeated commit call is a no-op.
    await w.asStaff.mutation(api.imports.commit, { batchId, deactivateMissing: false });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const batch = (await w.asStaff.query(api.imports.batch, { batchId }))!;
    expect(batch.status).toBe("committed");
    expect(batch.counts).toMatchObject({ created: 2, updated: 1, failed: 0, error: 1 });

    const created = (await product(t, "IMP-1"))!;
    expect(created).toMatchObject({
      retailPricePara: 849_000,
      stockQty: 3,
      source: "import",
      importBatchId: batchId,
    });
    const disc = (await product(t, "T-DISC"))!;
    expect(disc).toMatchObject({
      retailPricePara: 1_399_000,
      stockQty: 7,
      lastImportBatchId: batchId,
    });
    const maker = await t.run(async (ctx) =>
      ctx.db
        .query("manufacturers")
        .withIndex("by_name", (q) => q.eq("name", "Novi Brend DOO"))
        .first(),
    );
    expect(maker?.source).toBe("import");

    const records = await t.run(async (ctx) => ({
      prices: await ctx.db
        .query("priceChanges")
        .withIndex("by_productId_and_at", (q) => q.eq("productId", disc._id))
        .collect(),
      moves: await ctx.db
        .query("stockMovements")
        .withIndex("by_importBatchId", (q) => q.eq("importBatchId", batchId))
        .collect(),
      changes: await ctx.db
        .query("importChanges")
        .withIndex("by_batchId", (q) => q.eq("batchId", batchId))
        .collect(),
      audit: await ctx.db
        .query("auditLog")
        .withIndex("by_action_and_at", (q) => q.eq("action", "import.commit"))
        .collect(),
      notes: await ctx.db.query("notifications").collect(),
    }));
    expect(records.prices.at(-1)).toMatchObject({
      reason: "import",
      importBatchId: batchId,
      oldRetailPara: 1_000_000,
    });
    // IMP-1 (0 → 3) and T-DISC (10 → 7); IMP-3 starts at 0, so no movement.
    expect(records.moves.map((m) => m.reason)).toEqual(["import", "import"]);
    expect(records.changes).toHaveLength(3);
    expect(records.changes.find((c) => c.action === "update")?.before).toMatchObject({
      retailPricePara: 1_000_000,
      stockQty: 10,
    });
    expect(records.audit).toHaveLength(1);
    expect(records.notes.some((x) => x.kind === "import_done")).toBe(true);

    // Product history shows the import.
    const history = await w.asStaff.query(api.catalog.productsAdmin.history, {
      productId: disc._id,
    });
    expect(history.audit.some((a) => a.action === "import.update")).toBe(true);

    await w.asStaff.mutation(api.imports.rollback, { batchId });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const after = (await w.asStaff.query(api.imports.batch, { batchId }))!;
    expect(after.status).toBe("rolled_back");
    expect(await product(t, "IMP-1")).toBeNull();
    expect(await product(t, "IMP-3")).toBeNull();
    expect(await product(t, "T-DISC")).toMatchObject({ retailPricePara: 1_000_000, stockQty: 10 });
    const rollbackMoves = await t.run(async (ctx) =>
      ctx.db
        .query("stockMovements")
        .withIndex("by_productId_and_at", (q) => q.eq("productId", disc._id))
        .collect(),
    );
    expect(rollbackMoves.at(-1)?.reason).toBe("import_rollback");
  });

  test("a row that fails on commit is recorded and does not stop the others", async () => {
    vi.useFakeTimers();
    const t = makeT();
    const w = await setupWorld(t);
    const n = await names(t);
    const batchId = await newBatch(w, [
      { sku: "IMP-A", name: "Prvi", category: n.disc, manufacturer: "ATE", priceRetail: "1.000" },
      { sku: "IMP-B", name: "Drugi", category: n.disc, manufacturer: "ATE", priceRetail: "2.000" },
    ]);
    // Someone creates IMP-A by hand between the preview and the commit.
    const staffBatch = await newBatch(w, [
      { sku: "IMP-A", name: "Ručno", category: n.disc, manufacturer: "ATE", priceRetail: "500" },
    ]);
    await w.asStaff.mutation(api.imports.commit, { batchId: staffBatch, deactivateMissing: false });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    await w.asStaff.mutation(api.imports.commit, { batchId, deactivateMissing: false });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const batch = (await w.asStaff.query(api.imports.batch, { batchId }))!;
    expect(batch.counts).toMatchObject({ created: 1, failed: 1 });
    const failed = (await rowsOf(w, batchId)).find((r) => r.sku === "IMP-A")!;
    expect(failed.commitError).toContain("već postoji");
    expect((await product(t, "IMP-A"))?.name).toBe("Ručno");
    expect(await product(t, "IMP-B")).not.toBeNull();
  });

  test("rollback leaves products changed after the import alone", async () => {
    vi.useFakeTimers();
    const t = makeT();
    const w = await setupWorld(t);
    const batchId = await newBatch(w, [{ sku: "T-BATT", priceRetail: "13.000" }]);
    await w.asStaff.mutation(api.imports.commit, { batchId, deactivateMissing: false });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    await w.asStaff.mutation(api.catalog.productsAdmin.update, {
      productId: w.products.battery,
      patch: { retailPricePara: 1_450_000 },
    });
    await w.asStaff.mutation(api.imports.rollback, { batchId });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect((await product(t, "T-BATT"))?.retailPricePara).toBe(1_450_000);
    const changes = (
      await w.asStaff.query(api.imports.changes, {
        batchId,
        paginationOpts: { numItems: 10, cursor: null },
      })
    ).page;
    expect(changes[0]?.rollbackSkippedReason).toContain("Izmenjen posle uvoza");
    expect((await w.asStaff.query(api.imports.batch, { batchId }))?.counts.rollbackSkipped).toBe(1);
  });

  test("deactivate-missing needs the typed phrase, spares demo products and is undone by rollback", async () => {
    vi.useFakeTimers();
    const t = makeT();
    const w = await setupWorld(t);
    const demo = await t.run(async (ctx) => {
      await ctx.db.patch("products", w.products.turbo, { isDemo: true });
      return w.products.turbo;
    });
    const batchId = await newBatch(w, [{ sku: "T-DISC", stock: "5" }]);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const preview = (await w.asStaff.query(api.imports.batch, { batchId }))!;
    // pads, filter, battery (turbo is demo; disc is in the file)
    expect(preview.missing).toMatchObject({ done: true, count: 3 });
    expect(
      await errorCode(() =>
        w.asStaff.mutation(api.imports.commit, {
          batchId,
          deactivateMissing: true,
          confirmPhrase: "da",
        }),
      ),
    ).toBe("INVALID");
    await w.asStaff.mutation(api.imports.commit, {
      batchId,
      deactivateMissing: true,
      confirmPhrase: "deaktiviraj",
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const done = (await w.asStaff.query(api.imports.batch, { batchId }))!;
    expect(done.counts.deactivated).toBe(3);
    expect((await product(t, "T-PADS"))?.active).toBe(false);
    expect((await product(t, "T-DISC"))?.active).toBe(true);
    expect((await t.run(async (ctx) => ctx.db.get("products", demo)))?.active).toBe(true);

    await w.asStaff.mutation(api.imports.rollback, { batchId });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect((await product(t, "T-PADS"))?.active).toBe(true);
    expect((await product(t, "T-BATT"))?.active).toBe(true);
  });

  test("image URLs are fetched after commit, verified and removed on rollback", async () => {
    vi.useFakeTimers();
    const png = new Uint8Array(64);
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    png.set([0, 0, 0x03, 0x20], 16);
    png.set([0, 0, 0x02, 0x58], 20);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        String(url).includes("dobra")
          ? new Response(png, { status: 200, headers: { "content-type": "image/png" } })
          : String(url).includes("preusmeri")
            ? // A public URL that redirects into the metadata service (SSRF via redirect).
              new Response(null, {
                status: 302,
                headers: { location: "http://169.254.169.254/latest/meta-data" },
              })
            : new Response("<html>nije slika</html>", {
                status: 200,
                headers: { "content-type": "image/png" },
              }),
      ),
    );
    const t = makeT();
    const w = await setupWorld(t);
    const n = await names(t);
    const batchId = await w.asStaff.mutation(api.imports.createBatch, {
      fileName: "slike.xlsx",
      fileSize: 100,
      format: "xlsx",
      headerRow: 0,
      numberFormat: "sr",
      warnAmbiguous: false,
      mode: "full",
      mapping: [...MAPPING, { column: 6, header: "Slike (URL)", field: "images" }],
      total: 1,
    });
    await w.asStaff.mutation(api.imports.stageRows, {
      batchId,
      rows: [
        {
          rowNumber: 2,
          cells: {
            sku: "IMP-IMG",
            name: "Disk sa slikom",
            category: n.disc,
            manufacturer: "ATE",
            priceRetail: "3.000",
            images:
              "https://cdn.primer.rs/dobra.png; https://cdn.primer.rs/losa.png; http://127.0.0.1/x.png; https://cdn.primer.rs/preusmeri.png",
          },
        },
      ],
    });
    await w.asStaff.mutation(api.imports.finalizeStaging, { batchId });
    await w.asStaff.mutation(api.imports.commit, { batchId, deactivateMissing: false });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const created = (await product(t, "IMP-IMG"))!;
    expect(created.imageCount).toBe(1);
    const batch = (await w.asStaff.query(api.imports.batch, { batchId }))!;
    expect(batch.images).toEqual({ total: 4, done: 1, failed: 3 });
    const jobs = await w.asStaff.query(api.imports.imageJobs, { batchId });
    expect(jobs.failed.map((j) => j.error).sort()).toEqual([
      "Adresa nije ispravna ili vodi na privatnu mrežu.",
      "Adresa preusmerava na nedozvoljenu adresu.",
      "Sadržaj nije JPEG, PNG ni WebP slika.",
    ]);

    await w.asStaff.mutation(api.imports.rollback, { batchId });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await product(t, "IMP-IMG")).toBeNull();
  });

  test("cancel purges the staged rows", async () => {
    vi.useFakeTimers();
    const t = makeT();
    const w = await setupWorld(t);
    const batchId = await newBatch(w, [{ sku: "T-DISC", priceRetail: "1.000" }]);
    await w.asStaff.mutation(api.imports.cancel, { batchId });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await rowsOf(w, batchId)).toHaveLength(0);
    expect((await w.asStaff.query(api.imports.batch, { batchId }))?.status).toBe("cancelled");
    expect(
      await errorCode(() =>
        w.asStaff.mutation(api.imports.commit, { batchId, deactivateMissing: false }),
      ),
    ).toBe("CONFLICT");
  });

  test("the commit row function is idempotent", async () => {
    vi.useFakeTimers();
    const t = makeT();
    const w = await setupWorld(t);
    const batchId = await newBatch(w, [{ sku: "T-FILTER", stock: "4" }]);
    await w.asStaff.mutation(api.imports.commit, { batchId, deactivateMissing: false });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const [row] = await rowsOf(w, batchId);
    expect(await t.mutation(internal.importCommit.commitRow, { rowId: row!._id })).toBe("skipped");
    const moves = await t.run(async (ctx) =>
      ctx.db
        .query("stockMovements")
        .withIndex("by_importBatchId", (q) => q.eq("importBatchId", batchId))
        .collect(),
    );
    expect(moves).toHaveLength(1);
  });
});

describe("exports", () => {
  test("product export pages include cost and category labels", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const page = await w.asStaff.query(api.exportsAdmin.productsPage, {
      paginationOpts: { numItems: 50, cursor: null },
    });
    const battery = page.page.find((p) => p.sku === "T-BATT")!;
    expect(battery).toMatchObject({
      costNetPara: 950_000,
      active: true,
      retailPricePara: 1_200_000,
    });
    const pads = page.page.find((p) => p.sku === "T-PADS")!;
    expect(pads.oem).toEqual(["5Q0 698 151 B"]);
    expect(pads.fitments).toHaveLength(1);
  });
});
