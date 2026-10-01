/// <reference types="vite/client" />
/**
 * Step 20 security audit (docs/SECURITY-AUDIT.md): one test per fixed finding — owner seed
 * takeover, staff self-approval, privacy tools (owner only), rate limits on reset e-mails and
 * guest carts, customer role on sign-up, test helpers gated by env, status links masked in
 * the outbox, CAPI context / click-id retention and guest-cart pruning.
 */
import { afterEach, describe, expect, test, vi } from "vitest";

import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { maskSecrets } from "./emailsAdmin";
import { ipSubject } from "./lib/functions";
import {
  checkoutArgs,
  CONSENT,
  errorCode,
  GUEST,
  makeT,
  setupWorld,
  VALID_MB,
  VALID_PIB,
} from "./test.setup";

const DAY = 86_400_000;
const TOKEN = "Zq3vK9x_pL2mN8rT4wY6aB1cD5eF7gH0jS-uV2iO3kA";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("owner seed (P1)", () => {
  test("an existing account with the owner's e-mail but another password is never promoted", async () => {
    const t = makeT();
    vi.stubEnv("SEED_ADMIN_EMAIL", "vlasnik@sklop.test");
    // The attacker registered the owner's address first, with their own password (simulated by
    // creating that account through the seed, then taking the role away).
    vi.stubEnv("SEED_ADMIN_PASSWORD", "napadac-lozinka-1");
    const first = await t.action(internal.seed.createOwner, {});
    expect(first.status).toBe("created");
    const attacker = await t.run(async (ctx) =>
      ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", "vlasnik@sklop.test"))
        .unique(),
    );
    await t.run(async (ctx) => ctx.db.patch("users", attacker!._id, { role: "customer" }));

    vi.stubEnv("SEED_ADMIN_PASSWORD", "tacna-lozinka-2026");
    const second = await t.action(internal.seed.createOwner, {});
    expect(second.status).toBe("password_mismatch");
    const after = await t.run(async (ctx) => ctx.db.get("users", attacker!._id));
    expect(after?.role).toBe("customer");

    // With the right password the same account is (re)promoted.
    vi.stubEnv("SEED_ADMIN_PASSWORD", "napadac-lozinka-1");
    expect((await t.action(internal.seed.createOwner, {})).status).toBe("exists");
    expect((await t.run(async (ctx) => ctx.db.get("users", attacker!._id)))?.role).toBe("owner");
  });
});

describe("mechanic terms (P2)", () => {
  test("staff cannot approve or change their own mechanic profile; the owner can, audited with values", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const profileId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("mechanicProfiles", {
        userId: w.staff,
        status: "pending",
        companyName: "Servis zaposlenog",
        pib: VALID_PIB,
        mb: VALID_MB,
        contactPerson: "Zaposleni",
        phone: "+381641234567",
        email: "staff@sklop.test",
        city: "Beograd",
        address: "Ulica 2",
        serviceTypes: ["mehanika"],
        brandsServiced: [],
        creditEnabled: false,
        paymentTermsDays: 15,
        consent: {
          termsVersion: "1",
          privacyVersion: "1",
          acceptedAt: 1,
          marketingEmail: false,
          analytics: false,
          ads: false,
        },
        isDemo: false,
        updatedAt: 0,
      });
      await ctx.db.patch("users", w.staff, { mechanicProfileId: id, mechanicStatus: "pending" });
      return id;
    });
    const approve = {
      profileId,
      tierId: w.tiers.partner,
      personalRules: { defaultDiscountBp: 9_000 },
      creditEnabled: true,
    };
    expect(await errorCode(() => w.asStaff.mutation(api.mechanicsAdmin.approve, approve))).toBe(
      "FORBIDDEN",
    );
    await w.asOwner.mutation(api.mechanicsAdmin.approve, {
      ...approve,
      creditLimitPara: 5_000_000,
    });
    expect(
      await errorCode(() =>
        w.asStaff.mutation(api.mechanicsAdmin.update, { profileId, creditLimitPara: null }),
      ),
    ).toBe("FORBIDDEN");
    // Staff still manage other mechanics, and the audit shows the values that changed.
    await w.asStaff.mutation(api.mechanicsAdmin.update, {
      profileId: w.mechB.profileId,
      creditEnabled: true,
      creditLimitPara: 1_000_000,
    });
    const entry = await t.run(async (ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_action_and_at", (q) => q.eq("action", "mechanic.update"))
        .order("desc")
        .first(),
    );
    expect(entry?.diff).toEqual(
      expect.arrayContaining([
        { field: "creditEnabled", before: "false", after: "true" },
        expect.objectContaining({ field: "creditLimitPara", after: "1000000" }),
      ]),
    );
    const approval = await t.run(async (ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_action_and_at", (q) => q.eq("action", "mechanic.approved"))
        .order("desc")
        .first(),
    );
    expect(approval?.diff?.map((d) => d.field)).toEqual(
      expect.arrayContaining(["status", "tierId", "personalRules", "creditEnabled"]),
    );
  });
});

