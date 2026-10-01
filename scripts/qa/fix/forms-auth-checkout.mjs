/**
 * forms-auth (step 22): checkout focus (A11Y-01), terms error description (A11Y-07),
 * aria-required (A11Y-18), mobile summary (VIS-11), back link (FLOW-29), PIB/MB copy (FLOW-09).
 *   AUDIT_BASE=http://localhost:3001 node scripts/qa/fix/forms-auth-checkout.mjs [width]
 */
import { launch, newContext, shot, BASE } from "../audit/kit.mjs";

const width = Number(process.argv[2] ?? 1440);
const out = {};
const note = (k, v) => {
  out[k] = v;
  console.log("--", k, JSON.stringify(v).slice(0, 900));
};
const act = (page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return "BODY";
    return `${el.tagName.toLowerCase()}${el.getAttribute("role") ? "[" + el.getAttribute("role") + "]" : ""}#${el.id || ""}`;
  });
const vals = (page) =>
  page.evaluate(() => ["co-firstName", "co-lastName", "co-phone"].map((id) => `${id}=${document.getElementById(id)?.value}`));

const browser = await launch();
try {
  const ctx = await newContext(browser, { width, height: width < 1024 ? 844 : 900, tag: `fa-co${width}` });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 200)));
  await page.goto(BASE + "/deo/kocioni-disk-prednji-276-24-mm-demo-0004", { waitUntil: "load", timeout: 180000 });
  await page.waitForTimeout(1500);
  await page.getByTestId("product-add-to-cart").first().click();
  await page.waitForTimeout(1500);
  await page.goto(BASE + "/porudzbina", { waitUntil: "domcontentloaded", timeout: 240000 });
  await page.locator("#co-firstName").waitFor({ timeout: 120000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => sessionStorage.removeItem("sk.checkout.v1"));
  note("aria-required", await page.evaluate(() =>
    ["co-firstName", "co-lastName", "co-phone", "co-email"].map((id) => `${id}:${document.getElementById(id)?.getAttribute("aria-required")}`),
  ));
  note("back link", await page.evaluate(() => {
    const a = [...document.querySelectorAll("form a")].find((x) => x.textContent.trim().endsWith("Korpa"));
    return a ? { text: a.textContent.trim(), firstChildIsIcon: a.firstElementChild?.getAttribute("aria-hidden") === "true" } : null;
  }));
  if (width < 1024) {
    note("mobile summary (closed)", await page.locator("details summary").first().innerText());
    await page.locator("details summary").first().click();
    await page.waitForTimeout(300);
    note("mobile summary (open) has inner Ukupno", await page.evaluate(() => /Ukupno/.test(document.querySelector("details > div")?.textContent ?? "")));
    await shot(page, `../fix/forms-auth/checkout-summary-${width}`);
    await page.locator("details summary").first().click();
  }
  await page.getByTestId("checkout-next").focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(800);
  note("A after empty Dalje (expect summary)", await act(page));
  await page.locator("#co-firstName").focus();
  await page.keyboard.type("Petar", { delay: 30 });
  await page.keyboard.press("Tab");
  await page.waitForTimeout(600);
  note("A after Tab from fixed Ime (expect co-lastName)", await act(page));
  await page.keyboard.type("Petrović", { delay: 20 });
  await page.locator("#co-phone").click();
  await page.waitForTimeout(600);
  note("B after click Telefon (expect co-phone)", await act(page));
  await page.keyboard.type("0641234567", { delay: 20 });
  await page.waitForTimeout(300);
  note("values", await vals(page));
  await page.getByTestId("checkout-next").focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(800);
  note("A second failed Dalje (expect summary again)", await act(page));
  // FLOW-09: company with a bad MB checksum
  await page.locator("#co-email").fill(`fa-co-${Date.now()}@primer.rs`);
  await page.locator("#co-isCompany").click();
  await page.locator("#co-companyName").fill("Servis Test");
  await page.locator("#co-pib").fill("104052136");
  await page.locator("#co-mb").fill("64552873");
  await page.locator("#co-companyName").focus();
  await page.waitForTimeout(500);
  note("FLOW-09 messages", await page.evaluate(() => ["co-pib-msg", "co-mb-msg"].map((id) => document.getElementById(id)?.textContent)));
  await page.locator("#co-pib").fill("104052135");
  await page.locator("#co-mb").fill("20084693");
  await page.locator("#co-isCompany").click();
  for (let i = 0; i < 3; i++) {
    await page.getByTestId("checkout-next").click();
    await page.waitForTimeout(1200);
  }
  await page.getByTestId("checkout-submit").focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1000);
  note("C after submit without terms", await act(page));
  note("C terms a11y", await page.evaluate(() => {
    const b = document.getElementById("co-terms");
    const ids = (b?.getAttribute("aria-describedby") ?? "").split(" ").filter(Boolean);
    return {
      invalid: b?.getAttribute("aria-invalid"),
      required: b?.getAttribute("aria-required"),
      description: ids.map((id) => document.getElementById(id)?.textContent).join(" | "),
    };
  }));
  await page.locator("#co-terms").focus();
  await page.keyboard.press("Space");
  await page.waitForTimeout(400);
  note("C focus stays on terms after checking it", await act(page));
  await shot(page, `../fix/forms-auth/checkout-terms-${width}`);
  note("console errors", errors);
} finally {
  await browser.close();
}
