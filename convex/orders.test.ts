/// <reference types="vite/client" />
import { describe, expect, test, vi } from "vitest";

import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { rateLimiter } from "./lib/rateLimits";
import { DEFAULT_SETTINGS } from "./lib/settings";
import { belgradeYear } from "../lib/domain/time";
import {
  checkoutArgs,
  errorCode,
  GUEST,
  GUEST_2,
  makeT,
  setupWorld,
  VALID_MB,
  VALID_PIB,
} from "./test.setup";

const year = belgradeYear(Date.now());

describe("order submit", () => {
  test("guest order is re-priced on the server, numbered and totals follow the rules", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    await w.anon.mutation(api.carts.addItem, {
      guestToken: GUEST,
      productId: w.products.disc,
      quantity: 2,
    });
    const res = await w.anon.mutation(api.orders.submit, { guestToken: GUEST, ...checkoutArgs() });
    expect(res.number).toBe(`SK-${year}-000001`);
    const order = await w.anon.query(api.orders.getByToken, { token: res.token });
    expect(order).not.toBeNull();
    expect(order!.status).toBe("nova");
    expect(order!.contact.email).toBe("petar@primer.rs");
    expect(order!.contact.phone).toBe("+381641234567");
    // 2 × 10.000 RSD = 20.000 ≥ 10.000 → free courier; VAT included = 20.000 × 20/120.
    expect(order!.totals).toMatchObject({
      itemsPara: 2_000_000,
      deliveryPara: 0,
      totalPara: 2_000_000,
      vatPara: 333_333,
    });
    const cart = await w.anon.query(api.carts.get, { guestToken: GUEST });
    expect(cart.cartId).toBeNull();
  });

  test("delivery fee applies below the free-shipping threshold", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    await w.anon.mutation(api.carts.addItem, {
      guestToken: GUEST,
      productId: w.products.pads,
      quantity: 1,
    });
    const res = await w.anon.mutation(api.orders.submit, { guestToken: GUEST, ...checkoutArgs() });
    const order = await w.anon.query(api.orders.getByToken, { token: res.token });
    expect(order!.totals).toMatchObject({
      itemsPara: 500_000,
      deliveryPara: 45_000,
      totalPara: 545_000,
    });
  });

  test("order numbers are unique and sequential", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const numbers = [];
    for (const token of [GUEST, GUEST_2]) {
      await w.anon.mutation(api.carts.addItem, {
        guestToken: token,
        productId: w.products.battery,
        quantity: 1,
      });
      numbers.push(
        (await w.anon.mutation(api.orders.submit, { guestToken: token, ...checkoutArgs() })).number,
      );
    }
    expect(numbers).toEqual([`SK-${year}-000001`, `SK-${year}-000002`]);
  });

  test("approved mechanic orders at his price with a tier snapshot", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    await w.asMechA.mutation(api.carts.addItem, { productId: w.products.disc, quantity: 1 });
    const res = await w.asMechA.mutation(
      api.orders.submit,
      checkoutArgs({ payment: { method: "deferred" } }),
    );
    const mine = await w.asMechA.query(api.orders.myOrder, { number: res.number });
    expect(mine!.items[0]).toMatchObject({ unitRetailPara: 1_000_000, unitPricePara: 900_000 });
    expect(mine!.customerType).toBe("mechanic");
    expect(mine!.payment.method).toBe("deferred");
    expect(mine!.payment.dueAt).not.toBeNull();
    const staffView = await w.asStaff.query(api.ordersAdmin.get, { number: res.number });
    expect(staffView!.order.tierName).toBe("Majstor");
  });

  test("honeypot and too-fast submissions are rejected", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    await w.anon.mutation(api.carts.addItem, {
      guestToken: GUEST,
      productId: w.products.disc,
      quantity: 1,
    });
    expect(
      await errorCode(() =>
        w.anon.mutation(api.orders.submit, {
          guestToken: GUEST,
          ...checkoutArgs({ honeypot: "bot" }),
        }),
      ),
    ).toBe("SPAM");
    expect(
      await errorCode(() =>
        w.anon.mutation(api.orders.submit, {
          guestToken: GUEST,
          ...checkoutArgs({ startedAt: Date.now() }),
        }),
      ),
    ).toBe("SPAM");
  });

  test("invalid payloads are rejected with field errors", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    await w.anon.mutation(api.carts.addItem, {
      guestToken: GUEST,
      productId: w.products.disc,
      quantity: 1,
    });
    const submit = (o: Record<string, unknown>) =>
      errorCode(() =>
        w.anon.mutation(api.orders.submit, { guestToken: GUEST, ...checkoutArgs(o) }),
      );
    expect(await submit({ contact: { ...checkoutArgs().contact, email: "nije-mejl" } })).toBe(
      "INVALID",
    );
    expect(await submit({ contact: { ...checkoutArgs().contact, phone: "123" } })).toBe("INVALID");
    expect(
      await submit({
        delivery: {
          method: "courier",
          address: { street: "X 1", city: "Beograd", postalCode: "110" },
        },
      }),
    ).toBe("INVALID");
    expect(await submit({ delivery: { method: "courier" } })).toBe("INVALID");
    expect(await submit({ delivery: { method: "pickup" }, payment: { method: "cod" } })).toBe(
      "INVALID",
    );
    expect(await submit({ payment: { method: "bank_transfer" } })).toBe("INVALID");
    expect(await submit({ payment: { method: "deferred" } })).toBe("INVALID");
    expect(
      await submit({
        payment: { method: "bank_transfer" },
        company: { name: "Firma", pib: "123456789" },
      }),
    ).toBe("INVALID");
    // A valid company unlocks the bank transfer.
    const ok = await w.anon.mutation(api.orders.submit, {
      guestToken: GUEST,
      ...checkoutArgs({
        payment: { method: "bank_transfer" },
        company: { name: "Firma d.o.o.", pib: VALID_PIB, mb: VALID_MB },
      }),
    });
    expect(ok.number).toMatch(/^SK-\d{4}-\d{6}$/);
  });

  test("out-of-stock products cannot be added; backorder products can", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    expect(
      await errorCode(() =>
        w.anon.mutation(api.carts.addItem, {
          guestToken: GUEST,
          productId: w.products.filter,
          quantity: 1,
        }),
      ),
    ).toBe("OUT_OF_STOCK");
    expect(
      await errorCode(() =>
        w.anon.mutation(api.carts.addItem, {
          guestToken: GUEST,
          productId: w.products.pads,
          quantity: 3,
        }),
      ),
    ).toBe("OUT_OF_STOCK");
    await w.anon.mutation(api.carts.addItem, {
      guestToken: GUEST,
      productId: w.products.turbo,
      quantity: 1,
    });
    const res = await w.anon.mutation(api.orders.submit, { guestToken: GUEST, ...checkoutArgs() });
    const order = await w.anon.query(api.orders.getByToken, { token: res.token });
    expect(order!.hasBackorder).toBe(true);
    expect(order!.items[0].availabilityAtOrder).toBe("on_order");
  });

  test("stock that dropped after adding to the cart blocks the order", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    await w.anon.mutation(api.carts.addItem, {
      guestToken: GUEST,
      productId: w.products.pads,
      quantity: 2,
    });
    await w.asStaff.mutation(api.catalog.productsAdmin.adjustStock, {
      productId: w.products.pads,
      delta: -1,
      reason: "correction",
    });
    const cart = await w.anon.query(api.carts.get, { guestToken: GUEST });
    expect(cart.hasProblems).toBe(true);
    expect(cart.lines[0].notice).toEqual({ kind: "insufficient_stock", available: 1 });
    expect(
      await errorCode(() =>
        w.anon.mutation(api.orders.submit, { guestToken: GUEST, ...checkoutArgs() }),
      ),
    ).toBe("OUT_OF_STOCK");
  });

  test("a stale reviewed total is rejected with PRICE_CHANGED", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    await w.anon.mutation(api.carts.addItem, {
      guestToken: GUEST,
      productId: w.products.pads,
      quantity: 1,
    });
    await w.asStaff.mutation(api.catalog.productsAdmin.update, {
      productId: w.products.pads,
      patch: { retailPricePara: 550_000 },
    });
    expect(
      await errorCode(() =>
        w.anon.mutation(api.orders.submit, {
          guestToken: GUEST,
          ...checkoutArgs({ expectedTotalPara: 545_000 }),
        }),
      ),
    ).toBe("PRICE_CHANGED");
    const ok = await w.anon.mutation(api.orders.submit, {
      guestToken: GUEST,
      ...checkoutArgs({ expectedTotalPara: 595_000 }),
    });
    expect(ok.totalPara).toBe(595_000);
  });

  test("empty cart and unknown token", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    expect(
      await errorCode(() =>
        w.anon.mutation(api.orders.submit, { guestToken: GUEST, ...checkoutArgs() }),
      ),
    ).toBe("EMPTY_CART");
    expect(await w.anon.query(api.orders.getByToken, { token: "x".repeat(43) })).toBeNull();
    expect(await w.anon.query(api.orders.getByToken, { token: "short" })).toBeNull();
  });

  test("submissions are rate limited per client", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const client = t.withRequestMetadata({ ip: "203.0.113.7", userAgent: "vitest" });
    const codes = [];
    // orderSubmit: a burst of 10 per IP (sized for carrier NAT, D221).
    for (let i = 0; i < 11; i++) {
      const token = `rate-token-${String(i).padStart(30, "0")}`;
      await client.mutation(api.carts.addItem, {
        guestToken: token,
        productId: w.products.battery,
        quantity: 1,
      });
      codes.push(
        await errorCode(() =>
          client.mutation(api.orders.submit, {
            guestToken: token,
            ...checkoutArgs({ contact: { ...checkoutArgs().contact, email: `k${i}@primer.rs` } }),
          }),
        ),
      );
    }
    expect(codes.slice(0, 10)).toEqual(Array(10).fill("NO_ERROR"));
    expect(codes[10]).toBe("RATE_LIMITED");
  });

  test("the site-wide order threshold alerts the owner instead of refusing orders", async () => {
    vi.useFakeTimers();
    const t = makeT();
    const w = await setupWorld(t);
    await t.run(async (ctx) => {
      await rateLimiter.limit(ctx, "orderSubmitGlobal", { key: "global", count: 300 });
    });
    for (const [i, token] of [GUEST, GUEST_2].entries()) {
      await w.anon.mutation(api.carts.addItem, {
        guestToken: token,
        productId: w.products.battery,
        quantity: 1,
      });
      await w.anon.mutation(api.orders.submit, {
        guestToken: token,
        ...checkoutArgs({ contact: { ...checkoutArgs().contact, email: `g${i}@primer.rs` } }),
      });
    }
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const alerts = await t.run(async (ctx) =>
      (await ctx.db.query("notifications").take(100)).filter((n) => n.kind === "security"),
    );
    // One alert per owner per hour, however many orders cross the threshold.
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.userId).toBe(w.owner);
    vi.useRealTimers();
  });

  test("guest checkout can be disabled by the owner", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const s = await w.asOwner.query(api.settings.getAdmin, {});
    await w.asOwner.mutation(api.settings.updateSection, {
      update: { section: "flags", value: { ...s.flags, guestCheckout: false } },
    });
    await w.anon.mutation(api.carts.addItem, {
      guestToken: GUEST,
      productId: w.products.disc,
      quantity: 1,
    });
    expect(
      await errorCode(() =>
        w.anon.mutation(api.orders.submit, { guestToken: GUEST, ...checkoutArgs() }),
      ),
    ).toBe("UNAUTHENTICATED");
  });
});