describe("privacy tools (ZZPL)", () => {
  async function customerWithHistory() {
    const t = makeT();
    const w = await setupWorld(t);
    await w.asCustomerA.mutation(api.carts.addItem, { productId: w.products.disc, quantity: 1 });
    const order = await w.asCustomerA.mutation(api.orders.submit, {
      ...checkoutArgs({ contact: { ...checkoutArgs().contact, email: "a@sklop.test" } }),
      vehicle: { label: "Golf 7", vin: "WVWZZZAUZHW000001" },
      note: "Pozovite posle 17 h",
    });
    const inquiry = await w.asCustomerA.mutation(api.inquiries.submit, {
      kind: "part",
      message: "Treba mi pumpa vode",
      contact: { name: "Ana A", email: "a@sklop.test", preferredChannel: "email" },
      consent: checkoutArgs().consent,
      honeypot: "",
      startedAt: Date.now() - 60_000,
    });
    // A guest order with the same address, before the account existed.
    await w.anon.mutation(api.carts.addItem, {
      guestToken: GUEST,
      productId: w.products.pads,
      quantity: 1,
    });
    await w.anon.mutation(api.orders.submit, {
      guestToken: GUEST,
      ...checkoutArgs({ contact: { ...checkoutArgs().contact, email: "a@sklop.test" } }),
    });
    await t.run(async (ctx) => {
      await ctx.db.insert("savedVehicles", { userId: w.customerA, label: "Golf 7", vin: "X" });
      await ctx.db.insert("favorites", { userId: w.customerA, productId: w.products.disc });
      await ctx.db.insert("consentRecords", {
        consentId: "abcdefgh-1",
        choices: { analytics: true, ads: false },
        policyVersion: "1",
        at: Date.now(),
        userId: w.customerA,
      });
    });
    return { t, w, order, inquiry };
  }

  test("only the owner exports or anonymizes", async () => {
    const { w } = await customerWithHistory();
    for (const as of [w.asStaff, w.asCustomerA, w.anon]) {
      expect(
        await errorCode(() => as.query(api.privacy.customerData, { userId: w.customerA })),
      ).toMatch(/FORBIDDEN|UNAUTHENTICATED/);
      expect(
        await errorCode(() =>
          as.mutation(api.privacy.anonymize, { userId: w.customerA, confirmPhrase: "ANONIMIZUJ" }),
        ),
      ).toMatch(/FORBIDDEN|UNAUTHENTICATED/);
    }
  });

  test("the export covers account, guest orders by e-mail, inquiries, vehicles, favorites, consents", async () => {
    const { w } = await customerWithHistory();
    const out = await w.asOwner.query(api.privacy.customerData, { userId: w.customerA });
    expect(out.counts).toMatchObject({
      orders: 2,
      inquiries: 1,
      savedVehicles: 1,
      favorites: 1,
      cookieConsents: 1,
    });
    const data = JSON.parse(out.json) as { account: { email: string }; orders: unknown[] };
    expect(data.account.email).toBe("a@sklop.test");
    // Guest lookup by e-mail finds the same orders.
    const guest = await w.asOwner.query(api.privacy.customerData, { email: "A@Sklop.test" });
    expect(guest.counts.orders).toBe(2);
  });

  test("anonymization keeps orders without personal data and removes the rest, including the login", async () => {
    const { t, w, order } = await customerWithHistory();
    expect(
      await errorCode(() =>
        w.asOwner.mutation(api.privacy.anonymize, { userId: w.customerA, confirmPhrase: "da" }),
      ),
    ).toBe("INVALID");
    expect(
      await errorCode(() =>
        w.asOwner.mutation(api.privacy.anonymize, { userId: w.staff, confirmPhrase: "ANONIMIZUJ" }),
      ),
    ).toBe("FORBIDDEN");

    const r = await w.asOwner.mutation(api.privacy.anonymize, {
      userId: w.customerA,
      confirmPhrase: "ANONIMIZUJ",
    });
    expect(r.done).toBe(true);
    expect(r.counts).toMatchObject({ orders: 2, inquiriesDeleted: 1, account: 1 });

    const state = await t.run(async (ctx) => {
      const o = await ctx.db
        .query("orders")
        .withIndex("by_number", (q) => q.eq("number", order.number))
        .unique();
      return {
        order: o,
        user: await ctx.db.get("users", w.customerA),
        inquiries: await ctx.db
          .query("inquiries")
          .withIndex("by_contact_email", (q) => q.eq("contact.email", "a@sklop.test"))
          .take(5),
        vehicles: await ctx.db
          .query("savedVehicles")
          .withIndex("by_userId", (q) => q.eq("userId", w.customerA))
          .take(5),
        consents: await ctx.db
          .query("consentRecords")
          .withIndex("by_consentId", (q) => q.eq("consentId", "abcdefgh-1"))
          .take(5),
      };
    });
    expect(state.order?.contact).toEqual({
      firstName: "Anonimizovano",
      lastName: "",
      email: "",
      phone: "",
    });
    expect(state.order?.delivery.address).toEqual({
      street: "—",
      city: "Beograd",
      postalCode: "11000",
    });
    expect(state.order?.customerNote).toBeUndefined();
    expect(state.order?.vehicle?.vin).toBeUndefined();
    expect(state.order?.userId).toBeUndefined();
    expect(state.order?.searchText).not.toContain("petar");
    expect(state.order?.totals.totalPara).toBeGreaterThan(0);
    expect(state.user).toBeNull();
    expect(state.inquiries).toHaveLength(0);
    expect(state.vehicles).toHaveLength(0);
    expect(state.consents[0]?.userId).toBeUndefined();

    const audit = await t.run(async (ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_action_and_at", (q) => q.eq("action", "privacy.anonymize"))
        .first(),
    );
    expect(audit?.summary).not.toContain("a@sklop.test");
  });
});

describe("abuse limits", () => {
  test("password-reset codes: at most 3 e-mails per address per hour", async () => {
    const t = makeT();
    await setupWorld(t);
    for (let i = 0; i < 5; i++) {
      await t.mutation(internal.authEmails.sendPasswordResetCode, {
        email: "Meta@Primer.rs",
        code: `1234567${i}`,
        expiresAt: Date.now() + 900_000,
      });
    }
    const sent = await t.run(async (ctx) =>
      ctx.db
        .query("emailLog")
        .withIndex("by_templateKey", (q) => q.eq("templateKey", "password_reset_code"))
        .take(10),
    );
    expect(sent).toHaveLength(3);
  });

  test("new guest carts are rate-limited per client; existing carts keep working", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const token = (i: number) => `guest-token-${String(i).padStart(28, "0")}`;
    for (let i = 0; i < 100; i++) {
      await w.anon.mutation(api.carts.addItem, {
        guestToken: token(i),
        productId: w.products.battery,
        quantity: 1,
      });
    }
    expect(
      await errorCode(() =>
        w.anon.mutation(api.carts.addItem, {
          guestToken: token(100),
          productId: w.products.battery,
          quantity: 1,
        }),
      ),
    ).toBe("RATE_LIMITED");
    await w.anon.mutation(api.carts.addItem, {
      guestToken: token(5),
      productId: w.products.disc,
      quantity: 1,
    });
  });
});

