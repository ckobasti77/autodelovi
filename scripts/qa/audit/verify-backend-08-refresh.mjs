/**
 * Step 21 audit — independent verification of backend-08 (Convex Auth refresh per page load).
 * Signs in the shared customer, then (A) 4 full page loads and (B) 4 client-side (Link) navigations.
 * Counts POST /api/auth requests and records which responses set __convexAuthJWT (no values stored;
 * only the JSON action name / arg keys of the /api/auth body).
 * Output: docs/qa/audit/verify/backend/backend-08-reproduce.json
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { BASE, launch, loginWith, newContext } from "./kit.mjs";

const acc = JSON.parse(readFileSync(".playwright/audit-accounts.json", "utf8"));
const browser = await launch("chromium");
const context = await newContext(browser, { width: 1440, height: 900, tag: "verify-backend-08" });
const page = await context.newPage();
let phase = "login";
const events = [];
page.on("request", (r) => {
  if (r.url().startsWith(`${BASE}/api/auth`) && r.method() === "POST") {
    let body = null;
    try {
      const j = JSON.parse(r.postData() ?? "null");
      body = { action: j?.action, argKeys: j?.args ? Object.keys(j.args) : [] };
    } catch {}
    events.push({ phase, kind: "POST /api/auth", body });
  }
});
page.on("response", async (r) => {
  try {
    const h = await r.headersArray();
    const sets = h.filter((x) => x.name.toLowerCase() === "set-cookie" && /__convexAuthJWT=/.test(x.value));
    if (sets.length)
      events.push({
        phase,
        kind: "sets JWT cookie",
        method: r.request().method(),
        url: r.url().replace(BASE, ""),
        type: r.request().resourceType(),
      });
  } catch {}
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  await loginWith(page, acc.customer.email, acc.customer.password, "/nalog");
  await page.waitForLoadState("networkidle");
  await wait(3000);
  // A) full page loads
  for (const p of ["/delovi", "/korpa", "/", "/nalog"]) {
    phase = `A full load ${p}`;
    await page.goto(`${BASE}${p}`, { waitUntil: "networkidle" });
    await wait(3000);
  }
  // B) client-side navigations via in-page links (same ConvexReactClient)
  for (const href of ["/delovi", "/nalog", "/vozila", "/"]) {
    await page.keyboard.press("Escape");
    phase = `B client nav ${href}`;
    const link = page.locator(`a[href="${href}"]:visible`).first();
    const n = await page.locator(`a[href="${href}"]:visible`).count();
    if (!n) {
      events.push({ phase, kind: "no visible link" });
      continue;
    }
    const before = await page.evaluate(() => performance.getEntriesByType("navigation").length && performance.timeOrigin);
    const desc = await link.evaluate((a) => (a.textContent || a.getAttribute("aria-label") || "").trim().slice(0, 40));
    await link.evaluate((a) => a.click());
    try {
      await page.waitForFunction((h) => location.pathname === h, href, { timeout: 15_000 });
    } catch {
      events.push({ phase, kind: "did not navigate", desc, at: page.url() });
      continue;
    }
    events.push({ phase, kind: "clicked", desc });
    await page.waitForLoadState("networkidle");
    const after = await page.evaluate(() => performance.timeOrigin);
    events.push({ phase, kind: "nav type", softNavigation: before === after });
    await wait(3000);
  }
} finally {
  await browser.close();
}
const count = (pfx) => events.filter((e) => e.phase.startsWith(pfx) && e.kind === "POST /api/auth").length;
const out = {
  base: BASE,
  at: new Date().toISOString(),
  summary: {
    fullLoads: 4,
    apiAuthPostsDuringFullLoads: count("A "),
    clientNavs: 4,
    apiAuthPostsDuringClientNavs: count("B "),
  },
  events,
};
mkdirSync("docs/qa/audit/verify/backend", { recursive: true });
writeFileSync("docs/qa/audit/verify/backend/backend-08-reproduce.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
