/**
 * copy-14 part 2: home 3D part panel (Kočioni diskovi) and the product page overline above H1.
 *   node scripts/qa/audit/verify-copy-14b.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { BASE, launch, newContext, shot } from "./kit.mjs";

const OUT = "docs/qa/audit/verify/copy/copy-14-reproduce.json";
const res = JSON.parse(readFileSync(OUT, "utf8"));
const b = await launch();

// Home 3D panel at 1440
{
  const ctx = await newContext(b, { width: 1440, height: 900, tag: "verify-copy14-home" });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.getByTestId("parts-list-trigger").click();
  const dialog = page.getByRole("dialog", { name: "Lista delova po sistemima" });
  await dialog.getByRole("button", { name: /^Kočioni diskovi/ }).click();
  const panel = page.getByTestId("part-panel");
  await panel.getByTestId("part-panel-product").first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(1500);
  res.homePanel = await panel
    .getByTestId("part-panel-product")
    .evaluateAll((els) => els.map((e) => e.querySelector("span.truncate")?.textContent + " | " + e.querySelector("a")?.textContent));
  await shot(page, "verify/copy/copy-14-reproduce-home-panel-1440", { locator: panel });
  await ctx.close();
}
// PDP overline above H1 at 390 and 1440
for (const width of [390, 1440]) {
  const ctx = await newContext(b, { width, height: width < 800 ? 844 : 900, tag: `verify-copy14-pdp-${width}` });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/deo/kocioni-disk-prednji-340-30-mm-gti-demo-0005`, { waitUntil: "networkidle" });
  const h1 = page.locator("h1").first();
  await h1.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500);
  res[`pdpOverline${width}`] = await h1.evaluate((e) => e.previousElementSibling?.textContent);
  const box = await h1.locator("xpath=..").boundingBox();
  if (box) {
    await shot(page, `verify/copy/copy-14-reproduce-pdp-${width}`, {
      clip: { x: Math.max(0, box.x - 8), y: Math.max(0, box.y - 8), width: Math.min(box.width + 16, width - box.x + 8), height: Math.min(box.height + 16, 220) },
    });
  }
  await ctx.close();
}
writeFileSync(OUT, JSON.stringify(res, null, 2));
await b.close();
console.log(JSON.stringify({ homePanel: res.homePanel, pdp390: res.pdpOverline390, pdp1440: res.pdpOverline1440 }, null, 1));
