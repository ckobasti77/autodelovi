// flows-shop-09 on /za-majstore/registracija: PIB/MB messages. Other fields stay empty so the
// client schema blocks the submit (no registration is created).
import { writeFileSync } from "node:fs";
import { BASE, launch, newContext, watch, shot } from "./kit.mjs";

const browser = await launch("chromium");
const ctx = await newContext(browser, { width: 390, height: 844, tag: "vfs09reg" });
const page = await ctx.newPage();
const log = watch(page);
await page.goto(`${BASE}/za-majstore/registracija`, { waitUntil: "networkidle" });
const out = [];
for (const c of [
  { name: "mb-bad-checksum", pib: "154552870", mb: "64552873" },
  { name: "pib-empty-mb-empty", pib: "", mb: "" },
  { name: "pib-8digits", pib: "15455287", mb: "64552872" },
]) {
  await page.getByTestId("mechanic-reg-pib").fill(c.pib);
  await page.getByTestId("mechanic-reg-mb").fill(c.mb);
  await page.getByTestId("mechanic-reg-submit").click();
  await page.waitForTimeout(900);
  const errs = await page.evaluate(() => {
    const r = {};
    for (const id of ["mr-pib", "mr-mb"]) {
      const i = document.getElementById(id);
      r[id] = {
        value: i?.value,
        invalid: i?.getAttribute("aria-invalid"),
        described: (i?.getAttribute("aria-describedby") ?? "")
          .split(/\s+/)
          .map((d) => document.getElementById(d)?.textContent?.trim())
          .filter(Boolean),
      };
    }
    return r;
  });
  out.push({ ...c, errs });
  if (c.name !== "pib-8digits") {
    await page.locator("#mr-pib").scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, -120));
    await page.waitForTimeout(300);
    const box = await page.locator("#mr-pib").boundingBox();
    await shot(page, `verify/flows-shop/flows-shop-09-reproduce-registracija-${c.name}-390`, {
      clip: { x: 0, y: Math.max(0, box.y - 50), width: 390, height: 300 },
    });
  }
}
await browser.close();
writeFileSync("docs/qa/audit/verify/flows-shop/flows-shop-09-reproduce-registracija.json", JSON.stringify({ out, log }, null, 2));
console.log(JSON.stringify({ out, log }, null, 2));
