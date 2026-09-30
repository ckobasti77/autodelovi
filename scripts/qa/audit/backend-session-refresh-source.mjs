/**
 * Step 21 audit (backend): which request rotates the Convex Auth cookies on a signed-in page load?
 * Records every response that sets __convexAuthJWT (URL, method, status) — no cookie values.
 * Output: docs/qa/audit/backend/session-refresh-source.json
 */
import { readFileSync, writeFileSync } from "node:fs";
import { BASE, launch, loginWith, newContext } from "./kit.mjs";
const acc = JSON.parse(readFileSync(".playwright/audit-accounts.json", "utf8"));
const browser = await launch("chromium");
const context = await newContext(browser, { width: 1440, height: 900, tag: "backend-session2" });
const page = await context.newPage();
const setters = [];
let phase = "login";
page.on("response", async (r) => {
  try {
    const h = await r.headersArray();
    const sets = h.filter((x) => x.name.toLowerCase() === "set-cookie" && /convexAuthJWT/.test(x.value));
    if (sets.length) setters.push({ phase, method: r.request().method(), url: r.url().replace(BASE, ""), status: r.status(), type: r.request().resourceType(), clearing: sets.some((s) => /convexAuthJWT=;|Max-Age=0|expires=Thu, 01 Jan 1970/i.test(s.value)) });
  } catch {}
});
try {
  await loginWith(page, acc.customer.email, acc.customer.password, "/nalog");
  for (const p of ["/delovi", "/nalog/porudzbine", "/"]) {
    await new Promise((r) => setTimeout(r, 2500));
    phase = `GET ${p}`;
    await page.goto(`${BASE}${p}`, { waitUntil: "networkidle" });
  }
} finally {
  await browser.close();
}
writeFileSync("docs/qa/audit/backend/session-refresh-source.json", JSON.stringify(setters, null, 2));
console.log(JSON.stringify(setters, null, 2));