describe("order ownership", () => {
  test("a customer cannot read or reorder another customer's order", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    await w.asCustomerA.mutation(api.carts.addItem, { productId: w.products.disc, quantity: 1 });
    const res = await w.asCustomerA.mutation(api.orders.submit, checkoutArgs());
    expect(await w.asCustomerA.query(api.orders.myOrder, { number: res.number })).not.toBeNull();
    expect(await w.asCustomerB.query(api.orders.myOrder, { number: res.number })).toBeNull();
    expect(await w.asCustomerB.query(api.orders.myOrders, {})).toEqual([]);
    expect(
      await errorCode(() => w.asCustomerB.mutation(api.orders.reorder, { number: res.number })),
    ).toBe("NOT_FOUND");
    expect(
      await errorCode(() => w.asCustomerB.query(api.ordersAdmin.get, { number: res.number })),
    ).toBe("FORBIDDEN");
    expect(await errorCode(() => w.anon.query(api.orders.myOrders, {}))).toBe("UNAUTHENTICATED");
  });

  test("reorder adds the still-available lines to the own cart", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    await w.asCustomerA.mutation(api.carts.addItem, { productId: w.products.disc, quantity: 1 });
    const res = await w.asCustomerA.mutation(api.orders.submit, checkoutArgs());
    const r = await w.asCustomerA.mutation(api.orders.reorder, { number: res.number });
    expect(r).toEqual({ added: 1, unavailable: [] });
    const cart = await w.asCustomerA.query(api.carts.get, {});
    expect(cart.lines[0].quantity).toBe(1);
  });
});

