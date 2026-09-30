/**
 * Step 21 audit — verify backend-04: how an unbounded company address (20 000 chars, postcode "ABC")
 * submitted through orders:submit renders in the admin order detail and the inquiries list.
 */
import { writeFileSync } from "node:fs";
import { BASE, launch, newContext, watch, shot, loginAdmin, overflowX } from "./kit.mjs";

const number = process.argv[2] ?? "SK-2026-000102";
const browser = await launch();
const ctx = await newContext(browser, { width: 1440, height: 900, tag: "verify-backend-04" });
const page = await ctx.newPage();
const log = watch(page);
await loginAdmin(page);
await page.goto(`${BASE}/admin/porudzbine/${number}`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
const res = { number };
res.overflow = await overflowX(page);
res.addressBox = await page.evaluate(() => {
  const el = [...document.querySelectorAll("*")].find(
    (e) => e.children.length === 0 && /S{200,}/.test(e.textContent ?? ""),
  );
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { tag: el.tagName, width: Math.round(r.width), height: Math.round(r.height), textLength: el.textContent.length };
});
res.shot = await shot(page, "verify/backend/backend-04-reproduce-order-detail-1440");
await page.evaluate(() => window.scrollTo(0, 0));
const loc = page.getByText(/SSSSSSSSSS/).first();
if (await loc.count()) {
  await loc.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  res.shotAtAddress = await shot(page, "verify/backend/backend-04-reproduce-order-detail-address-1440");
}
res.log = log;
writeFileSync("docs/qa/audit/verify/backend/backend-04-reproduce-shot.json", JSON.stringify(res, null, 2));
console.log(JSON.stringify(res, null, 2));
await browser.close();
