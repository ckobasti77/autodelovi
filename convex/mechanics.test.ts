/// <reference types="vite/client" />
/**
 * Step 14 — mechanics portal: registration, approval authorization, quick-order matching,
 * one-click inquiry for misses, personal price list, favorites, credit limit.
 */
import { describe, expect, test } from "vitest";

import { api } from "./_generated/api";
import { parseQuickOrder } from "../lib/domain/quickOrder";
import { SYSTEM_ACTOR } from "./lib/authz";
import { createProduct } from "./lib/productWriter";
import {
  CONSENT,
  checkoutArgs,
  errorCode,
  makeT,
  setupWorld,
  VALID_MB,
  type T,
  type World,
} from "./test.setup";
import { mbCheckDigit, pibCheckDigit } from "../lib/domain/identifiers";

const PIB_2 = `10203040${pibCheckDigit("10203040")}`;
const MB_2 = `1020304${mbCheckDigit("1020304")}`;

function registration(overrides: Record<string, unknown> = {}) {
  return {
    companyName: "Auto servis Zvezdara",
    pib: PIB_2,
    mb: MB_2,
    contactPerson: "Nikola Jovanović",
    phone: "064 555 1234",
    city: "Beograd",
    address: "Bulevar kralja Aleksandra 100",
    serviceTypes: ["mehanika" as const, "dijagnostika" as const],
    brandsServiced: [],
    consent: CONSENT,
    ...overrides,
  };
}

/** Items for `quickOrderMatch` from pasted text, like the client sends them. */
function items(text: string) {
  return parseQuickOrder(text).items.map((i) => ({
    key: i.key,
    candidates: i.candidates.map((c) => ({ code: c.code, quantity: c.quantity })),
  }));
}

/** A second listed product sharing the disc's OEM number (aftermarket, cheaper). */
async function addTwinDisc(t: T, w: World) {
  return await t.run(async (ctx) => {
    const trw = (await ctx.db
      .query("manufacturers")
      .withIndex("by_slug", (q) => q.eq("slug", "trw"))
      .unique())!;
    return await createProduct(
      ctx,
      {
        sku: "T-DISC-TRW",
        name: "Kočioni disk prednji 312 mm TRW",
        categoryId: w.categories.disc,
        manufacturerId: trw._id,
        quality: "aftermarket",
        oemNumbers: [{ raw: "5Q0615301F" }],
        crossNumbers: [],
        retailPricePara: 800_000,
        stockQty: 4,
        allowBackorder: false,
        universal: false,
        fitments: [],
        specs: [],
        active: true,
        isDemo: false,
        source: "manual",
      },
      { actor: SYSTEM_ACTOR, emit: false },
    );
  });
}

