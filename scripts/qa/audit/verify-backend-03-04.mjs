/**
 * Step 21 audit — independent verification of backend-03 (client-supplied consent proof) and
 * backend-04 (unbounded attribution / company address strings).
 *
 *  A. Anonymous `inquiries:submit` with EMPTY terms/privacy versions and acceptedAt in 2099,
 *     attribution.last.campaign = 200 000 chars, gclid = 3 000 chars of non-id characters.
 *  B. Anonymous guest order `orders:submit` (pickup + pickup_cash) with consent versions
 *     "VERIFY-FORGED" and acceptedAt 0, company.address.street = 20 000 chars, postalCode "ABC",
 *     attribution.last.campaign = 50 000 chars.
 *  Owner reads everything back (privacy export, admin lists, admin detail), then closes the
 *  inquiry and cancels the order. Output: docs/qa/audit/verify/backend/backend-03|04-reproduce.json
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference as ref } from "convex/server";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const URL_ = env.NEXT_PUBLIC_CONVEX_URL;
const anonClient = (tag) =>
  new ConvexHttpClient(URL_, {
    fetch: (i, init = {}) => {
      const h = new Headers(init.headers ?? {});
      h.set("User-Agent", `SklopAudit-verify-backend-${tag}/${Date.now()}`);
      return fetch(i, { ...init, headers: h });
    },
  });

function pibCheckDigit(first8) {
  let s = 10;
  for (const ch of first8) {
    s = (s + Number(ch)) % 10;
    s = ((s === 0 ? 10 : s) * 2) % 11;
  }
  return (11 - s) % 10;
}
const pib = `10203040${pibCheckDigit("10203040")}`;

const c0 = new ConvexHttpClient(URL_);
const r = await c0.action(ref("auth:signIn"), {
  provider: "password",
  params: { email: process.env.SEED_ADMIN_EMAIL, password: process.env.SEED_ADMIN_PASSWORD, flow: "signIn" },
});
const owner = new ConvexHttpClient(URL_);
owner.setAuth(r.tokens.token);

const settings = await owner.query(ref("settings:getPublic"), {}).catch((e) => ({ error: String(e?.message ?? e).slice(0, 200) }));
const legalInForce = settings?.legalVersions ?? settings?.error ?? null;

const stamp = Date.now();
const out03 = { legalVersionsInForce: legalInForce };
const out04 = {};

// ---------- A. inquiry ----------
try {
  const email = `audit-verify-backend-a-${stamp}@primer.rs`;
  const anon = anonClient("a");
  const now = Date.now();
  const inq = await anon.mutation(ref("inquiries:submit"), {
    kind: "part",
    message: "QA verify (backend-03/04) — provera zapisa saglasnosti. Ne obrađivati.",
    contact: { name: "QA Verify Saglasnost", email, preferredChannel: "email" },
    consent: {
      termsVersion: "",
      privacyVersion: "",
      acceptedAt: Date.UTC(2099, 0, 1),
      marketingEmail: false,
      analytics: false,
      ads: false,
    },
    attribution: {
      consentAnalytics: false,
      consentAds: false,
      last: { at: now, campaign: "Y".repeat(200_000), gclid: "<>\"'=;|".repeat(430), source: "qa-verify" },
    },
    honeypot: "",
    startedAt: now - 10_000,
  });
  out03.inquiry = inq.number;
  out04.inquiry = inq.number;
  const exp = await owner.query(ref("privacy:customerData"), { email });
  const data = JSON.parse(exp.json);
  const i0 = (data.inquiries ?? [])[0] ?? {};
  out03.inquiryStoredConsent = i0.consent ?? "(not in export)";
  out04.inquiryStoredCampaignLength = i0.attribution?.last?.campaign?.length ?? null;
  out04.inquiryStoredGclidLength = i0.attribution?.last?.gclid?.length ?? null;
  out04.inquiryStoredGclidSample = i0.attribution?.last?.gclid?.slice(0, 21) ?? null;
  out04.inquiryExportBytes = exp.json.length;
  const list = await owner.query(ref("inquiriesAdmin:list"), {
    search: inq.number,
    paginationOpts: { numItems: 5, cursor: null },
  });
  const row = list.page.find((x) => x.number === inq.number);
  out04.inquiryAdminListCampaignLength = row?.campaign?.length ?? null;
  out04.inquiryAdminListRowBytes = row ? JSON.stringify(row).length : null;
  // Default admin tab („Svi“, no status) — the first page the Admin → Upiti table loads.
  const all = await owner.query(ref("inquiriesAdmin:list"), { paginationOpts: { numItems: 50, cursor: null } });
  out04.inquiryDefaultTabFirstPageBytes = JSON.stringify(all).length;
  out04.inquiryDefaultTabContainsRow = all.page.some((x) => x.number === inq.number);
  if (row?._id) {
    await owner.mutation(ref("inquiriesAdmin:close"), { inquiryId: row._id, reason: "QA verify test (backend-03/04) — zatvoreno" });
    out03.inquiryCleanup = "inquiry closed";
    const after = await owner.query(ref("inquiriesAdmin:list"), { paginationOpts: { numItems: 50, cursor: null } });
    out04.inquiryStillInDefaultTabAfterClose = after.page.some((x) => x.number === inq.number);
  }
} catch (e) {
  out03.inquiryError = e?.data ?? String(e?.message ?? e).slice(0, 400);
}

// ---------- B. guest order ----------
try {
  const email = `audit-verify-backend-b-${stamp}@primer.rs`;
  const anon = anonClient("b");
  const product = await anon.query(ref("catalog/products:bySlug"), { slug: "kocioni-disk-prednji-276-24-mm-demo-0004" });
  const productId = product?.product?._id ?? product?.product?.id ?? product?._id;
  const guestToken = `verifyBackend${stamp}abcdefghijk`.slice(0, 40);
  await anon.mutation(ref("carts:addItem"), { guestToken, productId, quantity: 1 });
  const now = Date.now();
  const ord = await anon.mutation(ref("orders:submit"), {
    guestToken,
    contact: { firstName: "QA", lastName: "Verify", email, phone: "+381 64 123 4567" },
    company: {
      name: "QA Verify d.o.o.",
      pib,
      address: { street: "S".repeat(20_000), city: "Beograd", postalCode: "ABC" },
    },
    delivery: { method: "pickup" },
    payment: { method: "pickup_cash" },
    note: "QA verify (backend-03/04) — test porudžbina, ne obrađivati.",
    consent: {
      termsVersion: "VERIFY-FORGED",
      privacyVersion: "VERIFY-FORGED",
      acceptedAt: 0,
      marketingEmail: false,
      analytics: false,
      ads: false,
    },
    attribution: {
      consentAnalytics: false,
      consentAds: false,
      last: { at: now, campaign: "Z".repeat(50_000), source: "qa-verify" },
    },
    honeypot: "",
    startedAt: now - 10_000,
  });
  out03.order = ord.number;
  out04.order = ord.number;
  const det = await owner.query(ref("ordersAdmin:get"), { number: ord.number });
  const o = det?.order ?? {};
  out04.orderAdminDetailCompanyStreetLength = o.company?.address?.street?.length ?? null;
  out04.orderAdminDetailCompanyPostalCode = o.company?.address?.postalCode ?? null;
  const exp = await owner.query(ref("privacy:customerData"), { email });
  const data = JSON.parse(exp.json);
  const o0 = (data.orders ?? [])[0] ?? {};
  out03.orderStoredConsent = o0.consent ?? "(not in export)";
  out04.orderStoredCompanyStreetLength = o0.company?.address?.street?.length ?? null;
  out04.orderStoredCompanyPostalCode = o0.company?.address?.postalCode ?? null;
  out04.orderStoredCampaignLength = o0.attribution?.last?.campaign?.length ?? null;
  const list = await owner.query(ref("ordersAdmin:list"), { search: ord.number, paginationOpts: { numItems: 5, cursor: null } });
  const row = list.page.find((x) => x.number === ord.number);
  out04.orderAdminListCampaignLength = row?.campaign?.length ?? null;
  if (o._id) {
    await owner.mutation(ref("ordersAdmin:transition"), {
      orderId: o._id,
      to: "otkazana",
      reason: "QA verify test (backend-03/04)",
      expectedUpdatedAt: o.updatedAt,
    });
    out03.orderCleanup = "order cancelled";
  }
} catch (e) {
  out03.orderError = e?.data ?? String(e?.message ?? e).slice(0, 400);
} finally {
  await owner.action(ref("auth:signOut"), {}).catch(() => {});
}

mkdirSync("docs/qa/audit/verify/backend", { recursive: true });
writeFileSync("docs/qa/audit/verify/backend/backend-03-reproduce.json", JSON.stringify(out03, null, 2));
writeFileSync("docs/qa/audit/verify/backend/backend-04-reproduce.json", JSON.stringify(out04, null, 2));
console.log(JSON.stringify({ out03, out04 }, null, 2));
