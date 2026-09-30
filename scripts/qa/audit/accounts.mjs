/**
 * Creates the shared audit accounts (step 21) through the real UI and writes their credentials to
 * .playwright/audit-accounts.json (git-ignored folder, dev deployment only):
 *   - an approved mechanic („Majstor Plus“, deferred payment enabled),
 *   - a retail customer with an account.
 *   node scripts/qa/audit/accounts.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { mbCheckDigit, pibCheckDigit } from "../../../lib/domain/identifiers.ts";
import { BASE, convexRun, launch, newContext } from "./kit.mjs";

const stamp = String(Date.now()).slice(-7);
const password = "Radionica2026x";
const mechanic = { email: `audit-majstor-${stamp}@primer.rs`, password };
const customer = { email: `audit-kupac-${stamp}@primer.rs`, password };

const pib8 = `1${stamp}`;
const mb7 = `6${stamp.slice(-6)}`;
const pib = `${pib8}${pibCheckDigit(pib8)}`;
const mb = `${mb7}${mbCheckDigit(mb7)}`;

const browser = await launch();
{
  const context = await newContext(browser, { width: 1440, height: 900, tag: "acc-m" });
  const page = await context.newPage();
  await page.goto(`${BASE}/za-majstore/registracija`, { waitUntil: "networkidle" });
  await page.getByTestId("mechanic-reg-email").fill(mechanic.email);
  await page.getByTestId("mechanic-reg-password").fill(password);
  await page.getByTestId("mechanic-reg-company").fill("Audit servis d.o.o.");
  await page.getByTestId("mechanic-reg-pib").fill(pib);
  await page.getByTestId("mechanic-reg-mb").fill(mb);
  await page.getByTestId("mechanic-reg-contact").fill("Dragan Jović");
  await page.getByTestId("mechanic-reg-phone").fill("064 555 1234");
  await page.getByTestId("mechanic-reg-city").fill("Kragujevac");
  await page.getByTestId("mechanic-reg-address").fill("Kralja Petra I 12");
  await page.getByTestId("mechanic-reg-service-mehanika").click();
  await page.getByTestId("mechanic-reg-terms").click();
  await page.getByTestId("mechanic-reg-submit").click();
  await page.waitForURL(/\/za-majstore\/hvala/, { timeout: 60_000 });
  await context.close();
  mechanic.approval = convexRun("testing:approveMechanic", {
    email: mechanic.email,
    tierSlug: "majstor-plus",
    creditEnabled: true,
    creditLimitPara: 20_000_000,
  });
}
{
  const context = await newContext(browser, { width: 1440, height: 900, tag: "acc-c" });
  const page = await context.newPage();
  await page.goto(`${BASE}/registracija`, { waitUntil: "networkidle" });
  await page.getByLabel("Ime i prezime").fill("Marko Petrović");
  await page.getByTestId("signup-email").fill(customer.email);
  await page.getByTestId("signup-password").fill(password);
  await page.getByRole("checkbox").first().click();
  await page.getByTestId("signup-submit").click();
  await page.waitForURL((u) => !u.pathname.startsWith("/registracija"), { timeout: 60_000 });
  customer.landedOn = new URL(page.url()).pathname;
  await context.close();
}
await browser.close();

const out = path.resolve(".playwright/audit-accounts.json");
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({ mechanic, customer, pib, mb }, null, 2));
console.log(JSON.stringify({ mechanic, customer }, null, 2));
