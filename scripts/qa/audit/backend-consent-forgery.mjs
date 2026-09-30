/**
 * Step 21 audit (backend): client-supplied consent proof and unbounded attribution strings.
 *  1. Anonymous `inquiries:submit` with consent {termsVersion/privacyVersion: "QA-FORGED",
 *     acceptedAt: 2000-01-01} and attribution.last.campaign of 200 000 characters.
 *  2. Owner reads it back with the privacy export (`privacy:customerData` by the unique e-mail).
 *  3. Owner closes the test inquiry (reason „QA audit test“).
 * Output: docs/qa/audit/backend/consent-forgery.json (no personal data besides the test address).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference as ref } from "convex/server";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const URL_ = env.NEXT_PUBLIC_CONVEX_URL;
const anon = new ConvexHttpClient(URL_, {
  fetch: (i, init = {}) => {
    const h = new Headers(init.headers ?? {});
    h.set("User-Agent", `SklopAudit-backend-consent/${Date.now()}`);
    return fetch(i, { ...init, headers: h });
  },
});
const c0 = new ConvexHttpClient(URL_);
const r = await c0.action(ref("auth:signIn"), {
  provider: "password",
  params: { email: process.env.SEED_ADMIN_EMAIL, password: process.env.SEED_ADMIN_PASSWORD, flow: "signIn" },
});
const owner = new ConvexHttpClient(URL_);
owner.setAuth(r.tokens.token);

const email = `audit-backend-consent-${Date.now()}@primer.rs`;
const now = Date.now();
const res = {};
try {
  const inq = await anon.mutation(ref("inquiries:submit"), {
    kind: "part",
    message: "QA audit (backend) — provera zapisa saglasnosti. Ne obrađivati.",
    contact: { name: "QA Audit Saglasnost", email, preferredChannel: "email" },
    consent: {
      termsVersion: "QA-FORGED",
      privacyVersion: "QA-FORGED",
      acceptedAt: Date.UTC(2000, 0, 1),
      marketingEmail: true,
      analytics: true,
      ads: true,
    },
    attribution: {
      consentAnalytics: true,
      consentAds: true,
      last: { at: now, campaign: "X".repeat(200_000), source: "qa" },
    },
    honeypot: "",
    startedAt: now - 10_000,
  });
  res.inquiry = inq.number;
  const exp = await owner.query(ref("privacy:customerData"), { email });
  const data = JSON.parse(exp.json);
  const found = JSON.stringify(data);
  const i0 = (data.inquiries ?? [])[0] ?? {};
  res.storedConsent = i0.consent ?? "(not in export)";
  res.storedCampaignLength = i0.attribution?.last?.campaign?.length ?? (found.match(/X{1000,}/)?.[0].length ?? null);
  res.exportBytes = exp.json.length;
  const list = await owner.query(ref("inquiriesAdmin:list"), { search: inq.number, paginationOpts: { numItems: 5, cursor: null } });
  const id = list.page.find((x) => x.number === inq.number)?._id;
  res.adminListCampaignLength = list.page.find((x) => x.number === inq.number)?.campaign?.length ?? null;
  if (id) {
    await owner.mutation(ref("inquiriesAdmin:close"), { inquiryId: id, reason: "QA audit test (backend) — zatvoreno" });
    res.cleanup = "inquiry closed";
  }
} catch (e) {
  res.error = e?.data ?? String(e?.message ?? e).slice(0, 300);
} finally {
  await owner.action(ref("auth:signOut"), {}).catch(() => {});
}
writeFileSync("docs/qa/audit/backend/consent-forgery.json", JSON.stringify(res, null, 2));
console.log(JSON.stringify(res, null, 2));
