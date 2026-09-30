/**
 * a11y-store: reflow at 320 CSS px (1.4.10) and text-spacing override (1.4.12) on key templates.
 *   node scripts/qa/audit/a11y-store-reflow.mjs
 */
import { writeFileSync } from "node:fs";
import { launch, newContext, scrollThrough, overflowX, shot, BASE } from "./kit.mjs";

const TOKEN = "GVl2SHwvba1nbEDG8VWTGcg0IPXAbHGNXGpzjHnowJw";
const ROUTES = [
  ["home", "/"],
  ["category", "/delovi/kocioni-diskovi"],
  ["product", "/deo/kocioni-disk-prednji-276-24-mm-demo-0004"],
  ["landing", "/ponuda/kocione-plocice-golf"],
  ["search", "/pretraga?q=disk"],
  ["checkout", "/porudzbina"],
  ["inquiry", "/upit"],
  ["status", `/porudzbina/${TOKEN}`],
  ["delivery", "/dostava-i-placanje"],
  ["vehicle", "/vozila/volkswagen/golf/golf-7"],
];
const SPACING = `*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}`;

const clipped = (page) =>
  page.evaluate(() => {
    const out = [];
    for (const e of document.querySelectorAll("body *")) {
      if (!e.offsetParent || e.closest("[aria-hidden=true],canvas,svg")) continue;
      const s = getComputedStyle(e);
      const txt = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!txt) continue;
      const hid = /hidden|clip/.test(s.overflow + s.overflowX + s.overflowY);
      const ell = s.textOverflow === "ellipsis" || s.webkitLineClamp !== "none";
      if ((hid || ell) && (e.scrollWidth > e.clientWidth + 2 || e.scrollHeight > e.clientHeight + 2)) {
        const r = e.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) continue;
        if (e.closest(".sr-only") || s.position === "absolute" && r.width <= 1) continue;
        out.push(`${e.tagName.toLowerCase()}.${String(e.className).split(" ").slice(0, 3).join(".")} "${e.textContent.trim().slice(0, 50)}" sw${e.scrollWidth}/cw${e.clientWidth} sh${e.scrollHeight}/ch${e.clientHeight}${ell ? " ellipsis" : ""}`);
      }
    }
    return out.slice(0, 25);
  });

const browser = await launch();
const res = {};
for (const [tag, route] of ROUTES) {
  const ctx = await newContext(browser, { width: 320, height: 640, tag: "a11yreflow" });
  const page = await ctx.newPage();
  try {
    await page.goto(BASE + route, { waitUntil: "load", timeout: 120000 });
    await page.waitForTimeout(1500);
    await scrollThrough(page, { stepMs: 90 });
    const r = { reflow: await overflowX(page) };
    r.shot320 = await shot(page, `a11y-store/reflow320-${tag}`);
    await page.addStyleTag({ content: SPACING });
    await page.waitForTimeout(500);
    r.spacingOverflow = await overflowX(page);
    r.spacingClipped = await clipped(page);
    r.shotSpacing = await shot(page, `a11y-store/spacing320-${tag}`);
    res[route] = r;
  } catch (e) {
    res[route] = { error: String(e).slice(0, 200) };
  }
  console.log(route, JSON.stringify(res[route]).slice(0, 900));
  await ctx.close();
}
writeFileSync("docs/qa/audit/a11y-store/reflow-spacing-320.json", JSON.stringify(res, null, 1));
await browser.close();
