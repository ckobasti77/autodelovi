/**
 * Verify a11y-store-10: required state of mandatory form controls (DOM + Chromium AX tree).
 *   node scripts/qa/audit/verify-a11y-store-10.mjs
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { launch, newContext, shot, BASE } from "./kit.mjs";

const DIR = "docs/qa/audit/verify/a11y-store";
mkdirSync(DIR, { recursive: true });
const out = {};
const note = (k, v) => {
  out[k] = v;
  console.log("--", k, (typeof v === "string" ? v : JSON.stringify(v)).slice(0, 2500));
};

const fields = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("main input:not([type=hidden]), main textarea, main select, main [role=checkbox], main [role=combobox]")]
      .filter((e) => e.getBoundingClientRect().width > 0 || e.type === "checkbox")
      .map((e) => {
        const lab = e.id ? document.querySelector(`label[for="${CSS.escape(e.id)}"]`) : e.closest("label");
        return `${e.id || e.name || e.tagName.toLowerCase()} [${(lab?.textContent || e.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim().slice(0, 45)}] required=${e.required ?? "-"} aria-required=${e.getAttribute("aria-required") ?? "-"}`;
      }),
  );
const instructions = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("main p, main span, main legend, main div")]
      .filter((e) => e.children.length === 0 && /obavezn/i.test(e.textContent))
      .map((e) => e.textContent.replace(/\s+/g, " ").trim().slice(0, 100))
      .slice(0, 10),
  );
async function axRequired(page, ids) {
  const cdp = await page.context().newCDPSession(page);
  const res = {};
  for (const id of ids) {
    const { root } = await cdp.send("DOM.getDocument", { depth: 0 });
    const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: `#${id}` }).catch(() => ({ nodeId: 0 }));
    if (!nodeId) {
      res[id] = "missing";
      continue;
    }
    const { node } = await cdp.send("DOM.describeNode", { nodeId });
    const tree = await cdp
      .send("Accessibility.getPartialAXTree", { backendNodeId: node?.backendNodeId, fetchRelatives: false })
      .catch((e) => ({ err: String(e) }));
    const n = tree.nodes?.[0];
    res[id] = n ? `${n.role?.value} "${n.name?.value}" required=${n.properties?.find((p) => p.name === "required")?.value?.value ?? "absent"}` : tree.err ?? "n/a";
  }
  return res;
}

const browser = await launch();
const ctx = await newContext(browser, { width: 1440, height: 900, tag: "v10" });
const page = await ctx.newPage();
// cart item for checkout
await page.goto(`${BASE}/deo/kocioni-disk-prednji-276-24-mm-demo-0004`, { waitUntil: "load", timeout: 180000 });
await page.waitForTimeout(2500);
await page.getByTestId("product-add-to-cart").first().click();
await page.waitForTimeout(2000);
for (const [tag, route, ax] of [
  ["checkout", "/porudzbina", ["co-firstName", "co-lastName", "co-phone", "co-email"]],
  ["inquiry", "/upit", ["iq-name", "iq-phone"]],
  ["signup", "/registracija", []],
  ["mechanic-register", "/za-majstore/registracija", ["mr-email", "mr-contactPerson", "mr-city"]],
  ["signin", "/prijava", []],
]) {
  try {
    await page.goto(BASE + route, { waitUntil: "load", timeout: 180000 });
    await page.waitForTimeout(3000);
    note(`${tag} fields`, await fields(page));
    note(`${tag} instructions mentioning obavezn*`, await instructions(page));
    if (ax.length) note(`${tag} AX required`, await axRequired(page, ax));
    if (tag === "checkout") await shot(page, "verify/a11y-store/a11y-store-10-reproduce-checkout-1440");
  } catch (e) {
    note(`${tag} error`, String(e).slice(0, 300));
  }
}
writeFileSync(`${DIR}/a11y-store-10-reproduce.json`, JSON.stringify(out, null, 1));
await ctx.close();
await browser.close();
