/** cart-mechanic-overlays: PERF-04 (picker chunk not fetched before intent) and FLOW-37 (unknown price-list slugs → 400). */
import { BASE, launch, newContext } from "../audit/kit.mjs";
import { loginMechanic } from "../audit/flows-import-mech-lib.mjs";
const browser = await launch();
try {
  const ctx = await newContext(browser, { width: 1440, height: 900, tag: "fix-perf" });
  const page = await ctx.newPage();
  const picker = [];
  // Turbopack dev chunk names are hashed: count JS chunk requests per phase instead.
  page.on("request", (r) => { if (r.url().includes("/_next/static/chunks/") && r.url().endsWith(".js")) picker.push(r.url().split("/").pop()); });
  await page.goto(`${BASE}/delovi/kocioni-diskovi`, { waitUntil: "load" });
  await page.waitForTimeout(6000);
  await page.waitForTimeout(4000);
  const idle = picker.length;
  console.log("PERF-04 JS chunks by load + 10 s idle:", idle);
  await page.locator("[data-testid=vehicle-picker-trigger]:visible").first().hover();
  await page.waitForTimeout(2500);
  console.log("PERF-04 new JS chunks after hovering the picker trigger:", picker.length - idle, picker.slice(idle));
  await loginMechanic(page, "/majstor");
  const bad = await page.request.get(`${BASE}/majstor/cenovnik/preuzmi?kategorije=nepostoji-kategorija`);
  console.log("FLOW-37 unknown slug:", bad.status(), (await bad.text()).slice(0, 90));
  await ctx.close();
} finally {
  await browser.close();
}
