/** vis-admin: timing probe for a single admin route (diagnostics for slow navigations). */
import { BASE, launch, newContext, watch, loginAdmin } from "./kit.mjs";
const route = process.argv[2] ?? "/admin/upiti/UP-2026-000054";
const b = await launch();
const ctx = await newContext(b, { width: 1440, height: 900, tag: "vis-admin-probe" });
const page = await ctx.newPage();
const log = watch(page);
page.on("request", (r) => { if (r.isNavigationRequest()) console.log("nav req", r.url()); });
page.on("response", (r) => { if (r.request().isNavigationRequest()) console.log("nav resp", r.status(), r.url()); });
await loginAdmin(page);
if (process.argv[3]) { await page.goto(BASE + process.argv[3]); await page.waitForTimeout(3000); console.log("prev loaded"); }
const t0 = Date.now();
try {
  await page.goto(BASE + route, { waitUntil: "commit", timeout: 60_000 });
  console.log("commit", Date.now() - t0);
  await page.waitForLoadState("domcontentloaded", { timeout: 60_000 });
  console.log("dcl", Date.now() - t0);
} catch (e) {
  console.log("ERR", String(e).slice(0, 200), Date.now() - t0);
}
console.log(JSON.stringify(log));
await b.close();
