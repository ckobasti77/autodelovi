import { writeFileSync } from "node:fs";
import { BASE, launch, newContext, watch, shot } from "./kit.mjs";

const OUT = "docs/qa/audit/verify/motion-3d";
const ROUTES = [
  "/deo/kocioni-disk-prednji-276-24-mm-demo-0004",
];
const results = [];

async function probe(page) {
  return page.evaluate(() => {
    const bar = [...document.querySelectorAll("div.fixed.bottom-0")].find((d) => d.className.includes("z-sticky"));
    const bb = document.getElementById("buy-box");
    if (!bar) return { bar: null };
    const r = bar.getBoundingClientRect();
    const cs = getComputedStyle(bar);
    const g = bar._gsap || null;
    return {
      scrollY: Math.round(window.scrollY),
      vh: window.innerHeight,
      rect: { top: Math.round(r.top * 10) / 10, bottom: Math.round(r.bottom * 10) / 10, height: Math.round(r.height * 10) / 10 },
      buyBoxRect: bb ? { top: Math.round(bb.getBoundingClientRect().top), bottom: Math.round(bb.getBoundingClientRect().bottom) } : null,
      computedTransform: cs.transform,
      visibility: cs.visibility,
      opacity: cs.opacity,
      inlineStyle: bar.getAttribute("style"),
      ariaHidden: bar.getAttribute("aria-hidden"),
      inert: bar.hasAttribute("inert"),
      gsapCache: g ? { y: g.y, yPercent: g.yPercent } : null,
      visiblePx: Math.max(0, Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0)),
      elementAtBottom: (() => { const e = document.elementFromPoint(195, window.innerHeight - 20); return e ? `${e.tagName.toLowerCase()}.${String(e.className).slice(0, 60)}` : null; })(),
    };
  });
}

const browser = await launch("chromium");
try {
  for (const route of ROUTES) {
    for (const mode of ["wheel-1", "wheel-2", "scrollTo-3", "reduced", "768-wheel"]) {
      const reduced = mode === "reduced";
      const w = mode.startsWith("768") ? 768 : 390;
      const h = w === 768 ? 1024 : 844;
      const ctx = await newContext(browser, { width: w, height: h, reducedMotion: reduced ? "reduce" : "no-preference", tag: `v03-${mode}` });
      const page = await ctx.newPage();
      const log = watch(page);
      await page.goto(BASE + route, { waitUntil: "networkidle" });
      await page.waitForTimeout(1500);
      const before = await probe(page);
      if (mode.startsWith("scrollTo")) {
        await page.evaluate(() => window.scrollTo(0, 1300));
      } else {
        await page.mouse.move(195, 400);
        for (let i = 0; i < 13; i++) { await page.mouse.wheel(0, 100); await page.waitForTimeout(60); }
      }
      await page.waitForTimeout(3000);
      const after = await probe(page);
      await page.waitForTimeout(1000);
      const after2 = await probe(page);
      const img = await shot(page, `verify/motion-3d/motion-3d-03-skeptic-${mode}`);
      // Keyboard: focus after the main content and Tab to see whether focus can land inside the bar
      const focusProbe = await page.evaluate(() => {
        const bar = [...document.querySelectorAll("div.fixed.bottom-0")].find((d) => d.className.includes("z-sticky"));
        const btns = bar ? [...bar.querySelectorAll("button, input, a")] : [];
        const res = btns.map((b) => { b.focus(); const r = b.getBoundingClientRect(); return { tag: b.tagName, label: (b.getAttribute("aria-label") || b.textContent || "").trim().slice(0, 40), focused: document.activeElement === b, top: Math.round(r.top), bottom: Math.round(r.bottom), vh: window.innerHeight }; });
        return res;
      });
      // scroll back up — bar should leave
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(1500);
      const back = await probe(page);
      results.push({ route, mode, width: w, before, after, after2, back, focusProbe, img, errors: { console: log.console, pageErrors: log.pageErrors } });
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}
writeFileSync(`${OUT}/motion-3d-03-skeptic.json`, JSON.stringify(results, null, 2));
for (const r of results) {
  console.log(`${r.mode} w${r.width}: after scrollY=${r.after.scrollY} top=${r.after.rect.top} bottom=${r.after.rect.bottom} vh=${r.after.vh} tf=${r.after.computedTransform} vis=${r.after.visibility} op=${r.after.opacity} aria=${r.after.ariaHidden} inert=${r.after.inert} gsap=${JSON.stringify(r.after.gsapCache)} visiblePx=${r.after.visiblePx} inline="${r.after.inlineStyle}" atBottom=${r.after.elementAtBottom}`);
  console.log(`   +1s top=${r.after2.rect.top}  buyBox=${JSON.stringify(r.after.buyBoxRect)}  focus=${JSON.stringify(r.focusProbe)}`);
  console.log(`   back: top=${r.back.rect.top} vis=${r.back.visibility} aria=${r.back.ariaHidden} inert=${r.back.inert} tf=${r.back.computedTransform}`);
}
