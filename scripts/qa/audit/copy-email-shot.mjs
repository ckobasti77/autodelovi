// Copy track: screenshots of the admin e-mail gallery plain-text view and the back-in-stock / quote templates.
import { BASE, launch, newContext, loginAdmin, shot } from "./kit.mjs";
const b = await launch();
const ctx = await newContext(b, { width: 1440, height: 900, tag: "copy-email-shot" });
const page = await ctx.newPage();
await loginAdmin(page);
for (const [k, v] of [["quote_ready", "tekst"], ["back_in_stock", "tekst"], ["staff_low_stock", "tekst"], ["quote_ready", ""]]) {
  await page.goto(`${BASE}/admin/mejlovi/sabloni?sablon=${k}${v ? `&prikaz=${v}` : ""}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  console.log(await shot(page, `copy/email-${k}-${v || "html"}`));
  if (v) {
    const tt = await page.evaluate(() => { const p = document.querySelector("pre"); return p ? getComputedStyle(p).textTransform + " | " + p.textContent.slice(0, 120) : "no pre"; });
    console.log(tt);
  }
}
await b.close();
