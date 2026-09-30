// motion-3d: 3D explorer on desktop 1440 with a real mouse and keyboard.
// poster → intent → ready/crossfade; hover highlight + cursor; click a part → panel; Escape →
// focus return; explode on wheel scroll; keyboard tab order; parts list dialog; deep links;
// back/forward; route-change cleanup (ScrollTriggers, tweens).
import { writeFileSync } from "node:fs";
import { BASE, launch, newContext, watch, shot } from "./kit.mjs";

const out = { steps: [] };
const note = (k, v) => {
  out.steps.push({ k, v });
  console.log(k, typeof v === "string" ? v : JSON.stringify(v));
};
const browser = await launch();
const ctx = await newContext(browser, { width: 1440, height: 900, tag: "m3d-hero-d" });
const page = await ctx.newPage();
const log = watch(page);
const glb = [];
page.on("request", (r) => {
  if (/\.glb|\.hdr/.test(r.url())) glb.push({ t: Date.now(), url: r.url().replace(BASE, "") });
});
const t0 = Date.now();
await page.goto(`${BASE}/`, { waitUntil: "load" });
await page.waitForTimeout(800);
const st = () => page.evaluate(() => window.__sklop3d?.getState());
note("before-intent", {
  state: await st(),
  canvases: await page.locator('[data-testid="hero-canvas"] canvas').count(),
  glbRequests: glb.length,
  gsapGlobal: await page.evaluate(() => typeof window.gsap),
});

