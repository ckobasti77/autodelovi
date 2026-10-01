/// <reference types="vite/client" />
import { describe, expect, test, vi } from "vitest";

import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { belgradeYear } from "../lib/domain/time";
import { CONSENT, CONTACT, errorCode, makeT, setupWorld, type World } from "./test.setup";

const year = belgradeYear(Date.now());

const inquiryArgs = (overrides: Record<string, unknown> = {}) => ({
  kind: "vin" as const,
  vin: "WVWZZZ5GZEW123456",
  message: "Treba mi set kvačila za Golf 7 2.0 TDI.",
  contact: { name: "Marko", phone: "064 111 2222", preferredChannel: "viber" as const },
  consent: CONSENT,
  honeypot: "",
  startedAt: Date.now() - 30_000,
  ...overrides,
});

async function inquiryWithQuote(w: World) {
  const { number, token } = await w.anon.mutation(api.inquiries.submit, inquiryArgs());
  const detail = (await w.asStaff.query(api.inquiriesAdmin.get, { number }))!;
  const draftId = await w.asStaff.mutation(api.inquiriesAdmin.saveQuoteDraft, {
    inquiryId: detail.inquiry._id,
    lines: [
      {
        productId: w.products.disc,
        sku: "T-DISC",
        name: "Kočioni disk prednji 312 mm",
        quantity: 2,
        unitPricePara: 850_000,
        availability: "in_stock",
      },
      {
        name: "Nosač kočione čeljusti",
        quantity: 1,
        unitPricePara: 300_000,
        availability: "on_order",
        leadTimeDays: 4,
      },
    ],
  });
  return { number, token, inquiryId: detail.inquiry._id, draftId };
}

const acceptArgs = (token: string, quoteId: Id<"quotes">) => ({
  token,
  quoteId,
  contact: CONTACT,
  delivery: { method: "pickup" as const },
  payment: { method: "pickup_cash" as const },
  consent: CONSENT,
});

