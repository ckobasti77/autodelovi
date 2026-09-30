// motion-3d: keyboard Tab through the hero — does focusing hero controls scroll the page (and
// explode the car) on its own? Records scrollY / progress after every Tab. 1440 and 1024.
import { writeFileSync } from "node:fs";
import { BASE, launch, newContext, shot } from "./kit.mjs";

const browser = await launch();
const out = [];
for (const vp of [
  { tag: "1440", width: 1440, height: 900 },
  { tag: "1280", width: 1280, height: 800 },
]) {
  const ctx = await newContext(browser, { width: vp.width, height: vp.height, tag: `m3d-tab-${vp.tag}` });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: "load", timeout: 90_000 });
  await page.waitForTimeout(1200);
  const rows = [];
  for (let i = 0; i < 26; i++) {
    await page.keyboard.press("Tab");
    await page.waitForTimeout(450);
    const r = await page.evaluate(() => {
      const a = document.activeElement;
      const s = window.__sklop3d?.getState();
      const rect = a?.getBoundingClientRect();
      return {
        el: `${a?.tagName.toLowerCase()} "${(a?.getAttribute("aria-label") || a?.textContent || a?.getAttribute("placeholder") || "").trim().slice(0, 32)}"`,
        scrollY: Math.round(scrollY),
        progress: s ? +s.progress.toFixed(3) : null,
        stage: s?.stage,
        status: s?.status,
        rectY: rect ? Math.round(rect.y) : null,
        inViewport: rect ? rect.top >= 0 && rect.bottom <= innerHeight : null,
      };
    });
    rows.push(r);
    console.log(vp.tag, i, JSON.stringify(r));
    if (/Rasklopi|Sklopi/.test(r.el)) await shot(page, `motion-3d/tab-${vp.tag}-at-toggle`);
    if (r.el.includes("Lista delova")) break;
  }
  out.push({ vp: vp.tag, rows });
  await ctx.close();
}
await browser.close();
writeFileSync("docs/qa/audit/motion-3d/tab-scroll.json", JSON.stringify(out, null, 2));
