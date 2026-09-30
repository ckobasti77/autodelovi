// Independent verification of vis-admin-01 (dashboard overflow at phone/tablet widths).
import { writeFileSync } from "node:fs";
import { BASE, launch, newContext, watch, loginAdmin, shot } from "./kit.mjs";

const out = {};
const browser = await launch("chromium");
const sizes = [
  { tag: "390", width: 390, height: 844 },
  { tag: "768", width: 768, height: 1024 },
  { tag: "360", width: 360, height: 780 },
  { tag: "1023", width: 1023, height: 768 },
  { tag: "1024", width: 1024, height: 768 },
  { tag: "1280", width: 1280, height: 800 },
];
for (const s of sizes) {
  const ctx = await newContext(browser, { width: s.width, height: s.height, tag: `ver-va01-${s.tag}` });
  const page = await ctx.newPage();
  const log = watch(page);
  for (let i = 0; i < 3; i++) { try { await loginAdmin(page); break; } catch (e) { console.log("login retry", i, String(e).slice(0, 100)); } }
  await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  const m = await page.evaluate(async () => {
    const de = document.documentElement;
    const vw = de.clientWidth;
    const r = {
      vw,
      docW: de.scrollWidth,
      bodyW: document.body.scrollWidth,
      htmlOverflowX: getComputedStyle(de).overflowX,
      bodyOverflowX: getComputedStyle(document.body).overflowX,
    };
    window.scrollTo({ left: 420, top: 0 });
    await new Promise((res) => setTimeout(res, 300));
    r.scrollXAfter = window.scrollX;
    window.scrollTo({ left: 0, top: 0 });
    // Find sections by heading
    const secs = [...document.querySelectorAll("main section, main h2")].map((e) => e.closest("section") || e);
    const uniq = [...new Set(secs)];
    r.sections = uniq.map((sec) => {
      const b = sec.getBoundingClientRect();
      const h = sec.querySelector("h2,h3");
      return { title: h?.textContent?.trim().slice(0, 40), left: Math.round(b.left), right: Math.round(b.right), width: Math.round(b.width) };
    });
    // queue rows: right column
    const queueHeading = [...document.querySelectorAll("main h2, main h3")].find((h) => /Red čekanja/.test(h.textContent));
    const queueSec = queueHeading?.closest("section");
    const rows = queueSec ? [...queueSec.querySelectorAll("li > a")] : [];
    r.queueRows = rows.slice(0, 4).map((a) => {
      const right = a.lastElementChild.getBoundingClientRect();
      const left = a.firstElementChild.getBoundingClientRect();
      return {
        text: a.textContent.replace(/\s+/g, " ").trim().slice(0, 120),
        leftCol: [Math.round(left.left), Math.round(left.right)],
        rightCol: [Math.round(right.left), Math.round(right.right)],
        rightVisible: right.right <= vw && right.left < vw,
      };
    });
    // Grid container of the queue
    const grid = queueSec?.parentElement;
    if (grid) {
      const cs = getComputedStyle(grid);
      r.queueGrid = { cls: grid.className, gridTemplateColumns: cs.gridTemplateColumns, width: Math.round(grid.getBoundingClientRect().width) };
    }
    // offenders: widest elements extending past vw
    r.offenders = [...document.querySelectorAll("main *")]
      .filter((e) => e.getBoundingClientRect().right > vw + 1)
      .map((e) => ({ tag: e.tagName.toLowerCase(), cls: String(e.className?.baseVal ?? e.className).slice(0, 60), right: Math.round(e.getBoundingClientRect().right) }))
      .slice(0, 12);
    // chart svg
    const svg = document.querySelector("main svg[role], main figure svg, main svg");
    return r;
  });
  out[s.tag] = { ...m, errors: log.pageErrors.slice(0, 3) };
  console.log(s.tag, JSON.stringify({ docW: m.docW, vw: m.vw, sx: m.scrollXAfter, grid: m.queueGrid, rows: m.queueRows?.slice(0, 2) }));
  if (["390", "768", "360"].includes(s.tag)) {
    const h = page.locator("main h2, main h3").filter({ hasText: "Red čekanja" }).first();
    await h.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, -60));
    await page.waitForTimeout(400);
    await shot(page, `verify/vis-admin/vis-admin-01-reproduce-${s.tag}-queue`);
  }
  if (s.tag === "1024") {
    const h = page.locator("main h2, main h3").filter({ hasText: "Red čekanja" }).first();
    await h.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await shot(page, `verify/vis-admin/vis-admin-01-reproduce-${s.tag}-queue`);
  }
  await ctx.close();
}
writeFileSync("docs/qa/audit/verify/vis-admin/vis-admin-01-reproduce.json", JSON.stringify(out, null, 2));
await browser.close();
