// Verifier for copy-06: e-pošta vs e-mail terminology; „Proizvodi“ vs „Artikli“.
import { writeFileSync, mkdirSync } from "node:fs";
import { BASE, launch, newContext, shot, watch } from "./kit.mjs";

const OUT = "docs/qa/audit/verify/copy";
mkdirSync(OUT, { recursive: true });
const log = [];
const p = (s) => {
  log.push(s);
  console.log(s);
};

const browser = await launch();
for (const vp of [
  { tag: "1440", width: 1440, height: 900 },
  { tag: "390", width: 390, height: 844 },
]) {
  const ctx = await newContext(browser, { width: vp.width, height: vp.height, tag: `verify-copy06-${vp.tag}` });
  const page = await ctx.newPage();
  const w = watch(page);

  // 1. Back in stock
  await page.goto(`${BASE}/deo/kocione-plocice-prednje-demo-0012`, { waitUntil: "networkidle" });
  const form = page.getByTestId("back-in-stock-form").or(page.locator("form#obavestenje")).first();
  await form.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500);
  await form.locator("input[type=email]").fill("pogresno@");
  await form.getByRole("button", { name: /Obavesti me/ }).click();
  await page.waitForTimeout(600);
  p(`\n[1] back-in-stock @${vp.tag}:\n${await form.innerText()}`);
  await shot(page, `verify/copy/copy-06-reproduce-back-in-stock-${vp.tag}`, { locator: form });

  // 2. Checkout empty contact step
  await page.goto(`${BASE}/deo/kocioni-disk-prednji-276-24-mm-demo-0004`, { waitUntil: "networkidle" });
  await page.getByTestId("product-add-to-cart").first().click();
  await page.waitForTimeout(2500);
  await page.goto(`${BASE}/porudzbina`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.getByTestId("checkout-next").click();
  await page.waitForTimeout(800);
  const emailField = page.locator("#co-email").locator("xpath=ancestor::*[.//label][1]");
  const step = page.locator("section[aria-labelledby='step-title']").first();
  p(`\n[2] checkout contact step errors @${vp.tag}:\n${await step.innerText()}`);
  await page.locator("#co-email").scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await shot(page, `verify/copy/copy-06-reproduce-checkout-${vp.tag}`);

  // 3. Sign-in wrong credentials (1440 only — one attempt)
  if (vp.tag === "1440") {
    await page.goto(`${BASE}/prijava`, { waitUntil: "networkidle" });
    await page.getByTestId("auth-email").fill(`verify-copy06-${Date.now()}@primer.rs`);
    await page.getByTestId("auth-password").fill("pogresna-lozinka-123");
    await page.getByTestId("auth-submit").click();
    await page.waitForTimeout(4000);
    const f = page.locator("form").filter({ has: page.getByTestId("auth-email") }).first();
    p(`\n[3] sign-in wrong creds @${vp.tag}:\n${await f.innerText()}`);
    await shot(page, `verify/copy/copy-06-reproduce-signin-${vp.tag}`, { locator: f });
  }

  // 4. Mechanic registration page copy
  await page.goto(`${BASE}/za-majstore/registracija`, { waitUntil: "networkidle" });
  const body = await page.locator("main").innerText();
  const lines = body.split("\n").filter((l) => /e-mail|e-pošt|E-pošt|E-mail/.test(l));
  p(`\n[4] /za-majstore/registracija @${vp.tag} lines mentioning e-mail/e-pošta:\n${lines.join("\n")}`);
  if (vp.tag === "1440") {
    const el = page.getByText("Stiže vam e-mail o odobrenju", { exact: false }).first();
    if (await el.count()) {
      await el.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1500);
      await shot(page, `verify/copy/copy-06-reproduce-mechanic-reg-${vp.tag}`);
    }
  }

  // 5. Search heading vs listings
  await page.goto(`${BASE}/pretraga?q=disk`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const heads = await page.locator("main h2, main h1").allInnerTexts();
  p(`\n[5] /pretraga?q=disk @${vp.tag} headings: ${JSON.stringify(heads)}`);
  await shot(page, `verify/copy/copy-06-reproduce-search-${vp.tag}`);
  await page.goto(`${BASE}/delovi/kocioni-diskovi`, { waitUntil: "networkidle" });
  const countLabel = await page.getByText(/\d+ artikal/).first().innerText().catch(() => "(none)");
  p(`/delovi/kocioni-diskovi count label: ${countLabel}`);
  // search suggestions group label
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  const sb = page.getByRole("combobox").or(page.getByPlaceholder(/Broj dela/)).first();
  if (vp.tag === "1440" && (await sb.count())) {
    await sb.click();
    await sb.fill("disk");
    await page.waitForTimeout(2500);
    const lb = page.getByRole("listbox").first();
    p(`search suggest listbox: ${(await lb.count()) ? JSON.stringify((await lb.innerText()).slice(0, 300)) : "(none)"}`);
    if (await lb.count()) await shot(page, `verify/copy/copy-06-reproduce-suggest-${vp.tag}`);
  }
  p(`errors: ${JSON.stringify({ c: w.console.slice(0, 3), pe: w.pageErrors.slice(0, 3) })}`);
  await ctx.close();
}
await browser.close();
writeFileSync(`${OUT}/copy-06-reproduce.txt`, log.join("\n"));
