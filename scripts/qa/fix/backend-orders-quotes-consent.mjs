/**
 * Step 22 fix verification (BE-03, BE-04) against the dev deployment: forged consent versions
 * are refused, the stored consent time is the server's, and attribution strings are clamped.
 * Creates one test inquiry and closes it again.
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
const anon = new ConvexHttpClient(URL_);
const r = await new ConvexHttpClient(URL_).action(ref("auth:signIn"), {
  provider: "password",
  params: {
    email: process.env.SEED_ADMIN_EMAIL,
    password: process.env.SEED_ADMIN_PASSWORD,
    flow: "signIn",
  },
});
const owner = new ConvexHttpClient(URL_);
owner.setAuth(r.tokens.token);

const settings = await owner.query(ref("settings:getAdmin"), {});
const legal = settings.legalVersions;
const base = {
  kind: "part",
  message: "QA fix test (backend-orders-quotes): provera saglasnosti.",
  contact: { name: "QA Fix Consent", phone: "064 000 0022", preferredChannel: "phone" },
  honeypot: "",
  startedAt: Date.now() - 30_000,
};
const consent = {
  termsVersion: legal.terms,
  privacyVersion: legal.privacy,
  acceptedAt: 946_684_800_000,
  marketingEmail: false,
  analytics: false,
  ads: false,
};
const out = { legal };
try {
  await anon.mutation(ref("inquiries:submit"), {
    ...base,
    consent: { ...consent, termsVersion: "QA-FORGED", privacyVersion: "QA-FORGED" },
  });
  out.forged = "ACCEPTED";
} catch (e) {
  out.forged = { code: e.data?.code, message: e.data?.message };
}
const before = Date.now();
const res = await anon.mutation(ref("inquiries:submit"), {
  ...base,
  consent,
  attribution: {
    last: {
      campaign: "c".repeat(200_000),
      gclid: `ok_id-1<script>${"z".repeat(5000)}`,
      at: before,
    },
    consentAnalytics: false,
    consentAds: false,
  },
});
out.created = res.number;
const detail = await owner.query(ref("inquiriesAdmin:get"), { number: res.number });
out.storedCampaignLength = detail.inquiry.attribution?.last?.campaign?.length ?? null;
out.storedGclid = (detail.inquiry.attribution?.last?.gclid ?? "").slice(0, 40);
out.storedGclidLength = detail.inquiry.attribution?.last?.gclid?.length ?? null;
const list = await owner.query(ref("inquiriesAdmin:list"), {
  search: res.number,
  paginationOpts: { numItems: 5, cursor: null },
});
out.listCampaignLength = list.page.find((p) => p.number === res.number)?.campaign?.length ?? null;
const privacy = await owner
  .query(ref("privacy:customerData"), { phone: "064 000 0022" })
  .catch((e) => ({ error: e.data?.message ?? String(e) }));
const stored = privacy?.inquiries?.find?.((i) => i.number === res.number);
out.storedConsent = stored?.consent ?? privacy?.error ?? "n/a";
out.consentTimeFromServer = stored?.consent ? stored.consent.acceptedAt >= before - 60_000 : "n/a";
await owner.mutation(ref("inquiriesAdmin:close"), {
  inquiryId: detail.inquiry._id,
  reason: "QA fix test (backend) — zatvoreno",
});
writeFileSync(
  "docs/qa/fix/backend-orders-quotes/consent-attribution.json",
  JSON.stringify(out, null, 2),
);
console.log(JSON.stringify(out, null, 2));