describe("registration", () => {
  test("anonymous visitors cannot register; a signed-in customer creates a pending profile", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    expect(await errorCode(() => w.anon.mutation(api.mechanics.register, registration()))).toBe(
      "UNAUTHENTICATED",
    );
    const profileId = await w.asCustomerA.mutation(api.mechanics.register, registration());
    const overview = await w.asCustomerA.query(api.mechanicPortal.overview, {});
    expect(overview).toMatchObject({
      status: "pending",
      companyName: "Auto servis Zvezdara",
      phone: "+381645551234",
      email: "a@sklop.test",
      tierName: null,
      credit: { enabled: false },
    });
    const viewer = await w.asCustomerA.query(api.users.viewer, {});
    expect(viewer?.mechanicStatus).toBe("pending");
    const events = await t.run((ctx) =>
      ctx.db
        .query("domainEvents")
        .withIndex("by_aggregateType_and_aggregateId", (q) =>
          q.eq("aggregateType", "mechanic").eq("aggregateId", profileId),
        )
        .take(5),
    );
    expect(events.map((e) => e.type)).toEqual(["mechanic.registered"]);
    // Pending mechanics still see retail prices.
    const live = await w.asCustomerA.query(api.catalog.products.liveState, {
      productIds: [w.products.disc],
    });
    expect(live[0]?.yourPricePara).toBeNull();
  });

  test("validates PIB checksum, MB, phone; rejects a second registration and a taken PIB", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const badPib = `${PIB_2.slice(0, 8)}${(Number(PIB_2[8]) + 1) % 10}`;
    expect(
      await errorCode(() =>
        w.asCustomerA.mutation(api.mechanics.register, registration({ pib: badPib })),
      ),
    ).toBe("INVALID");
    expect(
      await errorCode(() =>
        w.asCustomerA.mutation(api.mechanics.register, registration({ mb: "123" })),
      ),
    ).toBe("INVALID");
    expect(
      await errorCode(() =>
        w.asCustomerA.mutation(api.mechanics.register, registration({ phone: "12" })),
      ),
    ).toBe("INVALID");
    // The world's mechanics already use VALID_PIB.
    const taken = await t.run(
      async (ctx) => (await ctx.db.get("mechanicProfiles", w.mechA.profileId))!.pib,
    );
    expect(
      await errorCode(() =>
        w.asCustomerA.mutation(api.mechanics.register, registration({ pib: taken, mb: VALID_MB })),
      ),
    ).toBe("DUPLICATE");
    await w.asCustomerA.mutation(api.mechanics.register, registration());
    expect(
      await errorCode(() => w.asCustomerA.mutation(api.mechanics.register, registration())),
    ).toBe("DUPLICATE");
  });

  test("the registration flag turns the form off", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const s = await w.asOwner.query(api.settings.getAdmin, {});
    await w.asOwner.mutation(api.settings.updateSection, {
      update: { section: "flags", value: { ...s.flags, mechanicRegistration: false } },
    });
    expect(
      await errorCode(() => w.asCustomerA.mutation(api.mechanics.register, registration())),
    ).toBe("DISABLED");
  });
});

