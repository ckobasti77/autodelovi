/** verify a11y-store-03/04: consent banner obscuring focus, Escape, „Podešavanja“ focus. */
import { writeFileSync } from "node:fs";
import { launch, newContext, BASE, shot } from "./kit.mjs";

const engine = process.argv[2] ?? "chromium";
const cases = [
  { route: "/delovi/kocioni-diskovi", w: 390, h: 844 },
  { route: "/delovi/kocioni-diskovi", w: 1440, h: 900 },
  { route: "/deo/kocioni-disk-prednji-276-24-mm-demo-0004", w: 390, h: 844 },
  { route: "/", w: 768, h: 1024 },
  { route: "/delovi/kocioni-diskovi", w: 360, h: 780 },
];
const browser = await launch(engine);
const out = { engine, cases: [] };
for (const c of engine === "chromium" ? cases : cases.slice(0, 2)) {
  const ctx = await newContext(browser, { width: c.w, height: c.h, consent: false, tag: "vfybn", engine });
  const page = await ctx.newPage();
  await page.goto(BASE + c.route, { waitUntil: "load", timeout: 180000 });
  await page.waitForTimeout(3000);
  const r = { ...c };
  r.env = await page.evaluate(() => {
    const b = document.querySelector("[data-testid=consent-banner]");
    const br = (b?.querySelector("form") ?? b)?.getBoundingClientRect();
    const cs = getComputedStyle(document.documentElement);
    return {
      banner: br ? [br.left, br.top, br.width, br.height].map(Math.round) : null,
      bannerPctOfViewport: br ? Math.round((br.height / innerHeight) * 100) : null,
      scrollPaddingTop: cs.scrollPaddingTop,
      scrollPaddingBottom: cs.scrollPaddingBottom,
    };
  });
  r.stops = [];
  let firstShot = null;
  for (let i = 0; i < 50; i++) {
    await page.keyboard.press("Tab");
    await page.waitForTimeout(90);
    const s = await page.evaluate(() => {
      const el = document.activeElement;
      const banner = document.querySelector("[data-testid=consent-banner]");
      if (!el || el === document.body) return { name: "BODY" };
      const rr = el.getBoundingClientRect();
      const name = (el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40);
      if (!banner) return { name, noBanner: true };
      if (banner.contains(el)) return { name, inBanner: true };
      const b = (banner.querySelector("form") ?? banner).getBoundingClientRect();
      const ix = Math.max(0, Math.min(rr.right, b.right) - Math.max(rr.left, b.left));
      const iy = Math.max(0, Math.min(rr.bottom, b.bottom) - Math.max(rr.top, b.top));
      // top-most element at the centre of the focused element
      const cx = Math.min(innerWidth - 1, Math.max(0, rr.left + rr.width / 2));
      const cy = Math.min(innerHeight - 1, Math.max(0, rr.top + rr.height / 2));
      const top = document.elementFromPoint(cx, cy); const panelEl = banner.querySelector("form") ?? banner;
      return {
        name,
        tag: el.tagName.toLowerCase(),
        rect: [rr.left, rr.top, rr.width, rr.height].map(Math.round),
        coveredPct: rr.width * rr.height ? Math.round(((ix * iy) / (rr.width * rr.height)) * 100) : 0,
        topIsBanner: !!(top && panelEl.contains(top)),
        scrollY: Math.round(scrollY),
      };
    });
    r.stops.push({ tab: i + 1, ...s });
    if (!firstShot && s.coveredPct === 100) {
      firstShot = await shot(page, `verify/a11y-store/a11y-store-03-reproduce-${engine}-${c.w}-${c.route === "/" ? "home" : c.route.split("/").pop().slice(0, 20)}`);
      r.firstFullyCoveredTab = i + 1;
      r.shot = firstShot;
    }
  }
  r.fullyCovered = r.stops.filter((s) => s.coveredPct === 100).length;
  r.fullyCoveredConsecutiveMax = r.stops.reduce((a, s) => { a.cur = s.coveredPct === 100 ? a.cur + 1 : 0; a.max = Math.max(a.max, a.cur); return a; }, { cur: 0, max: 0 }).max;
  r.partiallyCovered = r.stops.filter((s) => s.coveredPct > 0 && s.coveredPct < 100).length;
  // Escape with focus in the page
  await page.keyboard.press("Escape");
  await page.waitForTimeout(600);
  r.bannerVisibleAfterEscapeFocusInPage = await page.getByTestId("consent-banner").isVisible();
  // Escape with focus inside banner
  await page.getByTestId("consent-banner").getByRole("button", { name: "Odbij sve" }).focus();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(600);
  r.bannerVisibleAfterEscapeFocusInBanner = await page.getByTestId("consent-banner").isVisible();

  // a11y-store-04: Podešavanja via keyboard
  if (c.route === "/delovi/kocioni-diskovi" && (c.w === 390 || c.w === 1440)) {
    for (const key of ["Enter", "Space"]) {
      if (key === "Space") {
        // fresh page for the Space variant
        await page.reload({ waitUntil: "load" });
        await page.waitForTimeout(3000);
      }
      const btn = page.getByTestId("consent-banner").getByRole("button", { name: "Podešavanja" });
      await btn.focus();
      const before = await page.evaluate(() => document.activeElement?.textContent?.trim());
      await page.keyboard.press(key);
      await page.waitForTimeout(1200);
      const after = await page.evaluate(() => {
        const el = document.activeElement;
        return el === document.body ? "BODY" : `${el.tagName.toLowerCase()}[${el.getAttribute("role") || ""}] ${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 40)}`;
      });
      const switches = await page.getByTestId("consent-banner").getByRole("switch").count();
      const liveOrAnnounce = await page.evaluate(() => [...document.querySelectorAll("[data-testid=consent-banner] [role=status],[data-testid=consent-banner] [aria-live],[data-testid=consent-banner] [role=alert]")].length);
      if (key === "Enter") r.settingsShot = await shot(page, `verify/a11y-store/a11y-store-04-reproduce-${engine}-${c.w}`);
      // where does the next Tab go?
      await page.keyboard.press("Tab");
      await page.waitForTimeout(200);
      const nextTab = await page.evaluate(() => {
        const el = document.activeElement;
        const banner = document.querySelector("[data-testid=consent-banner]");
        return el === document.body ? "BODY" : `${el.closest("header") ? "HEADER " : el.closest("footer") ? "FOOTER " : ""}${banner?.contains(el) ? "IN-BANNER " : "OUTSIDE "}${el.tagName.toLowerCase()}[${el.getAttribute("role") || ""}] ${(el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40)}`;
      });
      await page.keyboard.down("Shift"); await page.keyboard.press("Tab"); await page.keyboard.press("Tab"); await page.keyboard.up("Shift");
      r[`settings_${key}`] = { before, after, switches, liveOrAnnounce, nextTab };
    }
  }
  out.cases.push(r);
  console.log(JSON.stringify({ ...r, stops: undefined }, null, 0));
  await ctx.close();
}
writeFileSync(`docs/qa/audit/verify/a11y-store/a11y-store-03-reproduce-${engine}.json`, JSON.stringify(out, null, 1));
await browser.close();
