/// <reference types="vite/client" />
import { describe, expect, test, vi } from "vitest";

import { api, internal } from "./_generated/api";
import { pibCheckDigit } from "../lib/domain/identifiers";
import { CONSENT, errorCode, GUEST, makeT, setupWorld, VALID_MB } from "./test.setup";

describe("normalized OEM lookup and search", () => {
  test("every spelling of an OEM number finds the product", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    for (const code of [
      "5Q0 615 301 F",
      "5Q0-615-301-F",
      "5q0615301f",
      "5Q0.615.301 F",
      " 5Q0/615/301F ",
    ]) {
      const hits = await w.anon.query(api.catalog.codes.lookup, { code });
      expect(
        hits.map((h) => h.productId),
        code,
      ).toEqual([w.products.disc]);
      expect(hits[0].kind).toBe("oem");
    }
  });

  test("cross numbers, MPN, SKU and prefix lookups", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    expect((await w.anon.query(api.catalog.codes.lookup, { code: "df 6503" }))[0]).toMatchObject({
      kind: "cross",
      label: "TRW",
    });
    expect((await w.anon.query(api.catalog.codes.lookup, { code: "24.0125-0184.1" }))[0].kind).toBe(
      "mpn",
    );
    expect((await w.anon.query(api.catalog.codes.lookup, { code: "t-disc" }))[0].kind).toBe("sku");
    const prefix = await w.anon.query(api.catalog.codes.lookup, { code: "5Q0", mode: "prefix" });
    expect(prefix).toEqual([]);
    const prefix2 = await w.anon.query(api.catalog.codes.lookup, { code: "5Q06", mode: "prefix" });
    expect(new Set(prefix2.map((h) => h.productId))).toEqual(
      new Set([w.products.disc, w.products.pads]),
    );
  });

  test("search puts exact code hits first and folds diacritics and Cyrillic", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const byCode = await w.anon.query(api.search.run, { q: "5Q0 615 301 F" });
    expect(byCode.kind).toBe("code");
    expect(byCode.exactCodeHit).toBe(true);
    expect(byCode.results[0]).toMatchObject({ match: "exact_code", matchedCode: "5Q0 615 301 F" });
    for (const q of ["kocioni disk", "Kočioni disk", "кочиони диск"]) {
      const res = await w.anon.query(api.search.run, { q });
      expect(
        res.results.map((r) => r.card._id),
        q,
      ).toContain(w.products.disc);
    }
    const zero = await w.anon.query(api.search.run, { q: "nepostojeci deo xyz" });
    expect(zero.results).toEqual([]);
  });

  test("search log writes the daily aggregate and counts zero results", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const client = t.withRequestMetadata({ ip: "198.51.100.1", userAgent: "ua" });
    await client.mutation(api.search.log, {
      query: "Hladnjak Golf 9",
      resultsCount: 0,
      exactCodeHit: false,
      source: "search_page",
    });
    await client.mutation(api.search.log, {
      query: "hladnjak golf 9",
      resultsCount: 0,
      exactCodeHit: false,
      source: "header",
    });
    const zero = await w.asStaff.query(api.search.zeroResults, { days: 1, nowMs: Date.now() });
    expect(zero[0]).toMatchObject({ normalized: "hladnjak golf 9", count: 2, zeroCount: 2 });
  });

  test("category listing filters by vehicle, engine, manufacturer and availability", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const golf7 = { generationId: w.golf7 };
    const discs = await w.anon.query(api.catalog.products.listByCategory, {
      categorySlug: "kocioni-diskovi",
      vehicle: golf7,
    });
    expect(discs!.items.map((i) => i._id)).toEqual([w.products.disc]);
    const pads = await w.anon.query(api.catalog.products.listByCategory, {
      categorySlug: "kocione-plocice",
      vehicle: { ...golf7, engineId: w.tdi110 },
    });
    expect(pads!.total).toBe(1);
    const otherEngine = await t.run(
      async (ctx) =>
        (await ctx.db
          .query("engines")
          .withIndex("by_slug", (q) => q.eq("slug", "1-5-tsi-110kw"))
          .unique())!._id,
    );
    const none = await w.anon.query(api.catalog.products.listByCategory, {
      categorySlug: "kocione-plocice",
      vehicle: { ...golf7, engineId: otherEngine },
    });
    expect(none!.total).toBe(0);
    // Parent category merges its children; universal products join vehicle listings.
    const filters = await w.anon.query(api.catalog.products.listByCategory, {
      categorySlug: "filteri",
    });
    expect(filters!.total).toBe(1);
    const batteries = await w.anon.query(api.catalog.products.listByCategory, {
      categorySlug: "akumulator",
      vehicle: golf7,
    });
    expect(batteries!.total).toBe(1);
    const inStock = await w.anon.query(api.catalog.products.listByCategory, {
      categorySlug: "filter-ulja",
      availability: "in_stock",
    });
    expect(inStock!.total).toBe(0);
    expect(inStock!.facets.allCount).toBe(1);
  });

  test("product page shows fitments with engine and year data; unknown slug is null", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const list = await w.anon.query(api.catalog.products.listByCategory, {
      categorySlug: "kocione-plocice",
    });
    const detail = await w.anon.query(api.catalog.products.bySlug, { slug: list!.items[0].slug });
    expect(detail!.fitments[0]).toMatchObject({
      brandName: "Volkswagen",
      generationName: "Golf VII",
      engineName: "2.0 TDI 110 kW",
    });
    expect(detail!.oemNumbers[0].normalized).toBe("5Q0698151B");
    expect(await w.anon.query(api.catalog.products.bySlug, { slug: "ne-postoji" })).toBeNull();
  });

  test("part panel ranks in-stock and fitting parts first", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const panel = await w.anon.query(api.catalog.products.partPanel, {
      categorySlug: "kocione-plocice",
      vehicle: { generationId: w.golf7 },
    });
    expect(panel!.items[0].fit).toBe("generation_only");
    const exact = await w.anon.query(api.catalog.products.partPanel, {
      categorySlug: "kocione-plocice",
      vehicle: { generationId: w.golf7, engineId: w.tdi110 },
    });
    expect(exact!.items[0].fit).toBe("fits");
    // Unconfirmed parts go last and are counted for the panel notice.
    const firstUnknown = exact!.items.findIndex((i) => i.fit === "unknown");
    if (firstUnknown >= 0) {
      expect(exact!.items.slice(firstUnknown).every((i) => i.fit === "unknown")).toBe(true);
    }
    expect(exact!.unmatched).toBe(exact!.items.filter((i) => i.fit === "unknown").length);
    const noVehicle = await w.anon.query(api.catalog.products.partPanel, {
      categorySlug: "kocione-plocice",
    });
    expect(noVehicle!.unmatched).toBe(0);
  });

  test("vehicle picker queries resolve slugs", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const brands = await w.anon.query(api.catalog.vehicles.brands, {});
    expect(brands.map((b) => b.slug)).toEqual(["volkswagen", "audi", "skoda", "seat", "cupra"]);
    const resolved = await w.anon.query(api.catalog.vehicles.resolve, {
      brandSlug: "volkswagen",
      modelSlug: "golf",
      generationSlug: "golf-7",
      engineSlug: "2-0-tdi-110kw",
    });
    expect(resolved?.label).toBe("Volkswagen Golf VII 2.0 TDI 110 kW");
    const engines = await w.anon.query(api.catalog.vehicles.engines, { generationId: w.golf7 });
    expect(engines.some((e) => e.codes.includes("CRLB"))).toBe(true);
    const tree = await w.anon.query(api.catalog.categories.tree, {});
    expect(tree.systems).toHaveLength(10);
    expect(tree.categories).toHaveLength(44);
    expect(tree.subcategories).toHaveLength(4);
  });
});

