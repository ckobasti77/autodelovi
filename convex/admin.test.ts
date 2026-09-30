/// <reference types="vite/client" />
/**
 * Step 15 — admin panel backend: staff vs owner permissions, audit entries, order status
 * transitions, bulk product edits with undo, staff invites, quote → order by staff,
 * customer blocking, role safety, command search, category 3D mapping.
 */
import { describe, expect, test } from "vitest";

import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  checkoutArgs,
  CONSENT,
  errorCode,
  GUEST,
  makeT,
  setupWorld,
  type World,
} from "./test.setup";

async function guestOrder(w: World, productId: Id<"products"> = w.products.disc, quantity = 1) {
  await w.anon.mutation(api.carts.addItem, { guestToken: GUEST, productId, quantity });
  const res = await w.anon.mutation(api.orders.submit, { guestToken: GUEST, ...checkoutArgs() });
  const detail = (await w.asStaff.query(api.ordersAdmin.get, { number: res.number }))!;
  return { number: res.number, detail };
}

async function auditActions(w: World, entityId: string) {
  return await w.anon.run(async (ctx) =>
    (await ctx.db.query("auditLog").withIndex("by_at").order("desc").take(200))
      .filter((a) => a.entityId === entityId)
      .map((a) => a.action),
  );
}

describe("staff vs owner permissions", () => {
  test("staff-only reads refuse customers, mechanics and anonymous visitors", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const now = Date.now();
    for (const who of [w.anon, w.asCustomerA, w.asMechA]) {
      expect(await errorCode(() => who.query(api.dashboard.kpis, { nowMinute: now }))).toMatch(
        /UNAUTHENTICATED|FORBIDDEN/,
      );
      expect(await errorCode(() => who.query(api.adminSearch.run, { q: "SK-2026-1" }))).toMatch(
        /UNAUTHENTICATED|FORBIDDEN/,
      );
      expect(
        await errorCode(() =>
          who.query(api.customersAdmin.list, { paginationOpts: { numItems: 5, cursor: null } }),
        ),
      ).toMatch(/UNAUTHENTICATED|FORBIDDEN/);
      expect(await errorCode(() => who.query(api.catalog.categoriesAdmin.tree, {}))).toMatch(
        /UNAUTHENTICATED|FORBIDDEN/,
      );
    }
    expect(await errorCode(() => w.asStaff.query(api.dashboard.kpis, { nowMinute: now }))).toBe(
      "NO_ERROR",
    );
    expect(await errorCode(() => w.asStaff.query(api.dashboard.navCounts, {}))).toBe("NO_ERROR");
  });

  test("owner-only writes refuse staff: settings, invites, roles, tiers, legal texts, demo removal", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const settings = await w.asStaff.query(api.settings.getAdmin, {});
    const flags = { ...settings.flags, backInStock: false };
    expect(
      await errorCode(() =>
        w.asStaff.mutation(api.settings.updateSection, {
          update: { section: "flags", value: flags },
        }),
      ),
    ).toBe("FORBIDDEN");
    expect(
      await errorCode(() =>
        w.asOwner.mutation(api.settings.updateSection, {
          update: { section: "flags", value: flags },
        }),
      ),
    ).toBe("NO_ERROR");
    expect(
      await errorCode(() =>
        w.asStaff.mutation(api.staff.createInvite, { email: "novi@sklop.test", role: "staff" }),
      ),
    ).toBe("FORBIDDEN");
    expect(await errorCode(() => w.asStaff.query(api.staff.listInvites, {}))).toBe("FORBIDDEN");
    expect(
      await errorCode(() =>
        w.asStaff.mutation(api.staff.setRole, { userId: w.customerA, role: "staff" }),
      ),
    ).toBe("FORBIDDEN");
    expect(
      await errorCode(() =>
        w.asStaff.mutation(api.pricing.setTierActive, { tierId: w.tiers.majstor, active: false }),
      ),
    ).toBe("FORBIDDEN");
    expect(
      await errorCode(() => w.asStaff.mutation(api.demo.remove, { confirm: "OBRIŠI DEMO" })),
    ).toBe("FORBIDDEN");
    await t.mutation(internal.content.seedContent, {});
    const page = (await w.asStaff.query(api.content.adminPages, {}))[0]!;
    const edit = {
      pageId: page._id,
      title: page.title,
      bodyMd: `${page.bodyMd}

Dopuna.`,
      published: page.published,
      needsLegalReview: true,
      expectedVersion: page.version,
    };
    expect(await errorCode(() => w.asStaff.mutation(api.content.updatePage, edit))).toBe(
      "FORBIDDEN",
    );
    expect((await w.asOwner.mutation(api.content.updatePage, edit)).version).toBe(page.version + 1);
    expect(await errorCode(() => w.asOwner.mutation(api.content.updatePage, edit))).toBe(
      "CONFLICT",
    );
  });

  test("settings update is audited with a field diff", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const settings = await w.asOwner.query(api.settings.getAdmin, {});
    await w.asOwner.mutation(api.settings.updateSection, {
      update: {
        section: "company",
        value: { ...settings.company, legalName: "Auto delovi Test d.o.o." },
      },
    });
    const entry = await w.anon.run(
      async (ctx) =>
        await ctx.db
          .query("auditLog")
          .withIndex("by_action_and_at", (q) => q.eq("action", "settings.update"))
          .first(),
    );
    expect(entry?.entityId).toBe("company");
    expect(entry?.actor.type).toBe("owner");
    expect(entry?.diff?.length).toBeGreaterThan(0);
  });
});

