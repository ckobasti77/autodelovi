/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";

import { api, internal } from "./_generated/api";
import { errorCode, makeT, setupWorld } from "./test.setup";

describe("content pages and FAQs (step 12)", () => {
  test("seedContent is idempotent and keeps owner edits", async () => {
    const t = makeT();
    const first = await t.mutation(internal.content.seedContent, {});
    expect(first.pages).toBe(7);
    expect(first.faqs).toBeGreaterThanOrEqual(6);
    const again = await t.mutation(internal.content.seedContent, {});
    expect(again).toEqual({ pages: 0, faqs: 0 });

    const terms = await t.query(api.content.pageBySlug, { slug: "uslovi-koriscenja" });
    expect(terms).toMatchObject({ title: "Uslovi korišćenja i kupovine", needsLegalReview: true, version: 1 });
    expect(terms!.bodyMd).toContain("{{firma.naziv}}");

    // An owner-edited page (version > 1) is never overwritten by the seed.
    await t.run(async (ctx) => {
      const page = await ctx.db
        .query("contentPages")
        .withIndex("by_slug", (q) => q.eq("slug", "o-nama"))
        .unique();
      await ctx.db.patch("contentPages", page!._id, { bodyMd: "Vlasnikov tekst.", version: 2 });
    });
    await t.mutation(internal.content.seedContent, {});
    expect((await t.query(api.content.pageBySlug, { slug: "o-nama" }))!.bodyMd).toBe("Vlasnikov tekst.");

    const faqs = await t.query(api.content.faqs, { scope: "home" });
    expect(faqs.length).toBeGreaterThanOrEqual(6);
    expect(await t.query(api.content.pageBySlug, { slug: "ne-postoji" })).toBeNull();
  });
});

describe("vehicle pages and retired products", () => {
  test("forVehicle counts fitting products per category and filters by engine", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const all = await w.anon.query(api.catalog.products.forVehicle, { generationId: w.golf7 });
    // disc (all engines) + pads (2.0 TDI 110 kW only) fit the Golf VII.
    expect(all.total).toBe(2);
    expect(all.categories.map((c) => c.category.slug).sort()).toEqual(["kocione-plocice", "kocioni-diskovi"]);
    expect(all.top.map((p) => p._id).sort()).toEqual([w.products.disc, w.products.pads].sort());
    // Anonymous projection: no role price, no cost.
    for (const card of all.top) {
      expect(card).not.toHaveProperty("yourPricePara");
      expect(card).not.toHaveProperty("costNetPara");
    }

    const otherEngine = await t.run(async (ctx) => {
      const links = await ctx.db
        .query("generationEngines")
        .withIndex("by_generationId", (q) => q.eq("generationId", w.golf7))
        .take(20);
      return links.find((l) => l.engineId !== w.tdi110)!.engineId;
    });
    const filtered = await w.anon.query(api.catalog.products.forVehicle, {
      generationId: w.golf7,
      engineId: otherEngine,
    });
    expect(filtered.total).toBe(1);
    expect(filtered.top[0]._id).toBe(w.products.disc);
  });

  test("retired returns inactive products only", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const slug = await t.run(async (ctx) => {
      const p = (await ctx.db.get("products", w.products.filter))!;
      await ctx.db.patch("products", p._id, { active: false });
      return p.slug;
    });
    expect(await w.anon.query(api.catalog.products.bySlug, { slug })).toBeNull();
    const retired = await w.anon.query(api.catalog.products.retired, { slug });
    expect(retired).toMatchObject({ manufacturerName: expect.any(String) });
    expect(retired!.category).not.toBeNull();

    const liveSlug = await t.run(async (ctx) => (await ctx.db.get("products", w.products.disc))!.slug);
    expect(await w.anon.query(api.catalog.products.retired, { slug: liveSlug })).toBeNull();
  });

  test("the vehicle tree nests models and generations", async () => {
    const t = makeT();
    await setupWorld(t);
    const tree = await t.query(api.catalog.vehicles.tree, {});
    const vw = tree.find((b) => b.brand.slug === "volkswagen");
    expect(vw).toBeDefined();
    const golf = vw!.models.find((m) => m.model.slug === "golf");
    expect(golf!.generations.some((g) => g.slug === "golf-7")).toBe(true);
  });
});

describe("saved vehicles (account)", () => {
  test("owner-only: add, list, remove; other users and anonymous are refused", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    expect(
      await errorCode(() => w.anon.mutation(api.account.addSavedVehicle, { brandSlug: "volkswagen" })),
    ).toBe("UNAUTHENTICATED");

    const id = await w.asCustomerA.mutation(api.account.addSavedVehicle, {
      brandSlug: "volkswagen",
      modelSlug: "golf",
      generationSlug: "golf-7",
      engineSlug: "2-0-tdi-110kw",
      vin: "wvwzzz1kz8w123456",
      plate: "ns 123-ab",
    });
    // The same vehicle twice is one row.
    expect(
      await w.asCustomerA.mutation(api.account.addSavedVehicle, {
        brandSlug: "volkswagen",
        modelSlug: "golf",
        generationSlug: "golf-7",
        engineSlug: "2-0-tdi-110kw",
        vin: "WVWZZZ1KZ8W123456",
      }),
    ).toBe(id);

    const mine = await w.asCustomerA.query(api.account.savedVehicles, {});
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({
      generationSlug: "golf-7",
      engineSlug: "2-0-tdi-110kw",
      vin: "WVWZZZ1KZ8W123456",
      plate: "NS 123-AB",
    });
    expect(await w.asCustomerB.query(api.account.savedVehicles, {})).toEqual([]);
    expect(await errorCode(() => w.asCustomerB.mutation(api.account.removeSavedVehicle, { id }))).toBe(
      "NOT_FOUND",
    );
    expect(
      await errorCode(() =>
        w.asCustomerA.mutation(api.account.addSavedVehicle, { brandSlug: "volkswagen", vin: "KRATAK" }),
      ),
    ).toBe("INVALID");

    await w.asCustomerA.mutation(api.account.removeSavedVehicle, { id });
    expect(await w.asCustomerA.query(api.account.savedVehicles, {})).toEqual([]);
  });
});
