// Step 22 shell-perf verify round 2 · PERF-01: a decision clicked on the server-rendered panel
// before React has hydrated (every script held 4 s). Expected: the plain form post records the
// decision (the no-JS path) and the next document has no banner.
// Usage (Git Bash): AUDIT_BASE=http://localhost:3001 node docs/qa/fix/shell-perf/verify/r2/perf01-prehydration.mjs
import { writeFileSync } from "node:fs";
import { BASE, launch, newContext, watch } from "../../../../../../scripts/qa/audit/kit.mjs";

const BANNER = "[data-testid='consent-banner']";
const out = {};
const browser = await launch();
try {
  for (const choice of ["Odbij sve", "Prihvati sve"]) {
    const ctx = await newContext(browser, { width: 390, height: 844, consent: false, tag: "r2-prehyd" });
    const page = await ctx.newPage();
    const log = watch(page);
    let hold = true;
    await page.route("**/_next/static/chunks/**", async (route) => {
      if (hold) await new Promise((r) => setTimeout(r, 4000));
      await route.continue();
    });
    const docs = [];
    page.on("request", (r) => r.resourceType() === "document" && docs.push(`${r.method()} ${r.url().replace(BASE, "")}`));
    await page.goto(`${BASE}/delovi/kocioni-diskovi`, { waitUntil: "domcontentloaded", timeout: 90000 });
    const hydratedBefore = await page.evaluate(() => Object.keys(document.querySelector("main") || {}).some((k) => k.startsWith("__reactFiber")));
    await page.locator(BANNER).getByRole("button", { name: choice }).click({ noWaitAfter: true });
    hold = false;
    await page.waitForLoadState("load", { timeout: 90000 }).catch(() => {});
    await page.waitForTimeout(4000);
    const c = (await ctx.cookies()).find((x) => x.name === "sk_consent");
    out[choice] = {
      hydratedBeforeClick: hydratedBefore,
      documents: docs,
      cookie: c ? JSON.parse(decodeURIComponent(c.value)) : null,
      bannerAfter: await page.locator(BANNER).count(),
      url: new URL(page.url()).pathname,
      errors: [...log.console, ...log.pageErrors],
    };
    await ctx.close();
  }
} finally {
  await browser.close();
}
writeFileSync("docs/qa/fix/shell-perf/verify/r2/perf01-prehydration.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 1));
