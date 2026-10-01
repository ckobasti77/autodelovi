/**
 * admin-lists-shell (step 22): finds what widens the document on /admin/upiti at phone widths.
 *   AUDIT_BASE=http://localhost:3001 node scripts/qa/fix/admin-lists-shell-docover.mjs [path] [width]
 */
import { BASE, launch, newContext, loginAdmin } from "../audit/kit.mjs";

const path = process.argv[2] ?? "/admin/upiti?status=sve";
const width = Number(process.argv[3] ?? 390);
const browser = await launch("chromium");
try {
  const ctx = await newContext(browser, { width, height: 844 });
  const page = await ctx.newPage();
  await loginAdmin(page);
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("main table tbody tr", { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(1200);
  const r = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const over = document.documentElement.scrollWidth - vw;
    const inScroll = (e) => {
      for (let p = e.parentElement; p; p = p.parentElement) {
        const ox = getComputedStyle(p).overflowX;
        if (ox === "auto" || ox === "scroll" || ox === "hidden") return true;
      }
      return false;
    };
    const offenders = [...document.querySelectorAll("body *")]
      .filter((e) => e.getBoundingClientRect().right > vw + 1 && (!inScroll(e) || ["absolute", "fixed"].includes(getComputedStyle(e).position)))
      .slice(0, 8)
      .map((e) => `${e.tagName.toLowerCase()}.${String(e.className).slice(0, 90)} r=${Math.round(e.getBoundingClientRect().right)} pos=${getComputedStyle(e).position} txt=${(e.textContent || "").slice(0, 40)}`);
    return { over, offenders };
  });
  console.log(JSON.stringify(r, null, 1));
  await ctx.close();
} finally {
  await browser.close();
}
