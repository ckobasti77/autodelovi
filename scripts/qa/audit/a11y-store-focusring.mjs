/**
 * a11y-store: focus indicator audit by Tab walk — indicator present (outline / box-shadow / ::after),
 * indicator colour contrast vs the adjacent background (>= 3:1, 1.4.11 / 2.4.13 informative),
 * focused element hidden under the sticky header or other fixed chrome (2.4.11), forward and back.
 *   node scripts/qa/audit/a11y-store-focusring.mjs <width>
 */
import { writeFileSync } from "node:fs";
import { launch, newContext, shot, BASE } from "./kit.mjs";

const width = Number(process.argv[2] ?? 1440);
const height = width < 1024 ? 844 : 900;
const ROUTES = ["/", "/delovi/kocioni-diskovi", "/deo/kocioni-disk-prednji-276-24-mm-demo-0004", "/ponuda/kocione-plocice-golf", "/upit"];

const probe = (page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return null;
    const parse = (c) => {
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
      return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 };
    };
    const lum = ({ r, g, b }) => {
      const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const ratio = (a, b) => {
      const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
      return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100;
    };
    const bgOf = (node) => {
      for (let n = node; n; n = n.parentElement) {
        const c = parse(getComputedStyle(n).backgroundColor);
        if (c && c.a > 0.5) return c;
      }
      return { r: 13, g: 15, b: 17, a: 1 };
    };
    const s = getComputedStyle(el);
    const a = getComputedStyle(el, "::after");
    let ind = null;
    if (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) ind = { kind: "outline", color: s.outlineColor, w: s.outlineWidth, off: s.outlineOffset };
    else if (a.outlineStyle !== "none" && parseFloat(a.outlineWidth) > 0) ind = { kind: "::after outline", color: a.outlineColor, w: a.outlineWidth, off: a.outlineOffset };
    else if (s.boxShadow && s.boxShadow !== "none") ind = { kind: "box-shadow", color: (s.boxShadow.match(/rgba?\([^)]+\)/) || [""])[0], w: s.boxShadow.slice(0, 60) };
    else if (a.boxShadow && a.boxShadow !== "none") ind = { kind: "::after box-shadow", color: (a.boxShadow.match(/rgba?\([^)]+\)/) || [""])[0], w: a.boxShadow.slice(0, 60) };
    else if (el.matches("input,textarea,select")) ind = { kind: "border", color: s.borderColor, w: s.borderWidth };
    const outside = ind && (ind.kind.includes("outline") ? parseFloat(ind.off) >= 0 : true);
    const bg = outside ? bgOf(el.parentElement) : bgOf(el);
    const col = ind && parse(ind.color);
    const r = el.getBoundingClientRect();
    // obscured by fixed/sticky chrome?
    let obscuredBy = null;
    const pts = [[r.left + r.width / 2, r.top + Math.min(r.height / 2, 6)], [r.left + r.width / 2, r.bottom - 3]];
    const hits = pts.map(([x, y]) => (x >= 0 && y >= 0 && x < innerWidth && y < innerHeight ? document.elementFromPoint(x, y) : null));
    const covered = hits.every((h) => h && !el.contains(h) && !h.contains(el));
    if (covered) {
      const h = hits[0];
      const fixed = h.closest("header, [data-testid=consent-banner], [class*=sticky], [class*=fixed]") || h;
      obscuredBy = `${fixed.tagName.toLowerCase()}.${String(fixed.className).split(" ").slice(0, 3).join(".")}`;
    }
    return {
      name: `${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") || el.textContent || el.placeholder || "").replace(/\s+/g, " ").trim().slice(0, 40)}"`,
      rect: [r.left, r.top, r.width, r.height].map(Math.round),
      ind: ind ? `${ind.kind} ${ind.color} ${ind.w}` : "NONE",
      bg: `rgb(${bg.r},${bg.g},${bg.b})`,
      ratio: col ? ratio(col, bg) : null,
      obscuredBy,
    };
  });

const browser = await launch();
const out = {};
for (const route of ROUTES) {
  const ctx = await newContext(browser, { width, height, tag: `a11yfr${width}` });
  const page = await ctx.newPage();
  await page.goto(BASE + route, { waitUntil: "load", timeout: 180000 });
  await page.waitForTimeout(3000);
  const fwd = [];
  for (let i = 0; i < 70; i++) {
    await page.keyboard.press("Tab");
    await page.waitForTimeout(70);
    const p = await probe(page);
    if (p) fwd.push(p);
  }
  // back from the end of the page
  await page.keyboard.press("End");
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(800);
  await page.locator("footer a").last().focus();
  const back = [];
  for (let i = 0; i < 70; i++) {
    await page.keyboard.press("Shift+Tab");
    await page.waitForTimeout(70);
    const p = await probe(page);
    if (p) back.push(p);
    if (p?.obscuredBy && !back.shot) {
      back.shot = await shot(page, `a11y-store/focus-obscured-${width}-${route === "/" ? "home" : route.split("/").filter(Boolean).pop().slice(0, 24)}`);
    }
  }
  const bad = [...fwd, ...back].filter((p) => p.ind === "NONE" || (p.ratio !== null && p.ratio < 3) || p.obscuredBy);
  const uniq = [...new Map(bad.map((b) => [b.name + b.ind + b.obscuredBy, b])).values()];
  out[route] = { stops: fwd.length + back.length, bad: uniq, shot: back.shot ?? null, sampleOk: fwd.slice(0, 4) };
  console.log(route, JSON.stringify(out[route]).slice(0, 2500));
  await ctx.close();
}
writeFileSync(`docs/qa/audit/a11y-store/focusring-${width}.json`, JSON.stringify(out, null, 1));
await browser.close();
