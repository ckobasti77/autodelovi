/// <reference types="vite/client" />
/**
 * Step 19: landing statistics + thin-content guard, public SEO read models, the Meta
 * Conversions API channel (mocked fetch), consent log, sources report, offline conversions and
 * ads landings (staff writes, public read).
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { SYSTEM_ACTOR } from "./lib/authz";
import { createProduct } from "./lib/productWriter";
import { recomputeCategory } from "./landings";
import { belgradeConversionTime } from "./seoAdmin";
import { CONSENT, checkoutArgs, errorCode, GUEST, makeT, setupWorld, type T, type World } from "./test.setup";

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("EMAIL_MODE", "");
  vi.stubEnv("RESEND_API_KEY", "");
  vi.stubEnv("META_CAPI_TOKEN", "");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function drain(t: T) {
  await t.finishAllScheduledFunctions(vi.runAllTimers);
}

/** Adds `count` pads fitting Golf VII (alternating makers), `inStock` of them available. */
async function addPads(t: T, count: number, inStock: number, makers = ["brembo", "ate"]) {
  await t.run(async (ctx) => {
    const category = (await ctx.db
      .query("categories")
      .withIndex("by_slug", (q) => q.eq("slug", "kocione-plocice"))
      .unique())!;
    const golf7 = (await ctx.db
      .query("vehicleGenerations")
      .withIndex("by_slug", (q) => q.eq("slug", "golf-7"))
      .first())!;
    for (let i = 0; i < count; i++) {
      const maker = (await ctx.db
        .query("manufacturers")
        .withIndex("by_slug", (q) => q.eq("slug", makers[i % makers.length]!))
        .unique())!;
      await createProduct(
        ctx,
        {
          sku: `T-PAD-${i}`,
          name: `Pločice ${i}`,
          categoryId: category._id,
          manufacturerId: maker._id,
          oemNumbers: [{ raw: `5Q0 698 15${i} A` }],
          crossNumbers: [],
          retailPricePara: 300_000 + i * 10_000,
          stockQty: i < inStock ? 5 : 0,
          allowBackorder: false,
          universal: false,
          fitments: [{ brandId: golf7.brandId, modelId: golf7.modelId, generationId: golf7._id }],
          specs: [],
          active: true,
          isDemo: false,
          source: "manual",
        },
        { actor: SYSTEM_ACTOR, emit: false },
      );
    }
  });
}

async function landingRows(t: T) {
  return await t.run(async (ctx) => await ctx.db.query("landingStats").take(500));
}

