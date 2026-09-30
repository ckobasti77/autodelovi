/**
 * xbrowser — does each engine apply the wght axis of the variable UI font (Public Sans 100–900)?
 * Measures the width of the same string at several weights; a variable-font capable engine gives
 * different widths. Also renders a strip for visual comparison.
 */
import { BASE, shot } from "./kit.mjs";
import { ENGINES, launch, saveJson, xctx } from "./xbrowser-lib.mjs";

const out = {};
for (const engine of ENGINES) {
  const browser = await launch(engine);
  const context = await xctx(browser, engine, { tag: "vf" });
  const page = await context.newPage();
  await page.goto(`${BASE}/styleguide`, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  out[engine] = await page.evaluate(async () => {
    const box = document.createElement("div");
    box.id = "vf-test";
    box.setAttribute("data-reveal", "off");
    box.style.cssText = "position:fixed;left:0;top:0;z-index:99999;background:#111;color:#eee;padding:12px;font-size:28px;line-height:1.3";
    const res = {};
    for (const fam of ["var(--font-ui)", "var(--font-mono)"]) {
      for (const w of [100, 300, 400, 600, 700, 900]) {
        const s = document.createElement("div");
        s.style.fontFamily = fam;
        s.style.fontWeight = String(w);
        s.style.whiteSpace = "nowrap";
        s.style.display = "inline-block";
        s.textContent = `Kočione pločice ${w}`;
        box.appendChild(s);
        box.appendChild(document.createElement("br"));
      }
    }
    document.body.appendChild(box);
    await document.fonts.ready;
    await new Promise((r) => setTimeout(r, 500));
    for (const el of box.querySelectorAll("div")) res[`${el.style.fontFamily}|${el.style.fontWeight}`] = Math.round(el.getBoundingClientRect().width * 10) / 10;
    return res;
  });
  await shot(page, `xbrowser/varfont-${engine}`, { clip: { x: 0, y: 0, width: 520, height: 560 } });
  console.log(engine, JSON.stringify(out[engine]));
  await context.close();
  await browser.close();
}
saveJson("varfont.json", out);
