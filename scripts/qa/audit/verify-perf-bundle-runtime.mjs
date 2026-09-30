// verify track for perf-bundle-02/-03/-04/-05: what a first visit (consent cookie already set,
// no interaction) actually downloads and executes. Chromium: JS requests + precise block
// coverage of the suspect chunks; WebKit: requests only. Also probes the DOM for tooltips,
// the consent banner, the toast viewport and ScrollTrigger instances.
//
//   node scripts/qa/audit/verify-perf-bundle-runtime.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import { BASE, launch, newContext, watch } from "./kit.mjs";

const OUT = "docs/qa/audit/verify/perf-bundle";
mkdirSync(OUT, { recursive: true });
const ROUTES = ["/", "/delovi/kocioni-diskovi", "/deo/kocioni-disk-prednji-276-24-mm-demo-0004", "/ponuda/kocione-plocice-golf", "/korpa"];
const SUSPECTS = {
  "14y-81z8a-w-u.js": "Popper/floating-ui (Tooltip)",
  "25dplrt_qw3he.js": "root layout: Providers + Tooltip module + TextReveal",
  "1tr6a7zmh41cy.js": "gsap + ScrollTrigger + ScrollToPlugin + CustomEase",
  "1t0q0ok8maumv.js": "radix Dialog + FocusScope + RemoveScroll + hideOthers",
  "2vm060vmiv-df.js": "DismissableLayer/Presence/Collection + icons",
  "0rklqt_vfe3_n.js": "radix Toast (Toaster) + Convex auth + icons",
  "0sgvhbpe5nb6s.js": "ShopChrome, ConsentBanner, Sheet, icons",
  "120epkn8j_rkq.js": "Button, ui/Dialog, radix Switch, icons",
  "2g3bv_p29okud.js": "MobileNav, HeaderSearch, SearchBox, Combobox",
};

/** Used bytes from V8 block coverage: later (inner) ranges override earlier (outer) ones. */
function usedBytes(entry) {
  const len = entry.source?.length ?? 0;
  if (!len) return { len: 0, used: 0 };
  const mark = new Uint8Array(len);
  for (const fn of entry.functions) {
    for (const r of fn.ranges) mark.fill(r.count > 0 ? 1 : 0, r.startOffset, Math.min(r.endOffset, len));
  }
  let used = 0;
  for (let i = 0; i < len; i++) used += mark[i];
  return { len, used };
}

const report = [];
const json = [];
for (const engine of ["chromium", "webkit"]) {
  const browser = await launch(engine);
  for (const vp of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    if (engine === "webkit" && vp.width === 1440) continue;
    for (const route of ROUTES) {
      const context = await newContext(browser, { ...vp, tag: `verify-pb-${engine}-${vp.width}`, engine });
      const page = await context.newPage();
      const log = watch(page);
      const js = [];
      page.on("response", (r) => {
        const u = r.url();
        if (/\/_next\/static\/chunks\/.*\.js/.test(u)) js.push(u.split("/").pop().split("?")[0]);
      });
      if (engine === "chromium") await page.coverage.startJSCoverage({ resetOnNavigation: false, reportAnonymousScripts: false });
      await page.goto(BASE + route, { waitUntil: "load" });
      await page.waitForTimeout(3000); // idle, no interaction (desktop 3D starts 4 s after load by design, D105)
      const dom = await page.evaluate(() => {
        const g = window.gsap;
        const st = g?.core?.globals?.()?.ScrollTrigger ?? window.ScrollTrigger;
        return {
          tooltipContent: document.querySelectorAll("[data-radix-popper-content-wrapper],[role=tooltip]").length,
          consentBannerVisible: [...document.querySelectorAll('[role="dialog"]')].some((d) => /kolačić|kolacic/i.test(d.textContent ?? "") && d.getBoundingClientRect().height > 0),
          toastRegion: document.querySelectorAll('[role="region"] ol, ol[tabindex="-1"]').length,
          windowGsap: typeof g,
          scrollTriggerGlobal: typeof st,
          scrollTriggers: st?.getAll ? st.getAll().length : null,
          registeredPlugins: g?.core?.globals ? Object.keys(g.core.globals()).filter((k) => /Scroll|Ease|GSAP/.test(k)) : null,
        };
      });
      let cov = {};
      if (engine === "chromium") {
        const entries = await page.coverage.stopJSCoverage();
        for (const e of entries) {
          const name = e.url.split("/").pop().split("?")[0];
          if (SUSPECTS[name]) {
            const { len, used } = usedBytes(e);
            cov[name] = { rawKB: +(len / 1024).toFixed(1), usedPct: +((100 * used) / len).toFixed(1) };
          }
        }
      }
      const loaded = Object.keys(SUSPECTS).filter((s) => js.includes(s));
      const row = { engine, width: vp.width, route, jsRequests: js.length, suspectsLoaded: loaded, dom, coverage: cov, errors: [...log.console, ...log.pageErrors] };
      json.push(row);
      report.push(`## ${engine} ${vp.width} ${route}  js requests ${js.length}`);
      report.push(`  suspects loaded (${loaded.length}/${Object.keys(SUSPECTS).length}): ${loaded.join(" ")}`);
      report.push(`  dom: ${JSON.stringify(dom)}`);
      for (const [k, v] of Object.entries(cov)) report.push(`  coverage ${k.padEnd(18)} ${String(v.rawKB).padStart(6)} KB raw, ${String(v.usedPct).padStart(5)} % executed  (${SUSPECTS[k]})`);
      if (row.errors.length) report.push(`  errors: ${row.errors.join(" | ")}`);
      await context.close();
    }
  }
  await browser.close();
}
writeFileSync(`${OUT}/perf-bundle-02-reproduce-runtime.txt`, report.join("\n") + "\n");
writeFileSync(`${OUT}/perf-bundle-02-reproduce-runtime.json`, JSON.stringify(json, null, 2));
console.log(report.join("\n"));