describe("landing statistics and the thin-content guard", () => {
  test("rows per brand and model with counts, price range and makers", async () => {
    const t = makeT();
    await setupWorld(t);
    await addPads(t, 7, 3);
    await t.mutation(internal.landings.recompute, {});
    await drain(t);
    const rows = (await landingRows(t)).filter((r) => r.categorySlug === "kocione-plocice");
    const brand = rows.find((r) => !r.modelId)!;
    const model = rows.find((r) => r.modelId)!;
    // 7 new pads + the world's pads (T-PADS, Golf VII, in stock 2).
    expect(brand).toMatchObject({ brandSlug: "volkswagen", productCount: 8, inStockCount: 4 });
    expect(model).toMatchObject({ modelSlug: "golf", productCount: 8 });
    expect(model.manufacturers.map((m) => m.name).sort()).toEqual(["ATE", "Brembo"]);
    expect(model.minPricePara).toBe(300_000);
    expect(model.topOems.length).toBeGreaterThan(0);
    expect(model.generationCounts[0]).toMatchObject({ count: 8 });
    // Brand needs 8 (met), model 6 (met); both have ≥ 2 in stock and 2 makers.
    expect(brand.indexable).toBe(true);
    expect(model.indexable).toBe(true);
  });

  test("below the minimum, too few in stock or one maker and one generation → noindex", async () => {
    const t = makeT();
    await setupWorld(t);
    await addPads(t, 4, 1, ["brembo"]);
    await t.mutation(internal.landings.recompute, {});
    await drain(t);
    const model = (await landingRows(t)).find(
      (r) => r.categorySlug === "kocione-plocice" && r.modelId,
    )!;
    expect(model.productCount).toBe(5);
    expect(model.indexable).toBe(false);
    expect(model.reason).toBe("few_products");

    await t.run(async (ctx) => {
      const settings = (await ctx.db.query("settings").first())!;
      await ctx.db.patch("settings", settings._id, {
        seo: { ...settings.seo, landingMin: { ...settings.seo.landingMin, model: 5 } },
      });
    });
    await t.mutation(internal.landings.rank, {});
    const again = (await landingRows(t)).find((r) => r._id === model._id)!;
    // Enough products now, still: 1 maker (Brembo ×4 + T-PADS Brembo) and one generation.
    expect(again.reason).toBe("low_variety");
  });

  test("the global cap admits the best ranked landings only", async () => {
    const t = makeT();
    await setupWorld(t);
    await addPads(t, 9, 6);
    await t.run(async (ctx) => {
      const settings = (await ctx.db.query("settings").first())!;
      await ctx.db.patch("settings", settings._id, {
        seo: { ...settings.seo, maxIndexableLandings: 1 },
      });
    });
    await t.mutation(internal.landings.recompute, {});
    await drain(t);
    const pads = (await landingRows(t)).filter((r) => r.categorySlug === "kocione-plocice");
    expect(pads.filter((r) => r.indexable)).toHaveLength(1);
    expect(pads.find((r) => !r.indexable)?.reason).toBe("over_cap");
  });

  test("an inactive category loses its rows; public reads expose only indexable landings", async () => {
    const t = makeT();
    await setupWorld(t);
    await addPads(t, 7, 3);
    await t.mutation(internal.landings.recompute, {});
    await drain(t);
    const data = await t.query(api.seo.sitemapData, {});
    expect(data.landings.map((l) => `${l.categorySlug}/${l.brandSlug}/${l.modelSlug}`)).toContain(
      "kocione-plocice/volkswagen/golf",
    );
    const landing = await t.query(api.seo.landing, {
      categorySlug: "kocione-plocice",
      brandSlug: "volkswagen",
      modelSlug: "golf",
    });
    expect(landing).toMatchObject({ indexable: true, productCount: 8 });
    expect(landing?.generations[0]?.name).toMatch(/Golf/);
    const links = await t.query(api.seo.categoryLandings, { categorySlug: "kocione-plocice" });
    expect(links.every((l) => l.indexable)).toBe(true);

    await t.run(async (ctx) => {
      const c = (await ctx.db
        .query("categories")
        .withIndex("by_slug", (q) => q.eq("slug", "kocione-plocice"))
        .unique())!;
      await ctx.db.patch("categories", c._id, { active: false });
      await recomputeCategory(ctx, c._id);
    });
    const left = (await landingRows(t)).filter((r) => r.categorySlug === "kocione-plocice");
    expect(left).toHaveLength(0);
  });
});

describe("feeds", () => {
  test("only active, priced, non-demo products; demo only on request", async () => {
    const t = makeT();
    await setupWorld(t);
    await t.run(async (ctx) => {
      const p = (await ctx.db
        .query("products")
        .withIndex("by_sku", (q) => q.eq("sku", "T-FILTER"))
        .unique())!;
      await ctx.db.patch("products", p._id, { isDemo: true });
    });
    const page = await t.query(api.seo.feedProducts, {
      paginationOpts: { numItems: 50, cursor: null },
    });
    expect(page.pricesPublic).toBe(true);
    const skus = page.page.map((r) => r.sku);
    expect(skus).toContain("T-DISC");
    expect(skus).not.toContain("T-FILTER");
    const withDemo = await t.query(api.seo.feedProducts, {
      paginationOpts: { numItems: 50, cursor: null },
      includeDemo: true,
    });
    expect(withDemo.page.map((r) => r.sku)).toContain("T-FILTER");
    // No cost or role price in the feed rows.
    expect(JSON.stringify(page.page)).not.toMatch(/cost/i);
  });

  test("hidden public prices → empty feed", async () => {
    const t = makeT();
    await setupWorld(t);
    await t.run(async (ctx) => {
      const s = (await ctx.db.query("settings").first())!;
      await ctx.db.patch("settings", s._id, { flags: { ...s.flags, publicPrices: false } });
    });
    const page = await t.query(api.seo.feedProducts, {
      paginationOpts: { numItems: 50, cursor: null },
    });
    expect(page).toMatchObject({ pricesPublic: false, page: [] });
  });
});

const ATTRIBUTION_ADS = {
  first: { source: "google", medium: "cpc", campaign: "plocice-golf", gclid: "Cj0KCQ-test", at: 1 },
  last: { source: "google", medium: "cpc", campaign: "plocice-golf", gclid: "Cj0KCQ-test", at: 2 },
  fbp: "fb.1.1700000000000.123456",
  consentAnalytics: true,
  consentAds: true,
};

async function enableCapi(t: T) {
  await t.run(async (ctx) => {
    const s = (await ctx.db.query("settings").first())!;
    await ctx.db.patch("settings", s._id, {
      tracking: {
        ...s.tracking,
        metaPixelId: "123456789012345",
        metaCapiEnabled: true,
        metaTestEventCode: "TEST123",
      },
    });
  });
  vi.stubEnv("META_CAPI_TOKEN", "test-token");
}