describe("approval authorization", () => {
  test("only staff list, read and decide on registrations", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    for (const who of ["asCustomerA", "asPending", "asMechA"] as const) {
      expect(await errorCode(() => w[who].query(api.mechanicsAdmin.list, {})), who).toBe(
        "FORBIDDEN",
      );
      expect(await errorCode(() => w[who].query(api.mechanicsAdmin.counts, {})), who).toBe(
        "FORBIDDEN",
      );
      expect(
        await errorCode(() =>
          w[who].mutation(api.mechanicsAdmin.approve, {
            profileId: w.pending.profileId,
            tierId: w.tiers.partner,
            creditEnabled: true,
          }),
        ),
        who,
      ).toBe("FORBIDDEN");
      expect(
        await errorCode(() =>
          w[who].mutation(api.mechanicsAdmin.reject, {
            profileId: w.pending.profileId,
            reason: "Ne",
          }),
        ),
        who,
      ).toBe("FORBIDDEN");
    }
    expect(await errorCode(() => w.anon.query(api.mechanicsAdmin.list, {}))).toBe(
      "UNAUTHENTICATED",
    );
    const counts = await w.asStaff.query(api.mechanicsAdmin.counts, {});
    expect(counts).toEqual({ pending: 1, approved: 2, rejected: 0, suspended: 1 });
  });

  test("staff approve with tier, personal rabat and credit → prices and events follow", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    await w.asStaff.mutation(api.mechanicsAdmin.approve, {
      profileId: w.pending.profileId,
      tierId: w.tiers.majstor,
      personalRules: { defaultDiscountBp: 1_200 },
      creditEnabled: true,
      creditLimitPara: 10_000_000,
      paymentTermsDays: 30,
    });
    const overview = await w.asPending.query(api.mechanicPortal.overview, {});
    expect(overview).toMatchObject({
      status: "approved",
      tierName: "Majstor",
      personalDiscountBp: 1_200,
      credit: { enabled: true, limitPara: 10_000_000, paymentTermsDays: 30, usedPara: 0 },
    });
    const live = await w.asPending.query(api.catalog.products.liveState, {
      productIds: [w.products.pads],
    });
    // Personal default 12 % wins over the tier default 10 %.
    expect(live[0]?.yourPricePara).toBe(440_000);
    const detail = await w.asStaff.query(api.mechanicsAdmin.get, {
      profileId: w.pending.profileId,
    });
    expect(detail?.tierName).toBe("Majstor");
    const [events, audits] = await t.run(async (ctx) => [
      await ctx.db
        .query("domainEvents")
        .withIndex("by_aggregateType_and_aggregateId", (q) =>
          q.eq("aggregateType", "mechanic").eq("aggregateId", w.pending.profileId),
        )
        .take(5),
      await ctx.db
        .query("auditLog")
        .withIndex("by_entityType_and_entityId_and_at", (q) =>
          q.eq("entityType", "mechanicProfile").eq("entityId", w.pending.profileId),
        )
        .take(5),
    ]);
    expect(events.map((e) => e.type)).toEqual(["mechanic.approved"]);
    expect(audits.map((a) => a.action)).toEqual(["mechanic.approved"]);
  });

  test("reject needs a reason, shows it to the applicant, and reopen returns to pending", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    expect(
      await errorCode(() =>
        w.asStaff.mutation(api.mechanicsAdmin.reject, {
          profileId: w.pending.profileId,
          reason: " ",
        }),
      ),
    ).toBe("INVALID");
    await w.asStaff.mutation(api.mechanicsAdmin.reject, {
      profileId: w.pending.profileId,
      reason: "PIB ne odgovara nazivu firme.",
    });
    const rejected = await w.asPending.query(api.mechanicPortal.overview, {});
    expect(rejected).toMatchObject({
      status: "rejected",
      rejectionReason: "PIB ne odgovara nazivu firme.",
    });
    // A rejected profile cannot be approved directly.
    expect(
      await errorCode(() =>
        w.asStaff.mutation(api.mechanicsAdmin.approve, {
          profileId: w.pending.profileId,
          tierId: w.tiers.majstor,
          creditEnabled: false,
        }),
      ),
    ).toBe("INVALID");
    await w.asStaff.mutation(api.mechanicsAdmin.reopen, { profileId: w.pending.profileId });
    expect((await w.asPending.query(api.mechanicPortal.overview, {}))?.status).toBe("pending");
  });
});

