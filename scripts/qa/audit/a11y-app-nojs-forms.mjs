// a11y-app: what happens when an auth form is submitted before hydration (no JS = worst case of a
// slow phone). Uses fake credentials only. Records the URL after submit.
import { writeFileSync } from "node:fs";
import { BASE, launch, shot } from "./kit.mjs";

const browser = await launch();
const out = [];
const cases = [
  { route: "/prijava", fill: { "auth-email": "audit-a11y-nojs@primer.rs", "auth-password": "LaznaLozinka-123" }, submit: "auth-submit" },
  { route: "/registracija", fillSel: { "input[name=name]": "Audit Nojs", "input[name=email]": "audit-a11y-nojs@primer.rs", "input[name=password]": "LaznaLozinka-123" } },
  { route: "/zaboravljena-lozinka", fillSel: { "input[type=email]": "audit-a11y-nojs@primer.rs" } },
];
for (const w of [390]) {
  for (const c of cases) {
    const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: w, height: 844 }, isMobile: true, hasTouch: true, locale: "sr-Latn-RS" });
    await ctx.addCookies([{ name: "sk_consent", value: encodeURIComponent(JSON.stringify({ v: 1, analytics: false, ads: false, at: Date.now(), id: "audit-a11y-app-0002" })), domain: "localhost", path: "/" }]);
    const page = await ctx.newPage();
    await page.goto(BASE + c.route, { waitUntil: "domcontentloaded", timeout: 180000 });
    const formInfo = await page.evaluate(() => [...document.querySelectorAll("main form")].map((f) => ({ method: f.getAttribute("method"), action: f.getAttribute("action"), names: [...f.elements].map((e) => e.name).filter(Boolean) })));
    for (const [id, v] of Object.entries(c.fill ?? {})) await page.getByTestId(id).fill(v);
    for (const [sel, v] of Object.entries(c.fillSel ?? {})) await page.locator(`main ${sel}`).first().fill(v).catch((e) => console.log("fill fail", sel, String(e).slice(0, 80)));
    if (c.submit) await page.getByTestId(c.submit).click();
    else await page.locator("main form button[type=submit]").first().click();
    await page.waitForLoadState("domcontentloaded", { timeout: 180000 });
    await page.waitForTimeout(1500);
    const url = page.url().replace(BASE, "");
    const slug = c.route.replace(/\//g, "") || "root";
    const ev = await shot(page, `a11y-app/nojs-${slug}-${w}`);
    out.push({ route: c.route, width: w, formInfo, urlAfterSubmit: url, evidence: ev });
    console.log(c.route, JSON.stringify(formInfo), "->", url);
    await ctx.close();
  }
}
writeFileSync("docs/qa/audit/a11y-app/nojs-forms.json", JSON.stringify(out, null, 2));
await browser.close();
