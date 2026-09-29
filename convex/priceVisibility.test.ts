/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";

import { api } from "./_generated/api";
import { errorCode, makeT, setupWorld, type World } from "./test.setup";

async function live(
  w: World,
  who: keyof Pick<
    World,
    | "anon"
    | "asCustomerA"
    | "asPending"
    | "asMechA"
    | "asMechB"
    | "asStaff"
    | "asOwner"
    | "asSuspended"
    | "asBlocked"
  >,
) {
  const rows = await w[who].query(api.catalog.products.liveState, {
    productIds: [w.products.disc, w.products.pads, w.products.battery],
  });
  return Object.fromEntries(rows.map((r) => [r.productId, r]));
}

describe("price visibility matrix (docs/SECURITY.md §D4)", () => {
  test("anonymous, customer, pending, suspended, blocked and staff get retail only", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    for (const who of [
      "anon",
      "asCustomerA",
      "asPending",
      "asSuspended",
      "asBlocked",
      "asStaff",
      "asOwner",
    ] as const) {
      const rows = await live(w, who);
      expect(rows[w.products.disc].retailPricePara, who).toBe(1_000_000);
      expect(rows[w.products.disc].yourPricePara, who).toBeNull();
      expect(rows[w.products.pads].yourPricePara, who).toBeNull();
    }
  });

  test("approved mechanic on Majstor (10 %) sees his price everywhere", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const rows = await live(w, "asMechA");
    expect(rows[w.products.disc].yourPricePara).toBe(900_000);
    expect(rows[w.products.pads].yourPricePara).toBe(450_000);
    const forProducts = await w.asMechA.query(api.pricing.forProducts, {
      productIds: [w.products.disc],
    });
    expect(forProducts[0]).toMatchObject({
      retailPricePara: 1_000_000,
      yourPricePara: 900_000,
      discountBp: 1_000,
    });
    const panel = await w.asMechA.query(api.catalog.products.partPanel, {
      categorySlug: "kocioni-diskovi",
    });
    expect(panel?.items[0].yourPricePara).toBe(900_000);
  });

  test("tier B (Partner) gets its category rule; tier A never sees tier B's price", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const b = await live(w, "asMechB");
    // Partner: 25 % on brake discs (category rule), 20 % default on pads.
    expect(b[w.products.disc].yourPricePara).toBe(750_000);
    expect(b[w.products.pads].yourPricePara).toBe(400_000);
    const a = await live(w, "asMechA");
    expect(a[w.products.disc].yourPricePara).toBe(900_000);
  });

  test("margin guard keeps the mechanic price at retail when cost + margin exceeds it", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const rows = await live(w, "asMechB");
    // cost 9.500 × 1,08 × 1,2 = 12.312 ≥ retail 12.000 → retail.
    expect(rows[w.products.battery].yourPricePara).toBe(1_200_000);
  });

  test("anonymous catalog projections never contain cost or role prices", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const list = await w.asMechA.query(api.catalog.products.listByCategory, {
      categorySlug: "kocioni-diskovi",
    });
    const detail = await w.asMechA.query(api.catalog.products.bySlug, {
      slug: list!.items[0].slug,
    });
    const text = JSON.stringify({ list, detail });
    for (const forbidden of ["costNetPara", "yourPricePara", "supplier", "900000", "500000"]) {
      expect(text).not.toContain(forbidden);
    }
    expect(list!.items[0].retailPricePara).toBe(1_000_000);
  });

  test("hidden public prices: anonymous gets null, signed-in customers see retail", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const flags = await w.asOwner.query(api.settings.getAdmin, {});
    await w.asOwner.mutation(api.settings.updateSection, {
      update: { section: "flags", value: { ...flags.flags, publicPrices: false } },
    });
    const anon = await live(w, "anon");
    expect(anon[w.products.disc].retailPricePara).toBeNull();
    const customer = await live(w, "asCustomerA");
    expect(customer[w.products.disc].retailPricePara).toBe(1_000_000);
  });

  test("purchase cost is staff-only", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const staffView = await w.asStaff.query(api.catalog.productsAdmin.get, {
      productId: w.products.disc,
    });
    expect(staffView?.costNetPara).toBe(500_000);
    expect(
      await errorCode(() =>
        w.asMechA.query(api.catalog.productsAdmin.get, { productId: w.products.disc }),
      ),
    ).toBe("FORBIDDEN");
    expect(
      await errorCode(() =>
        w.anon.query(api.catalog.productsAdmin.get, { productId: w.products.disc }),
      ),
    ).toBe("UNAUTHENTICATED");
  });

  test("prices switch live when a pending mechanic is approved", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    expect((await live(w, "asPending"))[w.products.disc].yourPricePara).toBeNull();
    await w.asStaff.mutation(api.mechanicsAdmin.approve, {
      profileId: w.pending.profileId,
      tierId: w.tiers.majstor,
      creditEnabled: false,
    });
    expect((await live(w, "asPending"))[w.products.disc].yourPricePara).toBe(900_000);
  });
});
