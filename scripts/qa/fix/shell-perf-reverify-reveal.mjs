// Probe: the site-wide reveal still animates word by word (sampled in flight), at 390 and 1440.
import { writeFileSync } from "node:fs";
import { BASE, launch, newContext } from "../audit/kit.mjs";
const browser = await launch();
const out = [];
try {
  for (const width of [390, 1440]) {
    const ctx = await newContext(browser, { width, height: width < 1024 ? 844 : 900, tag: "rvanim" });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/delovi/kocioni-diskovi`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    const samples = [];
    for (let i = 0; i < 12 && samples.length < 3; i += 1) {
      await page.mouse.wheel(0, 500);
      const s = await page
        .waitForFunction(
          () => {
            const el = document.querySelector("[data-reveal-state='running']");
            if (!el) return null;
            const w = el.querySelector(".reveal-word");
            const cs = getComputedStyle(w ?? el);
            return { tag: el.tagName, mode: el.getAttribute("data-reveal-mode"), words: el.querySelectorAll(".reveal-word").length, anim: cs.animationName, dur: cs.animationDuration, delay: cs.animationDelay, i: w?.style.getPropertyValue("--i"), n: w?.style.getPropertyValue("--n"), text: el.textContent.trim().slice(0, 40) };
          },
          null,
          { timeout: 1500, polling: 16 },
        )
        .then((h) => h.jsonValue())
        .catch(() => null);
      if (s) samples.push(s);
    }
    out.push({ width, samples });
    await ctx.close();
  }
} finally {
  await browser.close();
}
writeFileSync("docs/qa/fix/shell-perf/verify/reveal-in-flight.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 1));