describe("product writer invariants", () => {
  test("codes mirror OEM/cross numbers; price and stock changes are recorded; counters move", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const before = (await w.anon.query(api.catalog.categories.bySlug, { slug: "kocioni-diskovi" }))!
      .category;
    await w.asStaff.mutation(api.catalog.productsAdmin.update, {
      productId: w.products.disc,
      patch: { oemNumbers: [{ raw: "5Q0-615-301-G" }], retailPricePara: 1_100_000, stockQty: 0 },
    });
    expect(await w.anon.query(api.catalog.codes.lookup, { code: "5Q0615301F" })).toEqual([]);
    expect(
      (await w.anon.query(api.catalog.codes.lookup, { code: "5Q0615301G" }))[0].productId,
    ).toBe(w.products.disc);
    const history = await w.asStaff.query(api.catalog.productsAdmin.history, {
      productId: w.products.disc,
    });
    expect(history.prices[0]).toMatchObject({ oldRetailPara: 1_000_000, newRetailPara: 1_100_000 });
    expect(history.stock[0]).toMatchObject({ delta: -10, qtyAfter: 0 });
    expect(history.audit[0].action).toBe("product.update");
    const after = (await w.anon.query(api.catalog.categories.bySlug, { slug: "kocioni-diskovi" }))!
      .category;
    expect(after.inStockCount).toBe(before.inStockCount - 1);
    await w.asStaff.mutation(api.catalog.productsAdmin.setActive, {
      productId: w.products.disc,
      active: false,
    });
    expect(
      (await w.anon.query(api.catalog.categories.bySlug, { slug: "kocioni-diskovi" }))!.category
        .productCount,
    ).toBe(before.productCount - 1);
    expect(await w.anon.query(api.catalog.codes.lookup, { code: "5Q0615301G" })).toEqual([]);
  });

  test("a slug change leaves a redirect; duplicate SKUs are refused", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const old = (await t.run(async (ctx) => ctx.db.get("products", w.products.disc)))!.slug;
    await w.asStaff.mutation(api.catalog.productsAdmin.update, {
      productId: w.products.disc,
      patch: { slug: "disk-novi-slug" },
    });
    const redirect = await t.run(async (ctx) =>
      ctx.db
        .query("redirects")
        .withIndex("by_fromPath", (q) => q.eq("fromPath", `/deo/${old}`))
        .unique(),
    );
    expect(redirect?.toPath).toBe("/deo/disk-novi-slug");
    expect(
      await errorCode(() =>
        w.asStaff.mutation(api.catalog.productsAdmin.update, {
          productId: w.products.pads,
          patch: { sku: "T-DISC" },
        }),
      ),
    ).toBe("INVALID");
  });

  test("stock back from zero emits back-in-stock; subscriptions validate", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const client = t.withRequestMetadata({ ip: "192.0.2.5", userAgent: "ua" });
    expect(
      (
        await client.mutation(api.backInStock.subscribe, {
          productId: w.products.filter,
          email: "Kupac@Primer.rs",
          consent: true,
          honeypot: "",
        })
      ).status,
    ).toBe("subscribed");
    expect(
      (
        await client.mutation(api.backInStock.subscribe, {
          productId: w.products.filter,
          email: "kupac@primer.rs",
          consent: true,
          honeypot: "",
        })
      ).status,
    ).toBe("already");
    expect(
      (
        await client.mutation(api.backInStock.subscribe, {
          productId: w.products.disc,
          email: "kupac@primer.rs",
          consent: true,
          honeypot: "",
        })
      ).status,
    ).toBe("in_stock");
    expect(
      await errorCode(() =>
        client.mutation(api.backInStock.subscribe, {
          productId: w.products.filter,
          email: "x",
          consent: true,
          honeypot: "",
        }),
      ),
    ).toBe("INVALID");
    await w.asStaff.mutation(api.catalog.productsAdmin.adjustStock, {
      productId: w.products.filter,
      delta: 4,
      reason: "receipt",
    });
    const events = await t.run(async (ctx) =>
      ctx.db
        .query("domainEvents")
        .withIndex("by_aggregateType_and_aggregateId", (q) =>
          q.eq("aggregateType", "stock").eq("aggregateId", w.products.filter),
        )
        .collect(),
    );
    expect(events.map((e) => e.type)).toContain("stock.back_in_stock");
  });
});