describe("quick order", () => {
  test("exact, ambiguous and not-found lines with the mechanic's own prices", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    await addTwinDisc(t, w);
    const result = await w.asMechA.mutation(api.mechanicPortal.quickOrderMatch, {
      items: items("5Q0 698 151 B x2\n5q0-615-301-f 1\nZZ9999999 3\n2x 24.0125-0184.1"),
    });
    expect(result.counts).toEqual({ exact: 2, ambiguous: 1, notFound: 1 });
    const [pads, discs, missing, mpn] = result.rows;
    expect(pads).toMatchObject({ status: "exact", normalized: "5Q0698151B", quantity: 2 });
    expect(pads!.options[0]).toMatchObject({
      unitPricePara: 450_000,
      discountBp: 1_000,
      orderable: true,
      matchKind: "oem",
    });
    // Ambiguous: sorted by quality (ATE = oem before TRW = aftermarket), then price.
    expect(discs!.status).toBe("ambiguous");
    expect(discs!.options.map((o) => o.card.sku)).toEqual(["T-DISC", "T-DISC-TRW"]);
    expect(discs!.options.map((o) => o.unitPricePara)).toEqual([900_000, 720_000]);
    expect(missing).toMatchObject({
      status: "not_found",
      code: "ZZ9999999",
      quantity: 3,
      options: [],
    });
    expect(mpn).toMatchObject({ status: "exact", quantity: 2 });
    expect(mpn!.options[0]).toMatchObject({ matchKind: "mpn", card: { sku: "T-DISC" } });
    // Misses are logged for „Traženo, a nemamo“.
    const logs = await t.run((ctx) => ctx.db.query("searchLogs").take(10));
    expect(logs.map((l) => [l.source, l.normalized, l.resultsCount])).toEqual([
      ["quick_order", "ZZ9999999", 0],
    ]);
  });

  test("picks the reading that matches: a trailing number is a quantity or part of the code", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const result = await w.asMechA.mutation(api.mechanicPortal.quickOrderMatch, {
      items: items("5Q0698151B 4"),
    });
    expect(result.rows[0]).toMatchObject({
      status: "exact",
      quantity: 4,
      normalized: "5Q0698151B",
    });
  });

  test("quantities above stock are flagged not orderable; backorder items are orderable", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    // Give the turbo (backorder) and the filter (out of stock) plausible codes.
    await t.run(async (ctx) => {
      for (const [productId, code] of [
        [w.products.turbo, "04L253010T"],
        [w.products.filter, "03N115562"],
      ] as const) {
        const p = (await ctx.db.get("products", productId))!;
        await ctx.db.insert("productCodes", {
          code,
          kind: "oem",
          productId,
          raw: code,
          active: true,
          categoryId: p.categoryId,
        });
      }
    });
    const result = await w.asMechB.mutation(api.mechanicPortal.quickOrderMatch, {
      items: items("5Q0698151B 5\n04L253010T 1\n03N115562 1"),
    });
    expect(result.rows[0]!.options[0]).toMatchObject({ orderable: false, available: 2 });
    expect(result.rows[1]!.options[0]).toMatchObject({ orderable: true, backorder: true });
    expect(result.rows[2]!.options[0]).toMatchObject({ orderable: false, available: 0 });
    // Partner tier: 20 % default.
    expect(result.rows[0]!.options[0]!.unitPricePara).toBe(400_000);
  });

  test("only approved mechanics; payload limits enforced", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    for (const who of ["asCustomerA", "asPending", "asSuspended", "asStaff"] as const) {
      expect(
        await errorCode(() =>
          w[who].mutation(api.mechanicPortal.quickOrderMatch, { items: items("5Q0698151B 1") }),
        ),
        who,
      ).toBe("FORBIDDEN");
    }
    expect(
      await errorCode(() =>
        w.anon.mutation(api.mechanicPortal.quickOrderMatch, { items: items("5Q0698151B 1") }),
      ),
    ).toBe("UNAUTHENTICATED");
    expect(
      await errorCode(() => w.asMechA.mutation(api.mechanicPortal.quickOrderMatch, { items: [] })),
    ).toBe("INVALID");
    expect(
      await errorCode(() =>
        w.asMechA.mutation(api.mechanicPortal.quickOrderMatch, {
          items: [{ key: "1", candidates: [{ code: "5Q0698151B", quantity: 5_000 }] }],
        }),
      ),
    ).toBe("INVALID");
  });

  test("rate limited per mechanic", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    let code = "NO_ERROR";
    for (let i = 0; i < 31 && code === "NO_ERROR"; i++) {
      code = await errorCode(() =>
        w.asMechA.mutation(api.mechanicPortal.quickOrderMatch, { items: items("5Q0698151B 1") }),
      );
    }
    expect(code).toBe("RATE_LIMITED");
  });

  test("matched lines go to the cart with the mechanic's price", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const result = await w.asMechA.mutation(api.carts.addMany, {
      items: [
        { productId: w.products.pads, quantity: 2 },
        { productId: w.products.filter, quantity: 1 },
      ],
      source: "quick_order",
    });
    expect(result.added).toEqual([w.products.pads]);
    expect(result.rejected.map((r) => r.productId)).toEqual([w.products.filter]);
    const cart = await w.asMechA.query(api.carts.get, {});
    expect(cart.lines[0]).toMatchObject({ unitPricePara: 450_000, unitRetailPara: 500_000 });
    expect(cart.discountPara).toBe(100_000);
  });

  test("one-click inquiry for missing numbers uses the profile contact", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const { number } = await w.asMechA.mutation(api.mechanicPortal.inquireMissing, {
      items: [
        { code: "ZZ9 999 999", quantity: 3 },
        { code: "YY1234567", quantity: 1 },
      ],
      note: "Za Golf 7 mušterije.",
    });
    const inquiry = await t.run((ctx) =>
      ctx.db
        .query("inquiries")
        .withIndex("by_number", (q) => q.eq("number", number))
        .unique(),
    );
    expect(inquiry).toMatchObject({
      kind: "quick_order_missing",
      status: "nov",
      requestedCodes: ["ZZ9999999", "YY1234567"],
      mechanicProfileId: w.mechA.profileId,
      contact: {
        name: "Majstor",
        phone: "+381641234567",
        email: "mech-a@sklop.test",
        preferredChannel: "phone",
      },
    });
    expect(inquiry?.message).toContain("ZZ9 999 999 — 3 kom.");
    const mine = await w.asMechA.query(api.inquiries.mine, {});
    expect(mine.map((i) => i.number)).toContain(number);
    expect(
      await errorCode(() =>
        w.asPending.mutation(api.mechanicPortal.inquireMissing, {
          items: [{ code: "ZZ9999999", quantity: 1 }],
        }),
      ),
    ).toBe("FORBIDDEN");
  });
});

