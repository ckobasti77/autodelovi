// Control for the A11Y-03 re-verification: the same /prijava target loaded directly with NO auth
// cookies in WebKit and Firefox, to tell redirect-related errors from engine/dev-server noise.
// Usage: AUDIT_BASE=http://localhost:3001 node scripts/qa/fix/routing-errors-gates-reverify-a11y03-control.mjs
import { writeFileSync } from "node:fs";

import { BASE, launch, newContext, watch } from "../audit/kit.mjs";

const out = [];
for (const [engine, width, path] of [["webkit", 390, "/prijava?next=%2Fnalog"], ["firefox", 1440, "/prijava?next=%2Fadmin%2Fporudzbine"]]) {
  const browser = await launch(engine);
  try {
    const ctx = await newContext(browser, { width, height: width < 1024 ? 844 : 900, engine, tag: "reverify-a11y03-control" });
    const page = await ctx.newPage();
    const log = watch(page);
    await page.goto(BASE + path, { waitUntil: "load", timeout: 180_000 });
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(1200);
    const beforeReload = { console: [...log.console], pageErrors: [...log.pageErrors] };
    await page.reload({ waitUntil: "load", timeout: 180_000 });
    await page.waitForTimeout(800);
    out.push({ engine, width, path, beforeReload, afterReload: { console: log.console.slice(beforeReload.console.length), pageErrors: log.pageErrors.slice(beforeReload.pageErrors.length) } });
    await ctx.close();
  } finally {
    await browser.close();
  }
}
writeFileSync("docs/qa/fix/routing-errors-gates/verify/a11y03-control-no-cookies.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 1).slice(0, 4000));