describe("product images", () => {
  test("staff attach images; a fake image is removed after the magic-byte check", async () => {
    vi.useFakeTimers();
    const t = makeT();
    const w = await setupWorld(t);
    const [png, fake] = await t.run(async (ctx) => [
      await ctx.storage.store(
        new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], {
          type: "image/png",
        }),
      ),
      await ctx.storage.store(
        new Blob([new TextEncoder().encode("GIF89a-not-allowed")], { type: "image/png" }),
      ),
    ]);
    expect(
      await errorCode(() =>
        w.asCustomerA.mutation(api.catalog.productsAdmin.attachImage, {
          productId: w.products.disc,
          storageId: png,
          alt: "Disk",
          width: 800,
          height: 600,
        }),
      ),
    ).toBe("FORBIDDEN");
    await w.asStaff.mutation(api.catalog.productsAdmin.attachImage, {
      productId: w.products.disc,
      storageId: png,
      alt: "Kočioni disk ATE",
      width: 800,
      height: 600,
    });
    await w.asStaff.mutation(api.catalog.productsAdmin.attachImage, {
      productId: w.products.disc,
      storageId: fake,
      alt: "Lažna slika",
      width: 10,
      height: 10,
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const card = (
      await w.anon.query(api.catalog.products.liveState, { productIds: [w.products.disc] })
    )[0];
    expect(card.active).toBe(true);
    const detail = await t.run(async (ctx) => ctx.db.get("products", w.products.disc));
    expect(detail?.imageCount).toBe(1);
    expect(detail?.primaryImageId).toBe(png);
    expect(
      await errorCode(() =>
        w.asStaff.mutation(api.catalog.productsAdmin.attachImage, {
          productId: w.products.pads,
          storageId: png,
          alt: "Opet",
          width: 1,
          height: 1,
        }),
      ),
    ).toBe("INVALID");
    vi.useRealTimers();
  });
});

