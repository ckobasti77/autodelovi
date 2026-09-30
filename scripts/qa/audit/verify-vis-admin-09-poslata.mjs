// verify vis-admin-09 scope: order transition dialog with an autoFocus input opened from the primary BUTTON (no menu).
import { writeFileSync } from "node:fs";
import { BASE, launch, newContext, shot } from "./kit.mjs";
const browser = await launch();
const ctx = await newContext(browser, { width: 1440, height: 900, tag: "verify-va09-poslata" });
const page = await ctx.newPage();
await page.goto(`${BASE}/prijava?next=%2Fadmin`, { waitUntil: "domcontentloaded", timeout: 180000 });
await page.waitForFunction(() => { const f = document.querySelector("[data-testid=auth-email]")?.closest("form"); return !!f && Object.keys(f).some((k) => k.startsWith("__reactProps")); }, null, { timeout: 180000 });
await page.getByTestId("auth-email").fill(process.env.SEED_ADMIN_EMAIL);
await page.getByTestId("auth-password").fill(process.env.SEED_ADMIN_PASSWORD);
await page.getByTestId("auth-submit").click();
await page.waitForURL((u) => u.pathname.startsWith("/admin"), { timeout: 180000 });
await page.goto(`${BASE}/admin/porudzbine?status=potvrdjena`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForTimeout(3500);
const numbers = await page.evaluate(() => [...new Set((document.querySelector("main")?.innerText.match(/SK-\d{4}-\d{6}/g) ?? []))]);
const out = { numbers, tried: [] };
for (const n of numbers.slice(0, 8)) {
  await page.goto(`${BASE}/admin/porudzbine/${n}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  const prim = page.locator("[data-testid=admin-order-transition-poslata]");
  await page.locator("[data-testid^=admin-order-transition-]").first().waitFor({ timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1200);
  if (!(await prim.count())) { out.tried.push({ n, poslata: false }); continue; }
  await page.evaluate(() => { window.__seq = []; document.addEventListener("focusin", (e) => window.__seq.push(`${e.target.tagName}${e.target.getAttribute("aria-label") ? `[${e.target.getAttribute("aria-label")}]` : ""} ${e.target.getAttribute("data-testid") ?? ""}`), true); });
  await prim.click();
  await page.getByRole("alertdialog").waitFor({ timeout: 10000 });
  await page.waitForTimeout(1000);
  out.order = n;
  out.seq = await page.evaluate(() => window.__seq);
  out.active = await page.evaluate(() => ({ tag: document.activeElement?.tagName, label: document.activeElement?.getAttribute("aria-label"), testid: document.activeElement?.getAttribute("data-testid") }));
  out.shot = await shot(page, "verify/vis-admin/vis-admin-09-reproduce-poslata-button");
  await page.getByRole("alertdialog").getByRole("button", { name: "Odustani" }).click();
  await page.waitForTimeout(600);
  out.closed = (await page.getByRole("alertdialog").count()) === 0;
  break;
}
writeFileSync("docs/qa/audit/verify/vis-admin/vis-admin-09-reproduce-poslata.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
await browser.close();
