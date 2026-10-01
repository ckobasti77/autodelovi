// Step 22 re-verification probe: for a returning visitor (consent cookie set), which first-load
// chunk defines each lazily loaded shell module, and is that chunk referenced by the server HTML?
// Usage: AUDIT_BASE=http://localhost:3001 node scripts/qa/fix/shell-perf-reverify-firstload.mjs
import { writeFileSync } from "node:fs";
import { BASE, launch, newContext } from "../audit/kit.mjs";
const DEF = (p) => `${p} [app-client] (ecmascript)", ((__turbopack_context__)`;
const MODS = ["components/consent/ConsentBanner.tsx", "components/consent/ConsentReopen.tsx", "components/consent/ConsentDetails.tsx", "components/shell/HeaderSearchPanel.tsx", "components/shell/MobileNavPanel.tsx", "components/ui/Dialog.tsx", "components/ui/Sheet.tsx", "components/shell/SearchBox.tsx", "components/cart/CartDrawer.tsx", "components/vehicle/VehiclePickerDialog.tsx", "components/catalog/CatalogControls.tsx"];
const browser = await launch();
const out = {};
try {
  for (const path of ["/delovi", "/"]) {
    const ctx = await newContext(browser, { width: 390, height: 844, tag: "rvfirstload" });
    const page = await ctx.newPage();
    const bodies = [];
    let html = "";
    page.on("response", (res) => {
      if (res.request().resourceType() === "document") res.text().then((t) => (html = t)).catch(() => {});
      if (res.request().resourceType() === "script") bodies.push(res.text().then((t) => [res.url(), t]).catch(() => [res.url(), ""]));
    });
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    const rows = {};
    for (const [url, t] of await Promise.all(bodies)) {
      const file = url.split("/_next/")[1] ?? url;
      for (const m of MODS) if (t.includes(DEF(m))) (rows[m] ??= []).push({ chunk: file, inServerHtml: html.includes(file) });
    }
    out[path] = { returningVisitorConsentCookie: true, bannerInDom: await page.getByTestId("consent-banner").count(), modulesDefinedInFirstLoad: rows };
    await ctx.close();
  }
} finally {
  await browser.close();
}
writeFileSync("docs/qa/fix/shell-perf/verify/first-load-modules-returning.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 1));
