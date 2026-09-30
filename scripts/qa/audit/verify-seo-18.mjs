/**
 * Step 21 QA audit — independent verification of seo-18 (X-Robots-Tag on admin HTML responses,
 * ROUTES §B2). Signs in as the owner, requests admin pages with page.request (no redirects) and
 * records status, X-Robots-Tag and the robots meta. Anonymous checks for the public invite page
 * and the redirect of /admin. Compares with /styleguide and robots.txt.
 *   node scripts/qa/audit/verify-seo-18.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { BASE, launch, loginAdmin, newContext } from "./kit.mjs";

const meta = (html) => (html.match(/<meta name="robots" content="([^"]+)"/) ?? [])[1] ?? null;

const browser = await launch("chromium");
const out = { base: BASE, at: new Date().toISOString(), owner: [], anonymous: [], robotsTxt: null };

// Anonymous first (fresh context, no cookies).
const anon = await newContext(browser, { tag: "verify-seo-18-anon" });
for (const p of ["/admin", "/admin/porudzbine", "/admin/pozivnica/abc", "/admin/pozivnica/xyz123456789", "/styleguide"]) {
  const res = await anon.request.get(BASE + p, { maxRedirects: 0 });
  const html = await res.text();
  out.anonymous.push({
    path: p,
    status: res.status(),
    location: res.headers()["location"] ?? null,
    xRobots: res.headers()["x-robots-tag"] ?? null,
    robotsMeta: meta(html),
  });
}
const robots = await anon.request.get(`${BASE}/robots.txt`);
out.robotsTxt = await robots.text();
await anon.close();

// Owner.
const ctx = await newContext(browser, { tag: "verify-seo-18-owner" });
const page = await ctx.newPage();
await loginAdmin(page);
for (const p of [
  "/admin",
  "/admin/porudzbine",
  "/admin/porudzbine/SK-2026-000092",
  "/admin/porudzbine/SK-2026-000092/predracun",
  "/admin/porudzbine/SK-2026-000092/otpremnica",
  "/admin/upiti",
  "/admin/proizvodi",
  "/admin/uvoz",
  "/admin/izvori",
  "/admin/podesavanja?tab=seo",
  "/admin/privatnost",
  "/admin/pozivnica/abc",
  "/admin/izvoz/kupci.csv",
  "/nalog",
  "/styleguide",
]) {
  const res = await page.request.get(BASE + p, { maxRedirects: 0 });
  const ct = res.headers()["content-type"] ?? "";
  const body = ct.includes("html") ? await res.text() : "";
  out.owner.push({
    path: p,
    status: res.status(),
    contentType: ct.split(";")[0],
    xRobots: res.headers()["x-robots-tag"] ?? null,
    robotsMeta: meta(body),
  });
}
await browser.close();

const dir = path.resolve("docs/qa/audit/verify/seo");
mkdirSync(dir, { recursive: true });
writeFileSync(path.join(dir, "seo-18-reproduce.json"), JSON.stringify(out, null, 1));
console.table(out.anonymous);
console.table(out.owner);
console.log(out.robotsTxt);
