// a11y-app: stale-session repro. Loads admin routes with a storage state whose refresh token has been
// rotated by later use (docs/qa/audit/a11y-app/state/admin.json after the sweep) and records status codes.
import { readFileSync, writeFileSync } from "node:fs";
import { BASE, launch, shot } from "./kit.mjs";
const state = JSON.parse(readFileSync("docs/qa/audit/a11y-app/state/admin.json", "utf8"));
const browser = await launch();
const out = [];
for (const route of ["/admin/upiti", "/admin/upiti/UP-2026-000054", "/admin", "/nalog"]) {
  for (let i = 0; i < 2; i++) {
    const ctx = await browser.newContext({ storageState: state, viewport: { width: 1024, height: 768 } });
    const page = await ctx.newPage();
    const statuses = [];
    const errs = [];
    page.on("response", (r) => { if (r.request().isNavigationRequest()) statuses.push(`${r.status()} ${r.url().replace(BASE, "")}`); });
    page.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 160)); });
    await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 180000 }).catch((e) => statuses.push(String(e).slice(0, 80)));
    await page.waitForTimeout(3000);
    const h1 = await page.locator("h1").first().textContent({ timeout: 5000 }).catch(() => null);
    const ev = i === 0 ? await shot(page, `a11y-app/stale-session-${route.replace(/\//g, "_")}`) : null;
    out.push({ route, i, statuses, finalUrl: page.url().replace(BASE, ""), h1, errs: errs.slice(0, 3), ev });
    console.log(route, i, statuses.join(" > "), "| h1:", h1, "|", errs[0] ?? "");
    await ctx.close();
  }
}
writeFileSync("docs/qa/audit/a11y-app/stale-session.json", JSON.stringify(out, null, 2));
await browser.close();
