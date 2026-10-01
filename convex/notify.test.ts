/// <reference types="vite/client" />
/**
 * Step 18: outbox fan-out, preferences, idempotency, retries, delivery modes, webhook
 * feedback and the automation crons (fake time, Europe/Belgrade business hours).
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { api, internal } from "./_generated/api";
import { TEMPLATES } from "../lib/email/registry";
import { belgradeLocalToUtc } from "../lib/domain/time";
import { SYSTEM_ACTOR } from "./lib/authz";
import { emitEvent } from "./lib/events";
import { statusLinkToken } from "./lib/linkTokens";
import { hashToken } from "./lib/tokens";
import { checkoutArgs, GUEST, makeT, setupWorld, type T, type World } from "./test.setup";
import { nextLogStatus } from "./notify";
import { retryDelayMs } from "./events";

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("EMAIL_MODE", "");
  vi.stubEnv("RESEND_API_KEY", "");
  vi.stubEnv("EMAIL_FROM", "");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

async function placeOrder(w: World, qty = 1) {
  await w.anon.mutation(api.carts.addItem, {
    guestToken: GUEST,
    productId: w.products.battery,
    quantity: qty,
  });
  return await w.anon.mutation(api.orders.submit, { guestToken: GUEST, ...checkoutArgs() });
}

async function drain(t: T) {
  await t.finishAllScheduledFunctions(vi.runAllTimers);
}

async function emails(t: T) {
  return await t.run(async (ctx) => await ctx.db.query("emailLog").take(500));
}

async function eventByType(t: T, type: string) {
  return await t.run(async (ctx) =>
    (await ctx.db.query("domainEvents").take(500)).filter((e) => e.type === type),
  );
}

describe("fan-out", () => {
  test("a new order logs the customer and staff e-mails and rings the staff bell", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const res = await placeOrder(w);
    await drain(t);

    const log = await emails(t);
    const customer = log.filter((m) => m.templateKey === "order_received");
    expect(customer).toHaveLength(1);
    expect(customer[0]!.to).toEqual(["petar@primer.rs"]);
    expect(customer[0]!.mode).toBe("log");
    expect(customer[0]!.status).toBe("logged");
    expect(customer[0]!.subject).toBe(`Porudžbina ${res.number} je primljena`);
    expect(customer[0]!.html).toContain(res.number);
    expect(customer[0]!.resendEmailId).toBeUndefined();
    // The status link in the e-mail opens the order (derived capability token).
    const token = await statusLinkToken("order", res.number);
    expect(customer[0]!.text).toContain(`/porudzbina/${token}`);
    expect(await t.query(api.orders.getByToken, { token })).not.toBeNull();

    const staff = log.filter((m) => m.templateKey === "staff_order_new").flatMap((m) => m.to);
    expect(staff.sort()).toEqual(["owner@sklop.test", "staff@sklop.test"]);

    const bells = await t.run(async (ctx) =>
      (await ctx.db.query("notifications").take(50)).filter((n) => n.kind === "order_new"),
    );
    expect(bells.map((b) => b.userId).sort()).toEqual([w.owner, w.staff].sort());
    expect(await w.asOwner.query(api.notifications.unreadCount, {})).toBe(1);

    // History: logged, not shown to the customer in log mode.
    const history = await t.run(async (ctx) =>
      (await ctx.db.query("orderEvents").take(50)).filter((e) => e.type === "email_sent"),
    );
    expect(history).toHaveLength(1);
    expect(history[0]!.visibleToCustomer).toBe(false);
  });

  test("status changes e-mail the customer with the matching template", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const res = await placeOrder(w);
    await drain(t);
    const order = await t.run(async (ctx) =>
      ctx.db
        .query("orders")
        .withIndex("by_number", (q) => q.eq("number", res.number))
        .unique(),
    );
    await w.asStaff.mutation(api.ordersAdmin.transition, {
      orderId: order!._id,
      to: "potvrdjena",
      expectedUpdatedAt: order!.updatedAt,
    });
    await drain(t);
    const confirmed = await t.run(async (ctx) => ctx.db.get("orders", order!._id));
    await w.asStaff.mutation(api.ordersAdmin.transition, {
      orderId: order!._id,
      to: "poslata",
      tracking: { courierCode: "dexpress", trackingNumber: "DE123RS" },
      expectedUpdatedAt: confirmed!.updatedAt,
    });
    await drain(t);
    const customer = (await emails(t)).filter((m) => m.to.includes("petar@primer.rs"));
    expect(customer.map((m) => m.templateKey)).toEqual([
      "order_received",
      "order_confirmed",
      "order_shipped",
    ]);
    const shipped = customer[2]!;
    expect(shipped.text).toContain("DE123RS");
    expect(shipped.text).toContain("D Express");
  });

  test("an inquiry e-mails the customer and staff; a sent quote e-mails the accept link", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const res = await w.anon.mutation(api.inquiries.submit, {
      kind: "part",
      message: "Treba mi turbina za Golf 7 2.0 TDI.",
      categorySlugs: ["turbina"],
      requestedCodes: [],
      photos: [],
      contact: { name: "Marko Marković", email: "marko@primer.rs", preferredChannel: "email" },
      consent: checkoutArgs().consent,
      honeypot: "",
      startedAt: Date.now() - 60_000,
    });
    await drain(t);
    const log = await emails(t);
    expect(log.find((m) => m.templateKey === "inquiry_received")!.to).toEqual(["marko@primer.rs"]);
    expect(log.filter((m) => m.templateKey === "staff_inquiry_new")).toHaveLength(2);
    expect(log.find((m) => m.templateKey === "staff_inquiry_new")!.subject).toBe(
      `Novi upit ${res.number} — turbina`,
    );
  });

  test("mechanic registration and approval reach the applicant and staff", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    await t.mutation(internal.testing.approveMechanic, {
      email: "pending@sklop.test",
      tierSlug: "partner",
      creditEnabled: true,
    });
    await drain(t);
    const log = await emails(t);
    const approved = log.find((m) => m.templateKey === "mechanic_approved");
    expect(approved?.to).toEqual(["pending@sklop.test"]);
    expect(approved?.subject).toBe("Nalog je odobren — Partner (20 %)");
    expect(approved?.text).toContain("odobreno, rok 15 dana");
    const bell = await t.run(async (ctx) =>
      (await ctx.db.query("notifications").take(50)).filter((n) => n.userId === w.pending.userId),
    );
    expect(bell.map((n) => n.kind)).toEqual(["mechanic_approved"]);
  });
});

describe("preferences", () => {
  test("a staff member can mute e-mail and in-app per event; shared addresses get staff mail", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const prefs = await w.asStaff.query(api.notifications.preferences, {});
    await w.asStaff.mutation(api.notifications.setPreferences, {
      email: { ...prefs.email, orderNew: false },
      inApp: { ...prefs.inApp, orderNew: false },
    });
    const settings = await w.asOwner.query(api.settings.getAdmin, {});
    await w.asOwner.mutation(api.settings.updateSection, {
      update: {
        section: "notifications",
        value: {
          ...settings.notifications,
          staffEmails: ["prodaja@primer.rs", "STAFF@sklop.test"],
        },
      },
    });
    await placeOrder(w);
    await drain(t);
    const staffMail = (await emails(t))
      .filter((m) => m.templateKey === "staff_order_new")
      .flatMap((m) => m.to)
      .sort();
    // staff@ muted it (its own preference wins over the shared list), owner and the shared inbox get it.
    expect(staffMail).toEqual(["owner@sklop.test", "prodaja@primer.rs"]);
    const bells = await t.run(async (ctx) =>
      (await ctx.db.query("notifications").take(50)).filter((n) => n.kind === "order_new"),
    );
    expect(bells.map((b) => b.userId)).toEqual([w.owner]);
  });

  test("the owner manages another staff member's preferences; staff cannot", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const current = await w.asOwner.query(api.notifications.preferencesFor, { userId: w.staff });
    expect(current?.email.digest).toBe(true);
    await w.asOwner.mutation(api.notifications.setPreferencesFor, {
      userId: w.staff,
      email: { ...current!.email, digest: false },
      inApp: current!.inApp,
    });
    expect((await w.asStaff.query(api.notifications.preferences, {})).email.digest).toBe(false);
    await expect(
      w.asStaff.mutation(api.notifications.setPreferencesFor, {
        userId: w.owner,
        email: current!.email,
        inApp: current!.inApp,
      }),
    ).rejects.toThrow();
    expect(
      await w.asOwner.query(api.notifications.preferencesFor, { userId: w.customerA }),
    ).toBeNull();
  });
});

describe("idempotency and retries", () => {
  test("re-dispatching an event never duplicates deliveries or e-mails", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    await placeOrder(w);
    await drain(t);
    const before = (await emails(t)).length;
    const [event] = await eventByType(t, "order.created");
    // Done events are ignored; a forced re-run goes through the ledger.
    await t.mutation(internal.events.dispatch, { eventId: event!._id });
    await t.run(async (ctx) => ctx.db.patch("domainEvents", event!._id, { status: "pending" }));
    await t.mutation(internal.events.dispatch, { eventId: event!._id });
    await drain(t);
    expect((await emails(t)).length).toBe(before);
    const deliveries = await t.run(async (ctx) =>
      (await ctx.db.query("notificationDeliveries").take(100)).filter(
        (d) => d.eventId === event!._id,
      ),
    );
    const keys = deliveries.map((d) => `${d.channel}:${d.recipient}`);
    expect(new Set(keys).size).toBe(keys.length);
    // A delivered e-mail is never re-rendered.
    const sent = deliveries.find((d) => d.channel === "email")!;
    await t.mutation(internal.notify.deliverEmail, { deliveryId: sent._id });
    expect((await emails(t)).length).toBe(before);
  });

  test("a failing render retries with backoff and stops after five attempts", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const original = TEMPLATES.order_received.render;
    TEMPLATES.order_received.render = () => {
      throw new Error("render exploded");
    };
    try {
      await placeOrder(w);
      await drain(t);
      const delivery = await t.run(async (ctx) =>
        (await ctx.db.query("notificationDeliveries").take(100)).find(
          (d) => d.templateKey === "order_received",
        ),
      );
      expect(delivery!.status).toBe("failed");
      expect(delivery!.attempts).toBe(5);
      expect(delivery!.lastError).toBe("render exploded");
      expect(delivery!.nextAttemptAt).toBeUndefined();
      // The staff e-mails of the same event were not affected.
      expect((await emails(t)).filter((m) => m.templateKey === "staff_order_new")).toHaveLength(2);
    } finally {
      TEMPLATES.order_received.render = original;
    }
    expect([1, 2, 3, 4, 5, 6].map(retryDelayMs)).toEqual([
      60_000, 300_000, 1_800_000, 7_200_000, 43_200_000, 43_200_000,
    ]);
  });

  test("a delivery that recovers on retry is sent once", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const original = TEMPLATES.order_received.render;
    let calls = 0;
    TEMPLATES.order_received.render = (data, ctx) => {
      calls++;
      if (calls === 1) throw new Error("transient");
      return original(data, ctx);
    };
    try {
      await placeOrder(w);
      await drain(t);
    } finally {
      TEMPLATES.order_received.render = original;
    }
    const received = (await emails(t)).filter((m) => m.templateKey === "order_received");
    expect(received).toHaveLength(1);
    const delivery = await t.run(async (ctx) =>
      (await ctx.db.query("notificationDeliveries").take(100)).find(
        (d) => d.templateKey === "order_received",
      ),
    );
    expect(delivery).toMatchObject({ status: "sent", attempts: 2 });
  });
});

describe("delivery modes", () => {
  test("live without an API key falls back to log and never calls the provider", async () => {
    vi.stubEnv("EMAIL_MODE", "live");
    const t = makeT();
    const w = await setupWorld(t);
    await placeOrder(w);
    await drain(t);
    const log = await emails(t);
    expect(log.length).toBeGreaterThan(0);
    expect(log.every((m) => m.mode === "log" && m.resendEmailId === undefined)).toBe(true);
    const config = await w.asOwner.query(api.emailsAdmin.config, {});
    expect(config.requested).toBe("live");
    expect(config.effective).toBe("log");
    expect(config.warnings.join(" ")).toContain("RESEND_API_KEY");
  });

  test("test mode rewrites recipients and hands off to Resend; e2e orders stay logged", async () => {
    vi.stubEnv("EMAIL_MODE", "test");
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    const t = makeT();
    const w = await setupWorld(t);
    await placeOrder(w);
    // Run the dispatcher and deliveries by hand (the component's own workers would call the API).
    const [event] = await eventByType(t, "order.created");
    await t.mutation(internal.events.dispatch, { eventId: event!._id });
    const deliveries = await t.run(async (ctx) =>
      (await ctx.db.query("notificationDeliveries").take(100)).filter((d) => d.channel === "email"),
    );
    for (const d of deliveries)
      await t.mutation(internal.notify.deliverEmail, { deliveryId: d._id });
    const received = (await emails(t)).find((m) => m.templateKey === "order_received")!;
    expect(received.mode).toBe("test");
    expect(received.status).toBe("queued");
    expect(received.to).toEqual(["delivered@resend.dev"]);
    expect(received.originalTo).toEqual(["petar@primer.rs"]);
    expect(received.resendEmailId).toBeTruthy();

    const e2e = await t.mutation(internal.testing.createTestOrder, { tag: "modes" });
    const [created] = (await eventByType(t, "order.created")).filter((e) => e._id !== event!._id);
    await t.mutation(internal.events.dispatch, { eventId: created!._id });
    const more = await t.run(async (ctx) =>
      (await ctx.db.query("notificationDeliveries").take(100)).filter(
        (d) => d.channel === "email" && d.eventId === created!._id,
      ),
    );
    for (const d of more) await t.mutation(internal.notify.deliverEmail, { deliveryId: d._id });
    const testOrderMail = (await emails(t)).filter((m) => m.subject.includes(e2e.number));
    expect(testOrderMail.length).toBeGreaterThan(0);
    expect(testOrderMail.every((m) => m.mode === "log")).toBe(true);
  });
});

describe("admin outbox", () => {
  test("template previews, test sends, masking and resend", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const list = await w.asStaff.query(api.emailsAdmin.templates, {});
    expect(list.length).toBe(25);
    const preview = await w.asStaff.query(api.emailsAdmin.preview, { key: "order_confirmed" });
    expect(preview!.subject).toContain("potvrđena");
    await expect(
      w.asCustomerA.query(api.emailsAdmin.preview, { key: "order_confirmed" }),
    ).rejects.toThrow();

    const sent = await w.asStaff.mutation(api.emailsAdmin.sendTest, { key: "back_in_stock" });
    expect(sent).toMatchObject({ mode: "log", to: "staff@sklop.test" });
    const row = await w.asStaff.query(api.emailsAdmin.get, { emailLogId: sent.emailLogId });
    expect(row!.subject.startsWith("[PROBA] ")).toBe(true);

    const code = await w.asStaff.mutation(api.emailsAdmin.sendTest, { key: "password_reset_code" });
    const masked = await w.asStaff.query(api.emailsAdmin.get, { emailLogId: code.emailLogId });
    expect(masked!.text).not.toContain("48213905");
    expect(masked!.resendable).toBe(false);

    const again = await w.asStaff.mutation(api.emailsAdmin.resend, { emailLogId: sent.emailLogId });
    const copy = await t.run(async (ctx) => ctx.db.get("emailLog", again.emailLogId));
    expect(copy!.resentFrom).toBe(sent.emailLogId);
    expect(copy!.subject).toBe(row!.subject);

    const filtered = await w.asStaff.query(api.emailsAdmin.outbox, {
      templateKey: "back_in_stock",
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(filtered.page).toHaveLength(2);
  });

  test("password reset codes go through the mailer", async () => {
    const t = makeT();
    await setupWorld(t);
    await t.mutation(internal.authEmails.sendPasswordResetCode, {
      email: "a@sklop.test",
      code: "12345678",
      expiresAt: Date.now() + 900_000,
    });
    const row = (await emails(t)).find((m) => m.templateKey === "password_reset_code")!;
    expect(row.relatedType).toBe("auth");
    expect(row.text).toContain("12345678");
    expect(row.subject).toBe("Kod za novu lozinku");
  });
});

describe("webhook feedback", () => {
  test("statuses only move forward; a bounce flags the order for staff", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const res = await placeOrder(w);
    await drain(t);
    const received = (await emails(t)).find((m) => m.templateKey === "order_received")!;
    await t.run(async (ctx) =>
      ctx.db.patch("emailLog", received._id, {
        resendEmailId: "email_1",
        status: "queued",
        mode: "live",
      }),
    );
    const common = {
      created_at: "2026-09-30T10:00:00.000Z",
      email_id: "re_1",
      from: "SKLOP <prodaja@primer.rs>",
      to: "petar@primer.rs",
      subject: received.subject,
    };
    const fire = (event: unknown) =>
      t.mutation(internal.notify.onEmailEvent, {
        id: "email_1",
        event,
      } as never);
    await fire({ type: "email.delivered", created_at: common.created_at, data: common });
    await fire({ type: "email.sent", created_at: common.created_at, data: common });
    expect((await t.run(async (ctx) => ctx.db.get("emailLog", received._id)))!.status).toBe(
      "delivered",
    );
    await fire({
      type: "email.bounced",
      created_at: common.created_at,
      data: {
        ...common,
        bounce: { message: "Mailbox does not exist", subType: "General", type: "Permanent" },
      },
    });
    await drain(t);
    const after = await t.run(async (ctx) => ctx.db.get("emailLog", received._id));
    expect(after).toMatchObject({ status: "bounced", error: "Mailbox does not exist" });
    const flag = await t.run(async (ctx) =>
      (await ctx.db.query("notifications").take(50)).filter((n) => n.kind === "email_bounced"),
    );
    expect(flag).toHaveLength(2);
    expect(flag[0]!.href).toBe(`/admin/porudzbine/${res.number}`);
    expect(nextLogStatus("bounced", "delivered")).toBeNull();
    expect(nextLogStatus("queued", "sent")).toBe("sent");
  });
});

describe("crons (fake time, Europe/Belgrade)", () => {
  // Wednesday 30.09.2026; CEST (UTC+2). Default hours: Mon–Fri 08–17, Sat 08–14.
  const local = (d: number, h: number, m = 0) => belgradeLocalToUtc(2026, 9, d, h, m);

  test("reminders count working minutes, escalate once and stay quiet after hours", async () => {
    const t = makeT();
    // The world is built before the order time: convex-test keeps _creationTime monotonic,
    // so building it at the real clock (after 30.09. 16:30) would date the order later.
    vi.setSystemTime(local(30, 8, 0));
    const w = await setupWorld(t);
    vi.setSystemTime(local(30, 16, 30));
    const res = await placeOrder(w);
    await drain(t);
    const run = async (at: number) => {
      vi.setSystemTime(at);
      return await t.mutation(internal.automations.runReminders, {});
    };
    expect(await run(local(30, 20, 0))).toMatchObject({ skipped: true });
    // Thu 01.10. 08:30 → 30 + 30 = 60 working minutes: nothing yet.
    vi.setSystemTime(belgradeLocalToUtc(2026, 10, 1, 8, 30));
    expect(await t.mutation(internal.automations.runReminders, {})).toMatchObject({ reminded: 0 });
    // 09:31 → 121 minutes: first reminder.
    vi.setSystemTime(belgradeLocalToUtc(2026, 10, 1, 9, 31));
    expect(await t.mutation(internal.automations.runReminders, {})).toMatchObject({ reminded: 1 });
    vi.setSystemTime(belgradeLocalToUtc(2026, 10, 1, 9, 46));
    expect(await t.mutation(internal.automations.runReminders, {})).toMatchObject({ reminded: 0 });
    // 11:31 → 241 minutes: second (escalation) reminder.
    vi.setSystemTime(belgradeLocalToUtc(2026, 10, 1, 11, 31));
    expect(await t.mutation(internal.automations.runReminders, {})).toMatchObject({ reminded: 1 });
    await drain(t);
    const reminders = (await emails(t)).filter((m) => m.templateKey === "staff_reminder");
    expect(reminders).toHaveLength(4); // 2 levels × owner + staff
    expect(reminders.some((m) => m.subject.startsWith("Drugi podsetnik"))).toBe(true);
    expect(reminders[0]!.subject).toContain(res.number);
    const bell = await t.run(async (ctx) =>
      (await ctx.db.query("notifications").take(100)).filter((n) => n.kind === "reminder"),
    );
    expect(bell).toHaveLength(4);
  });

  test("the digest goes out once per local day at 08:00, across the DST change", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const prefs = await w.asStaff.query(api.notifications.preferences, {});
    await w.asStaff.mutation(api.notifications.setPreferences, {
      email: { ...prefs.email, digest: false },
      inApp: prefs.inApp,
    });
    // Summer time: 08:00 CEST = 06:00 UTC.
    vi.setSystemTime(Date.UTC(2026, 9, 1, 5, 0));
    expect(await t.mutation(internal.automations.runDigest, {})).toBeNull();
    vi.setSystemTime(Date.UTC(2026, 9, 1, 6, 0));
    expect(await t.mutation(internal.automations.runDigest, {})).toBe("2026-09-30");
    vi.setSystemTime(Date.UTC(2026, 9, 1, 6, 30));
    expect(await t.mutation(internal.automations.runDigest, {})).toBeNull();
    // Winter time (after 25.10.2026): 08:00 CET = 07:00 UTC.
    vi.setSystemTime(Date.UTC(2026, 9, 27, 6, 0));
    expect(await t.mutation(internal.automations.runDigest, {})).toBeNull();
    vi.setSystemTime(Date.UTC(2026, 9, 27, 7, 0));
    expect(await t.mutation(internal.automations.runDigest, {})).toBe("2026-10-26");
    await drain(t);
    const digests = (await emails(t)).filter((m) => m.templateKey === "staff_daily_digest");
    // Two days × the owner only (staff turned the digest off).
    expect(digests.map((m) => m.to[0])).toEqual(["owner@sklop.test", "owner@sklop.test"]);
    expect(digests[0]!.subject).toMatch(/^Pregled za 30\.09\.2026\./);
  });

  test("low stock is batched into one staff e-mail per hour", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    vi.setSystemTime(local(30, 10, 0));
    for (const productId of [w.products.pads, w.products.filter]) {
      await t.run(async (ctx) => {
        const p = (await ctx.db.get("products", productId))!;
        await emitEvent(ctx, {
          type: "stock.low",
          aggregateType: "stock",
          aggregateId: productId,
          payload: { kind: "stock", productId, sku: p.sku, name: p.name, qty: p.stockQty },
          dedupeKey: `stock.low:${productId}:test`,
          actor: SYSTEM_ACTOR,
        });
      });
    }
    vi.setSystemTime(local(30, 10, 5));
    expect(await t.mutation(internal.automations.lowStockSweep, {})).toEqual({ items: 2 });
    expect(await t.mutation(internal.automations.lowStockSweep, {})).toEqual({ items: 0 });
    await drain(t);
    const mail = (await emails(t)).filter((m) => m.templateKey === "staff_low_stock");
    expect(mail).toHaveLength(2);
    expect(mail[0]!.subject).toBe("Malo na stanju: 2 artikla");
    expect(mail[0]!.text).toContain("T-PADS");
  });

  test("back in stock: the sweep e-mails subscribers once with a working unsubscribe link", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    await w.anon.mutation(api.backInStock.subscribe, {
      productId: w.products.filter,
      email: "ceka@primer.rs",
      consent: true,
      honeypot: "",
    });
    await w.anon.mutation(api.backInStock.subscribe, {
      productId: w.products.turbo,
      email: "ceka@primer.rs",
      consent: true,
      honeypot: "",
    });
    await t.run(async (ctx) =>
      ctx.db.patch("products", w.products.filter, { stockQty: 5, stockState: "in_stock" }),
    );
    expect(await t.mutation(internal.automations.backInStockSweep, {})).toEqual({ products: 1 });
    await drain(t);
    const mail = (await emails(t)).filter((m) => m.templateKey === "back_in_stock");
    expect(mail).toHaveLength(1);
    expect(mail[0]!.to).toEqual(["ceka@primer.rs"]);
    expect(mail[0]!.subject).toBe("Stiglo je: Filter ulja");
    // Sweeping again in the same hour or later sends nothing new (notified).
    await t.mutation(internal.automations.backInStockSweep, {});
    vi.advanceTimersByTime(3_600_000);
    await t.mutation(internal.automations.backInStockSweep, {});
    await drain(t);
    expect((await emails(t)).filter((m) => m.templateKey === "back_in_stock")).toHaveLength(1);
    const token = /\/obavestenja\/odjava\/([A-Za-z0-9_-]+)/.exec(mail[0]!.text)![1]!;
    expect(await w.anon.mutation(api.backInStock.unsubscribe, { token })).toEqual({ ok: true });
    const subs = await t.run(async (ctx) =>
      ctx.db
        .query("backInStockSubscriptions")
        .withIndex("by_email", (q) => q.eq("email", "ceka@primer.rs"))
        .take(10),
    );
    expect(subs.map((s) => s.status).sort()).toEqual(["cancelled", "notified"]);
    expect(await hashToken(token)).toBe(
      subs.find((s) => s.status === "notified")!.unsubscribeTokenHash,
    );
  });

  test("quotes expiring within 24 h remind the customer once", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const now = local(30, 10, 0);
    vi.setSystemTime(now);
    const { number } = await t.mutation(internal.testing.createTestInquiry, { tag: "exp" });
    await t.run(async (ctx) => {
      const inquiry = (await ctx.db
        .query("inquiries")
        .withIndex("by_number", (q) => q.eq("number", number))
        .unique())!;
      const quoteId = await ctx.db.insert("quotes", {
        inquiryId: inquiry._id,
        version: 1,
        status: "sent",
        validUntil: now + 20 * 3_600_000,
        lines: [
          { name: "Turbina", quantity: 1, unitPricePara: 8_990_000, availability: "in_stock" },
        ],
        totalPara: 8_990_000,
        sentAt: now - 6 * 86_400_000,
      });
      await ctx.db.patch("inquiries", inquiry._id, {
        status: "ponuda_poslata",
        currentQuoteId: quoteId,
        contact: { ...inquiry.contact, email: "kupac@primer.rs" },
      });
    });
    expect(await t.mutation(internal.automations.quoteExpiringSweep, {})).toEqual({ reminded: 1 });
    expect(await t.mutation(internal.automations.quoteExpiringSweep, {})).toEqual({ reminded: 1 });
    await drain(t);
    const mail = (await emails(t)).filter((m) => m.templateKey === "quote_expiring");
    expect(mail).toHaveLength(1);
    expect(mail[0]!.subject).toBe(`Ponuda za upit ${number} ističe 01.10.2026.`);
    void w;
  });

  test("nightly maintenance prunes by the retention policy and removes orphan uploads", async () => {
    // convex-test keeps creation times monotonic, so the clock starts in the past.
    const old = Date.UTC(2023, 5, 1, 12, 0);
    vi.setSystemTime(old);
    const t = makeT();
    await setupWorld(t);
    const ids = await t.run(async (ctx) => {
      const orphan = await ctx.storage.store(new Blob(["x"]));
      const kept = await ctx.storage.store(new Blob(["y"]));
      await ctx.db.insert("uploads", {
        storageId: kept,
        purpose: "inquiry_photo",
        uploaderKey: "k",
        status: "attached",
      });
      const mail = await ctx.db.insert("emailLog", {
        to: ["a@primer.rs"],
        subject: "Stara poruka",
        templateKey: "order_received",
        html: "<p>x</p>",
        text: "x",
        mode: "log",
        status: "logged",
        updatedAt: old,
      });
      await ctx.db.insert("searchLogs", {
        query: "stara",
        normalized: "STARA",
        kind: "text",
        resultsCount: 0,
        exactCodeHit: false,
        userType: "anon",
        source: "header",
        at: old,
      });
      return { orphan, kept, mail };
    });
    vi.setSystemTime(Date.UTC(2024, 5, 1, 0, 40));
    const counts = await t.mutation(internal.automations.nightly, {});
    expect(counts).toMatchObject({ orphanUploads: 1, emailHtmlStripped: 1, searchLogs: 1 });
    const after = await t.run(async (ctx) => ({
      orphan: await ctx.storage.getUrl(ids.orphan),
      kept: await ctx.storage.getUrl(ids.kept),
      mail: await ctx.db.get("emailLog", ids.mail),
    }));
    expect(after.orphan).toBeNull();
    expect(after.kept).not.toBeNull();
    expect(after.mail?.html).toBeUndefined();
    expect(after.mail?.text).toBe("x");
  });
});