describe("customer role", () => {
  test("accounts without a role are backfilled and appear in the admin customer list", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const legacy = await t.run(async (ctx) =>
      ctx.db.insert("users", { email: "stari@sklop.test", name: "Stari", status: "active" }),
    );
    const before = await w.asStaff.query(api.customersAdmin.list, {
      paginationOpts: { numItems: 100, cursor: null },
    });
    expect(before.page.some((u) => u._id === legacy)).toBe(false);
    await t.mutation(internal.maintenance.backfillCustomerRole, {});
    const after = await w.asStaff.query(api.customersAdmin.list, {
      paginationOpts: { numItems: 100, cursor: null },
    });
    expect(after.page.some((u) => u._id === legacy)).toBe(true);
  });
});

describe("test helpers", () => {
  test("refuse to run unless the deployment opted in with E2E_TEST_HELPERS", async () => {
    const t = makeT();
    await setupWorld(t);
    vi.stubEnv("E2E_TEST_HELPERS", "");
    expect(
      await errorCode(() => t.mutation(internal.testing.createTestOrder, { tag: "x" })),
    ).toMatch(/^PLAIN:.*E2E_TEST_HELPERS/);
    expect(
      await errorCode(() => t.query(internal.testing.orderStatusToken, { number: "SK-1" })),
    ).toMatch(/^PLAIN:.*E2E_TEST_HELPERS/);
  });
});