describe("carts", () => {
  test("guest cart merges into the user's cart on sign-in, capped by stock", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    await w.anon.mutation(api.carts.addItem, {
      guestToken: GUEST,
      productId: w.products.pads,
      quantity: 2,
    });
    await w.anon.mutation(api.carts.addItem, {
      guestToken: GUEST,
      productId: w.products.disc,
      quantity: 1,
    });
    await w.asCustomerA.mutation(api.carts.addItem, { productId: w.products.pads, quantity: 1 });
    const r = await w.asCustomerA.mutation(api.carts.mergeGuest, { guestToken: GUEST });
    expect(r.merged).toBe(2);
    const cart = await w.asCustomerA.query(api.carts.get, {});
    const qty = Object.fromEntries(cart.lines.map((l) => [l.productId, l.quantity]));
    expect(qty[w.products.pads]).toBe(2);
    expect(qty[w.products.disc]).toBe(1);
    expect((await w.anon.query(api.carts.get, { guestToken: GUEST })).cartId).toBeNull();
  });

  test("quantities are validated and cart lines are per viewer", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    expect(
      await errorCode(() =>
        w.anon.mutation(api.carts.addItem, {
          guestToken: GUEST,
          productId: w.products.disc,
          quantity: 0,
        }),
      ),
    ).toBe("INVALID");
    expect(
      await errorCode(() =>
        w.anon.mutation(api.carts.addItem, {
          guestToken: "short",
          productId: w.products.disc,
          quantity: 1,
        }),
      ),
    ).toBe("INVALID");
    await w.asMechA.mutation(api.carts.addItem, { productId: w.products.disc, quantity: 2 });
    const cart = await w.asMechA.query(api.carts.get, {});
    expect(cart).toMatchObject({
      itemsRetailPara: 2_000_000,
      itemsPara: 1_800_000,
      discountPara: 200_000,
    });
    const res = await w.asMechA.mutation(api.carts.addMany, {
      items: [
        { productId: w.products.filter, quantity: 1 },
        { productId: w.products.battery, quantity: 1 },
      ],
      source: "quick_order",
    });
    expect(res.added).toEqual([w.products.battery]);
    expect(res.rejected[0].productId).toBe(w.products.filter);
  });
});

