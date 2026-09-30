// a11y-app: discover admin routes and first detail links for the axe sweep.
import { writeFileSync } from "node:fs";
import { BASE, launch, newContext, loginAdmin } from "./kit.mjs";

const browser = await launch();
const ctx = await newContext(browser, { width: 1440, height: 900, tag: "a11y-app-disc" });
const page = await ctx.newPage();
await loginAdmin(page);
await page.waitForTimeout(2000);
const nav = await page.evaluate(() =>
  [...document.querySelectorAll("a[href^='/admin']")].map((a) => ({ href: a.getAttribute("href"), text: a.textContent.trim().slice(0, 40) })),
);
const out = { nav };
const lists = ["/admin/porudzbine", "/admin/upiti", "/admin/proizvodi", "/admin/kupci", "/admin/majstori", "/admin/uvoz/istorija", "/admin/mejlovi"];
for (const l of lists) {
  await page.goto(BASE + l, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  out[l] = await page.evaluate((l) => {
    const re = new RegExp("^" + l.replace("/istorija", "") + "/[^/?]+$");
    return [...new Set([...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")).filter((h) => re.test(h)))].slice(0, 6);
  }, l);
}
writeFileSync("docs/qa/audit/a11y-app/discover.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 1));
await browser.close();
