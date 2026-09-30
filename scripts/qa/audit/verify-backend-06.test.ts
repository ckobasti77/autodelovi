/// <reference types="vite/client" />
/**
 * Step 21 audit — independent verification of backend-06 (order line edits never adjust stock
 * that was already committed). Runs convex-test in memory against the real schema/functions, so
 * the shared dev deployment's global stock mode is never touched.
 *
 *   npx vitest run --config scripts/qa/audit/verify-backend-06.vitest.config.mts --silent=false verify-backend-06.test
 *
 * Every test prints a JSON line prefixed with `VERIFY06 ` (expected vs actual stock) and asserts
 * the CURRENT behaviour, so a green run means the defect reproduces.
 */
import { expect, test } from "vitest";

import { api } from "../../../convex/_generated/api";
import { checkoutArgs, GUEST, makeT, setupWorld } from "../../../convex/test.setup";

type W = Awaited<ReturnType<typeof setupWorld>>;
type TT = ReturnType<typeof makeT>;

async function setMode(t: TT, mode: "created" | "confirmed") {
  await t.run(async (ctx) => {
    const doc = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .unique();
    if (!doc) throw new Error("settings not seeded");
    await ctx.db.patch("settings", doc._id, {
      commerce: { ...doc.commerce, stockDecrementOn: mode, restockOnCancel: true },
    });
  });
}

async function stockOf(t: TT, id: string): Promise<number> {
  return await t.run(async (ctx) => (await ctx.db.get(id as never))!.stockQty as number);
}

async function movements(t: TT, id: string) {
  return await t.run(async (ctx) =>
    (
      await ctx.db
        .query("stockMovements")
        .withIndex("by_productId_and_at", (q) => q.eq("productId", id as never))
        .collect()
    ).map((m) => `${m.reason}:${m.delta}`),
  );
}

async function order(w: W, lines: Array<[string, number]>) {
  for (const [productId, quantity] of lines) {
    await w.anon.mutation(api.carts.addItem, {
      guestToken: GUEST,
      productId: productId as never,
      quantity,
    });
  }
  const res = await w.anon.mutation(api.orders.submit, {
    guestToken: GUEST,
    ...checkoutArgs({ delivery: { method: "pickup" }, payment: { method: "pickup_cash" } }),
  });
  const view = async () => (await w.asStaff.query(api.ordersAdmin.get, { number: res.number }))!;
  return { res, view };
}

async function go(w: W, view: () => Promise<any>, to: string, reason?: string) {
  const o = await view();
  await w.asStaff.mutation(api.ordersAdmin.transition, {
    orderId: o.order._id,
    to: to as never,
    ...(reason ? { reason } : {}),
    expectedUpdatedAt: o.order.updatedAt,
  });
}

const log = (name: string, data: unknown) => console.log(`VERIFY06 ${JSON.stringify({ name, ...(data as object) })}`);

test("created mode: removing a committed line never returns its stock, not even on cancel", async () => {
  const t = makeT();
  const w = await setupWorld(t);
  await setMode(t, "created");
  const { disc, battery } = w.products;
  const { view } = await order(w, [
    [disc, 3],
    [battery, 1],
  ]);
  let o = await view();
  const afterCreate = await stockOf(t, disc);
  const discItem = o.items.find((i: any) => i.productId === disc);
  await w.asStaff.mutation(api.ordersAdmin.editItems, {
    orderId: o.order._id,
    expectedUpdatedAt: o.order.updatedAt,
    changes: [{ itemId: discItem._id, remove: true }],
  });
  const afterRemove = await stockOf(t, disc);
  await go(w, view, "otkazana", "QA verify cancel");
  o = await view();
  const afterCancel = await stockOf(t, disc);
  const mv = await movements(t, disc);
  log("remove-then-cancel", {
    discStart: 10,
    afterCreate,
    afterRemove_expected: 10,
    afterRemove,
    afterCancel_expected: 10,
    afterCancel,
    batteryAfterCancel: await stockOf(t, battery),
    movements: mv,
  });
  expect(afterCreate).toBe(7);
  expect(afterRemove).toBe(7);
  expect(afterCancel).toBe(7);
  expect(mv.some((m) => m.startsWith("order_edited"))).toBe(false);
});

