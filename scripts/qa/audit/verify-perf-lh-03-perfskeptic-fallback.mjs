// Step 21 audit — perf-lh-03 skeptic: why next/font's Martian Mono fallback reflows, and whether a
// monospace fallback calibrated on the real advance width would. Layout only (no timing).
//
//   node scripts/qa/audit/verify-perf-lh-03-perfskeptic-fallback.mjs
import { writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

import { BASE, newContext, shot } from "./kit.mjs";

const PATH = "/vozila/volkswagen/golf/golf-7";
const browser = await chromium.launch();
const result = {};
try {
  const context = await newContext(browser, { width: 412, height: 823, mobile: true, tag: "perfskeptic-lh03fb" });
  const page = await context.newPage();
  await page.goto(`${BASE}${PATH}`, { waitUntil: "load", timeout: 90000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1500);
  Object.assign(
    result,
    await page.evaluate(async () => {
      const raf = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      // Advance width per em at 100 px, and cap height, for a family.
      const probe = (family, text) => {
        const s = document.createElement("span");
        s.style.cssText = `font-family:${family};font-size:100px;font-weight:400;letter-spacing:0;white-space:pre;position:absolute;left:-9999px;top:0;line-height:1`;
        s.textContent = text;
        document.body.append(s);
        const w = s.getBoundingClientRect().width / text.length / 100;
        s.remove();
        return +w.toFixed(4);
      };
      const fams = {
        martian: '"Martian Mono"',
        nextFallback: '"Martian Mono Fallback"',
        courierNew: '"Courier New"',
      };
      const adv = {};
      for (const [k, f] of Object.entries(fams)) {
        adv[k] = { caps: probe(f, "CUAADFHACHZDKLA"), digits: probe(f, "0123456789"), lower: probe(f, "etaoinshrdlu") };
      }
      const calib = +(adv.martian.caps / adv.courierNew.caps * 100).toFixed(2);
      const ff = new FontFace("MMCal", 'local("Courier New")', { sizeAdjust: `${calib}%` });
      await ff.load();
      document.fonts.add(ff);
      const geo = () => {
        const nav = document.querySelector('nav[aria-label="Motor"]');
        return {
          navH: Math.round(nav.getBoundingClientRect().height),
          codes: [...nav.querySelectorAll(".type-code-s")].map((e) => Math.round(e.getBoundingClientRect().width)),
        };
      };
      const swap = async (css) => {
        const st = document.createElement("style");
        st.textContent = css;
        document.head.append(st);
        await raf();
        const before = geo();
        const entries = [];
        const po = new PerformanceObserver((l) => entries.push(...l.getEntries()));
        po.observe({ type: "layout-shift" });
        st.remove();
        await raf();
        await new Promise((r) => setTimeout(r, 120));
        po.disconnect();
        return { fallback: before, loaded: geo(), cls: +entries.reduce((t, e) => t + e.value, 0).toFixed(4) };
      };
      scrollTo(0, 0);
      return {
        advancePerEm: adv,
        calibratedSizeAdjust: calib,
        currentFallback: await swap('html{--nf-mono:"Martian Mono Fallback" !important}'),
        calibratedMonoFallback: await swap('html{--nf-mono:"MMCal" !important}'),
      };
    }),
  );
  console.log(JSON.stringify(result, null, 1));
  await page.addStyleTag({ content: 'html{--nf-mono:"Martian Mono Fallback" !important}' });
  await page.waitForTimeout(200);
  await shot(page, "verify/perf-lh/perf-lh-03-perfskeptic-412-next-fallback", { clip: { x: 0, y: 340, width: 412, height: 480 } });
  await context.close();
} finally {
  await browser.close();
}
writeFileSync("docs/qa/audit/verify/perf-lh/perf-lh-03-perfskeptic-fallback.json", JSON.stringify({ base: BASE, path: PATH, ...result }, null, 1));
