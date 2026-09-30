/**
 * Verifier for flows-shop-16: does the quote accept form prefill phone / e-mail given in the inquiry?
 * 1. Guest sends a part inquiry at 390 with name, phone AND e-mail.
 * 2. Owner sends a one-line catalog quote in /admin/upiti/<number>.
 * 3. Guest opens /upit/<token>, clicks „Prihvati ponudu“ (never submits) and records the fields.
 * 4. Variant: seeded UP-2026-000003 token at 1440 (accept form only, not submitted).
 * Evidence: docs/qa/audit/verify/flows-shop/flows-shop-16-reproduce.*
 */
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

import { BASE, convexRun, launch, newContext, shot } from "./kit.mjs";
import { ownerCtx, go } from "./flows-admin-lib2.mjs";

const OUTDIR = path.resolve("docs/qa/audit/verify/flows-shop");
mkdirSync(OUTDIR, { recursive: true });
const out = { base: BASE };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hydrated = (page, sel) =>
  page.waitForFunction((s) => Object.keys(document.querySelector(s) ?? {}).some((k) => k.startsWith("__react")), sel, { timeout: 150_000 });

async function readAcceptForm(page) {
  return page.evaluate(() => {
    const form = [...document.querySelectorAll("form")].find((f) => /Podaci za porudžbinu/.test(f.textContent));
    if (!form) return null;
    return [...form.querySelectorAll("input")]
      .filter((i) => i.type !== "radio" && i.type !== "checkbox" && i.type !== "hidden")
      .map((i) => ({
        label: i.id ? document.querySelector(`label[for="${i.id}"]`)?.textContent?.trim() ?? null : null,
        type: i.type,
        autocomplete: i.getAttribute("autocomplete"),
        value: i.value,
      }));
  });
}

const browser = await launch();
const stamp = Date.now();
const email = `audit-verify-fs16-${stamp}@primer.rs`;
const A = { phone: "064 765 4321", email, name: "Verifikacija Prefill" };
try {
  // 1. guest inquiry with phone + e-mail
  {
    const ctx = await newContext(browser, { width: 390, height: 844, tag: "verify-fs16-a" });
    const page = await ctx.newPage();
    page.setDefaultTimeout(60_000);
    page.setDefaultNavigationTimeout(150_000);
    await page.goto(`${BASE}/upit`, { waitUntil: "domcontentloaded" });
    await page.getByTestId("inquiry-submit").waitFor();
    await hydrated(page, '[data-testid="inquiry-submit"]');
    await sleep(3000);
    await page.locator("#iq-message").fill("Treba mi prednji kočioni disk 276 mm za Golf 7 (verifikacija flows-shop-16).");
    await page.locator("#iq-name").fill(A.name);
    await page.locator("#iq-phone").fill(A.phone);
    await page.locator("#iq-email").fill(A.email);
    await page.locator("#iq-consent [role=checkbox], #iq-consent input[type=checkbox]").first().click();
    await page.getByTestId("inquiry-submit").click();
    await page.waitForURL(/\/upit\/hvala\//, { timeout: 60_000 });
    A.token = page.url().split("/upit/hvala/")[1];
    A.number = ((await page.locator("main").innerText()) ?? "").match(/UP-\d{4}-\d{6}/)?.[0];
    await ctx.close();
  }
  out.inquiry = { number: A.number, token: A.token, sentPhone: A.phone, sentEmail: A.email, sentName: A.name };
  console.log("inquiry", out.inquiry);

  // 2. owner sends a quote
  {
    const actx = await ownerCtx(browser, { tag: "verify-fs16-admin" });
    const page = await go(actx, `/admin/upiti/${A.number}`);
    out.adminContactText = ((await page.locator("main").innerText()) ?? "")
      .split("\n")
      .filter((l) => /064|primer\.rs|Verifikacija/.test(l))
      .slice(0, 8);
    await shot(page, "verify/flows-shop/flows-shop-16-reproduce-admin-inquiry-1440");
    await page.getByTestId("admin-quote-compose").click();
    const comp = page.getByTestId("admin-quote-composer");
    await comp.waitFor();
    await comp.getByRole("combobox").fill("5Q0615505R");
    await sleep(3000);
    await page.getByRole("option").first().click();
    await sleep(800);
    await page.getByTestId("admin-quote-send").click();
    await page.getByRole("alertdialog").waitFor();
    await page.getByTestId("admin-quote-send-confirm").click();
    await sleep(4000);
    out.probeAfterQuote = convexRun("testing:inquiryProbe", { number: A.number });
    await actx.close();
  }

  // 3. guest opens accept form (390), no submit
  {
    const ctx = await newContext(browser, { width: 390, height: 844, tag: "verify-fs16-b" });
    const page = await ctx.newPage();
    page.setDefaultTimeout(60_000);
    page.setDefaultNavigationTimeout(150_000);
    await page.goto(`${BASE}/upit/${A.token}`, { waitUntil: "domcontentloaded" });
    const btn = page.getByTestId("quote-accept");
    await btn.waitFor({ timeout: 90_000 });
    await hydrated(page, '[data-testid="quote-accept"]');
    await btn.click();
    await page.getByText("Podaci za porudžbinu").waitFor();
    await sleep(600);
    out.fresh390 = await readAcceptForm(page);
    const form = page.locator("form", { hasText: "Podaci za porudžbinu" });
    await form.scrollIntoViewIfNeeded();
    await page.evaluate(() => {
      const f = [...document.querySelectorAll("form")].find((x) => /Podaci za porudžbinu/.test(x.textContent));
      window.scrollTo(0, f.getBoundingClientRect().top + window.scrollY - 70);
    });
    await sleep(500);
    out.shot390 = await shot(page, "verify/flows-shop/flows-shop-16-reproduce-accept-form-390");
    await ctx.close();
  }

  // 4. variant: seeded UP-2026-000003 at 1440
  {
    const ctx = await newContext(browser, { width: 1440, height: 900, tag: "verify-fs16-c", mobile: false });
    const page = await ctx.newPage();
    page.setDefaultTimeout(60_000);
    page.setDefaultNavigationTimeout(150_000);
    await page.goto(`${BASE}/upit/3UMmrdzw1RNGw5ToQh06cANjxl8c_-Ajvp7eBwA1ayI`, { waitUntil: "domcontentloaded" });
    const btn = page.getByTestId("quote-accept");
    await btn.waitFor({ timeout: 90_000 });
    await hydrated(page, '[data-testid="quote-accept"]');
    await btn.click();
    await page.getByText("Podaci za porudžbinu").waitFor();
    await sleep(600);
    out.seed1440 = await readAcceptForm(page);
    await page.evaluate(() => {
      const f = [...document.querySelectorAll("form")].find((x) => /Podaci za porudžbinu/.test(x.textContent));
      window.scrollTo(0, f.getBoundingClientRect().top + window.scrollY - 90);
    });
    await sleep(500);
    out.shot1440 = await shot(page, "verify/flows-shop/flows-shop-16-reproduce-accept-form-seed-1440");
    await ctx.close();
  }
} catch (e) {
  out.error = String(e).slice(0, 600);
  console.error(e);
} finally {
  writeFileSync(path.join(OUTDIR, "flows-shop-16-reproduce.json"), JSON.stringify(out, null, 2));
  await browser.close();
  console.log(JSON.stringify(out, null, 2));
}
