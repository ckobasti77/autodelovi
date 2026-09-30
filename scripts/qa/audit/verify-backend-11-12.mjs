/**
 * Verifier (step 21): backend-11 (rejected mechanic profile keeps the PIB reserved) and
 * backend-12 (password equal to the e-mail accepted).
 *   node scripts/qa/audit/verify-backend-11-12.mjs
 * Creates: one pending test mechanic via testing:createPendingMechanic (then rejected by the admin
 * through the UI), up to two fresh customer accounts via the UI. No mechanic profile is created
 * through the UI (the registration is expected to fail with DUPLICATE).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { mbCheckDigit, pibCheckDigit } from "../../../lib/domain/identifiers.ts";
import { BASE, convexRun, launch, loginAdmin, loginWith, newContext, shot } from "./kit.mjs";

const OUT = "verify/backend";
const log = { startedAt: new Date().toISOString() };
const stamp = String(Date.now()).slice(-7);
const pib8 = `2${stamp}`;
const pib = `${pib8}${pibCheckDigit(pib8)}`;
const mbA7 = `7${stamp.slice(-6)}`;
const mbA = `${mbA7}${mbCheckDigit(mbA7)}`;
const mbB7 = `8${stamp.slice(-6)}`;
const mbB = `${mbB7}${mbCheckDigit(mbB7)}`;
log.pib = pib;
log.mbFraud = mbA;
log.mbReal = mbB;

const browser = await launch();
try {
  // 1. "Fraudulent" registration holding the PIB (pending).
  const created = convexRun("testing:createPendingMechanic", { tag: `v11-${stamp}`, pib, mb: mbA });
  log.created = created;

  // 2. Staff reject it through the admin UI.
  {
    const context = await newContext(browser, { width: 1440, height: 900, tag: "v11-admin" });
    const page = await context.newPage();
    await loginAdmin(page);
    await page.goto(`${BASE}/admin/majstori/${created.profileId}`, { waitUntil: "networkidle" });
    await page.getByRole("textbox", { name: /Razlog odbijanja/ }).fill("PIB pripada drugoj firmi (APR).");
    await page.getByTestId("admin-mechanic-reject").click();
    await page.getByText("Vrati na čekanje").waitFor({ timeout: 30_000 });
    await page.waitForTimeout(800);
    log.adminButtonsAfterReject = await page
      .locator("main button")
      .evaluateAll((els) => els.map((e) => e.textContent.trim()).filter(Boolean));
    log.adminShot = await shot(page, `${OUT}/backend-11-reproduce-admin-rejected`);
    await context.close();
  }
  log.probeAfterReject = convexRun("testing:mechanicProfileProbe", { profileId: created.profileId });

  // 3. The real workshop registers with the same PIB (signed out → account created by the form).
  //    Variant for backend-12: the account password is the e-mail address itself.
  const realEmail = `audit-verify-b11-${stamp}@primer.rs`;
  log.realEmail = realEmail;
  {
    const context = await newContext(browser, { width: 1440, height: 900, tag: "v11-real" });
    const page = await context.newPage();
    await page.goto(`${BASE}/za-majstore/registracija`, { waitUntil: "networkidle" });
    await page.getByTestId("mechanic-reg-email").fill(realEmail);
    await page.getByTestId("mechanic-reg-password").fill(realEmail);
    await page.getByTestId("mechanic-reg-company").fill("Pravi servis d.o.o.");
    await page.getByTestId("mechanic-reg-pib").fill(pib);
    await page.getByTestId("mechanic-reg-mb").fill(mbB);
    await page.getByTestId("mechanic-reg-contact").fill("Nenad Ilić");
    await page.getByTestId("mechanic-reg-phone").fill("064 555 7788");
    await page.getByTestId("mechanic-reg-city").fill("Čačak");
    await page.getByTestId("mechanic-reg-address").fill("Gradsko šetalište 5");
    await page.getByTestId("mechanic-reg-service-mehanika").click();
    await page.getByTestId("mechanic-reg-terms").click();
    await page.getByTestId("mechanic-reg-submit").click();
    const dup = page.getByText("Ovaj PIB je već registrovan", { exact: false }).first();
    try {
      await dup.waitFor({ timeout: 45_000 });
      log.realRegistration = "DUPLICATE shown";
    } catch {
      log.realRegistration = `no duplicate message; url=${page.url()}`;
    }
    await page.waitForTimeout(600);
    log.realUrl = page.url();
    log.realMessages = await page
      .locator('[role="alert"], [id$="-error"], .text-danger')
      .evaluateAll((els) => els.map((e) => e.textContent.trim()).filter(Boolean));
    const pibField = page.getByTestId("mechanic-reg-pib");
    await pibField.scrollIntoViewIfNeeded();
    log.realShot = await shot(page, `${OUT}/backend-11-reproduce-duplicate-pib`);
    await context.close();
  }

  // 4. backend-12: does the account whose password equals the e-mail exist and sign in?
  {
    const context = await newContext(browser, { width: 390, height: 844, tag: "v12-login" });
    const page = await context.newPage();
    try {
      await loginWith(page, realEmail, realEmail, "/nalog");
      log.b12_mechanicFormAccountLogin = `signed in, url=${new URL(page.url()).pathname}`;
      log.b12Shot1 = await shot(page, `${OUT}/backend-12-reproduce-login-email-as-password`);
    } catch (e) {
      log.b12_mechanicFormAccountLogin = `failed: ${String(e).slice(0, 200)}`;
    }
    await context.close();
  }

  // 5. backend-12 on /registracija exactly as reported.
  const e12 = `marko2024-${stamp}@primer.rs`;
  log.b12Email = e12;
  {
    const context = await newContext(browser, { width: 1440, height: 900, tag: "v12-signup" });
    const page = await context.newPage();
    await page.goto(`${BASE}/registracija`, { waitUntil: "networkidle" });
    await page.getByLabel("Ime i prezime").fill("Marko Marković");
    await page.getByTestId("signup-email").fill(e12);
    await page.getByTestId("signup-password").fill(e12);
    await page.getByRole("checkbox").first().click();
    log.b12Shot2 = await shot(page, `${OUT}/backend-12-reproduce-signup-form`);
    await page.getByTestId("signup-submit").click();
    try {
      await page.waitForURL((u) => !u.pathname.startsWith("/registracija"), { timeout: 45_000 });
      log.b12_signup = `accepted, landed on ${new URL(page.url()).pathname}`;
    } catch {
      log.b12_signup = `stayed on ${page.url()}; alerts=${JSON.stringify(
        await page.locator('[role="alert"]').allTextContents(),
      )}`;
    }
    await page.waitForTimeout(800);
    log.b12Shot3 = await shot(page, `${OUT}/backend-12-reproduce-signup-accepted`);
    await context.close();
  }
} catch (e) {
  log.error = String(e?.stack ?? e).slice(0, 1500);
} finally {
  await browser.close();
  const file = path.resolve(`docs/qa/audit/${OUT}/backend-11-12-reproduce.json`);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(log, null, 2));
  console.log(JSON.stringify(log, null, 2));
}