describe("order transitions from the admin", () => {
  test("nova → potvrdjena → poslata with tracking: stock, events, audit, timeline", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const { number, detail } = await guestOrder(w, w.products.disc, 2);
    await w.asStaff.mutation(api.ordersAdmin.transition, {
      orderId: detail.order._id,
      to: "potvrdjena",
      expectedUpdatedAt: detail.order.updatedAt,
    });
    const confirmed = (await w.asStaff.query(api.ordersAdmin.get, { number }))!;
    expect(confirmed.order.status).toBe("potvrdjena");
    expect(confirmed.items[0]!.currentStock).toBe(8);
    const settings = await w.asStaff.query(api.settings.getAdmin, {});
    await w.asStaff.mutation(api.ordersAdmin.transition, {
      orderId: detail.order._id,
      to: "poslata",
      tracking: { courierCode: settings.couriers[0]!.code, trackingNumber: "DE123456789RS" },
      expectedUpdatedAt: confirmed.order.updatedAt,
    });
    const shipped = (await w.asStaff.query(api.ordersAdmin.get, { number }))!;
    expect(shipped.order.status).toBe("poslata");
    expect(shipped.order.trackingNumber).toBe("DE123456789RS");
    expect(shipped.events.map((e) => e.toStatus).filter(Boolean)).toEqual(
      expect.arrayContaining(["potvrdjena", "poslata"]),
    );
    const eventTypes = await w.anon.run(async (ctx) =>
      (
        await ctx.db
          .query("domainEvents")
          .withIndex("by_aggregateType_and_aggregateId", (q) =>
            q.eq("aggregateType", "order").eq("aggregateId", detail.order._id),
          )
          .take(20)
      ).map((e) => e.type),
    );
    expect(eventTypes.filter((type) => type === "order.status_changed")).toHaveLength(2);
    expect(await auditActions(w, detail.order._id)).toEqual(
      expect.arrayContaining(["order.transition"]),
    );
  });

  test("guards: illegal jump, cancel without reason, stale expectedUpdatedAt, customers refused", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const { detail } = await guestOrder(w);
    const base = { orderId: detail.order._id, expectedUpdatedAt: detail.order.updatedAt };
    expect(
      await errorCode(() =>
        w.asStaff.mutation(api.ordersAdmin.transition, { ...base, to: "isporucena" }),
      ),
    ).toBe("INVALID");
    expect(
      await errorCode(() =>
        w.asStaff.mutation(api.ordersAdmin.transition, { ...base, to: "otkazana" }),
      ),
    ).toBe("INVALID");
    expect(
      await errorCode(() =>
        w.asStaff.mutation(api.ordersAdmin.transition, {
          ...base,
          to: "potvrdjena",
          expectedUpdatedAt: 1,
        }),
      ),
    ).toBe("CONFLICT");
    expect(
      await errorCode(() =>
        w.asCustomerA.mutation(api.ordersAdmin.transition, { ...base, to: "potvrdjena" }),
      ),
    ).toBe("FORBIDDEN");
  });

  test("edit before confirmation adds a catalogue line priced for the order's mechanic, then locks", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    await w.asMechA.mutation(api.carts.addItem, { productId: w.products.pads, quantity: 1 });
    const res = await w.asMechA.mutation(api.orders.submit, checkoutArgs());
    const detail = (await w.asStaff.query(api.ordersAdmin.get, { number: res.number }))!;
    await w.asStaff.mutation(api.ordersAdmin.editItems, {
      orderId: detail.order._id,
      expectedUpdatedAt: detail.order.updatedAt,
      changes: [],
      add: [{ productId: w.products.disc, quantity: 1 }],
    });
    const edited = (await w.asStaff.query(api.ordersAdmin.get, { number: res.number }))!;
    const disc = edited.items.find((i) => i.sku === "T-DISC")!;
    // Majstor tier: 10 % → 10.000 RSD retail becomes 9.000 RSD.
    expect(disc.unitPricePara).toBe(900_000);
    expect(edited.order.totalPara).toBeGreaterThan(detail.order.totalPara);
    await w.asStaff.mutation(api.ordersAdmin.transition, {
      orderId: detail.order._id,
      to: "potvrdjena",
      expectedUpdatedAt: edited.order.updatedAt,
    });
    const confirmed = (await w.asStaff.query(api.ordersAdmin.get, { number: res.number }))!;
    expect(
      await errorCode(() =>
        w.asStaff.mutation(api.ordersAdmin.editItems, {
          orderId: detail.order._id,
          expectedUpdatedAt: confirmed.order.updatedAt,
          changes: [{ itemId: disc._id, quantity: 2 }],
        }),
      ),
    ).toBe("INVALID");
  });

  test("status counts and filtered list", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    await guestOrder(w);
    const counts = await w.asStaff.query(api.ordersAdmin.statusCounts, {});
    expect(counts.nova).toBe(1);
    const page = await w.asStaff.query(api.ordersAdmin.list, {
      delivery: "courier",
      payment: "cod",
      customerType: "guest",
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(page.page).toHaveLength(1);
    const none = await w.asStaff.query(api.ordersAdmin.list, {
      delivery: "pickup",
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(none.page).toHaveLength(0);
  });
});

describe("bulk product edits", () => {
  test("price % change is recorded as bulk and fully undone", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const ids = [w.products.disc, w.products.pads];
    const undo = await w.asStaff.mutation(api.catalog.productsAdmin.bulkAdjustPrice, {
      productIds: ids,
      percent: 10,
    });
    expect(undo).toHaveLength(2);
    const after = await w.anon.run(
      async (ctx) => (await ctx.db.get("products", w.products.disc))!.retailPricePara,
    );
    expect(after).toBe(1_100_000);
    const reasons = await w.anon.run(async (ctx) =>
      (
        await ctx.db
          .query("priceChanges")
          .withIndex("by_productId_and_at", (q) => q.eq("productId", w.products.disc))
          .take(10)
      ).map((c) => c.reason),
    );
    expect(reasons).toContain("bulk");
    await w.asStaff.mutation(api.catalog.productsAdmin.bulkRestore, { items: undo });
    const restored = await w.anon.run(
      async (ctx) => (await ctx.db.get("products", w.products.disc))!.retailPricePara,
    );
    expect(restored).toBe(1_000_000);
    const actions = await w.anon.run(async (ctx) =>
      (await ctx.db.query("auditLog").withIndex("by_at").order("desc").take(10)).map(
        (a) => a.action,
      ),
    );
    expect(actions).toEqual(expect.arrayContaining(["product.bulk_price", "product.bulk_undo"]));
  });

  test("deactivate and category move return the previous values; limits and authz hold", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const undo = await w.asStaff.mutation(api.catalog.productsAdmin.bulkSetActive, {
      productIds: [w.products.disc],
      active: false,
    });
    expect(undo).toEqual([{ productId: w.products.disc, active: true }]);
    const moved = await w.asStaff.mutation(api.catalog.productsAdmin.bulkSetCategory, {
      productIds: [w.products.pads],
      categoryId: w.categories.disc,
    });
    expect(moved[0]!.categoryId).not.toBe(w.categories.disc);
    expect(
      await errorCode(() =>
        w.asStaff.mutation(api.catalog.productsAdmin.bulkAdjustPrice, {
          productIds: [w.products.disc],
          percent: 500,
        }),
      ),
    ).toBe("INVALID");
    expect(
      await errorCode(() =>
        w.asMechA.mutation(api.catalog.productsAdmin.bulkSetActive, {
          productIds: [w.products.disc],
          active: false,
        }),
      ),
    ).toBe("FORBIDDEN");
  });

  test("duplicate makes an inactive copy with stock 0 and the same codes", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const copyId = await w.asStaff.mutation(api.catalog.productsAdmin.duplicate, {
      productId: w.products.disc,
    });
    const copy = (await w.asStaff.query(api.catalog.productsAdmin.getFull, { productId: copyId }))!;
    expect(copy.sku).toBe("T-DISC-KOPIJA");
    expect(copy.active).toBe(false);
    expect(copy.stockQty).toBe(0);
    expect(copy.oemNumbers.map((o) => o.raw)).toEqual(["5Q0 615 301 F"]);
    expect(copy.costNetPara).toBe(500_000);
  });
});

