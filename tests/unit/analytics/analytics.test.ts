// @vitest-environment jsdom
import { afterEach, describe, expect, test } from "vitest";

import { mergeAttribution, parseStoredAttribution, sanitizeTouch } from "@/lib/analytics/attributionCookie";
import { gaClientIdFromCookie, readAttribution, touchFromUrl } from "@/lib/analytics/attribution";
import { buildCapiEvent, capiRequestBody, capiUrl, fbcFromClick } from "@/lib/analytics/capi";
import {
  CONSENT_DEFAULT,
  CONSENT_VERSION,
  consentModeState,
  parseConsent,
  serializeConsent,
} from "@/lib/analytics/consent";
import {
  googleUserData,
  normalizeCity,
  normalizeEmailForAds,
  normalizeName,
  phoneDigits,
  phoneE164,
  sha256Hex,
} from "@/lib/analytics/hash";
import { metaEventId, toAdsConversion, toGa4, toMeta } from "@/lib/analytics/mapping";
import { registerAnalyticsAdapter, track, type AnalyticsItem } from "@/lib/analytics/track";
import { classifyAttribution, classifyTouch, googleClickIds } from "@/lib/domain/attribution";

const item: AnalyticsItem = {
  sku: "SK-1",
  name: "Disk",
  manufacturer: "Brembo",
  system: "kocnice",
  category: "kocioni-diskovi",
  pricePara: 1_299_000,
  quantity: 2,
};

afterEach(() => {
  for (const c of document.cookie.split("; ")) {
    const name = c.split("=")[0];
    if (name) document.cookie = `${name}=; Max-Age=0; path=/`;
  }
  window.__skTrack = [];
});

describe("Consent Mode v2", () => {
  test("defaults deny every storage except security; grants map per category", () => {
    expect(CONSENT_DEFAULT).toMatchObject({
      ad_storage: "denied",
      analytics_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      security_storage: "granted",
      wait_for_update: 500,
    });
    expect(consentModeState(null)).toEqual({
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      analytics_storage: "denied",
    });
    expect(consentModeState({ analytics: true, ads: false })).toMatchObject({
      analytics_storage: "granted",
      ad_storage: "denied",
    });
    expect(consentModeState({ analytics: false, ads: true })).toMatchObject({
      ad_storage: "granted",
      ad_user_data: "granted",
      ad_personalization: "granted",
      analytics_storage: "denied",
    });
  });

  test("cookie round trip; outdated versions and junk are ignored", () => {
    const record = { v: CONSENT_VERSION, analytics: true, ads: false, at: 1, id: "abcdef12-3456" };
    expect(parseConsent(serializeConsent(record))).toEqual(record);
    expect(parseConsent(encodeURIComponent(serializeConsent(record)))).toEqual(record);
    expect(parseConsent(JSON.stringify({ ...record, v: 0 }))).toBeNull();
    expect(parseConsent("{bad")).toBeNull();
    expect(parseConsent(JSON.stringify({ ...record, id: "<script>" }))).toBeNull();
  });
});