async function placeOrder(w: World, t: T, attribution?: typeof ATTRIBUTION_ADS) {
  const client = t.withRequestMetadata({ ip: "203.0.113.9", userAgent: "Mozilla/5.0 test" });
  await client.mutation(api.carts.addItem, {
    guestToken: GUEST,
    productId: w.products.disc,
    quantity: 2,
  });
  return await client.mutation(api.orders.submit, {
    guestToken: GUEST,
    ...checkoutArgs(),
    ...(attribution ? { attribution } : {}),
    eventSourceUrl: "https://sklop.test/porudzbina",
  });
}

async function capiDeliveries(t: T) {
  return await t.run(async (ctx) =>
    (await ctx.db.query("notificationDeliveries").take(500)).filter((d) => d.channel === "meta_capi"),
  );
}

describe("Meta Conversions API", () => {
  test("a purchase with ads consent posts one hashed event with the order number as event_id", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    await enableCapi(t);
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ events_received: 1, fbtrace_id: "trace" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const res = await placeOrder(w, t, ATTRIBUTION_ADS);
    await drain(t);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(
      "https://graph.facebook.com/v26.0/123456789012345/events?access_token=test-token",
    );
    const body = JSON.parse(String(init.body)) as {
      data: {
        event_name: string;
        event_id: string;
        action_source: string;
        event_time: number;
        event_source_url: string;
        user_data: Record<string, unknown>;
        custom_data: Record<string, unknown>;
      }[];
      test_event_code: string;
    };
    expect(body.test_event_code).toBe("TEST123");
    const event = body.data[0]!;
    expect(event).toMatchObject({
      event_name: "Purchase",
      event_id: res.number,
      action_source: "website",
      event_source_url: "https://sklop.test/porudzbina",
    });
    expect(event.event_time).toBeLessThan(10_000_000_000);
    expect(event.custom_data).toMatchObject({
      currency: "RSD",
      value: res.totalPara / 100,
      content_ids: ["T-DISC"],
      num_items: 2,
      order_id: res.number,
    });
    // Hashed PII only: 64-hex strings, never the raw e-mail or phone.
    const u = event.user_data;
    expect((u.em as string[])[0]).toMatch(/^[a-f0-9]{64}$/);
    expect((u.ph as string[])[0]).toMatch(/^[a-f0-9]{64}$/);
    expect(u.client_ip_address).toBe("203.0.113.9");
    expect(u.client_user_agent).toBe("Mozilla/5.0 test");
    expect(u.fbp).toBe(ATTRIBUTION_ADS.fbp);
    expect(JSON.stringify(body)).not.toContain("primer.rs");
    expect(JSON.stringify(body)).not.toContain("123 4567");

    const deliveries = await capiDeliveries(t);
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0]).toMatchObject({ status: "sent", recipient: "meta" });
  });

  test("without ads consent the event is skipped and nothing is sent", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    await enableCapi(t);
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await placeOrder(w, t, { ...ATTRIBUTION_ADS, consentAds: false });
    await drain(t);
    expect(fetchMock).not.toHaveBeenCalled();
    const deliveries = await capiDeliveries(t);
    expect(deliveries[0]).toMatchObject({ status: "skipped", lastError: "no_ads_consent" });
  });

  test("no token or CAPI disabled → no ledger row at all", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await placeOrder(w, t, ATTRIBUTION_ADS);
    await drain(t);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await capiDeliveries(t)).toHaveLength(0);
  });

  test("a Graph API error retries, then succeeds", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    await enableCapi(t);
    let calls = 0;
    const fetchMock = vi.fn(async () => {
      calls++;
      return calls === 1
        ? new Response('{"error":{"message":"temporary"}}', { status: 500 })
        : new Response('{"events_received":1}', { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    await placeOrder(w, t, ATTRIBUTION_ADS);
    await drain(t);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [delivery] = await capiDeliveries(t);
    expect(delivery).toMatchObject({ status: "sent", attempts: 2 });
  });
});

describe("consent log", () => {
  test("records the choice with a hashed user agent; rejects malformed ids", async () => {
    const t = makeT();
    const client = t.withRequestMetadata({ ip: "198.51.100.3", userAgent: "UA" });
    await client.mutation(api.consent.record, {
      consentId: "2f1c2d3e-aaaa-bbbb-cccc-123456789abc",
      analytics: true,
      ads: false,
    });
    const rows = await t.run(async (ctx) => await ctx.db.query("consentRecords").take(10));
    expect(rows[0]).toMatchObject({ choices: { analytics: true, ads: false } });
    expect(rows[0]!.uaHash).toMatch(/^[a-f0-9]{32}$/);
    expect(await errorCode(() => client.mutation(api.consent.record, { consentId: "<x>", analytics: true, ads: true }))).toBe(
      "INVALID",
    );
  });
});

describe("sources report and offline conversions (staff only)", () => {
  test("groups by channel, counts completed value, exports gclid rows with consent", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const google = await placeOrder(w, t, ATTRIBUTION_ADS);
    await drain(t);
    await t.run(async (ctx) => {
      const order = (await ctx.db
        .query("orders")
        .withIndex("by_number", (q) => q.eq("number", google.number))
        .unique())!;
      await ctx.db.patch("orders", order._id, { status: "zavrsena", completedAt: Date.UTC(2026, 8, 30, 12, 5, 9) });
      await ctx.db.insert("inquiries", {
        number: "UP-2026-900001",
        year: 2026,
        seq: 900001,
        publicTokenHash: "x",
        status: "nov",
        kind: "part",
        message: "Treba mi deo",
        categorySlugs: [],
        requestedCodes: [],
        photos: [],
        contact: { name: "Ana", phone: "+381641112223", preferredChannel: "phone" },
        attribution: {
          last: { source: "meta", medium: "paid_social", campaign: "jesen", fbclid: "IwAR", at: 3 },
          consentAnalytics: true,
          consentAds: true,
        },
        consent: CONSENT,
        reminderLevel: 0,
        searchText: "",
        isDemo: false,
        updatedAt: 0,
      });
    });
    const now = Date.now();
    expect(await errorCode(() => w.asCustomerA.query(api.seoAdmin.sourcesReport, { from: 0, to: now }))).toBe(
      "FORBIDDEN",
    );
    const report = await w.asStaff.query(api.seoAdmin.sourcesReport, { from: 0, to: now + 1 });
    const g = report.byChannel.find((r) => r.channel === "google_ads")!;
    expect(g).toMatchObject({ orders: 1, completedOrders: 1 });
    expect(g.completedValuePara).toBe(google.totalPara);
    expect(report.byChannel.find((r) => r.channel === "meta_ads")).toMatchObject({ inquiries: 1 });
    expect(report.rows.find((r) => r.campaign === "plocice-golf")).toMatchObject({
      source: "google",
      medium: "cpc",
    });

    const offline = await w.asStaff.query(api.seoAdmin.offlineConversions, { from: 0, to: now + 1 });
    expect(offline.gclid).toEqual([
      {
        orderNumber: google.number,
        gclid: "Cj0KCQ-test",
        time: belgradeConversionTime(Date.UTC(2026, 8, 30, 12, 5, 9)),
        valuePara: google.totalPara,
      },
    ]);
    expect(belgradeConversionTime(Date.UTC(2026, 8, 30, 12, 5, 9))).toBe("2026-09-30 14:05:09");
  });
});

