// Step 22 shell-perf verify round 2: what makes /korpa 379 px wide for the mechanic at 320/360
// (header row itself fits)? Usage: AUDIT_BASE=http://localhost:3001 node docs/qa/fix/shell-perf/verify/r2/korpa-overflow.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { BASE, launch, newContext, loginWith, shot } from "../../../../../../scripts/qa/audit/kit.mjs";

const acc = JSON.parse(readFileSync(".playwright/audit-accounts.json", "utf8"));
const out = {};
const browser = await launch();
try {
  const ctx = await newContext(browser, { width: 360, height: 780, tag: "r2-korpa" });
  const page = await ctx.newPage();
  await loginWith(page, acc.mechanic.email, acc.mechanic.password, "/majstor");
  await page.goto(`${BASE}/korpa`, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(1500);
  out.korpa360 = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const offenders = [...document.querySelectorAll("body *")]
      .filter((e) => e.getBoundingClientRect().right > vw + 1 && e.getClientRects().length)
      .map((e) => {
        const r = e.getBoundingClientRect();
        return {
          el: `${e.tagName.toLowerCase()}${e.getAttribute("data-testid") ? `[data-testid=${e.getAttribute("data-testid")}]` : ""}.${String(e.className).split(" ").slice(0, 4).join(".")}`,
          L: Math.round(r.left),
          R: Math.round(r.right),
          inHeader: !!e.closest("header"),
          text: (e.textContent || "").trim().slice(0, 40),
        };
      })
      .slice(0, 12);
    return { vw, scrollW: document.documentElement.scrollWidth, offenders };
  });
  await shot(page, "../fix/shell-perf/verify/r2/korpa-mechanic-360", { fullPage: false });
  await ctx.close();
} finally {
  await browser.close();
}
writeFileSync("docs/qa/fix/shell-perf/verify/r2/korpa-overflow.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 1));