describe("attribution capture", () => {
  test("campaign parameters and an external referrer make a touch; internal visits do not", () => {
    const url = new URL("https://primer.rs/deo/disk?utm_source=google&utm_medium=cpc&gclid=abc&x=1");
    expect(touchFromUrl(url, "", 5)).toEqual({
      source: "google",
      medium: "cpc",
      gclid: "abc",
      landingPath: "/deo/disk",
      at: 5,
    });
    expect(touchFromUrl(new URL("https://primer.rs/"), "https://primer.rs/delovi", 5)).toBeNull();
    expect(touchFromUrl(new URL("https://primer.rs/"), "https://www.google.com/search?q=x", 5)).toMatchObject({
      referrer: "https://www.google.com/search",
    });
  });

  test("first touch is the oldest, last touch the newest; junk is dropped", () => {
    const merged = mergeAttribution(
      { first: { source: "meta", at: 1 }, last: { source: "meta", at: 2 } },
      { first: { source: "google", at: 5 }, last: { source: "google", at: 6 } },
    );
    expect(merged.first?.source).toBe("meta");
    expect(merged.last?.source).toBe("google");
    expect(sanitizeTouch({ at: 1, source: "x".repeat(400), evil: "y" })).toEqual({
      at: 1,
      source: "x".repeat(300),
    });
    expect(parseStoredAttribution("%%%")).toEqual({});
  });

  test("readAttribution merges both cookies and shares click ids only with consent", () => {
    document.cookie = `sk_attr=${encodeURIComponent(JSON.stringify({ first: { source: "google", gclid: "g1", at: 1 } }))}; path=/`;
    document.cookie = `sk_attr_s=${encodeURIComponent(JSON.stringify({ last: { source: "meta", fbclid: "fb1", at: 9 } }))}; path=/`;
    document.cookie = "_fbp=fb.1.123.456; path=/";
    document.cookie = "_ga=GA1.1.111.222; path=/";
    const without = readAttribution()!;
    expect(without).toMatchObject({ consentAds: false, consentAnalytics: false });
    expect(without.first?.gclid).toBe("g1");
    expect(without.last?.fbclid).toBe("fb1");
    expect(without.fbp).toBeUndefined();
    document.cookie = `sk_consent=${encodeURIComponent(JSON.stringify({ v: CONSENT_VERSION, analytics: true, ads: true, at: 1, id: "abcdef12-3456" }))}; path=/`;
    const withConsent = readAttribution()!;
    expect(withConsent).toMatchObject({
      consentAds: true,
      consentAnalytics: true,
      fbp: "fb.1.123.456",
      fbc: "fb.1.9.fb1",
      gaClientId: "111.222",
    });
    expect(gaClientIdFromCookie("GA1.2.1.2")).toBe("1.2");
    expect(gaClientIdFromCookie("junk")).toBeUndefined();
  });

  test("source classification: click ids, UTM, search engines, referrals, direct", () => {
    expect(classifyTouch({ gclid: "x" }).channel).toBe("google_ads");
    expect(classifyTouch({ gbraid: "x" }).channel).toBe("google_ads");
    expect(classifyTouch({ fbclid: "x" })).toMatchObject({ channel: "meta_ads", medium: "paid_social" });
    expect(classifyTouch({ source: "viber", medium: "referral" }).channel).toBe("viber");
    expect(classifyTouch({ source: "newsletter", medium: "email" }).channel).toBe("email");
    expect(classifyTouch({ source: "google", medium: "cpc" }).channel).toBe("google_ads");
    expect(classifyTouch({ source: "forum", medium: "banner" }).channel).toBe("campaign");
    expect(classifyTouch({ referrer: "https://www.google.rs/" })).toMatchObject({ channel: "organic", source: "google" });
    expect(classifyTouch({ referrer: "https://www.polovniautomobili.com/x" })).toMatchObject({
      channel: "referral",
      source: "polovniautomobili.com",
    });
    expect(classifyTouch(undefined).channel).toBe("direct");
    expect(classifyAttribution({ first: { gclid: "a" }, last: undefined }).channel).toBe("google_ads");
    expect(googleClickIds({ first: { gclid: "a" }, last: { wbraid: "w" } })).toEqual({ gclid: "a", wbraid: "w" });
  });
});

describe("event map", () => {
  test("GA4 ecommerce parameters in RSD decimals", () => {
    const [name, params] = toGa4({
      name: "purchase",
      orderNumber: "SK-2026-000123",
      valuePara: 2_643_000,
      shippingPara: 45_000,
      taxPara: 440_500,
      items: [item],
    })!;
    expect(name).toBe("purchase");
    expect(params).toMatchObject({
      transaction_id: "SK-2026-000123",
      currency: "RSD",
      value: 26430,
      tax: 4405,
      shipping: 450,
    });
    expect((params.items as Record<string, unknown>[])[0]).toEqual({
      item_id: "SK-1",
      item_name: "Disk",
      item_brand: "Brembo",
      item_category: "kocnice",
      item_category2: "kocioni-diskovi",
      price: 12990,
      quantity: 2,
    });
    expect(toGa4({ name: "contact_click", channel: "viber", location: "header" })).toEqual([
      "contact_click",
      { channel: "viber", location: "header" },
    ]);
  });

  test("Google Ads conversions only for configured labels", () => {
    const labels = { purchase: "AbC", lead: "LeAd", mechanicSignup: null };
    expect(
      toAdsConversion(
        { name: "purchase", orderNumber: "SK-1", valuePara: 100_00, shippingPara: 0, taxPara: 0, items: [] },
        "AW-123",
        labels,
      ),
    ).toEqual({ send_to: "AW-123/AbC", value: 100, currency: "RSD", transaction_id: "SK-1" });
    expect(
      toAdsConversion({ name: "generate_lead", leadType: "inquiry", leadId: "UP-1" }, "AW-123", labels),
    ).toEqual({ send_to: "AW-123/LeAd", transaction_id: "UP-1" });
    expect(
      toAdsConversion({ name: "generate_lead", leadType: "mechanic_registration", leadId: "p1" }, "AW-123", labels),
    ).toBeNull();
    expect(toAdsConversion({ name: "view_item", item }, "AW-123", labels)).toBeNull();
  });

  test("Meta Pixel events and shared dedup ids", () => {
    expect(toMeta({ name: "view_item", item })?.[0]).toBe("ViewContent");
    expect(toMeta({ name: "add_to_cart", item })?.[1]).toMatchObject({ content_ids: ["SK-1"], currency: "RSD", value: 25980 });
    expect(toMeta({ name: "generate_lead", leadType: "inquiry", leadId: "UP-1" })?.[0]).toBe("Lead");
    expect(toMeta({ name: "generate_lead", leadType: "mechanic_registration", leadId: "p1" })?.[0]).toBe(
      "CompleteRegistration",
    );
    expect(toMeta({ name: "view_item_list", listId: "a", listName: "b", items: [] })).toBeNull();
    expect(metaEventId({ name: "generate_lead", leadType: "mechanic_registration", leadId: "p1" })).toBe("mech-p1");
    expect(
      metaEventId({ name: "purchase", orderNumber: "SK-9", valuePara: 0, shippingPara: 0, taxPara: 0, items: [] }),
    ).toBe("SK-9");
  });
});

