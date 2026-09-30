/** verify a11y-store-05 (checkbox error association) and a11y-store-06 (back-in-stock errors). */
import { writeFileSync } from "node:fs";
import { launch, newContext, BASE, shot } from "./kit.mjs";

const width = Number(process.argv[2] ?? 1440);
const height = width < 1024 ? 844 : 900;
const only = process.argv[3] ?? "all";
const rec = {};
const note = (k, v) => {
  rec[k] = v;
  console.log("--", k, JSON.stringify(v).slice(0, 900));
};
const act = (page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return "BODY";
    return `${el.tagName.toLowerCase()}${el.getAttribute("role") ? "[" + el.getAttribute("role") + "]" : ""}#${el.id || ""} "${(el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40)}"`;
  });
/** Computed accessible name/description from the Chromium AX tree for a CSS selector. */
async function ax(page, selector) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("DOM.enable");
  await cdp.send("Accessibility.enable");
  const { root } = await cdp.send("DOM.getDocument", { depth: -1 });
  const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector });
  if (!nodeId) return null;
  const { nodes } = await cdp.send("Accessibility.getPartialAXTree", { nodeId, fetchRelatives: false });
  const n = nodes[0];
  const props = Object.fromEntries((n.properties ?? []).map((p) => [p.name, p.value?.value]));
  await cdp.detach();
  return { role: n.role?.value, name: n.name?.value, description: n.description?.value ?? "", invalid: props.invalid };
}
const attrs = (page, selector) =>
  page.evaluate((s) => {
    const t = document.querySelector(s);
    if (!t) return null;
    return {
      ariaInvalid: t.getAttribute("aria-invalid"),
      ariaDescribedby: t.getAttribute("aria-describedby"),
      alertsInMain: [...document.querySelectorAll("main [role=alert], main [aria-live]")].map(
        (e) => `${e.getAttribute("role") || "live=" + e.getAttribute("aria-live")}: ${e.textContent.trim().slice(0, 60)}`,
      ),
    };
  }, selector);

const browser = await launch();

if (only === "all" || only === "co") {
  const ctx = await newContext(browser, { width, height, tag: `vfyco${width}` });
  const page = await ctx.newPage();
  await page.goto(BASE + "/deo/kocioni-disk-prednji-276-24-mm-demo-0004", { waitUntil: "load", timeout: 180000 });
  await page.waitForTimeout(2000);
  await page.getByTestId("product-add-to-cart").first().click();
  await page.waitForTimeout(1500);
  await page.goto(BASE + "/porudzbina", { waitUntil: "domcontentloaded", timeout: 240000 });
  await page.locator("#co-firstName").waitFor({ timeout: 120000 });
  await page.waitForTimeout(2500);
  await page.locator("#co-firstName").fill("Petar");
  await page.locator("#co-lastName").fill("Petrovic");
  await page.locator("#co-phone").fill("064 123 4567");
  await page.locator("#co-email").fill(`audit-verify-a11y-${width}-${Date.now()}@primer.rs`);
  for (let i = 0; i < 3; i++) {
    await page.getByTestId("checkout-next").click();
    await page.waitForTimeout(1300);
  }
  await page.getByTestId("checkout-submit").focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1500);
  note("co focus after submit without terms", await act(page));
  note("co #co-terms attrs", await attrs(page, "#co-terms"));
  note("co #co-terms AX", await ax(page, "#co-terms"));
  note(
    "co error p",
    await page.evaluate(() => {
      const ps = [...document.querySelectorAll("p.text-danger")].map((p) => ({ id: p.id, role: p.getAttribute("role"), text: p.textContent.trim() }));
      return ps;
    }),
  );
  await page.locator("#co-terms").scrollIntoViewIfNeeded();
  await shot(page, `verify/a11y-store/a11y-store-05-reproduce-checkout-${width}`);
  await ctx.close();
}