test("created mode: lowering 3 → 1 keeps 3 off the shelf through completion", async () => {
  const t = makeT();
  const w = await setupWorld(t);
  await setMode(t, "created");
  const { disc } = w.products;
  const { view } = await order(w, [[disc, 3]]);
  const o = await view();
  await w.asStaff.mutation(api.ordersAdmin.editItems, {
    orderId: o.order._id,
    expectedUpdatedAt: o.order.updatedAt,
    changes: [{ itemId: o.items[0]._id, quantity: 1 }],
  });
  const afterEdit = await stockOf(t, disc);
  for (const to of ["potvrdjena", "spremna_za_preuzimanje", "preuzeta", "zavrsena"]) await go(w, view, to);
  const done = await view();
  const afterComplete = await stockOf(t, disc);
  log("lower-then-complete", {
    soldQty: done.items[0].quantity,
    committedQty: done.items[0].committedQty,
    afterEdit_expected: 9,
    afterEdit,
    afterComplete_expected: 9,
    afterComplete,
    movements: await movements(t, disc),
  });
  expect(afterEdit).toBe(7);
  expect(afterComplete).toBe(7);
});

test("created mode: a line added by staff is never taken off the shelf", async () => {
  const t = makeT();
  const w = await setupWorld(t);
  await setMode(t, "created");
  const { disc, battery } = w.products;
  const { view } = await order(w, [[disc, 1]]);
  const o = await view();
  await w.asStaff.mutation(api.ordersAdmin.editItems, {
    orderId: o.order._id,
    expectedUpdatedAt: o.order.updatedAt,
    changes: [],
    add: [{ productId: battery, quantity: 2 }],
  });
  for (const to of ["potvrdjena", "spremna_za_preuzimanje", "preuzeta", "zavrsena"]) await go(w, view, to);
  const done = await view();
  const afterComplete = await stockOf(t, battery);
  log("add-then-complete", {
    batteryStart: 20,
    batteryLine: done.items.find((i: any) => i.productId === battery),
    afterComplete_expected: 18,
    afterComplete,
    movements: await movements(t, battery),
  });
  expect(afterComplete).toBe(20);
});

test("mode switch confirmed → created: an open „nova“ order is never committed", async () => {
  const t = makeT();
  const w = await setupWorld(t);
  await setMode(t, "confirmed");
  const { disc } = w.products;
  const { view } = await order(w, [[disc, 3]]);
  await setMode(t, "created");
  for (const to of ["potvrdjena", "spremna_za_preuzimanje", "preuzeta", "zavrsena"]) await go(w, view, to);
  const done = await view();
  const afterComplete = await stockOf(t, disc);
  log("mode-switch", {
    stockCommitted: done.order.stockCommitted,
    afterComplete_expected: 7,
    afterComplete,
    movements: await movements(t, disc),
  });
  expect(done.order.stockCommitted).toBe(false);
  expect(afterComplete).toBe(10);
});

test("control: confirmed mode (default) — edits happen before commit, so stock is exact", async () => {
  const t = makeT();
  const w = await setupWorld(t);
  await setMode(t, "confirmed");
  const { disc } = w.products;
  const { view } = await order(w, [[disc, 3]]);
  const o = await view();
  await w.asStaff.mutation(api.ordersAdmin.editItems, {
    orderId: o.order._id,
    expectedUpdatedAt: o.order.updatedAt,
    changes: [{ itemId: o.items[0]._id, quantity: 1 }],
  });
  await go(w, view, "potvrdjena");
  const afterConfirm = await stockOf(t, disc);
  log("control-confirmed", { afterConfirm_expected: 9, afterConfirm });
  expect(afterConfirm).toBe(9);
});