describe("track() and adapters", () => {
  test("an adapter registered later receives this page's events once", () => {
    const seen: string[] = [];
    track({ name: "search", term: "5Q0", results: 3 });
    const off = registerAnalyticsAdapter("test", (e) => seen.push(e.name));
    registerAnalyticsAdapter("test", (e) => seen.push(`again:${e.name}`));
    track({ name: "contact_click", channel: "phone", location: "header" });
    expect(seen).toEqual(["search", "again:contact_click"]);
    off();
    const other: string[] = [];
    const off2 = registerAnalyticsAdapter("other", (e) => other.push(e.name));
    expect(other).toEqual(["search", "contact_click"]);
    off2();
  });
});

describe("PII hashing (Enhanced Conversions, CAPI)", () => {
  test("normalization rules", async () => {
    expect(normalizeEmailForAds("  Petar.Petrovic@Gmail.com ", true)).toBe("petarpetrovic@gmail.com");
    expect(normalizeEmailForAds("Petar.P@primer.rs", true)).toBe("petar.p@primer.rs");
    expect(phoneDigits("064 123 4567")).toBe("381641234567");
    expect(phoneDigits("+381 64 123 4567")).toBe("381641234567");
    expect(phoneDigits("00381641234567")).toBe("381641234567");
    expect(phoneDigits("12")).toBeNull();
    expect(phoneE164("064/123-4567")).toBe("+381641234567");
    expect(normalizeName(" Đorđe ")).toBe("đorđe");
    expect(normalizeCity("Novi Sad")).toBe("novisad");
    expect(await sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  test("Google user_data carries only sha256_* fields (plus city/country)", async () => {
    const data = (await googleUserData({
      email: "Petar@Primer.rs",
      phone: "064 123 4567",
      firstName: "Petar",
      lastName: "Petrović",
      city: "Beograd",
    }))!;
    expect(Object.keys(data).sort()).toEqual(["address", "sha256_email_address", "sha256_phone_number"]);
    expect(data.sha256_phone_number).toBe(await sha256Hex("+381641234567"));
    expect(JSON.stringify(data)).not.toMatch(/Petar|primer|4567/);
    expect(await googleUserData({})).toBeNull();
  });

  test("CAPI payload: hashed user data, seconds, RSD values, test code", async () => {
    const event = await buildCapiEvent({
      eventName: "Purchase",
      eventId: "SK-2026-000123",
      eventTimeMs: 1_790_000_000_123,
      eventSourceUrl: "https://primer.rs/porudzbina",
      user: {
        email: "Petar@Primer.rs",
        phone: "064 123 4567",
        firstName: "Petar",
        lastName: "Petrović",
        city: "Novi Sad",
        externalId: "user1",
        ip: "203.0.113.1",
        userAgent: "UA",
        fbp: "fb.1.1.2",
        fbc: fbcFromClick("IwAR", 1_700_000_000_000),
      },
      custom: {
        valuePara: 2_643_000,
        contents: [{ id: "SK-1", quantity: 2, itemPricePara: 1_299_000 }],
        orderId: "SK-2026-000123",
      },
    });
    expect(event).toMatchObject({
      event_name: "Purchase",
      event_id: "SK-2026-000123",
      event_time: 1_790_000_000,
      action_source: "website",
      custom_data: {
        currency: "RSD",
        value: 26430,
        content_ids: ["SK-1"],
        contents: [{ id: "SK-1", quantity: 2, item_price: 12990 }],
        num_items: 2,
        content_type: "product",
        order_id: "SK-2026-000123",
      },
    });
    const u = event.user_data;
    expect(u.em).toEqual([await sha256Hex("petar@primer.rs")]);
    expect(u.ph).toEqual([await sha256Hex("381641234567")]);
    expect(u.ln).toEqual([await sha256Hex("petrović")]);
    expect(u.ct).toEqual([await sha256Hex("novisad")]);
    expect(u.country).toEqual([await sha256Hex("rs")]);
    expect(u.client_ip_address).toBe("203.0.113.1");
    expect(u.fbc).toBe("fb.1.1700000000000.IwAR");
    expect(capiRequestBody([event], " TEST1 ")).toMatchObject({ test_event_code: "TEST1" });
    expect(capiRequestBody([event], "")).not.toHaveProperty("test_event_code");
    expect(capiUrl("123")).toBe("https://graph.facebook.com/v26.0/123/events");
  });
});

