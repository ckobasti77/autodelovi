/**
 * a11y-app-02 skeptic follow-up: after a pre-hydration GET submit of /prijava, does the password
 * (now in location.search) reach the analytics dataLayer / third-party requests when the visitor
 * has granted analytics + ads consent? lib/analytics/redact.ts keeps `url.search`.
 */
import { writeFileSync } from "node:fs";
import path from "node:path";

import { BASE, launch, newContext, shot } from "./kit.mjs";

const browser = await launch();
const context = await newContext(browser, { width: 390, height: 844, consent: false, tag: "verify-a11y02-analytics" });
const { hostname } = new URL(BASE);
const value = encodeURIComponent(
  JSON.stringify({ v: 1, analytics: true, ads: true, at: Date.now(), id: "audit-verify-a11y02-an" }),
);
await context.addCookies([{ name: "sk_consent", value, domain: hostname, path: "/", sameSite: "Lax" }]);
const page = await context.newPage();
const PW = "TajnaLozinka-888";
const leaks = [];
page.on("request", (r) => {
  const u = r.url();
  const body = r.postData() ?? "";
  if (!u.startsWith(BASE) && (u.includes(PW) || body.includes(PW))) leaks.push(`${r.method()} ${u.slice(0, 300)}`);
});
let delay = true;
await page.route(/\/_next\/static\/chunks\/.*\.js/, async (r) => {
  if (delay) await new Promise((res) => setTimeout(res, 8000));
  await r.continue().catch(() => {});
});
await page.goto(`${BASE}/prijava`, { waitUntil: "domcontentloaded" });
await page.locator("input[name=email]").fill("audit-verify-a11y02-an@primer.rs");
await page.locator("input[name=password]").fill(PW);
const nav = page.waitForRequest((r) => r.isNavigationRequest() && r.frame() === page.mainFrame(), { timeout: 8000 });
await page.locator("input[name=password]").press("Enter");
const req = await nav;
delay = false;
await page.waitForLoadState("load").catch(() => {});
await page.waitForTimeout(9000);
const state = await page.evaluate((pw) => {
  const dl = JSON.stringify(
    (window.dataLayer ?? []).map((a) => {
      try {
        return Array.from(a);
      } catch {
        return a;
      }
    }),
  );
  const idx = dl.indexOf(pw);
  return {
    href: location.href,
    hydrated: Object.keys(document.querySelector("main form input") ?? {}).some((k) => k.startsWith("__reactFiber")),
    dataLayerLength: (window.dataLayer ?? []).length,
    dataLayerHasPassword: idx >= 0,
    dataLayerExcerpt: idx >= 0 ? dl.slice(Math.max(0, idx - 160), idx + 30) : null,
    gtagLoaded: !!document.getElementById("sk-gtag"),
    fbq: typeof window.fbq,
  };
}, PW);
await shot(page, "verify/a11y-app/a11y-app-02-skeptic-analytics-after");
const out = { at: new Date().toISOString(), submitNavigation: `${req.method()} ${req.url()}`, ...state, thirdPartyRequestsWithPassword: leaks };
console.log(JSON.stringify(out, null, 1));
writeFileSync(path.resolve("docs/qa/audit/verify/a11y-app/a11y-app-02-skeptic-analytics.json"), JSON.stringify(out, null, 2));
await browser.close();