describe("status-link secret", () => {
  test("off localhost a missing LINK_TOKEN_SECRET fails closed instead of using the dev value", async () => {
    const t = makeT();
    await setupWorld(t);
    vi.stubEnv("LINK_TOKEN_SECRET", "");
    vi.stubEnv("SITE_URL", "https://sklop.rs");
    expect(
      await errorCode(() => t.query(internal.testing.orderStatusToken, { number: "SK-1" })),
    ).toMatch(/^PLAIN:.*LINK_TOKEN_SECRET/);
    vi.stubEnv("SITE_URL", "http://localhost:3000");
    expect(await t.query(internal.testing.orderStatusToken, { number: "SK-1" })).toMatch(
      /^[A-Za-z0-9_-]{43}$/,
    );
  });
});

describe("outbox masking", () => {
  test("status, proforma and unsubscribe links are masked for staff", () => {
    const text = [
      `https://sklop.rs/porudzbina/${TOKEN}`,
      `https://sklop.rs/porudzbina/${TOKEN}/predracun`,
      `https://sklop.rs/upit/${TOKEN}`,
      `https://sklop.rs/obavestenja/odjava/${TOKEN}`,
      "https://sklop.rs/porudzbina",
    ].join("\n");
    const masked = maskSecrets("order_status_changed", "order", text);
    expect(masked).not.toContain(TOKEN);
    expect(masked).toContain("https://sklop.rs/porudzbina/••••••••/predracun");
    expect(masked).toContain("https://sklop.rs/porudzbina\n".trim());
  });
});

describe("tracking retention", () => {
  test("CAPI context is cleared once the send is final", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    await w.anon.mutation(api.carts.addItem, {
      guestToken: GUEST,
      productId: w.products.disc,
      quantity: 1,
    });
    const order = await w.anon.mutation(api.orders.submit, {
      guestToken: GUEST,
      ...checkoutArgs(),
    });
    const deliveryId = await t.run(async (ctx) => {
      const o = (await ctx.db
        .query("orders")
        .withIndex("by_number", (q) => q.eq("number", order.number))
        .unique())!;
      const event = (await ctx.db
        .query("domainEvents")
        .withIndex("by_aggregateType_and_aggregateId", (q) =>
          q.eq("aggregateType", "order").eq("aggregateId", o._id),
        )
        .first())!;
      await ctx.db.patch("domainEvents", event._id, {
        capiContext: { ip: "203.0.113.9", userAgent: "UA", eventSourceUrl: "https://x.test" },
      });
      return await ctx.db.insert("notificationDeliveries", {
        eventId: event._id,
        channel: "meta_capi",
        recipient: "meta",
        status: "pending",
        attempts: 0,
      });
    });
    await t.mutation(internal.capi.finish, { deliveryId, outcome: "sent", detail: "ok" });
    const event = await t.run(async (ctx) => {
      const d = await ctx.db.get("notificationDeliveries", deliveryId);
      return await ctx.db.get("domainEvents", d!.eventId);
    });
    expect(event?.capiContext).toBeUndefined();
  });

  test("nightly: click ids masked after 180 days, CAPI context after 7, idle guest carts removed", async () => {
    vi.useFakeTimers();
    const t = makeT();
    const w = await setupWorld(t);
    await w.anon.mutation(api.carts.addItem, {
      guestToken: GUEST,
      productId: w.products.disc,
      quantity: 1,
    });
    const order = await w.anon.mutation(api.orders.submit, {
      guestToken: GUEST,
      ...checkoutArgs(),
      attribution: {
        last: { source: "google", medium: "cpc", gclid: "Cj0KCQjw-real-click", at: Date.now() },
        fbp: "fb.1.1.2",
        consentAnalytics: true,
        consentAds: true,
      },
    });
    const ids = await t.run(async (ctx) => {
      const o = (await ctx.db
        .query("orders")
        .withIndex("by_number", (q) => q.eq("number", order.number))
        .unique())!;
      const eventId = await ctx.db.insert("domainEvents", {
        type: "order.created",
        aggregateType: "order",
        aggregateId: o._id,
        payload: { kind: "order", orderId: o._id, number: o.number },
        status: "done",
        attempts: 1,
        nextAttemptAt: Date.now(),
        dedupeKey: "test-capi",
        capiContext: { ip: "203.0.113.9", userAgent: "UA", eventSourceUrl: "https://x.test" },
      });
      const cartId = await ctx.db.insert("carts", {
        ownerType: "guest",
        guestTokenHash: "stale",
        status: "converted",
        updatedAt: Date.now(),
      });
      return { orderId: o._id as Id<"orders">, eventId, cartId };
    });

    vi.setSystemTime(Date.now() + 200 * DAY);
    await t.mutation(internal.automations.nightly, {});
    const state = await t.run(async (ctx) => ({
      order: await ctx.db.get("orders", ids.orderId),
      event: await ctx.db.get("domainEvents", ids.eventId),
      cart: await ctx.db.get("carts", ids.cartId),
    }));
    expect(state.order?.attribution?.last?.gclid).toBe("pruned");
    expect(state.order?.attribution?.fbp).toBeUndefined();
    expect(state.order?.attribution?.last?.source).toBe("google");
    expect(state.event?.capiContext).toBeUndefined();
    expect(state.cart).toBeNull();
  });
});

