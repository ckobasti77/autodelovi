/**
 * cross-p1 (step 22) UI checks on :3001: add-to-cart stock cap (FLOW-25 cross request), Disclosure
 * swaps (category intro, fitment table), thank-you 404, admin 403 title for a customer, landing
 * vehicle link. Prints one JSON line per check.
 *   AUDIT_BASE=http://localhost:3001 node scripts/qa/fix/cross-p1-ui-checks.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { BASE, launch, loginWith, newContext } from "../audit/kit.mjs";

const PRODUCT = "/deo/kocioni-disk-prednji-276-24-mm-demo-0004";
const out = [];
const log = (o) => {
  out.push(o);
  console.log(JSON.stringify(o));
};
const browser = await launch();
try {
  // 1. Stock cap on the product page (guest cart).
  {
    const ctx = await newContext(browser, { width: 1440, height: 900, tag: "cp1-cap" });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
    try {
      await page.goto(BASE + PRODUCT, { waitUntil: "load", timeout: 180000 });
      await page.waitForTimeout(2500);
      const qty = page.locator("main").getByRole("spinbutton", { name: /Količina/ }).first();
      const max = await qty.evaluate((el) => el.getAttribute("aria-valuemax") || el.getAttribute("max"));
      await qty.fill(String(max));
      await qty.press("Tab");
      const add = page.getByTestId("product-add-to-cart").first();
      await add.click();
      await page.waitForTimeout(4000);
      log({
        check: "stock cap",
        max,
        buttonText: (await add.textContent())?.trim(),
        disabled: await add.isDisabled(),
        status: (await page.locator("main [role=status]").filter({ hasText: /korpi/ }).first().textContent().catch(() => null))?.trim(),
        errors,
      });
    } finally {
      await ctx.close();
    }
  }
  // 2. Disclosures: category intro and the fitment table.
  {
    const ctx = await newContext(browser, { width: 390, height: 844, tag: "cp1-disc" });
    const page = await ctx.newPage();
    try {
      for (const url of ["/delovi/kocioni-diskovi", PRODUCT]) {
        await page.goto(BASE + url, { waitUntil: "load", timeout: 180000 });
        await page.waitForTimeout(2500);
        const summary = page.locator("main details > summary").first();
        if (!(await summary.count())) {
          log({ check: "disclosure", url, skipped: "no details" });
          continue;
        }
        const label0 = (await summary.innerText()).trim();
        await summary.focus();
        await page.keyboard.press("Enter");
        await page.waitForTimeout(900);
        const open1 = await summary.evaluate((s) => s.parentElement.open);
        const h1 = await summary.evaluate((s) => s.nextElementSibling.getBoundingClientRect().height);
        await page.keyboard.press("Enter");
        await page.waitForTimeout(900);
        const open2 = await summary.evaluate((s) => s.parentElement.open);
        log({ check: "disclosure", url, label0, openAfterEnter: open1, contentHeight: Math.round(h1), openAfterSecondEnter: open2 });
      }
      await page.goto(BASE + "/porudzbina/hvala/xxxxxxxxxxxxxxxxxxxxxxxx", { waitUntil: "load", timeout: 180000 });
      await page.waitForTimeout(3000);
      log({ check: "hvala 404", title: await page.title(), h1: (await page.locator("h1").first().textContent().catch(() => null))?.trim() });
      await page.goto(BASE + "/delovi/kocioni-diskovi/volkswagen/golf", { waitUntil: "load", timeout: 180000 });
      await page.waitForTimeout(1500);
      const link = page.getByRole("link", { name: /Svi delovi za/ }).first();
      log({ check: "landing vehicle link", href: (await link.count()) ? await link.getAttribute("href") : null });
    } finally {
      await ctx.close();
    }
  }
  // 3. Admin 403 for a signed-in customer keeps its own title after hydration.
  {
    const acc = JSON.parse(readFileSync(".playwright/audit-accounts.json", "utf8")).customer;
    const ctx = await newContext(browser, { width: 1440, height: 900, tag: "cp1-403" });
    const page = await ctx.newPage();
    try {
      await loginWith(page, acc.email, acc.password);
      for (const url of ["/admin", "/admin/porudzbine"]) {
        const res = await page.goto(BASE + url, { waitUntil: "load", timeout: 180000 });
        await page.waitForTimeout(3500);
        log({ check: "admin 403", url, status: res?.status(), title: await page.title(), h1: (await page.locator("h1").first().textContent().catch(() => null))?.trim() });
      }
    } finally {
      await ctx.close();
    }
  }
} finally {
  await browser.close();
  writeFileSync("docs/qa/fix/cross-p1/ui-checks.json", JSON.stringify(out, null, 1));
}
