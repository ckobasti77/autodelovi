import { writeFileSync } from "node:fs";
import { BASE, launch, newContext, scrollThrough, shot } from "./kit.mjs";
const browser = await launch();
const results = [];
// sample height + content opacity per animation frame for 700 ms after toggling
const sampleToggle = (page, sel, contentSel) =>
  page.evaluate(async ({ sel, contentSel }) => {
    const target = document.querySelector(sel);
    if (!target) return { error: `no ${sel}` };
    const box = target.closest("details") ?? target.parentElement.parentElement;
    box.scrollIntoView({ block: "center" });
    await new Promise((r) => setTimeout(r, 600));
    const h0 = box.getBoundingClientRect().height;
    const icon = target.querySelector("svg");
    const iconStyle = icon ? getComputedStyle(icon) : null;
    const t0 = performance.now();
    target.click();
    const frames = [];
    await new Promise((resolve) => {
      const tick = () => {
        const t = performance.now() - t0;
        const content = contentSel ? box.querySelector(contentSel) : null;
        frames.push({ t: Math.round(t), h: Math.round(box.getBoundingClientRect().height), op: content ? getComputedStyle(content).opacity : null, rot: icon ? getComputedStyle(icon).transform : null });
        if (t < 700) requestAnimationFrame(tick); else resolve();
      };
      requestAnimationFrame(tick);
    });
    await new Promise((r) => setTimeout(r, 800));
    const h1500 = box.getBoundingClientRect().height;
    const distinctH = [...new Set(frames.map((f) => f.h))];
    return { label: target.textContent.trim().slice(0, 50), h0, firstFrame: frames[0], distinctHeights: distinctH, h1500, framesSampled: frames.length, iconTransition: iconStyle ? `${iconStyle.transitionProperty} ${iconStyle.transitionDuration} ${iconStyle.transitionTimingFunction}` : null, iconFinal: icon ? getComputedStyle(icon).transform : null, gsapTweensOnBox: window.gsap ? "n/a" : "n/a" };
  }, { sel, contentSel });

const cases = [
  { route: "/", sel: "#faq-title ~ div details summary", content: "details > :not(summary)" },
  { route: "/za-majstore", sel: "details summary", content: "details > :not(summary)" },
  { route: "/deo/kocioni-disk-prednji-276-24-mm-demo-0004", sel: "details summary", content: "details > :not(summary)" },
  { route: "/delovi/kocioni-diskovi", sel: "details summary", content: "details > :not(summary)" },
  { route: "/delovi/kocioni-diskovi", sel: "aside h2 button[aria-expanded], h2 > button[aria-expanded]", content: null, desktopOnly: true },
];
for (const [w, h] of [[1440, 900], [390, 844]]) {
  for (const c of cases) {
    if (c.desktopOnly && w < 1024) continue;
    const ctx = await newContext(browser, { width: w, height: h, tag: `v07-${w}` });
    const page = await ctx.newPage();
    await page.goto(`${BASE}${c.route}`, { waitUntil: "load" });
    await page.waitForTimeout(1200);
    await scrollThrough(page, { stepMs: 80 });
    const r = await sampleToggle(page, c.sel, c.content);
    results.push({ width: w, route: c.route, sel: c.sel, ...r });
    if (w === 1440 && c.route === "/") await shot(page, "verify/motion-3d/motion-3d-07-reproduce-faq-open-1440");
    await ctx.close();
  }
}
await browser.close();
writeFileSync("docs/qa/audit/verify/motion-3d/motion-3d-07-reproduce.json", JSON.stringify(results, null, 1));
for (const r of results) console.log(r.width, r.route, "|", r.label ?? r.error, "| h0", r.h0, "first", r.firstFrame?.t + "ms h" + r.firstFrame?.h + " op" + r.firstFrame?.op, "| distinct", JSON.stringify(r.distinctHeights), "| h1500", r.h1500, "| icon", r.iconTransition, r.iconFinal);