describe("per-visitor limits and client-supplied records (QA BE-02, BE-03, BE-04)", () => {
  test("the rate-limit key is the IP (IPv6 by /64), never the User-Agent", async () => {
    expect(ipSubject("203.0.113.7")).toBe("203.0.113.7");
    expect(ipSubject("::ffff:203.0.113.7")).toBe("203.0.113.7");
    expect(ipSubject("2001:db8:12:34:aaaa:bbbb:cccc:dddd")).toBe("2001:db8:12:34::/64");
    expect(ipSubject("2001:0db8:0012:0034::1")).toBe("2001:db8:12:34::/64");
    expect(ipSubject("[2001:db8::1]")).toBe("2001:db8:0:0::/64");

    const t = makeT();
    await setupWorld(t);
    const from = (ip: string, userAgent: string) => t.withRequestMetadata({ ip, userAgent });
    // uploadUrl: a burst of 30 per client. Rotating the UA must not open a fresh bucket.
    for (let i = 0; i < 30; i++)
      await from("198.51.100.9", `agent-${i}`).mutation(api.inquiries.generateUploadUrl, {});
    expect(
      await errorCode(() =>
        from("198.51.100.9", "agent-new").mutation(api.inquiries.generateUploadUrl, {}),
      ),
    ).toBe("RATE_LIMITED");
    // Same /64, different interface id: same subscriber, same bucket.
    for (let i = 0; i < 30; i++)
      await from(`2001:db8:1:2::${i + 1}`, "ua").mutation(api.inquiries.generateUploadUrl, {});
    expect(
      await errorCode(() =>
        from("2001:db8:1:2:ffff::1", "ua").mutation(api.inquiries.generateUploadUrl, {}),
      ),
    ).toBe("RATE_LIMITED");
    // Another address is unaffected.
    await from("198.51.100.10", "agent-0").mutation(api.inquiries.generateUploadUrl, {});
  });

  test("consent versions and time come from the server; attribution is clamped", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const args = {
      kind: "part" as const,
      message: "Treba mi filter ulja.",
      contact: { name: "Ana", phone: "064 111 2222", preferredChannel: "phone" as const },
      honeypot: "",
      startedAt: Date.now() - 30_000,
    };
    expect(
      await errorCode(() =>
        w.anon.mutation(api.inquiries.submit, {
          ...args,
          consent: { ...CONSENT, termsVersion: "QA-FORGED" },
        }),
      ),
    ).toBe("CONFLICT");
    const huge = "x".repeat(200_000);
    const { number } = await w.anon.mutation(api.inquiries.submit, {
      ...args,
      consent: { ...CONSENT, acceptedAt: 946_684_800_000 },
      attribution: {
        last: { campaign: huge, gclid: `abc<script>${huge}`, at: 1 },
        fbp: "fb.1.123.456",
        consentAnalytics: false,
        consentAds: false,
      },
    });
    const stored = await t.run(async (ctx) =>
      ctx.db
        .query("inquiries")
        .withIndex("by_number", (q) => q.eq("number", number))
        .unique(),
    );
    expect(stored!.consent.termsVersion).toBe("2026-09-29");
    expect(stored!.consent.acceptedAt).toBeGreaterThan(946_684_800_000);
    expect(stored!.attribution!.last!.campaign).toHaveLength(200);
    expect(stored!.attribution!.last!.gclid).toMatch(/^abcscriptx+$/);
    expect(stored!.attribution!.last!.gclid!.length).toBeLessThanOrEqual(512);
    expect(stored!.attribution!.fbp).toBe("fb.1.123.456");
  });
});