describe("inquiries", () => {
  test("submit decodes the VIN, numbers the inquiry and notifies staff in-app", async () => {
    vi.useFakeTimers();
    const t = makeT();
    const w = await setupWorld(t);
    const { number, token } = await w.anon.mutation(api.inquiries.submit, inquiryArgs());
    expect(number).toBe(`UP-${year}-000001`);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const detail = await w.asStaff.query(api.inquiriesAdmin.get, { number });
    expect(detail!.inquiry.vin).toBe("WVWZZZ5GZEW123456");
    const vinInfo = await t.run(
      async (ctx) => (await ctx.db.get("inquiries", detail!.inquiry._id))!.vinInfo,
    );
    expect(vinInfo).toMatchObject({ wmi: "WVW", brandGuess: "Volkswagen", modelCode: "5G" });
    const bell = await w.asStaff.query(api.notifications.mine, {
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(bell.page[0]).toMatchObject({ kind: "inquiry_new", href: `/admin/upiti/${number}` });
    expect((await w.anon.query(api.inquiries.getByToken, { token }))!.status).toBe("nov");
    vi.useRealTimers();
  });

  test("contact, VIN and message are validated", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const submit = (o: Record<string, unknown>) =>
      errorCode(() => w.anon.mutation(api.inquiries.submit, inquiryArgs(o)));
    expect(await submit({ contact: { name: "Marko", preferredChannel: "phone" } })).toBe("INVALID");
    expect(
      await submit({ contact: { name: "Marko", email: "m@primer.rs", preferredChannel: "viber" } }),
    ).toBe("INVALID");
    expect(await submit({ vin: "WVWZZZ5GZEW12345O" })).toBe("INVALID");
    expect(await submit({ vin: undefined })).toBe("INVALID");
    expect(await submit({ message: "" })).toBe("INVALID");
    expect(await submit({ honeypot: "x" })).toBe("SPAM");
  });

  test("drafts stay internal; a sent quote is visible on the status page", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const { token, draftId } = await inquiryWithQuote(w);
    expect((await w.anon.query(api.inquiries.getByToken, { token }))!.quote).toBeNull();
    const { validUntil } = await w.asStaff.mutation(api.inquiriesAdmin.sendQuote, {
      quoteId: draftId,
    });
    expect(validUntil).toBeGreaterThan(Date.now() + 6 * 86_400_000);
    const view = (await w.anon.query(api.inquiries.getByToken, { token }))!;
    expect(view.status).toBe("ponuda_poslata");
    expect(view.quote).toMatchObject({ version: 1, status: "sent", totalPara: 2_000_000 });
  });

  test("accepting a quote creates the order at quoted prices in the same transaction", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const { token, draftId, number } = await inquiryWithQuote(w);
    await w.asStaff.mutation(api.inquiriesAdmin.sendQuote, { quoteId: draftId });
    const { orderNumber, orderToken } = await w.anon.mutation(
      api.inquiries.acceptQuote,
      acceptArgs(token, draftId),
    );
    const order = (await w.anon.query(api.orders.getByToken, { token: orderToken }))!;
    expect(order.number).toBe(orderNumber);
    expect(order.items.map((i) => i.unitPricePara)).toEqual([850_000, 300_000]);
    expect(order.items[0].unitRetailPara).toBe(1_000_000);
    expect(order.hasBackorder).toBe(true);
    const inquiry = (await w.asStaff.query(api.inquiriesAdmin.get, { number }))!;
    expect(inquiry.inquiry.status).toBe("prihvacena");
    expect(inquiry.inquiry.orderId).not.toBeNull();
    expect(inquiry.quotes[0].status).toBe("accepted");
    expect(
      await errorCode(() => w.anon.mutation(api.inquiries.acceptQuote, acceptArgs(token, draftId))),
    ).toBe("CONFLICT");
  });

  test("an expired quote cannot be accepted; expiry job and renewal request move the inquiry", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const { token, draftId, number } = await inquiryWithQuote(w);
    await w.asStaff.mutation(api.inquiriesAdmin.sendQuote, { quoteId: draftId });
    await t.run(async (ctx) => ctx.db.patch("quotes", draftId, { validUntil: Date.now() - 1_000 }));
    expect(
      await errorCode(() => w.anon.mutation(api.inquiries.acceptQuote, acceptArgs(token, draftId))),
    ).toBe("EXPIRED");
    const r = await t.mutation(internal.maintenance.expireQuotes, {});
    expect(r.expired).toBe(1);
    expect((await w.anon.query(api.inquiries.getByToken, { token }))!.status).toBe("istekla");
    await w.anon.mutation(api.inquiries.requestRenewal, { token });
    expect((await w.asStaff.query(api.inquiriesAdmin.get, { number }))!.inquiry.status).toBe(
      "u_obradi",
    );
  });

  test("a revised quote supersedes the old one", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const { token, draftId, inquiryId } = await inquiryWithQuote(w);
    await w.asStaff.mutation(api.inquiriesAdmin.sendQuote, { quoteId: draftId });
    const v2 = await w.asStaff.mutation(api.inquiriesAdmin.saveQuoteDraft, {
      inquiryId,
      lines: [
        { name: "Set kvačila", quantity: 1, unitPricePara: 2_000_000, availability: "in_stock" },
      ],
    });
    expect(v2).not.toBe(draftId);
    await w.asStaff.mutation(api.inquiriesAdmin.sendQuote, { quoteId: v2 });
    expect(
      await errorCode(() => w.anon.mutation(api.inquiries.acceptQuote, acceptArgs(token, draftId))),
    ).toBe("CONFLICT");
    const view = (await w.anon.query(api.inquiries.getByToken, { token }))!;
    expect(view.quote).toMatchObject({ version: 2, status: "sent" });
    await w.anon.mutation(api.inquiries.acceptQuote, acceptArgs(token, v2));
  });

  test("declining closes the inquiry", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const { token, draftId } = await inquiryWithQuote(w);
    await w.asStaff.mutation(api.inquiriesAdmin.sendQuote, { quoteId: draftId });
    await w.anon.mutation(api.inquiries.declineQuote, { token, quoteId: draftId, reason: "Skupo" });
    const view = (await w.anon.query(api.inquiries.getByToken, { token }))!;
    expect(view.status).toBe("odbijena");
    expect(view.closedReason).toContain("Skupo");
  });

  test("photos are checked by metadata and by magic bytes", async () => {
    vi.useFakeTimers();
    const t = makeT();
    const w = await setupWorld(t);
    const [jpeg, fake] = await t.run(async (ctx) => [
      await ctx.storage.store(
        new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4])], { type: "image/jpeg" }),
      ),
      await ctx.storage.store(
        new Blob([new TextEncoder().encode("<html>not an image</html>")], { type: "image/png" }),
      ),
    ]);
    const pdf = await t.run(async (ctx) =>
      ctx.storage.store(new Blob(["%PDF-1.7"], { type: "application/pdf" })),
    );
    const { number } = await w.anon.mutation(
      api.inquiries.submit,
      inquiryArgs({ photos: [jpeg, fake, pdf] }),
    );
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const detail = (await w.asStaff.query(api.inquiriesAdmin.get, { number }))!;
    expect(detail.photos.map((p) => p.storageId)).toEqual([jpeg]);
    const uploads = await t.run(async (ctx) => ctx.db.query("uploads").collect());
    expect(uploads.find((u) => u.storageId === fake)?.status).toBe("rejected");
    expect(uploads.find((u) => u.storageId === pdf)?.status).toBe("rejected");
    expect(await t.run(async (ctx) => ctx.storage.get(fake))).toBeNull();
    expect(
      await errorCode(() => w.anon.mutation(api.inquiries.submit, inquiryArgs({ photos: [jpeg] }))),
    ).toBe("INVALID");
    vi.useRealTimers();
  });

  test("customers cannot use the staff inquiry functions", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const { inquiryId, draftId } = await inquiryWithQuote(w);
    expect(
      await errorCode(() =>
        w.asCustomerA.mutation(api.inquiriesAdmin.sendQuote, { quoteId: draftId }),
      ),
    ).toBe("FORBIDDEN");
    expect(
      await errorCode(() =>
        w.asMechA.mutation(api.inquiriesAdmin.close, { inquiryId, reason: "test" }),
      ),
    ).toBe("FORBIDDEN");
    expect(
      await errorCode(() =>
        w.anon.query(api.inquiriesAdmin.list, { paginationOpts: { numItems: 5, cursor: null } }),
      ),
    ).toBe("UNAUTHENTICATED");
  });

  test("signed-in customers see only their own inquiries", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    await w.asCustomerA.mutation(api.inquiries.submit, inquiryArgs());
    expect(await w.asCustomerA.query(api.inquiries.mine, {})).toHaveLength(1);
    expect(await w.asCustomerB.query(api.inquiries.mine, {})).toHaveLength(0);
  });
});