describe("order state machine through ordersAdmin.transition", () => {
  async function newOrder(delivery: "pickup" | "courier" = "courier") {
    const t = makeT();
    const w = await setupWorld(t);
    await w.anon.mutation(api.carts.addItem, {
      guestToken: GUEST,
      productId: w.products.disc,
      quantity: 3,
    });
    const res = await w.anon.mutation(api.orders.submit, {
      guestToken: GUEST,
      ...checkoutArgs(
        delivery === "pickup"
          ? { delivery: { method: "pickup" }, payment: { method: "pickup_cash" } }
          : {},
      ),
    });
    const view = async () => (await w.asStaff.query(api.ordersAdmin.get, { number: res.number }))!;
    return { t, w, res, view };
  }

  test("confirming commits stock once; cancelling restocks it", async () => {
    const { w, view } = await newOrder();
    let o = await view();
    await w.asStaff.mutation(api.ordersAdmin.transition, {
      orderId: o.order._id,
      to: "potvrdjena",
      expectedUpdatedAt: o.order.updatedAt,
    });
    o = await view();
    expect(o.order.status).toBe("potvrdjena");
    expect(o.order.stockCommitted).toBe(true);
    expect(o.items[0]).toMatchObject({ committedQty: 3, currentStock: 7 });
    await w.asStaff.mutation(api.ordersAdmin.transition, {
      orderId: o.order._id,
      to: "otkazana",
      reason: "Kupac odustao",
      expectedUpdatedAt: o.order.updatedAt,
    });
    o = await view();
    expect(o.order.status).toBe("otkazana");
    expect(o.items[0].currentStock).toBe(10);
    const movements = await w.asStaff.query(api.stock.movements, {
      productId: w.products.disc,
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(movements.page.map((m) => m.reason)).toEqual([
      "order_cancelled",
      "order_confirmed",
      "receipt",
    ]);
  });

  test("illegal transitions are rejected", async () => {
    const { w, view } = await newOrder("courier");
    const o = await view();
    const go = (
      to: "poslata" | "spremna_za_preuzimanje" | "zavrsena" | "otkazana" | "nova",
      reason?: string,
    ) =>
      errorCode(() =>
        w.asStaff.mutation(api.ordersAdmin.transition, {
          orderId: o.order._id,
          to,
          expectedUpdatedAt: o.order.updatedAt,
          ...(reason ? { reason } : {}),
        }),
      );
    expect(await go("poslata")).toBe("INVALID");
    expect(await go("zavrsena")).toBe("INVALID");
    expect(await go("nova")).toBe("CONFLICT");
    expect(await go("otkazana")).toBe("INVALID");
    await w.asStaff.mutation(api.ordersAdmin.transition, {
      orderId: o.order._id,
      to: "potvrdjena",
      expectedUpdatedAt: o.order.updatedAt,
    });
    const o2 = await view();
    expect(
      await errorCode(() =>
        w.asStaff.mutation(api.ordersAdmin.transition, {
          orderId: o.order._id,
          to: "spremna_za_preuzimanje",
          expectedUpdatedAt: o2.order.updatedAt,
        }),
      ),
    ).toBe("INVALID");
  });

  test("a stale expectedUpdatedAt is a conflict", async () => {
    const { w, view } = await newOrder();
    const o = await view();
    expect(
      await errorCode(() =>
        w.asStaff.mutation(api.ordersAdmin.transition, {
          orderId: o.order._id,
          to: "potvrdjena",
          expectedUpdatedAt: o.order.updatedAt - 1,
        }),
      ),
    ).toBe("CONFLICT");
  });

  test("courier flow with tracking reaches zavrsena; events, outbox and audit are written", async () => {
    const { t, w, view } = await newOrder("courier");
    for (const [to, extra] of [
      ["potvrdjena", {}],
      ["poslata", { tracking: { courierCode: "dexpress", trackingNumber: "RS123" } }],
      ["isporucena", {}],
      ["zavrsena", {}],
    ] as const) {
      const o = await view();
      await w.asStaff.mutation(api.ordersAdmin.transition, {
        orderId: o.order._id,
        to,
        expectedUpdatedAt: o.order.updatedAt,
        ...extra,
      });
    }
    const o = await view();
    expect(o.order.status).toBe("zavrsena");
    expect(o.order.trackingNumber).toBe("RS123");
    expect(o.events.map((e) => e.toStatus).filter(Boolean)).toEqual([
      "nova",
      "potvrdjena",
      "poslata",
      "isporucena",
      "zavrsena",
    ]);
    const counts = await t.run(async (ctx) => ({
      events: (
        await ctx.db
          .query("domainEvents")
          .withIndex("by_aggregateType_and_aggregateId", (q) =>
            q.eq("aggregateType", "order").eq("aggregateId", o.order._id),
          )
          .collect()
      ).length,
      audit: (
        await ctx.db
          .query("auditLog")
          .withIndex("by_entityType_and_entityId_and_at", (q) =>
            q.eq("entityType", "order").eq("entityId", o.order._id),
          )
          .collect()
      ).length,
    }));
    expect(counts.events).toBe(5);
    expect(counts.audit).toBe(4);
  });

  test("pickup flow: spremna_za_preuzimanje → preuzeta", async () => {
    const { w, view } = await newOrder("pickup");
    for (const to of ["potvrdjena", "spremna_za_preuzimanje", "preuzeta"] as const) {
      const o = await view();
      await w.asStaff.mutation(api.ordersAdmin.transition, {
        orderId: o.order._id,
        to,
        expectedUpdatedAt: o.order.updatedAt,
      });
    }
    expect((await view()).order.status).toBe("preuzeta");
  });

  test("items are editable only while the order is new", async () => {
    const { w, view } = await newOrder();
    let o = await view();
    await w.asStaff.mutation(api.ordersAdmin.editItems, {
      orderId: o.order._id,
      expectedUpdatedAt: o.order.updatedAt,
      changes: [{ itemId: o.items[0]._id, quantity: 1 }],
    });
    o = await view();
    expect(o.order.itemsPara).toBe(1_000_000);
    expect(o.order.deliveryPara).toBe(0);
    await w.asStaff.mutation(api.ordersAdmin.transition, {
      orderId: o.order._id,
      to: "potvrdjena",
      expectedUpdatedAt: o.order.updatedAt,
    });
    o = await view();
    expect(
      await errorCode(() =>
        w.asStaff.mutation(api.ordersAdmin.editItems, {
          orderId: o.order._id,
          expectedUpdatedAt: o.order.updatedAt,
          changes: [{ itemId: o.items[0]._id, quantity: 2 }],
        }),
      ),
    ).toBe("INVALID");
  });

  test("non-staff cannot call admin order functions", async () => {
    const { w, view } = await newOrder();
    const o = await view();
    const args = {
      orderId: o.order._id,
      to: "potvrdjena" as const,
      expectedUpdatedAt: o.order.updatedAt,
    };
    expect(await errorCode(() => w.anon.mutation(api.ordersAdmin.transition, args))).toBe(
      "UNAUTHENTICATED",
    );
    expect(await errorCode(() => w.asCustomerA.mutation(api.ordersAdmin.transition, args))).toBe(
      "FORBIDDEN",
    );
    expect(
      await errorCode(() =>
        w.asMechA.mutation(api.ordersAdmin.markPaid, { orderId: o.order._id, paid: true }),
      ),
    ).toBe("FORBIDDEN");
    expect(
      await errorCode(() =>
        w.asMechA.query(api.ordersAdmin.list, { paginationOpts: { numItems: 5, cursor: null } }),
      ),
    ).toBe("FORBIDDEN");
  });
});

async function setStockMode(ctx: MutationCtx, stockDecrementOn: "created" | "confirmed") {
  const doc = await ctx.db.query("settings").first();
  const commerce = {
    ...(doc ?? DEFAULT_SETTINGS).commerce,
    stockDecrementOn,
    restockOnCancel: true,
  };
  if (doc) await ctx.db.patch("settings", doc._id, { commerce });
  else await ctx.db.insert("settings", { ...DEFAULT_SETTINGS, commerce, updatedAt: 0 });
}

describe("staff edits keep committed stock in step (QA BE-06)", () => {
  async function createdModeOrder() {
    const t = makeT();
    const w = await setupWorld(t);
    await t.run((ctx) => setStockMode(ctx, "created"));
    await w.anon.mutation(api.carts.addItem, {
      guestToken: GUEST,
      productId: w.products.disc,
      quantity: 3,
    });
    await w.anon.mutation(api.carts.addItem, {
      guestToken: GUEST,
      productId: w.products.battery,
      quantity: 1,
    });
    const res = await w.anon.mutation(api.orders.submit, { guestToken: GUEST, ...checkoutArgs() });
    const view = async () => (await w.asStaff.query(api.ordersAdmin.get, { number: res.number }))!;
    const stock = (id: Id<"products">) =>
      t.run(async (ctx) => (await ctx.db.get("products", id))!.stockQty);
    const line = async (sku: string) => (await view()).items.find((i) => i.sku === sku)!;
    return { t, w, view, stock, line };
  }

  test("remove, lower, raise and add lines move stock with reason order_edited; cancel returns the rest", async () => {
    const { t, w, view, stock, line } = await createdModeOrder();
    expect(await stock(w.products.disc)).toBe(7);
    expect(await stock(w.products.battery)).toBe(19);
    let o = await view();
    // disc 3 → 1 returns 2; battery removed returns 1; filter-less add of battery × 2 takes 2.
    await w.asStaff.mutation(api.ordersAdmin.editItems, {
      orderId: o.order._id,
      expectedUpdatedAt: o.order.updatedAt,
      changes: [
        { itemId: (await line("T-DISC"))._id, quantity: 1 },
        { itemId: (await line("T-BATT"))._id, remove: true },
      ],
    });
    expect(await stock(w.products.disc)).toBe(9);
    expect(await stock(w.products.battery)).toBe(20);
    o = await view();
    await w.asStaff.mutation(api.ordersAdmin.editItems, {
      orderId: o.order._id,
      expectedUpdatedAt: o.order.updatedAt,
      changes: [{ itemId: (await line("T-DISC"))._id, quantity: 4 }],
      add: [{ productId: w.products.battery, quantity: 2 }],
    });
    expect(await stock(w.products.disc)).toBe(6);
    expect(await stock(w.products.battery)).toBe(18);
    expect(await line("T-DISC")).toMatchObject({ committedQty: 4 });
    expect(await line("T-BATT")).toMatchObject({ committedQty: 2 });
    const reasons = await t.run(async (ctx) =>
      (await ctx.db.query("stockMovements").take(100)).map((m) => m.reason),
    );
    expect(reasons.filter((r) => r === "order_edited")).toHaveLength(4);

    o = await view();
    await w.asStaff.mutation(api.ordersAdmin.transition, {
      orderId: o.order._id,
      to: "otkazana",
      reason: "Kupac odustao",
      expectedUpdatedAt: o.order.updatedAt,
    });
    expect(await stock(w.products.disc)).toBe(10);
    expect(await stock(w.products.battery)).toBe(20);
  });

  test("an order created before the switch to created mode is committed on confirm", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    await w.anon.mutation(api.carts.addItem, {
      guestToken: GUEST,
      productId: w.products.disc,
      quantity: 3,
    });
    const res = await w.anon.mutation(api.orders.submit, { guestToken: GUEST, ...checkoutArgs() });
    await t.run((ctx) => setStockMode(ctx, "created"));
    const o = (await w.asStaff.query(api.ordersAdmin.get, { number: res.number }))!;
    await w.asStaff.mutation(api.ordersAdmin.transition, {
      orderId: o.order._id,
      to: "potvrdjena",
      expectedUpdatedAt: o.order.updatedAt,
    });
    const after = (await w.asStaff.query(api.ordersAdmin.get, { number: res.number }))!;
    expect(after.order.stockCommitted).toBe(true);
    expect(after.items[0]).toMatchObject({ committedQty: 3, currentStock: 7 });
  });
});
