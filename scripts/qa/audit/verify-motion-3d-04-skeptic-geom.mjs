// Measures the hero ScrollTrigger geometry to see whether the overshoot is scroll rounding.
import { writeFileSync } from "node:fs";
import { BASE, launch, newContext } from "./kit.mjs";
const out = [];
const browser = await launch("chromium");
for (const [w, h, dpr, mobile] of [[1440, 900, 1, false], [1920, 1080, 1, false], [1280, 800, 1, false], [390, 844, 3, true]]) {
  const ctx = await newContext(browser, { width: w, height: h, deviceScaleFactor: dpr, mobile, tag: "v04g" });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/?deo=kocioni-diskovi`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!window.__sklop3d, null, { timeout: 60000 });
  await page.waitForTimeout(5000);
  const g = await page.evaluate(() => {
    const t = document.querySelector('[data-testid="hero-track"]');
    const r = t.getBoundingClientRect();
    const hh = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) || 64;
    const top = r.top + window.scrollY;
    const start = top - hh;
    const end = top + r.height - window.innerHeight;
    const s = window.__sklop3d.getState();
    return { scrollY: window.scrollY, headerH: hh, trackTop: top, trackH: r.height, start, end, len: end - start,
      progress: s.progress, stage: s.stage, timeline: s.timeline,
      computedP: (window.scrollY - start) / (end - start) };
  });
  const endP = g.timeline === "desktop" ? 0.46 : 0.52;
  g.targetY = g.start + endP * g.len;
  g.onePxInP = 1 / g.len;
  out.push({ w, h, dpr, ...g });
  await ctx.close();
}
await browser.close();
writeFileSync("docs/qa/audit/verify/motion-3d/motion-3d-04-skeptic-geom.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 1));
