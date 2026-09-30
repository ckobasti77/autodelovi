/**
 * a11y-store: product-card focus ring capture, placeholder contrast, 390 filter sheet tab order
 * through every checkbox, legal-table scroll regions (axe), product document title.
 *   node scripts/qa/audit/a11y-store-misc.mjs
 */
import { writeFileSync } from "node:fs";
import { launch, newContext, shot, axe, BASE } from "./kit.mjs";

const rec = {};
const note = (k, v) => {
  rec[k] = v;
  console.log("--", k, JSON.stringify(v).slice(0, 1500));
};
const go = async (page, url) => {
  await page.goto(BASE + url, { waitUntil: "domcontentloaded", timeout: 240000 });
  await page.waitForLoadState("load", { timeout: 120000 }).catch(() => {});
  await page.waitForTimeout(2500);
};
const browser = await launch();

// (a) card focus ring at 1440
{
  const ctx = await newContext(browser, { width: 1440, height: 900, tag: "a11ymisc1" });
  const page = await ctx.newPage();
  await go(page, "/delovi/kocioni-diskovi");
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press("Tab");
    await page.waitForTimeout(60);
    if (await page.evaluate(() => /\/deo\//.test(document.activeElement?.getAttribute("href") || ""))) break;
  }
  const r = await page.evaluate(() => {
    const el = document.activeElement;
    const card = el.closest("article, li") || el.parentElement;
    const b = card.getBoundingClientRect();
    return { name: el.textContent.trim().slice(0, 40), box: [b.x, b.y, b.width, b.height] };
  });
  note("card focused", r);
  const [x, y, w, h] = r.box;
  note("card shot", await shot(page, "a11y-store/card-focus-1440", { clip: { x: Math.max(0, x - 12), y: Math.max(0, y - 12), width: w + 24, height: Math.min(h + 24, 880) } }));
  // product title
  await go(page, "/deo/kocioni-disk-prednji-276-24-mm-demo-0004");
  note("product title", await page.title());
  // placeholder contrast on home, checkout, inquiry
  const ph = async () =>
    page.evaluate(() => {
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
      const bgOf = (n) => {
        for (; n; n = n.parentElement) {
          const c = parse(getComputedStyle(n).backgroundColor);
          if (c && c.a > 0.5) return c;
        }
        return { r: 13, g: 15, b: 17 };
      };
      return [...document.querySelectorAll("input[placeholder], textarea[placeholder]")]
        .filter((i) => i.getBoundingClientRect().height > 0)
        .map((i) => {
          const c = parse(getComputedStyle(i, "::placeholder").color);
          const bg = bgOf(i);
          const mix = c.a < 1 ? { r: c.r * c.a + bg.r * (1 - c.a), g: c.g * c.a + bg.g * (1 - c.a), b: c.b * c.a + bg.b * (1 - c.a) } : c;
          const [a, b] = [lum(mix), lum(bg)].sort((m, n) => n - m);
          return `${i.id || i.name || i.type} "${i.placeholder.slice(0, 30)}" ${getComputedStyle(i, "::placeholder").color} on rgb(${bg.r},${bg.g},${bg.b}) = ${(((a + 0.05) / (b + 0.05))).toFixed(2)}:1`;
        });
    });
  await go(page, "/");
  note("placeholder home", await ph());
  await go(page, "/upit");
  note("placeholder upit", await ph());
  await ctx.close();
}

// (c) filter sheet 390 tab order
{
  const ctx = await newContext(browser, { width: 390, height: 844, tag: "a11ymisc2" });
  const page = await ctx.newPage();
  await go(page, "/delovi/kocioni-diskovi");
  const trig = page.getByRole("button", { name: "Filteri" }).first();
  await trig.focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1500);
  const seq = [];
  for (let i = 0; i < 24; i++) {
    await page.keyboard.press("Tab");
    await page.waitForTimeout(60);
    seq.push(
      await page.evaluate(() => {
        const e = document.activeElement;
        const lab = e.getAttribute("aria-label") || (e.getAttribute("aria-labelledby") || "").split(" ").map((id) => document.getElementById(id)?.textContent || "").join(" ") || e.labels?.[0]?.textContent || e.textContent;
        return `${e.tagName.toLowerCase()}[${e.getAttribute("role") || e.type || ""}] ${lab.replace(/\s+/g, " ").trim().slice(0, 40)}`;
      }),
    );
  }
  note("filter390 tab seq", seq);
  note("filter390 checkboxes", await page.evaluate(() => [...document.querySelectorAll("[role=dialog] [role=checkbox], [role=dialog] input[type=checkbox]")].map((c) => `${c.tagName} tabindex=${c.tabIndex} hidden=${!!c.closest("[aria-hidden=true]")} ${Math.round(c.getBoundingClientRect().width)}x${Math.round(c.getBoundingClientRect().height)}`)));
  await ctx.close();
}

// (d) legal tables at 390
{
  const ctx = await newContext(browser, { width: 390, height: 844, tag: "a11ymisc3" });
  const page = await ctx.newPage();
  for (const r of ["/kolacici", "/dostava-i-placanje", "/politika-privatnosti"]) {
    await go(page, r);
    note(`axe390 ${r}`, (await axe(page)).map((v) => `${v.id} x${v.nodes} ${v.targets.join(" | ")}`));
    note(`scrollers390 ${r}`, await page.evaluate(() => [...document.querySelectorAll("main .overflow-x-auto")].map((d) => `sw${d.scrollWidth}/cw${d.clientWidth} tabindex=${d.getAttribute("tabindex")} role=${d.getAttribute("role")} label=${d.getAttribute("aria-label")}`)));
  }
  const t = page.locator("main .overflow-x-auto").first();
  if (await t.count()) note("table shot", await shot(page, "a11y-store/legal-table-390", { locator: t }));
  await ctx.close();
}
writeFileSync("docs/qa/audit/a11y-store/misc.json", JSON.stringify(rec, null, 1));
await browser.close();