describe("mechanic lifecycle", () => {
  test("register → approve → suspend → reactivate, with notifications and user status", async () => {
    vi.useFakeTimers();
    const t = makeT();
    const w = await setupWorld(t);
    const pib = `10000001${pibCheckDigit("10000001")}`;
    const profileId = await w.asCustomerA.mutation(api.mechanics.register, {
      companyName: "Servis A",
      pib,
      mb: VALID_MB,
      contactPerson: "Ana",
      phone: "0641234567",
      city: "Beograd",
      address: "Put 3",
      serviceTypes: ["elektrika"],
      brandsServiced: [],
      consent: CONSENT,
    });
    expect((await w.asCustomerA.query(api.users.viewer, {}))!.mechanicStatus).toBe("pending");
    expect(
      await errorCode(() =>
        w.asStaff.mutation(api.mechanicsAdmin.reject, { profileId, reason: "" }),
      ),
    ).toBe("INVALID");
    await w.asStaff.mutation(api.mechanicsAdmin.approve, {
      profileId,
      tierId: w.tiers.partner,
      creditEnabled: false,
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const bell = await w.asCustomerA.query(api.notifications.mine, {
      paginationOpts: { numItems: 5, cursor: null },
    });
    expect(bell.page[0]).toMatchObject({ kind: "mechanic_approved" });
    expect(
      await errorCode(() =>
        w.asStaff.mutation(api.mechanicsAdmin.approve, {
          profileId,
          tierId: w.tiers.partner,
          creditEnabled: false,
        }),
      ),
    ).toBe("INVALID");
    await w.asStaff.mutation(api.mechanicsAdmin.suspend, { profileId });
    expect(
      (
        await w.asCustomerA.query(api.catalog.products.liveState, { productIds: [w.products.disc] })
      )[0].yourPricePara,
    ).toBeNull();
    await w.asStaff.mutation(api.mechanicsAdmin.reactivate, { profileId });
    expect(
      (
        await w.asCustomerA.query(api.catalog.products.liveState, { productIds: [w.products.disc] })
      )[0].yourPricePara,
    ).toBe(750_000);
    vi.useRealTimers();
  });
});

describe("outbox dispatcher", () => {
  test("dispatch is idempotent: re-running an event does not duplicate notifications", async () => {
    vi.useFakeTimers();
    const t = makeT();
    const w = await setupWorld(t);
    await w.anon.mutation(api.carts.addItem, {
      guestToken: GUEST,
      productId: w.products.disc,
      quantity: 1,
    });
    await w.anon.mutation(api.orders.submit, {
      guestToken: GUEST,
      contact: { firstName: "A", lastName: "B", email: "a@b.rs", phone: "0641112222" },
      delivery: { method: "pickup" },
      payment: { method: "pickup_cash" },
      consent: CONSENT,
      honeypot: "",
      startedAt: 0,
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const event = await t.run(async (ctx) =>
      (await ctx.db.query("domainEvents").collect()).find((e) => e.type === "order.created")!,
    );
    expect(event.status).toBe("done");
    await t.run(async (ctx) => ctx.db.patch("domainEvents", event._id, { status: "failed" }));
    await t.mutation(internal.events.dispatch, { eventId: event._id });
    const notes = await t.run(async (ctx) => ctx.db.query("notifications").collect());
    // One per staff recipient (owner + staff), not duplicated.
    expect(notes.filter((n) => n.kind === "order_new")).toHaveLength(2);
    vi.useRealTimers();
  });
});