describe("staff invites and roles", () => {
  test("invite → accept with the matching e-mail binds the role once", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const { token } = await w.asOwner.mutation(api.staff.createInvite, {
      email: "A@sklop.test",
      role: "staff",
    });
    const info = await w.anon.query(api.staff.inviteInfo, { token });
    expect(info).toMatchObject({ status: "valid", role: "staff", emailMatches: false });
    expect(info.emailMasked).toBe("a•@sklop.test");
    // customerA has a@sklop.test (case-insensitive match).
    expect(await errorCode(() => w.asCustomerB.mutation(api.staff.acceptInvite, { token }))).toBe(
      "FORBIDDEN",
    );
    await w.asCustomerA.mutation(api.staff.acceptInvite, { token });
    const role = await w.anon.run(async (ctx) => (await ctx.db.get("users", w.customerA))!.role);
    expect(role).toBe("staff");
    expect(await errorCode(() => w.asCustomerA.mutation(api.staff.acceptInvite, { token }))).toBe(
      "CONFLICT",
    );
    expect((await w.anon.query(api.staff.inviteInfo, { token })).status).toBe("used");
    expect(await auditActions(w, w.customerA)).toContain("staff.invite_accept");
  });

  test("revoked invite and garbage tokens are refused", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const { token } = await w.asOwner.mutation(api.staff.createInvite, {
      email: "b@sklop.test",
      role: "staff",
    });
    const invites = await w.asOwner.query(api.staff.listInvites, {});
    await w.asOwner.mutation(api.staff.revokeInvite, { inviteId: invites[0]!._id });
    expect((await w.anon.query(api.staff.inviteInfo, { token })).status).toBe("invalid");
    expect(await errorCode(() => w.asCustomerB.mutation(api.staff.acceptInvite, { token }))).toBe(
      "CONFLICT",
    );
    expect((await w.anon.query(api.staff.inviteInfo, { token: "short" })).status).toBe("invalid");
    expect(
      await errorCode(() =>
        w.asOwner.mutation(api.staff.createInvite, { email: "staff@sklop.test", role: "staff" }),
      ),
    ).toBe("INVALID");
  });

  test("the owner cannot change their own role and the last owner cannot be demoted", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    expect(
      await errorCode(() =>
        w.asOwner.mutation(api.staff.setRole, { userId: w.owner, role: "staff" }),
      ),
    ).toBe("INVALID");
    await w.asOwner.mutation(api.staff.setRole, { userId: w.staff, role: "owner" });
    // Now two owners: the second one may demote the first.
    const asSecond = t.withIdentity({ subject: `${w.staff}|test-session` });
    await asSecond.mutation(api.staff.setRole, { userId: w.owner, role: "staff" });
    expect(
      await errorCode(() =>
        w.asOwner.mutation(api.staff.setRole, { userId: w.staff, role: "staff" }),
      ),
    ).toBe("FORBIDDEN");
  });
});

