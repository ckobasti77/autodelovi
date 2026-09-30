/**
 * Step 21 QA audit, track "seo": robots signals on signed-in areas (admin as owner) — X-Robots-Tag
 * header and robots meta on a few admin/account URLs (ROUTES §B2: noindex + X-Robots-Tag).
 *   node scripts/qa/audit/seo-admin-headers.mjs
 */
import { writeFileSync } from "node:fs";
import path from "node:path";

import { BASE, launch, loginAdmin, newContext } from "./kit.mjs";

const browser = await launch("chromium");
const ctx = await newContext(browser, { tag: "seo-admin" });
const page = await ctx.newPage();
await loginAdmin(page);
const out = [];
for (const p of ["/admin", "/admin/porudzbine", "/admin/proizvodi", "/admin/podesavanja?tab=seo", "/nalog", "/admin/porudzbine/SK-2026-000092/predracun"]) {
  const res = await page.request.get(BASE + p, { maxRedirects: 0 });
  const html = await res.text();
  out.push({
    path: p,
    status: res.status(),
    xRobots: res.headers()["x-robots-tag"] ?? null,
    robotsMeta: (html.match(/<meta name="robots" content="([^"]+)"/) ?? [])[1] ?? null,
  });
}
await browser.close();
writeFileSync(path.resolve("docs/qa/audit/seo/admin-headers.json"), JSON.stringify(out, null, 1));
console.table(out);
