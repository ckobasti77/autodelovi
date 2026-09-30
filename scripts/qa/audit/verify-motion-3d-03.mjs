// Independent verification of motion-3d-03 (mobile sticky buy bar stays off-screen).
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { BASE, launch, newContext, watch, shot, AUDIT_DIR } from "./kit.mjs";

const OUT = "verify/motion-3d";
mkdirSync(path.join(AUDIT_DIR, OUT), { recursive: true });
const ROUTE = process.env.ROUTE ?? "/deo/kocioni-disk-prednji-276-24-mm-demo-0004";
const results = [];

async function probe(page) {
  return page.evaluate(() => {
    const bar = [...document.querySelectorAll("div.fixed.bottom-0")].find((d) => d.getAttribute("data-reveal") === "off");
    const box = document.getElementById("buy-box");
    if (!bar) return { bar: null };
    const r = bar.getBoundingClientRect();
    const cs = getComputedStyle(bar);
    return {
      scrollY: Math.round(window.scrollY),
      vh: window.innerHeight,
      buyBoxRect: box ? { top: Math.round(box.getBoundingClientRect().top), bottom: Math.round(box.getBoundingClientRect().bottom) } : null,
      barTop: +r.top.toFixed(1),
      barBottom: +r.bottom.toFixed(1),
      barHeight: +r.height.toFixed(1),
      inlineStyle: bar.getAttribute("style"),
      computedTransform: cs.transform,
      visibility: cs.visibility,
      opacity: cs.opacity,
      display: cs.display,
      ariaHidden: bar.getAttribute("aria-hidden"),
      inert: bar.hasAttribute("inert"),
      visiblePx: Math.max(0, Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0)),
    };
  });
}

async function run({ engine = "chromium", width = 390, height = 844, reducedMotion = "no-preference", mode = "wheel", label }) {
  const browser = await launch(engine);
  const ctx = await newContext(browser, { width, height, reducedMotion, tag: `verify-m3d03-${label}`, engine });
  const page = await ctx.newPage();
  const w = watch(page);
  const rec = { label, engine, width, height, reducedMotion, mode, route: ROUTE };
  try {
    await page.goto(BASE + ROUTE, { waitUntil: "load" });
    await page.waitForTimeout(2500);
    rec.atLoad = await probe(page);
    if (mode === "wheel") {
      await page.mouse.move(width / 2, height / 2);
      for (let i = 0; i < 26; i++) {
        await page.mouse.wheel(0, 50);
        await page.waitForTimeout(40);
      }
    } else {
      await page.evaluate(() => window.scrollTo(0, 1300));
    }
    await page.waitForTimeout(1000);
    rec.after1s = await probe(page);
    await page.waitForTimeout(2000);
    rec.after3s = await probe(page);
    rec.shotPast = await shot(page, `${OUT}/motion-3d-03-reproduce-${label}-past`);
    // Keyboard: focus something near the end of the document then Tab until focus lands in the bar
    const tab = await page.evaluate(() => {
      const bar = [...document.querySelectorAll("div.fixed.bottom-0")].find((d) => d.getAttribute("data-reveal") === "off");
      const f = bar?.querySelector("button, input, a, [tabindex]");
      if (!f) return null;
      f.focus();
      const r = f.getBoundingClientRect();
      return {
        focusedInBar: bar.contains(document.activeElement),
        tag: document.activeElement?.tagName,
        label: document.activeElement?.getAttribute("aria-label") || document.activeElement?.textContent?.trim().slice(0, 40),
        rectTop: +r.top.toFixed(1),
        rectBottom: +r.bottom.toFixed(1),
        vh: window.innerHeight,
      };
    });
    rec.programmaticFocus = tab;
    // Scroll back to top and check the bar hides
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1500);
    rec.backTop = await probe(page);
  } catch (e) {
    rec.error = String(e);
  }
  rec.console = w.errors?.slice?.(0, 5) ?? w;
  results.push(rec);
  console.log(JSON.stringify({ label, after3s: rec.after3s, backTop: rec.backTop, focus: rec.programmaticFocus, error: rec.error }, null, 0));
  await ctx.close();
  await browser.close();
}

const which = process.env.RUNS ?? "base";
if (which === "base") {
  await run({ label: "390-wheel-run1" });
  await run({ label: "390-wheel-run2" });
  await run({ label: "390-scrollto-run3", mode: "scrollTo" });
  await run({ label: "390-reduced", reducedMotion: "reduce" });
} else if (which === "variants") {
  await run({ label: "360-wheel", width: 360, height: 780 });
  await run({ label: "768-wheel", width: 768, height: 1024 });
  await run({ label: "390-webkit", engine: "webkit", mode: "scrollTo" });
  await run({ label: "390-firefox", engine: "firefox", mode: "scrollTo" });
}
const file = path.join(AUDIT_DIR, OUT, `motion-3d-03-reproduce-${which}${process.env.ROUTE ? "-alt" : ""}.json`);
writeFileSync(file, JSON.stringify(results, null, 2));
console.log("saved", file);
