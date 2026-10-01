// Step 22 re-verification (round 2), hero-3d-assets / MOT-01 fix-up: replays the first steps of
// tests/e2e/security.spec.ts "storefront: home with the live 3D hero ..." on SwiftShader (the e2e
// launch flags) and records what that test actually exercises now that software renderers are
// classified low (PERF-23): the tier the test reads right after the scroll, whether the live 3D
// (GLB, Draco/Basis WASM decoders, blob workers, canvas) is ever loaded.
// Usage: AUDIT_BASE=http://localhost:3001 node scripts/qa/fix/hero-3d-assets-verify2-security.mjs [runs]
import { mkdirSync, writeFileSync } from "node:fs";

import { BASE, launch, newContext } from "../audit/kit.mjs";

const RUNS = Number(process.argv[2] ?? 3);
const OUT = "docs/qa/fix/hero-3d-assets/verify/r2";
mkdirSync(OUT, { recursive: true });

const browser = await launch("chromium");
const results = [];
try {
  for (const [label, width, height, query] of [
    ["1440 no override (as security.spec)", 1440, 900, ""],
    ["390 no override (as security.spec)", 390, 844, ""],
    ["1440 ?3d=high (control)", 1440, 900, "?3d=high"],
  ]) {
    for (let run = 0; run < (query ? 1 : RUNS); run++) {
      const ctx = await newContext(browser, { width, height, tag: `vfy2-sec-${width}-${run}` });
      const page = await ctx.newPage();
      const live = [];
      page.on("request", (r) => {
        const u = r.url();
        if (/\.glb|draco|basis|\.wasm|^blob:/i.test(u)) live.push(u.replace(BASE, "").slice(0, 80));
      });
      const workers = [];
      page.on("worker", (w) => workers.push(w.url().slice(0, 40)));
      try {
        await page.goto(`${BASE}/${query}`);
        await page.waitForFunction(() => Boolean(window.__sklop3d));
        await page.evaluate(() => window.scrollTo(0, 80));
        // Exactly what the spec does next: read the tier immediately.
        const tierRead = await page.evaluate(() => window.__sklop3d?.tier ?? null);
        let ready = false;
        try {
          await page.waitForFunction(() => window.__sklop3d?.ready === true, null, { timeout: query ? 120_000 : 15_000 });
          ready = true;
        } catch {
          ready = false;
        }
        const after = await page.evaluate(() => ({
          tier: window.__sklop3d?.tier ?? null,
          status: window.__sklop3d?.getState().status,
          canvases: document.querySelectorAll('[data-testid="hero-canvas"] canvas').length,
          renderer: (() => {
            const gl = document.createElement("canvas").getContext("webgl2");
            const ext = gl?.getExtension("WEBGL_debug_renderer_info");
            return gl && ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)).slice(0, 60) : null;
          })(),
        }));
        const row = {
          label,
          run,
          tierReadRightAfterScroll: tierRead,
          specWouldWaitForReady: tierRead !== "low",
          readyWithin: ready,
          ...after,
          liveAssetRequests: [...new Set(live)].slice(0, 6),
          workers: workers.length,
        };
        results.push(row);
        console.log(JSON.stringify(row));
      } finally {
        await ctx.close();
      }
    }
  }
} finally {
  await browser.close();
}
writeFileSync(`${OUT}/security-live3d-check.json`, JSON.stringify(results, null, 2));