if (only === "all" || only === "iq") {
  const ctx = await newContext(browser, { width, height, tag: `vfyiq${width}` });
  const page = await ctx.newPage();
  await page.goto(BASE + "/upit", { waitUntil: "load", timeout: 180000 });
  await page.waitForTimeout(2500);
  await page.getByTestId("inquiry-submit").focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1500);
  note("iq focus after empty submit", await act(page));
  const sel = "#iq-consent button[role=checkbox]";
  note("iq consent attrs", await attrs(page, sel));
  note("iq consent AX", await ax(page, sel));
  note("iq name field AX (comparison)", await ax(page, "#iq-name"));
  note(
    "iq consent error p",
    await page.evaluate(() => {
      const p = document.querySelector("#iq-consent p.text-danger");
      return p ? { id: p.id, role: p.getAttribute("role"), text: p.textContent.trim() } : null;
    }),
  );
  await page.locator("#iq-consent").scrollIntoViewIfNeeded();
  await shot(page, `verify/a11y-store/a11y-store-05-reproduce-inquiry-${width}`);
  await ctx.close();
}

if (only === "all" || only === "mr") {
  const ctx = await newContext(browser, { width, height, tag: `vfymr${width}` });
  const page = await ctx.newPage();
  await page.goto(BASE + "/za-majstore/registracija", { waitUntil: "load", timeout: 180000 });
  await page.waitForTimeout(2500);
  await page.getByTestId("mechanic-reg-submit").focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1500);
  note("mr focus after empty submit", await act(page));
  const sel = "[data-testid=mechanic-reg-terms]";
  note("mr terms attrs", await attrs(page, sel));
  note("mr terms AX", await ax(page, sel));
  note(
    "mr terms error p",
    await page.evaluate(() => {
      const p = document.querySelector("#mr-terms p.text-danger");
      return p ? { id: p.id, role: p.getAttribute("role"), text: p.textContent.trim() } : null;
    }),
  );
  await page.locator("#mr-terms").scrollIntoViewIfNeeded();
  await shot(page, `verify/a11y-store/a11y-store-05-reproduce-mechreg-${width}`);
  await ctx.close();
}

if (only === "all" || only === "oos") {
  const ctx = await newContext(browser, { width, height, tag: `vfyoos${width}` });
  const page = await ctx.newPage();
  await page.goto(BASE + "/deo/kocione-plocice-prednje-demo-0012", { waitUntil: "load", timeout: 180000 });
  await page.waitForTimeout(3000);
  const form = page.getByTestId("back-in-stock-form");
  await form.scrollIntoViewIfNeeded();
  await page.evaluate(() => {
    window.__mut = [];
    new MutationObserver((ms) => {
      for (const m of ms)
        for (const n of m.addedNodes)
          if (n.nodeType === 1)
            window.__mut.push(
              `${n.tagName} role=${n.getAttribute("role")} live=${n.getAttribute("aria-live")} inLive=${!!n.parentElement?.closest("[aria-live],[role=alert],[role=status]")} ${n.textContent.trim().slice(0, 60)}`,
            );
    }).observe(document.querySelector("[data-testid=back-in-stock-form]"), { childList: true, subtree: true });
  });
  const btn = form.getByRole("button", { name: "Obavesti me" });
  await btn.focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1200);
  note("oos A focus after empty submit", await act(page));
  note("oos A email input AX", await ax(page, "[data-testid=back-in-stock-form] input[type=email]"));
  note("oos A added nodes", await page.evaluate(() => window.__mut));
  await shot(page, `verify/a11y-store/a11y-store-06-reproduce-empty-${width}`, { locator: form });
  await form.locator("input[type=email]").fill("petar@");
  await btn.focus();
  await page.evaluate(() => (window.__mut = []));
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1000);
  note("oos B focus after invalid email submit", await act(page));
  note("oos B added nodes", await page.evaluate(() => window.__mut));
  await form.locator("input[type=email]").fill("audit-verify@primer.rs");
  await btn.focus();
  await page.evaluate(() => (window.__mut = []));
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1000);
  note("oos C focus after no-consent submit", await act(page));
  note("oos C added nodes", await page.evaluate(() => window.__mut));
  await ctx.close();
}
writeFileSync(`docs/qa/audit/verify/a11y-store/a11y-store-05-06-reproduce-${width}-${only}.json`, JSON.stringify(rec, null, 1));
await browser.close();