describe("price list", () => {
  test("own prices per tier, retail next to them, never cost; approved only", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const page = (who: "asMechA" | "asMechB") =>
      w[who].query(api.mechanicPortal.priceListPage, {
        categoryId: w.categories.disc,
        paginationOpts: { numItems: 50, cursor: null },
      });
    const a = await page("asMechA");
    const b = await page("asMechB");
    expect(a.page[0]).toMatchObject({
      sku: "T-DISC",
      retailPricePara: 1_000_000,
      unitPricePara: 900_000,
    });
    expect(b.page[0]).toMatchObject({ unitPricePara: 750_000, discountBp: 2_500 });
    expect(JSON.stringify(a)).not.toMatch(/cost|supplier|500000/i);
    const meta = await w.asMechB.query(api.mechanicPortal.priceListMeta, {});
    expect(meta).toMatchObject({ tierName: "Partner", tierDiscountBp: 2_000 });
    for (const who of ["asCustomerA", "asPending", "asSuspended", "asStaff"] as const) {
      expect(
        await errorCode(() =>
          w[who].query(api.mechanicPortal.priceListPage, {
            categoryId: w.categories.disc,
            paginationOpts: { numItems: 10, cursor: null },
          }),
        ),
        who,
      ).toBe("FORBIDDEN");
    }
    expect(
      await errorCode(() =>
        w.asMechA.query(api.mechanicPortal.priceListPage, {
          categoryId: w.categories.disc,
          paginationOpts: { numItems: 1_000, cursor: null },
        }),
      ),
    ).toBe("INVALID");
  });
});

