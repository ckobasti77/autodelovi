// Step 22 (hero-stage): VIS-04 (stage index labels), MOT-04 (strip under the part drawer),
// MOT-06 (FAQ disclosure motion), COPY-08 (category link copy), MOT-01 legend states and the
// text-reveal contract on /. usage:
//   AUDIT_BASE=http://localhost:3001 node scripts/qa/fix/hero-stage-p2.mjs [vis04|mot04|mot06|legend|reveal|all]
import { launch, newContext, revealCheck, scrollThrough, watch } from "../audit/kit.mjs";

const base = process.env.AUDIT_BASE ?? "http://localhost:3001";
const mode = process.argv[2] ?? "all";
const want = (m) => mode === "all" || mode === m;
const browser = await launch();
const open = async (size, url = "/", opts = {}) => {
  const [width, height] = size.split("x").map(Number);
  const ctx = await newContext(browser, { width, height, tag: "herop2", ...opts });
  const page = await ctx.newPage();
  await page.goto(`${base}${url}`, { waitUntil: "load" });
  await page.waitForTimeout(1500);
  return { ctx, page };
};
try {
  if (want("vis04")) {
    for (const size of ["1280x800", "1366x800", "1440x900"]) {
      const { ctx, page } = await open(size);
      const rows = await page.evaluate(() =>
        [...document.querySelectorAll('[data-stage-strip] nav ol button')].map((b) => {
          const label = b.querySelector("span:last-child");
          const cs = getComputedStyle(label);
          const lines = Math.round(label.getBoundingClientRect().height / parseFloat(cs.lineHeight));
          return {
            label: label.textContent,
            shown: cs.display !== "none",
            ellipsis: cs.textOverflow === "ellipsis" && label.scrollWidth > label.clientWidth,
            overflowX: label.scrollWidth > label.clientWidth + 1,
            lines,
            clippedInButton: b.scrollHeight > b.clientHeight + 1,
          };
        }),
      );
      const bad = rows.filter((r) => r.shown && (r.ellipsis || r.overflowX || r.clippedInButton));
      console.log("VIS04", size, bad.length ? "BAD" : "ok ", JSON.stringify(rows.map((r) => `${r.label}:${r.lines}`)), bad.length ? JSON.stringify(bad) : "");
      await ctx.close();
    }
  }
  if (want("mot04")) {
    for (const size of ["1024x768", "1280x800", "1440x900"]) {
      const { ctx, page } = await open(size, "/?deo=kocioni-diskovi");
      await page.getByTestId("part-panel").waitFor({ state: "visible", timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(1500);
      const rows = [];
      const handles = await page.locator("[data-stage-strip] button:visible").all();
      for (const h of handles) {
        await h.focus();
        rows.push(
          await h.evaluate((el) => {
            const r = el.getBoundingClientRect();
            const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
            const panel = document.querySelector("[data-testid=part-panel]");
            const pr = panel?.getBoundingClientRect();
            return {
              name: (el.getAttribute("aria-label") ?? el.textContent).trim().slice(0, 22),
              x: `${Math.round(r.x)}-${Math.round(r.right)}`,
              visibleAtCenter: !!hit && (hit === el || el.contains(hit)),
              hit: hit && !(hit === el || el.contains(hit)) ? `${hit.tagName}.${String(hit.className).slice(0, 40)}` : undefined,
              coveredByPanel: !!pr && r.right > pr.x + 1 && pr.width > 0,
              panelLeft: pr ? Math.round(pr.x) : null,
            };
          }),
        );
      }
      const bad = rows.filter((r) => !r.visibleAtCenter || r.coveredByPanel);
      console.log("MOT04", size, bad.length ? "BAD" : "ok ", `panelLeft ${rows[0]?.panelLeft}`, JSON.stringify(rows.map((r) => `${r.name} ${r.x}`)), bad.length ? JSON.stringify(bad) : "");
      await ctx.close();
    }
  }
  if (want("mot06")) {
    for (const [size, reduced] of [["1440x900", false], ["390x844", false], ["1440x900", true]]) {
      const { ctx, page } = await open(size, "/", { reducedMotion: reduced ? "reduce" : "no-preference" });
      const summary = page.locator("#faq-title").locator("xpath=..").locator("summary").first();
      await summary.scrollIntoViewIfNeeded();
      await page.waitForTimeout(800);
      const sample = async () => {
        await page.evaluate(() => {
          const d = document.querySelector("#faq-title").parentElement.querySelector("details");
          const c = d.querySelector("summary + div");
          window.__samples = [];
          const t0 = performance.now();
          const tick = () => {
            window.__samples.push([Math.round(performance.now() - t0), Math.round(d.getBoundingClientRect().height), +getComputedStyle(c).opacity.slice(0, 4), d.open]);
            if (performance.now() - t0 < 600) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        });
      };
      await sample();
      await summary.click();
      await page.waitForTimeout(700);
      const opened = await page.evaluate(() => window.__samples);
      await sample();
      await summary.press("Enter");
      await page.waitForTimeout(700);
      const closed = await page.evaluate(() => window.__samples);
      const pick = (s) => s.filter((_, i) => i % 4 === 0 || i === s.length - 1).map((x) => `${x[0]}ms:${x[1]}px/o${x[2]}/${x[3] ? "open" : "closed"}`);
      const distinct = (s) => new Set(s.map((x) => x[1])).size;
      console.log("MOT06", size, reduced ? "reduced" : "motion", "open", distinct(opened), "heights", JSON.stringify(pick(opened)));
      console.log("MOT06", size, reduced ? "reduced" : "motion", "close", distinct(closed), "heights", JSON.stringify(pick(closed)));
      await ctx.close();
    }
  }
  if (want("legend")) {
    for (const size of ["360x780", "390x844", "390x664", "412x915", "430x932", "768x1024", "820x1180", "1440x900"]) {
      const { ctx, page } = await open(size);
      const r = await page.evaluate(() => {
        const navs = [...document.querySelectorAll('nav[aria-label="Faze rasklapanja"]')];
        const visible = navs.filter((n) => n.offsetParent);
        const legend = document.querySelector("[data-testid=hero-track] .hero-frame > nav, [data-testid=hero-track] .hero-frame nav:not([data-stage-strip] nav)");
        const ol = legend?.querySelector("ol");
        return {
          navsInDom: navs.length,
          visibleNavs: visible.length,
          legend: legend ? (legend.offsetParent ? `${getComputedStyle(ol).gridTemplateColumns.split(" ").length} cols, ${Math.round(legend.getBoundingClientRect().height)}px` : "hidden") : "none",
        };
      });
      const link = await page.locator('a[href="/delovi"]', { hasText: "kategorij" }).first().textContent().catch(() => null);
      console.log("LEGEND", size, JSON.stringify(r), "| COPY08", JSON.stringify(link));
      await ctx.close();
    }
  }
  if (want("reveal")) {
    for (const size of ["390x844", "1440x900"]) {
      const { ctx, page } = await open(size);
      const log = watch(page);
      await scrollThrough(page);
      // The scrub catches up for 0.6 s after the jump to the top; the stage caption then replays
      // its own word reveal (~0.45 s) and restores the DOM when done.
      await page.waitForTimeout(1500);
      const r = await revealCheck(page);
      console.log("REVEAL", size, JSON.stringify(r), "errors", JSON.stringify({ c: log.console, p: log.pageErrors }).slice(0, 400));
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}