describe("ads landings", () => {
  test("staff create with validation; the public read hides inactive pages", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const base = {
      slug: "Pločice Golf 7",
      title: "Kočione pločice za Golf 7",
      headline: "Kočione pločice za Golf 7 — na stanju",
      productIds: [w.products.pads as Id<"products">],
      indexable: false,
      active: true,
    };
    expect(await errorCode(() => w.asCustomerA.mutation(api.seoAdmin.saveAdLanding, base))).toBe(
      "FORBIDDEN",
    );
    const id = await w.asStaff.mutation(api.seoAdmin.saveAdLanding, base);
    const page = await t.query(api.seo.adLanding, { slug: "plocice-golf-7" });
    expect(page).toMatchObject({ slug: "plocice-golf-7", headline: base.headline, indexable: false });
    expect(page?.products.map((p) => p.sku)).toEqual(["T-PADS"]);
    // Duplicate slug is refused; a missing headline too.
    expect(
      await errorCode(() => w.asStaff.mutation(api.seoAdmin.saveAdLanding, { ...base, headline: "x" })),
    ).toBe("INVALID");
    expect(
      await errorCode(() => w.asStaff.mutation(api.seoAdmin.saveAdLanding, { ...base, headline: " " , slug: "druga" })),
    ).toBe("INVALID");
    await w.asStaff.mutation(api.seoAdmin.saveAdLanding, { ...base, id, active: false });
    expect(await t.query(api.seo.adLanding, { slug: "plocice-golf-7" })).toBeNull();
    const audit = await t.run(async (ctx) =>
      (await ctx.db.query("auditLog").take(100)).filter((a) => a.entityType === "adLanding"),
    );
    expect(audit.map((a) => a.action)).toEqual(["adLanding.create", "adLanding.update"]);
  });
});