describe("favorites and customer vehicles", () => {
  test("toggle, list with own price, scoped to the owner", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    expect(
      await w.asMechA.mutation(api.account.toggleFavorite, { productId: w.products.disc }),
    ).toEqual({
      favorite: true,
    });
    await w.asCustomerA.mutation(api.account.toggleFavorite, { productId: w.products.disc });
    const mech = await w.asMechA.query(api.account.favorites, {});
    expect(mech.map((f) => [f.card.sku, f.unitPricePara])).toEqual([["T-DISC", 900_000]]);
    const customer = await w.asCustomerA.query(api.account.favorites, {});
    expect(customer.map((f) => [f.card.sku, f.unitPricePara, f.discountBp])).toEqual([
      ["T-DISC", 1_000_000, 0],
    ]);
    expect(await w.asCustomerB.query(api.account.favorites, {})).toEqual([]);
    expect(
      await w.asMechA.query(api.account.favoriteIds, {
        productIds: [w.products.disc, w.products.pads],
      }),
    ).toEqual([w.products.disc]);
    expect(
      await w.asMechA.mutation(api.account.toggleFavorite, { productId: w.products.disc }),
    ).toEqual({
      favorite: false,
    });
    expect(await errorCode(() => w.anon.query(api.account.favorites, {}))).toBe("UNAUTHENTICATED");
  });

  test("customer vehicles: VIN validated, plate normalised, only the owner edits", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const id = await w.asMechA.mutation(api.account.addSavedVehicle, {
      brandSlug: "volkswagen",
      label: "Petrović — Golf",
      vin: "wvwzzzauzhw000123",
      plate: "bg 123-ab",
      note: "Menjan zupčasti 2025.",
    });
    expect(
      await errorCode(() => w.asMechA.mutation(api.account.updateSavedVehicle, { id, vin: "123" })),
    ).toBe("INVALID");
    expect(
      await errorCode(() =>
        w.asCustomerB.mutation(api.account.updateSavedVehicle, { id, note: "x" }),
      ),
    ).toBe("NOT_FOUND");
    await w.asMechA.mutation(api.account.updateSavedVehicle, { id, plate: "ns 555-cc", note: "" });
    const [row] = await w.asMechA.query(api.account.savedVehicles, {});
    expect(row).toMatchObject({
      vin: "WVWZZZAUZHW000123",
      plate: "NS 555-CC",
      note: null,
      label: "Petrović — Golf",
    });
  });
});

describe("deferred payment", () => {
  async function fillCart(w: World, who: "asMechA" | "asMechB" | "asCustomerA") {
    await w[who].mutation(api.carts.addItem, { productId: w.products.disc, quantity: 1 });
  }

  test("approved mechanic with credit orders on deferred payment with a due date", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    await fillCart(w, "asMechA");
    const { number } = await w.asMechA.mutation(
      api.orders.submit,
      checkoutArgs({ payment: { method: "deferred" } }),
    );
    const order = await t.run((ctx) =>
      ctx.db
        .query("orders")
        .withIndex("by_number", (q) => q.eq("number", number))
        .unique(),
    );
    expect(order).toMatchObject({
      customerType: "mechanic",
      payment: { method: "deferred", status: "unpaid" },
      totals: { itemsPara: 900_000 },
      tierSnapshot: { name: "Majstor" },
    });
    expect(order!.payment.dueAt! - order!._creationTime).toBeGreaterThan(14 * 86_400_000);
    const overview = await w.asMechA.query(api.mechanicPortal.overview, {});
    expect(overview?.credit).toMatchObject({ usedPara: order!.totals.totalPara, openCount: 1 });
  });

  test("no credit flag or a customer → deferred refused", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    for (const who of ["asMechB", "asCustomerA"] as const) {
      await fillCart(w, who);
      expect(
        await errorCode(() =>
          w[who].mutation(api.orders.submit, checkoutArgs({ payment: { method: "deferred" } })),
        ),
        who,
      ).toBe("INVALID");
    }
  });

  test("the credit limit caps open deferred orders", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    await w.asStaff.mutation(api.mechanicsAdmin.update, {
      profileId: w.mechA.profileId,
      creditLimitPara: 500_000,
    });
    await fillCart(w, "asMechA");
    expect(
      await errorCode(() =>
        w.asMechA.mutation(api.orders.submit, checkoutArgs({ payment: { method: "deferred" } })),
      ),
    ).toBe("INVALID");
    // Other methods still work.
    const ok = await w.asMechA.mutation(
      api.orders.submit,
      checkoutArgs({ payment: { method: "cod" } }),
    );
    expect(ok.number).toMatch(/^SK-/);
  });
});