describe("inquiries: staff converts an accepted quote", () => {
  test("sent quote → order with the quote lines; inquiry accepted; audited", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const { number } = await w.anon.mutation(api.inquiries.submit, {
      kind: "vin",
      vin: "WVWZZZ5GZEW123456",
      message: "Treba mi kočioni disk za Golf 7.",
      contact: { name: "Marko Marković", phone: "064 111 2222", preferredChannel: "phone" },
      consent: CONSENT,
      honeypot: "",
      startedAt: Date.now() - 30_000,
    });
    const detail = (await w.asStaff.query(api.inquiriesAdmin.get, { number }))!;
    const quoteId = await w.asStaff.mutation(api.inquiriesAdmin.saveQuoteDraft, {
      inquiryId: detail.inquiry._id,
      lines: [
        {
          productId: w.products.disc,
          name: "Kočioni disk",
          quantity: 2,
          unitPricePara: 850_000,
          availability: "in_stock",
        },
      ],
    });
    await w.asStaff.mutation(api.inquiriesAdmin.sendQuote, { quoteId });
    const { orderNumber } = await w.asStaff.mutation(api.inquiriesAdmin.convertToOrder, {
      quoteId,
      contact: {
        firstName: "Marko",
        lastName: "Marković",
        email: "marko@primer.rs",
        phone: "064 111 2222",
      },
      delivery: { method: "pickup" },
      payment: { method: "pickup_cash" },
    });
    const order = (await w.asStaff.query(api.ordersAdmin.get, { number: orderNumber }))!;
    expect(order.order.source).toBe("admin");
    expect(order.order.inquiryNumber).toBe(number);
    expect(order.order.totalPara).toBe(1_700_000);
    const after = (await w.asStaff.query(api.inquiriesAdmin.get, { number }))!;
    expect(after.inquiry.status).toBe("prihvacena");
    expect(after.inquiry.orderNumber).toBe(orderNumber);
    expect(await auditActions(w, detail.inquiry._id)).toContain("quote.convert");
    // The same quote cannot become a second order.
    expect(
      await errorCode(() =>
        w.asStaff.mutation(api.inquiriesAdmin.convertToOrder, {
          quoteId,
          contact: {
            firstName: "Marko",
            lastName: "Marković",
            email: "marko@primer.rs",
            phone: "064 111 2222",
          },
          delivery: { method: "pickup" },
          payment: { method: "pickup_cash" },
        }),
      ),
    ).toBe("CONFLICT");
  });
});