describe("quote acceptance applies the mechanic's terms (QA BE-01, FLOW-08, FLOW-13, FLOW-16)", () => {
  const DAY = 86_400_000;

  async function mechanicQuote(w: World) {
    const { number, token } = await w.asMechA.mutation(api.inquiries.submit, inquiryArgs());
    const detail = (await w.asStaff.query(api.inquiriesAdmin.get, { number }))!;
    const quoteId = await w.asStaff.mutation(api.inquiriesAdmin.saveQuoteDraft, {
      inquiryId: detail.inquiry._id,
      lines: [
        {
          productId: w.products.disc,
          sku: "5Q0 615 301 F",
          name: "Kočioni disk prednji 312 mm",
          quantity: 2,
          unitPricePara: 850_000,
          availability: "in_stock",
        },
        { name: "Nosač čeljusti", quantity: 1, unitPricePara: 300_000, availability: "on_order" },
      ],
    });
    await w.asStaff.mutation(api.inquiriesAdmin.sendQuote, { quoteId });
    return { number, token, quoteId };
  }

  const setCredit = (t: ReturnType<typeof makeT>, w: World, creditLimitPara: number) =>
    t.run(async (ctx) => {
      await ctx.db.patch("mechanicProfiles", w.mechA.profileId, {
        creditLimitPara,
        paymentTermsDays: 30,
      });
    });

  test("deferred acceptance over the credit limit is refused; within it gets terms and tier", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const { token, quoteId } = await mechanicQuote(w);
    await setCredit(t, w, 1_000_000); // 10.000 RSD < 20.000 RSD quote
    const deferred = { ...acceptArgs(token, quoteId), payment: { method: "deferred" as const } };
    expect(await errorCode(() => w.asMechA.mutation(api.inquiries.acceptQuote, deferred))).toBe(
      "INVALID",
    );
    // The token page offers deferred payment only to the owning mechanic, with the remainder.
    const view = await w.asMechA.query(api.inquiries.getByToken, { token });
    expect(view!.deferredCredit).toEqual({ availablePara: 1_000_000 });
    expect((await w.anon.query(api.inquiries.getByToken, { token }))!.deferredCredit).toBeNull();
    expect(view!.prefill).toEqual({ phone: "+381641112222", email: null });

    await setCredit(t, w, 5_000_000);
    const before = Date.now();
    const { orderNumber } = await w.asMechA.mutation(api.inquiries.acceptQuote, deferred);
    const order = await t.run(async (ctx) =>
      ctx.db
        .query("orders")
        .withIndex("by_number", (q) => q.eq("number", orderNumber))
        .unique(),
    );
    expect(order!.customerType).toBe("mechanic");
    expect(order!.mechanicProfileId).toBe(w.mechA.profileId);
    expect(order!.tierSnapshot?.tierId).toBe(w.tiers.majstor);
    expect(order!.payment.dueAt! - before).toBeGreaterThanOrEqual(30 * DAY);
    expect(order!.payment.dueAt! - before).toBeLessThan(31 * DAY);
    // FLOW-16: the catalogue line orders under the product's SKU, not the quote's OEM code.
    const items = await t.run(async (ctx) =>
      ctx.db
        .query("orderItems")
        .withIndex("by_orderId", (q) => q.eq("orderId", order!._id))
        .take(10),
    );
    expect(items.map((i) => i.sku).sort()).toEqual(["T-DISC", "UPIT"]);
  });

  test("another signed-in mechanic holding the link gets no mechanic terms", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const { token, quoteId } = await mechanicQuote(w);
    const deferred = { ...acceptArgs(token, quoteId), payment: { method: "deferred" as const } };
    expect(await errorCode(() => w.asMechB.mutation(api.inquiries.acceptQuote, deferred))).toBe(
      "INVALID",
    );
  });

  test("staff conversion enforces the credit limit unless explicitly overridden (audited)", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const { quoteId } = await mechanicQuote(w);
    await setCredit(t, w, 1_000_000);
    const args = {
      quoteId,
      contact: CONTACT,
      delivery: { method: "pickup" as const },
      payment: { method: "deferred" as const },
    };
    expect(await errorCode(() => w.asStaff.mutation(api.inquiriesAdmin.convertToOrder, args))).toBe(
      "INVALID",
    );
    const { orderNumber } = await w.asStaff.mutation(api.inquiriesAdmin.convertToOrder, {
      ...args,
      creditOverride: true,
    });
    const audit = await t.run(async (ctx) =>
      (await ctx.db.query("auditLog").order("desc").take(20)).find(
        (a) => a.action === "quote.convert",
      ),
    );
    expect(audit!.summary).toContain(orderNumber);
    expect(audit!.summary).toContain("prekoračen limit");
    const order = await t.run(async (ctx) =>
      ctx.db
        .query("orders")
        .withIndex("by_number", (q) => q.eq("number", orderNumber))
        .unique(),
    );
    expect(order!.tierSnapshot?.tierId).toBe(w.tiers.majstor);
  });

  test("a staff member who is also a mechanic cannot override the limit on his own inquiry", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const { quoteId } = await mechanicQuote(w);
    await setCredit(t, w, 1_000_000); // 10.000 RSD < 20.000 RSD quote
    await t.run(async (ctx) => {
      await ctx.db.patch("users", w.mechA.userId, { role: "staff" });
    });
    const args = {
      quoteId,
      contact: CONTACT,
      delivery: { method: "pickup" as const },
      payment: { method: "deferred" as const },
    };
    const orderCount = () => t.run(async (ctx) => (await ctx.db.query("orders").take(50)).length);
    const before = await orderCount();
    // Same rule as mechanicsAdmin.assertNotOwnProfile: no self-granted credit.
    expect(
      await errorCode(() =>
        w.asMechA.mutation(api.inquiriesAdmin.convertToOrder, { ...args, creditOverride: true }),
      ),
    ).toBe("FORBIDDEN");
    expect(await errorCode(() => w.asMechA.mutation(api.inquiriesAdmin.convertToOrder, args))).toBe(
      "INVALID",
    );
    expect(await orderCount()).toBe(before);
    // The owner may still approve the overrun, audited.
    const { orderNumber } = await w.asOwner.mutation(api.inquiriesAdmin.convertToOrder, {
      ...args,
      creditOverride: true,
    });
    const audit = await t.run(async (ctx) =>
      (await ctx.db.query("auditLog").order("desc").take(20)).find(
        (a) => a.action === "quote.convert",
      ),
    );
    expect(audit!.summary).toContain(orderNumber);
    expect(audit!.summary).toContain("prekoračen limit");
  });

  test("phone-only inquiry: staff get the status link and convert without an e-mail", async () => {
    vi.useFakeTimers();
    const t = makeT();
    const w = await setupWorld(t);
    const { number, token, draftId } = await inquiryWithQuote(w);
    await w.asStaff.mutation(api.inquiriesAdmin.sendQuote, { quoteId: draftId });
    const detail = (await w.asStaff.query(api.inquiriesAdmin.get, { number }))!;
    expect(detail.inquiry.statusLink).toMatch(new RegExp(`/upit/${token}$`));
    const { orderNumber } = await w.asStaff.mutation(api.inquiriesAdmin.convertToOrder, {
      quoteId: draftId,
      contact: { ...CONTACT, email: "" },
      delivery: { method: "pickup" as const },
      payment: { method: "pickup_cash" as const },
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const order = await t.run(async (ctx) =>
      ctx.db
        .query("orders")
        .withIndex("by_number", (q) => q.eq("number", orderNumber))
        .unique(),
    );
    expect(order!.contact.email).toBe("");
    const customerMails = await t.run(async (ctx) =>
      (await ctx.db.query("notificationDeliveries").take(200)).filter(
        (d) => d.channel === "email" && d.recipient === "",
      ),
    );
    expect(customerMails).toHaveLength(0);
    vi.useRealTimers();
  });

  test("a sent quote needs a price on every line, named by line", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const { inquiryId } = await inquiryWithQuote(w);
    const quoteId = await w.asStaff.mutation(api.inquiriesAdmin.saveQuoteDraft, {
      inquiryId,
      lines: [{ name: "Senzor ABS", quantity: 1, unitPricePara: 0, availability: "on_order" }],
    });
    try {
      await w.asStaff.mutation(api.inquiriesAdmin.sendQuote, { quoteId });
      expect.unreachable();
    } catch (error) {
      expect((error as { data: { field: string } }).data.field).toBe("lines.0.price");
    }
  });
});
