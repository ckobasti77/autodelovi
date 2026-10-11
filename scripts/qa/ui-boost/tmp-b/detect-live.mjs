/**
 * The impeccable detector's browser engine, injected through Playwright (puppeteer is not
 * installed, so `detect.mjs <url>` cannot run). Same script, same entry point as
 * detector/engines/browser/detect-url.mjs: window.impeccableDetect({ decorate:false, serialize:true }).
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { chromium } from "@playwright/test";

const BASE = "http://localhost:3000";
const SCRIPT = readFileSync(
  path.resolve(".claude/skills/impeccable/scripts/detector/detect-antipatterns-browser.js"),
  "utf8",
);
const PAGES = [
  "/",
  "/delovi",
  "/delovi/kocioni-diskovi",
  "/deo/kocioni-disk-prednji-312-25-mm-demo-0007",
  "/pretraga?q=disk",
  "/upit",
  "/za-majstore",
  "/korpa",
  "/kontakt",
  "/prijava",
  "/styleguide",
];
const VIEWPORTS = [
  { tag: "1440", width: 1440, height: 900, mobile: false },
  { tag: "390", width: 390, height: 844, mobile: true },
];
const out = {};
const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
for (const vp of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    isMobile: vp.mobile,
    hasTouch: vp.mobile,
    locale: "sr-Latn-RS",
  });
  await context.addCookies([
    {
      name: "sk_consent",
      value: encodeURIComponent(
        JSON.stringify({ v: 1, analytics: false, ads: false, at: Date.now(), id: "critique-b-0001" }),
      ),
      domain: "localhost",
      path: "/",
    },
  ]);
  const page = await context.newPage();
  out[vp.tag] = {};
  for (const p of PAGES) {
    try {
      await page.goto(`${BASE}${p}`, { waitUntil: "networkidle", timeout: 120_000 });
      await page.evaluate(async () => {
        const step = window.innerHeight * 0.6;
        for (let y = 0, g = 0; y < document.documentElement.scrollHeight && g < 600; y += step, g++) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 150));
        }
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(1000);
      await page.evaluate(() => {
        window.__IMPECCABLE_CONFIG__ = { ...(window.__IMPECCABLE_CONFIG__ || {}), autoScan: false };
      });
      await page.evaluate(SCRIPT);
      const groups = await page.evaluate(() => {
        if (!window.impeccableDetect) return null;
        return window.impeccableDetect({ decorate: false, serialize: true });
      });
      const findings = (groups || []).flatMap((g) =>
        g.findings.map((f) => ({
          type: f.type,
          detail: f.detail,
          severity: f.severity,
          selector: g.selector || undefined,
          tag: g.tagName || undefined,
          isHidden: g.isHidden || undefined,
          isPageLevel: g.isPageLevel || undefined,
          rect: g.rect ? `${Math.round(g.rect.width)}x${Math.round(g.rect.height)}@${Math.round(g.rect.x ?? g.rect.left ?? 0)},${Math.round(g.rect.y ?? g.rect.top ?? 0)}` : undefined,
        })),
      );
      out[vp.tag][p] = { engineLoaded: groups !== null, groups: (groups || []).length, findings, firstGroupKeys: groups && groups[0] ? Object.keys(groups[0]) : [] };
      const counts = {};
      for (const f of findings) counts[f.type] = (counts[f.type] || 0) + 1;
      console.log(`[${vp.tag}] ${p}: ${findings.length} ${JSON.stringify(counts)}`);
    } catch (error) {
      out[vp.tag][p] = { error: String(error).slice(0, 300) };
      console.log(`[${vp.tag}] ${p}: FAILED ${String(error).slice(0, 200)}`);
    }
  }
  await context.close();
}
await browser.close();
writeFileSync(path.resolve("scripts/qa/ui-boost/tmp-b/detect-live.json"), JSON.stringify(out, null, 1));
console.log("saved");