describe("customers, search and categories", () => {
  test("staff block a customer with a reason (noted + audited) but never a staff account", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    expect(
      await errorCode(() =>
        w.asStaff.mutation(api.customersAdmin.setBlocked, { userId: w.customerA, blocked: true }),
      ),
    ).toBe("INVALID");
    await w.asStaff.mutation(api.customersAdmin.setBlocked, {
      userId: w.customerA,
      blocked: true,
      reason: "Lažne porudžbine",
    });
    const detail = (await w.asStaff.query(api.customersAdmin.get, { userId: w.customerA }))!;
    expect(detail.user.blocked).toBe(true);
    expect(detail.notes[0]!.message).toContain("Lažne porudžbine");
    expect(
      await errorCode(() =>
        w.asStaff.mutation(api.customersAdmin.setBlocked, {
          userId: w.owner,
          blocked: true,
          reason: "test",
        }),
      ),
    ).toBe("INVALID");
    expect(await auditActions(w, w.customerA)).toContain("customer.block");
  });

  test("command search finds an order by number and a product by its OEM number", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const { number } = await guestOrder(w);
    const byNumber = await w.asStaff.query(api.adminSearch.run, { q: number.toLowerCase() });
    expect(byNumber.some((h) => h.kind === "order" && h.title === number)).toBe(true);
    const byOem = await w.asStaff.query(api.adminSearch.run, { q: "5q0-615-301f" });
    expect(byOem.some((h) => h.kind === "product" && h.id === w.products.disc)).toBe(true);
  });

  test("3D part key: only taxonomy parts, one category per part; audited", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const tree = await w.asStaff.query(api.catalog.categoriesAdmin.tree, {});
    const disc = tree.find((c) => c._id === w.categories.disc)!;
    const other = tree.find((c) => c.kind === "category" && c.partKey && c._id !== disc._id)!;
    expect(
      await errorCode(() =>
        w.asStaff.mutation(api.catalog.categoriesAdmin.update, {
          categoryId: disc._id,
          partKey: "nepostojeci",
        }),
      ),
    ).toBe("INVALID");
    expect(
      await errorCode(() =>
        w.asStaff.mutation(api.catalog.categoriesAdmin.update, {
          categoryId: disc._id,
          partKey: other.partKey!,
        }),
      ),
    ).toBe("INVALID");
    await w.asStaff.mutation(api.catalog.categoriesAdmin.update, {
      categoryId: disc._id,
      seoTitle: "Kočioni diskovi za VW",
    });
    expect(await auditActions(w, disc._id)).toContain("category.update");
  });
});
