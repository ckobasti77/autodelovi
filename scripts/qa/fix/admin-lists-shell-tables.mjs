/**
 * admin-lists-shell (step 22): VIS-15 table width budgets + VIS-14 dashboard reflow.
 * Measures the DataTable wrapper overflow (scrollWidth - clientWidth), every header's extent
 * against the sticky right column and the document's horizontal overflow.
 *   AUDIT_BASE=http://localhost:3001 node scripts/qa/fix/admin-lists-shell-tables.mjs [label]
 */
import { writeFileSync } from "node:fs";
import { BASE, launch, newContext, loginAdmin } from "../audit/kit.mjs";

const label = process.argv[2] ?? "after";
const sizes = [
  { tag: "2560", width: 2560, height: 1440 },
  { tag: "1920", width: 1920, height: 1080 },
  { tag: "1440", width: 1440, height: 900 },
  { tag: "1366", width: 1366, height: 768 },
  { tag: "1280", width: 1280, height: 800 },
  { tag: "1024", width: 1024, height: 768 },
  { tag: "768", width: 768, height: 1024 },
  { tag: "390", width: 390, height: 844 },
];
const routes = [
  { key: "upiti", path: "/admin/upiti?status=sve" },
  { key: "proizvodi", path: "/admin/proizvodi" },
  { key: "porudzbine", path: "/admin/porudzbine" },
  { key: "porudzbine-sve", path: "/admin/porudzbine?status=sve" },
  { key: "mejlovi", path: "/admin/mejlovi" },
  { key: "dashboard", path: "/admin", dashboard: true },
];
const out = {};
const browser = await launch("chromium");
try {
  for (const s of sizes) {
    const ctx = await newContext(browser, { width: s.width, height: s.height });
    const page = await ctx.newPage();
    await loginAdmin(page);
    out[s.tag] = {};
    for (const r of routes) {
      try {
        await page.goto(`${BASE}${r.path}`, { waitUntil: "domcontentloaded" });
        if (r.dashboard) await page.waitForTimeout(3500);
        else await page.waitForSelector("main table tbody tr[data-row]", { timeout: 25000 });
        await page.waitForTimeout(800);
        const m = await page.evaluate((dash) => {
          const docOver = document.documentElement.scrollWidth - document.documentElement.clientWidth;
          if (dash) {
            const wide = [...document.querySelectorAll("main section, main li")]
              .filter((e) => e.getBoundingClientRect().right > window.innerWidth + 1)
              .slice(0, 4)
              .map((e) => `${e.tagName}.${(e.className || "").toString().slice(0, 40)} r=${Math.round(e.getBoundingClientRect().right)}`);
            return { docOver, wide };
          }
          const table = document.querySelector("main table");
          const wrap = table.parentElement;
          const ths = [...table.querySelectorAll("thead th")];
          const sticky = ths.filter((t) => getComputedStyle(t).position === "sticky" && getComputedStyle(t).right !== "auto");
          const wr = wrap.getBoundingClientRect();
          const stickyLeft = sticky.length ? Math.min(...sticky.map((t) => t.getBoundingClientRect().left)) : wr.right;
          const cols = ths.map((t) => {
            const b = t.getBoundingClientRect();
            const name = (t.textContent || "").trim().slice(0, 14) || "·";
            return `${name}:${Math.round(b.width)}${b.right > stickyLeft + 1 && !sticky.includes(t) ? "(CUT)" : ""}`;
          });
          const hint = [...wrap.parentElement.querySelectorAll(":scope > span[aria-hidden='true']")].map((x) => {
            const b = x.getBoundingClientRect();
            return [Math.round(b.left), Math.round(b.right)];
          });
          return { over: wrap.scrollWidth - wrap.clientWidth, docOver, cols: cols.join(" "), hint, stickyLeft: Math.round(stickyLeft) };
        }, Boolean(r.dashboard));
        out[s.tag][r.key] = m;
        console.log(s.tag, r.key, JSON.stringify(m));
      } catch (e) {
        out[s.tag][r.key] = { error: String(e).slice(0, 160) };
        console.log(s.tag, r.key, "ERR", String(e).slice(0, 160));
      }
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}
writeFileSync(`docs/qa/fix/admin-lists-shell/tables-${label}.json`, JSON.stringify(out, null, 2));
