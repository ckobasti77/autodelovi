/// <reference types="vite/client" />
import { describe, expect, test, vi } from "vitest";

import { internal } from "./_generated/api";
import { allCategorySlugs } from "../lib/catalog/taxonomy";
import { missingCopy } from "./seedData/categories";
import { makeT } from "./test.setup";

describe("seed", () => {
  test("every category and subcategory has SEO copy", () => {
    expect(missingCopy()).toEqual([]);
  });

  test("is idempotent and fills every table the storefront needs; demo removal keeps reference data", async () => {
    vi.useFakeTimers();
    const t = makeT();
    const first = await t.action(internal.seed.run, {});
    expect(first.productsCreated).toBe(150);
    expect(first.demoOrders).toBe(8);
    expect(first.demoInquiries).toBe(4);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const statsA = await t.query(internal.seed.stats, {});

    const second = await t.action(internal.seed.run, {});
    expect(second).toMatchObject({
      productsCreated: 0,
      productsSkipped: 150,
      demoOrders: 0,
      demoInquiries: 0,
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const statsB = await t.query(internal.seed.stats, {});
    for (const table of [
      "vehicleBrands",
      "vehicleModels",
      "vehicleGenerations",
      "engines",
      "generationEngines",
      "categories",
      "manufacturers",
      "products",
      "productCodes",
      "fitments",
      "priceTiers",
      "orders",
      "inquiries",
      "settings",
    ]) {
      expect(statsB.counts[table], table).toBe(statsA.counts[table]);
    }
    expect(statsA.counts.vehicleBrands).toBe(5);
    expect(statsA.counts.categories).toBe(allCategorySlugs().length + 10);
    expect(statsA.counts.priceTiers).toBe(3);
    expect(statsA.counts.mechanicProfiles).toBe(1);

    // Category counters match the products actually listed.
    const mismatch = await t.run(async (ctx) => {
      const bad: string[] = [];
      for (const c of await ctx.db.query("categories").collect()) {
        const listed = (await ctx.db.query("products").collect()).filter(
          (p) => p.categoryId === c._id && p.active,
        );
        if (listed.length !== c.productCount)
          bad.push(`${c.slug}: ${c.productCount} ≠ ${listed.length}`);
      }
      return bad;
    });
    expect(mismatch).toEqual([]);

    await t.mutation(internal.demo.removeDemoData, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const after = await t.query(internal.seed.stats, {});
    expect(after.demoProducts).toBe(0);
    expect(after.counts.orders).toBe(0);
    expect(after.counts.inquiries).toBe(0);
    expect(after.counts.mechanicProfiles).toBe(0);
    expect(after.counts.fitments).toBe(0);
    expect(after.counts.productCodes).toBe(0);
    expect(after.counts.vehicleGenerations).toBe(statsA.counts.vehicleGenerations);
    expect(after.counts.categories).toBe(statsA.counts.categories);
    expect(after.counts.manufacturers).toBe(statsA.counts.manufacturers);
    const counters = await t.run(async (ctx) =>
      (await ctx.db.query("categories").collect()).filter(
        (c) => c.productCount !== 0 || c.inStockCount !== 0,
      ),
    );
    expect(counters).toEqual([]);
    vi.useRealTimers();
  }, 120_000);
});