// Keyboard tab order from the top of the document (no intent yet except focus in the hero).
const order = [];
await page.keyboard.press("Tab");
for (let i = 0; i < 40; i++) {
  const info = await page.evaluate(() => {
    const a = document.activeElement;
    if (!a) return null;
    const r = a.getBoundingClientRect();
    const cs = getComputedStyle(a);
    const inHero = !!a.closest('[data-testid="home-hero"]');
    return {
      tag: a.tagName.toLowerCase(),
      name: (a.getAttribute("aria-label") || a.textContent || a.getAttribute("placeholder") || "").trim().slice(0, 40),
      inHero,
      outline: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}`,
      boxShadow: cs.boxShadow.slice(0, 60),
      rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
      visible: r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight,
    };
  });
  order.push(info);
  if (info && !info.inHero && order.some((o) => o?.inHero)) break;
  await page.keyboard.press("Tab");
}
note("tab-order", order.map((o) => o && `${o.inHero ? "H" : "-"} ${o.tag} "${o.name}" vis=${o.visible} ${o.outline}`));
note("after-focus-status", await st());

await page.goto(`${BASE}/`, { waitUntil: "load" });
await page.waitForTimeout(500);
// Intent: pointer over the stage.
const media = page.locator('[data-testid="hero-track"] [role="img"]');
const mb = await media.boundingBox();
const tIntent = Date.now();
await page.mouse.move(mb.x + mb.width * 0.7, mb.y + mb.height * 0.5);
await page.waitForFunction(() => window.__sklop3d?.ready === true, null, { timeout: 120_000 });
note("intent→ready ms (SwiftShader, shared machine)", Date.now() - tIntent);
await page.waitForTimeout(900);
note("crossfade", await page.evaluate(() => ({
  poster: getComputedStyle(document.querySelector('[data-testid="hero-poster"]')).opacity,
  canvas: getComputedStyle(document.querySelector('[data-testid="hero-canvas"]')).opacity,
})));
note("glb requests", glb);

// Hover scan: grid over the car area (right 55 % of the stage).
const hits = {};
let firstHit = null;
for (let gy = 0.35; gy <= 0.8; gy += 0.075) {
  for (let gx = 0.45; gx <= 0.92; gx += 0.05) {
    const x = mb.x + mb.width * gx;
    const y = mb.y + mb.height * gy;
    await page.mouse.move(x, y, { steps: 2 });
    await page.waitForTimeout(160);
    const s = await st();
    if (s.hovered) {
      hits[s.hovered] = (hits[s.hovered] ?? 0) + 1;
      if (!firstHit) {
        const cursor = await page.evaluate(
          ([px, py]) => {
            const el = document.elementFromPoint(px, py);
            return { el: el?.tagName, cursor: getComputedStyle(el).cursor };
          },
          [x, y],
        );
        firstHit = { x, y, hovered: s.hovered, ...cursor };
      }
    }
  }
}
note("hover hits", hits);
note("first hover", firstHit);
if (firstHit) {
  await page.mouse.move(firstHit.x, firstHit.y);
  await page.waitForTimeout(700);
  await shot(page, "motion-3d/hero-d-hover");
  // Callout present?
  note("callout", await page.evaluate(() => {
    const c = document.querySelector('[data-testid="hero-callout"], [role="tooltip"]');
    return c ? c.textContent.trim().slice(0, 120) : null;
  }));
  // Click → select.
  await page.mouse.click(firstHit.x, firstHit.y);
  await page.waitForTimeout(1800);
  const s = await st();
  note("after click", { selected: s.selected, url: page.url().replace(BASE, "") });
  const panel = page.getByTestId("part-panel");
  note("panel visible", await panel.isVisible().catch(() => false));
  await page.waitForTimeout(1500);
  note("panel products", await page.getByTestId("part-panel-product").count());
  note("focus in panel", await page.evaluate(() => {
    const a = document.activeElement;
    return `${a?.tagName} ${(a?.getAttribute("aria-label") || a?.textContent || "").trim().slice(0, 40)} inPanel=${!!a?.closest('[data-testid="part-panel"]')}`;
  }));
  await shot(page, "motion-3d/hero-d-selected");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(900);
  note("after Escape", {
    selected: (await st()).selected,
    url: page.url().replace(BASE, ""),
    active: await page.evaluate(() => {
      const a = document.activeElement;
      const cs = a ? getComputedStyle(a) : null;
      return `${a?.tagName} role=${a?.getAttribute("role")} label=${a?.getAttribute("aria-label")?.slice(0, 40)} outline=${cs?.outlineStyle} ${cs?.outlineWidth} shadow=${cs?.boxShadow?.slice(0, 50)}`;
    }),
  });
  await shot(page, "motion-3d/hero-d-after-escape");
}

// Explode on wheel scroll.
await page.mouse.move(mb.x + mb.width * 0.3, mb.y + 100);
const prog = [];
for (let i = 0; i < 14; i++) {
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(350);
  const s = await st();
  prog.push([Math.round(await page.evaluate(() => scrollY)), +s.progress.toFixed(3), s.stage]);
}
note("wheel explode [scrollY, progress, stage]", prog);
await shot(page, "motion-3d/hero-d-exploded-scroll");
const caption = await page.evaluate(() => document.querySelector('[data-testid="hero-track"] h2, [data-testid="hero-track"] p')?.textContent);
note("caption at end", caption);
// Scroll past the hero and check the stage releases (sticky) and the next section is visible.
await page.evaluate(() => window.scrollTo(0, document.querySelector('[data-testid="hero-track"]').getBoundingClientRect().bottom + scrollY + 50));
await page.waitForTimeout(800);
note("after hero", { progress: (await st()).progress, inView: await page.evaluate(() => document.querySelector('[data-testid="hero-track"]').getBoundingClientRect().bottom) });

// Parts list dialog via keyboard.
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(800);
const trig = page.getByTestId("parts-list-trigger");
await trig.focus();
await page.keyboard.press("Enter");
await page.waitForTimeout(700);
const dlg = page.getByTestId("parts-list-dialog");
note("parts list open", await dlg.isVisible().catch(() => false));
note("parts list focus", await page.evaluate(() => `${document.activeElement?.tagName} ${(document.activeElement?.textContent || "").trim().slice(0, 40)}`));
await shot(page, "motion-3d/hero-d-parts-list");
await page.keyboard.press("Escape");
await page.waitForTimeout(600);
note("parts list Escape focus", await page.evaluate(() => `${document.activeElement?.tagName} ${document.activeElement?.getAttribute("data-testid")} ${(document.activeElement?.textContent || "").trim().slice(0, 40)}`));
// Open again, pick a part with the keyboard, then close the panel with Escape → focus?
await page.keyboard.press("Enter");
await page.waitForTimeout(700);
await page.keyboard.press("Tab");
await page.keyboard.press("Tab");
const picked = await page.evaluate(() => (document.activeElement?.textContent || "").trim().slice(0, 40));
await page.keyboard.press("Enter");
await page.waitForTimeout(2500);
note("picked via keyboard", { picked, selected: (await st()).selected, active: await page.evaluate(() => `${document.activeElement?.tagName} inPanel=${!!document.activeElement?.closest('[data-testid="part-panel"]')}`) });
await page.keyboard.press("Escape");
await page.waitForTimeout(900);
note("panel Escape focus (opened from list)", await page.evaluate(() => `${document.activeElement?.tagName} ${document.activeElement?.getAttribute("data-testid")} ${document.activeElement?.getAttribute("role")} ${(document.activeElement?.textContent || "").trim().slice(0, 30)}`));

// Route change cleanup: ScrollTriggers / tweens before and after client navigation.
const stCount = () =>
  page.evaluate(() => {
    const g = window.gsap;
    const ST = g?.core?.globals?.()?.ScrollTrigger ?? window.ScrollTrigger;
    return {
      triggers: ST?.getAll?.().length ?? null,
      tweens: g ? g.globalTimeline.getChildren(true, true, false).length : null,
    };
  });
note("gsap on home", await stCount());
await page.evaluate(() => window.scrollTo(0, 0));
const link = page.locator('header a[href="/delovi"], a[href="/delovi"]').first();
await link.click();
await page.waitForURL(/\/delovi$/);
await page.waitForTimeout(2500);
note("gsap after client nav to /delovi", await stCount());
await page.goBack();
await page.waitForURL((u) => u.pathname === "/");
await page.waitForTimeout(3000);
note("after back: state", await st());
note("gsap after back", await stCount());
await page.evaluate(() => window.scrollTo(0, 900));
await page.waitForTimeout(1200);
note("after back + scroll 900: progress", (await st()).progress);
await shot(page, "motion-3d/hero-d-back-scroll900");
await page.goForward();
await page.waitForURL(/\/delovi$/);
await page.waitForTimeout(1500);
note("forward ok", page.url().replace(BASE, ""));

// Deep links.
for (const q of ["akumulator", "nepostoji-deo", "kocioni-diskovi"]) {
  await page.goto(`${BASE}/?deo=${q}`, { waitUntil: "load" });
  try {
    await page.waitForFunction(() => window.__sklop3d?.ready === true, null, { timeout: 90_000 });
  } catch {}
  await page.waitForTimeout(2500);
  const s = await st();
  note(`deep link ${q}`, { status: s.status, selected: s.selected, stage: s.stage, progress: +s.progress.toFixed(3), url: page.url().replace(BASE, ""), scrollY: await page.evaluate(() => scrollY), panel: await page.getByTestId("part-panel").isVisible().catch(() => false) });
  await shot(page, `motion-3d/hero-d-deeplink-${q}`);
}
out.log = log;
writeFileSync("docs/qa/audit/motion-3d/hero-desktop.json", JSON.stringify(out, null, 2));
console.log("errors", JSON.stringify(log));
await browser.close();
