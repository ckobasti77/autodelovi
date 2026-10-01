/**
 * forms-auth (step 22): no-JS auth forms (A11Y-04), back-in-stock focus (A11Y-08), /upit consent
 * description + category select size + photo rejections + breadcrumbs (A11Y-07, VIS-12,
 * FLOW-27, SEO-14), mechanic registration copy (FLOW-09, COPY-13), stepper name (A11Y-19).
 *   AUDIT_BASE=http://localhost:3001 node scripts/qa/fix/forms-auth-misc.mjs
 */
import { writeFileSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { launch, newContext, shot, BASE } from "../audit/kit.mjs";

const note = (k, v) => console.log("--", k, JSON.stringify(v).slice(0, 700));
const act = (page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    return el ? `${el.tagName.toLowerCase()}#${el.id}` : "none";
  });

const browser = await launch();
try {
  // 1. No JavaScript: auth forms are POST, the submit is disabled and the notice is visible.
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false });
    const page = await ctx.newPage();
    for (const route of ["/prijava", "/registracija", "/zaboravljena-lozinka", "/za-majstore/registracija"]) {
      await page.goto(BASE + route, { waitUntil: "load", timeout: 180000 });
      note(`nojs ${route}`, await page.evaluate(() => {
        const f = document.querySelector("main form:not([role=search])");
        const b = f?.querySelector('button[type="submit"]');
        return { method: f?.getAttribute("method"), submitDisabled: b?.disabled, notice: f?.querySelector("noscript") ? "noscript" : null };
      }));
    }
    await page.goto(BASE + "/prijava", { waitUntil: "load" });
    await page.locator('input[name="email"]').fill("audit@primer.rs");
    await page.locator('input[name="password"]').fill("TajnaLozinka-555");
    await page.locator('input[name="password"]').press("Enter");
    await page.waitForTimeout(1500);
    note("nojs /prijava URL after Enter (no password)", page.url().replace(BASE, ""));
    note("nojs notice text", await page.locator("main form p").filter({ hasText: "JavaScript" }).first().textContent().catch(() => null));
    await ctx.close();
  }
  const ctx = await newContext(browser, { width: 390, height: 844, tag: "fa-misc" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 160)));
  // 2. Back in stock (A11Y-08).
  await page.goto(BASE + "/deo/kocione-plocice-prednje-demo-0012", { waitUntil: "load", timeout: 180000 });
  const bis = page.getByTestId("back-in-stock-form");
  await bis.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500);
  await bis.getByRole("button", { name: "Obavesti me" }).focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(400);
  note("bis empty → focus + message", { focus: await act(page), msg: await page.locator("#bis-email-msg").textContent() });
  await page.locator("#bis-email").fill("pogresno@");
  await bis.getByRole("button", { name: "Obavesti me" }).click();
  await page.waitForTimeout(400);
  note("bis bad → message", await page.locator("#bis-email-msg").textContent());
  await page.locator("#bis-email").fill("ime@primer.rs");
  await bis.getByRole("button", { name: "Obavesti me" }).click();
  await page.waitForTimeout(400);
  note("bis no consent → focus + description", await page.evaluate(() => {
    const el = document.activeElement;
    const ids = (el?.getAttribute("aria-describedby") ?? "").split(" ").filter(Boolean);
    return { role: el?.getAttribute("role"), invalid: el?.getAttribute("aria-invalid"), desc: ids.map((i) => document.getElementById(i)?.textContent).join(" | ") };
  }));
  // 3. /upit: breadcrumbs, consent, category select, photo rejections.
  await page.goto(BASE + "/upit", { waitUntil: "load", timeout: 180000 });
  await page.waitForSelector('[data-testid="inquiry-submit"]:not([disabled])', { timeout: 120000 });
  note("upit breadcrumbs", await page.evaluate(() => ({
    nav: document.querySelector('nav[aria-label] ol')?.textContent?.replace(/\s+/g, " ").trim(),
    jsonld: [...document.querySelectorAll('script[type="application/ld+json"]')].some((s) => s.textContent.includes("BreadcrumbList")),
  })));
  note("upit control font sizes < md", await page.evaluate(() =>
    [...document.querySelectorAll("main form input:not([type=hidden]):not([type=file]):not([tabindex='-1']), main form select, main form textarea")]
      .filter((e) => e.offsetParent)
      .map((e) => `${e.id || e.getAttribute("aria-label") || e.name}:${getComputedStyle(e).fontSize}`)
      .filter((s) => parseFloat(s.split(":").pop()) < 16),
  ));
  note("upit 'Dodaj kategoriju' height", await page.evaluate(() => document.querySelector('select[aria-label="Dodaj kategoriju"]')?.getBoundingClientRect().height));
  const dir = mkdirSync(path.join(os.tmpdir(), "fa-photos"), { recursive: true }) ?? path.join(os.tmpdir(), "fa-photos");
  const pdf = path.join(dir, "racun.pdf");
  const big = path.join(dir, "velika.jpg");
  writeFileSync(pdf, "%PDF-1.4\n%fake\n");
  writeFileSync(big, Buffer.alloc(Math.round(9.2 * 1024 * 1024), 0xff));
  await page.locator('input[type="file"]').setInputFiles([pdf, big]);
  await page.waitForTimeout(500);
  note("upit photo rejections", await page.locator('[role="status"]').filter({ hasText: "fotografij" }).first().textContent());
  await page.getByTestId("inquiry-submit").click();
  await page.waitForTimeout(600);
  note("upit consent a11y", await page.evaluate(() => {
    const b = document.getElementById("iq-consent");
    const ids = (b?.getAttribute("aria-describedby") ?? "").split(" ").filter(Boolean);
    return { invalid: b?.getAttribute("aria-invalid"), required: b?.getAttribute("aria-required"), desc: ids.map((i) => document.getElementById(i)?.textContent).join(" | ") };
  }));
  note("upit required", await page.evaluate(() => ["iq-message", "iq-name", "iq-phone", "iq-email", "iq-vin"].map((id) => `${id}:${document.getElementById(id)?.getAttribute("aria-required")}`)));
  await shot(page, "../fix/forms-auth/upit-consent-390", { locator: page.locator("#iq-consent").locator("xpath=ancestor::fieldset[1]") });
  // 4. Mechanic registration (signed out): empty submit messages.
  await page.goto(BASE + "/za-majstore/registracija", { waitUntil: "load", timeout: 180000 });
  await page.waitForSelector('[data-testid="mechanic-registration-form"] button[type="submit"]:not([disabled])', { timeout: 120000 }).catch(() => null);
  await page.locator("#mr-mb").fill("64552873");
  await page.locator('[data-testid="mechanic-registration-form"] button[type="submit"]').click();
  await page.waitForTimeout(800);
  note("mech summary", await page.evaluate(() => [...document.querySelectorAll('[role="alert"] li')].map((li) => li.textContent)));
  note("mech terms a11y", await page.evaluate(() => {
    const b = document.getElementById("mr-terms");
    const ids = (b?.getAttribute("aria-describedby") ?? "").split(" ").filter(Boolean);
    return { invalid: b?.getAttribute("aria-invalid"), desc: ids.map((i) => document.getElementById(i)?.textContent).join(" | ") };
  }));
  note("console errors", errors);
  await ctx.close();
} finally {
  await browser.close();
}
