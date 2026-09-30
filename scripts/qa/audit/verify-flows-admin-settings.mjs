// Verifier (flows-admin-03 / -04): settings tab switch while dirty; PIB/MB saved without validation.
// Restores PIB and MB to their original values in `finally`.
import { writeFileSync, mkdirSync } from "node:fs";
import { BASE, launch, newContext, watch, shot } from "./kit.mjs";

const OUT = "docs/qa/audit/verify/flows-admin";
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const report = { steps: [] };
const step = (name, data = {}) => {
  report.steps.push({ name, ...data });
  console.log(name, JSON.stringify(data).slice(0, 700));
};
const txt = async (l) => ((await l.textContent().catch(() => "")) ?? "").replace(/\s+/g, " ").trim();

const browser = await launch();
const ctx = await newContext(browser, { width: 1440, height: 900, tag: "vfa-set", mobile: false });
const page = await ctx.newPage();
page.setDefaultTimeout(90_000);
const log = watch(page);
const dialogs = [];
page.on("dialog", async (d) => {
  dialogs.push(`${d.type()}: ${d.message()}`);
  await d.dismiss();
});

async function login() {
  for (let i = 0; i < 3; i++) {
    try {
      await page.goto(`${BASE}/prijava?next=%2Fadmin`, { waitUntil: "domcontentloaded", timeout: 120_000 });
      await page.getByTestId("auth-email").fill(process.env.SEED_ADMIN_EMAIL);
      await page.getByTestId("auth-password").fill(process.env.SEED_ADMIN_PASSWORD);
      await page.getByTestId("auth-submit").click();
      await page.waitForURL((u) => u.pathname.startsWith("/admin"), { timeout: 90_000 });
      await page.waitForLoadState("domcontentloaded").catch(() => {});
      await sleep(3000);
      return;
    } catch (e) {
      if (i === 2) throw e;
    }
  }
}
async function openSettings(tab = "") {
  for (let i = 0; i < 3; i++) {
    try {
      await page.goto(`${BASE}/admin/podesavanja${tab ? `?tab=${tab}` : ""}`, { waitUntil: "domcontentloaded" });
      break;
    } catch (e) {
      if (i === 2) throw e;
      await sleep(2500);
    }
  }
  await page.getByRole("tab", { name: "Firma" }).waitFor();
  await page.getByLabel("PIB", { exact: true }).waitFor();
  await sleep(1500);
}

let origPib = null;
let origMb = null;
try {
  await login();
  await openSettings();
  const slogan = page.getByLabel("Slogan", { exact: true });
  const origSlogan = await slogan.inputValue();
  origPib = await page.getByLabel("PIB", { exact: true }).inputValue();
  origMb = await page.getByLabel("Matični broj", { exact: true }).inputValue();
  step("original values", { origSlogan, origPib, origMb });

  // ---- 03: dirty section, switch tab, come back
  await slogan.fill("QA verifikacija slogan");
  await sleep(400);
  const bars = await page.getByRole("status").allTextContents();
  step("dirty status bars", { bars: bars.filter((b) => /sačuvan/.test(b)) });
  await slogan.scrollIntoViewIfNeeded();
  await shot(page, "verify/flows-admin/flows-admin-03-reproduce-dirty");
  await page.getByRole("tab", { name: "SEO" }).click();
  await sleep(1200);
  const dialogVisible = await page.getByRole("alertdialog").or(page.getByRole("dialog")).isVisible().catch(() => false);
  step("after click SEO", { url: page.url(), dialogVisible, selected: await page.getByRole("tab", { selected: true }).textContent() });
  await page.getByRole("tab", { name: "Firma" }).click();
  await sleep(1200);
  const sloganAfter = await page.getByLabel("Slogan", { exact: true }).inputValue();
  const barsAfter = (await page.getByRole("status").allTextContents()).filter((b) => /sačuvan/.test(b));
  step("after back to Firma", { sloganAfter, lost: sloganAfter === origSlogan, barsAfter });
  await page.getByLabel("Slogan", { exact: true }).scrollIntoViewIfNeeded();
  await shot(page, "verify/flows-admin/flows-admin-03-reproduce-after-switch");

  // Variant: Radno vreme tab field (another section)
  await page.getByRole("tab", { name: "Radno vreme" }).click();
  await sleep(1200);
  const hoursInput = page.locator('[role="tabpanel"][data-state="active"] input:not([type=checkbox]):not([type=hidden]):not([disabled])').first();
  const hBefore = await hoursInput.inputValue().catch(() => null);
  await hoursInput.fill("QA").catch(() => {});
  await sleep(400);
  const hBars = (await page.getByRole("status").allTextContents()).filter((b) => /sačuvan/.test(b));
  await page.getByRole("tab", { name: "Obaveštenja" }).click();
  await sleep(1000);
  await page.getByRole("tab", { name: "Radno vreme" }).click();
  await sleep(1200);
  const hAfter = await page
    .locator('[role="tabpanel"][data-state="active"] input:not([type=checkbox]):not([type=hidden]):not([disabled])')
    .first()
    .inputValue()
    .catch(() => null);
  step("variant Radno vreme", { hBefore, hBars, hAfter, lost: hAfter === hBefore });

  // Variant: dirty then reload (beforeunload)
  await page.getByRole("tab", { name: "Firma" }).click();
  await sleep(800);
  await page.getByLabel("Slogan", { exact: true }).fill("QA verifikacija 2");
  await sleep(300);
  const hasBeforeUnload = await page.evaluate(() => typeof window.onbeforeunload === "function");
  await page.reload({ waitUntil: "domcontentloaded" }).catch((e) => step("reload err", { e: String(e).slice(0, 200) }));
  await sleep(2500);
  step("variant reload while dirty", { dialogs: [...dialogs], hasBeforeUnloadProp: hasBeforeUnload });

  // ---- 04: invalid PIB + MB save
  await openSettings();
  await page.getByLabel("PIB", { exact: true }).fill("123");
  await page.getByLabel("Matični broj", { exact: true }).fill("12");
  await sleep(400);
  const pibInvalid = await page.getByLabel("PIB", { exact: true }).getAttribute("aria-invalid");
  // company bar is the first "Sačuvaj" in the company section's save bar
  const companyBar = page.locator("div.sticky", { has: page.getByRole("status") }).first();
  step("company bar", { text: await txt(companyBar), pibInvalid });
  await companyBar.getByRole("button", { name: "Sačuvaj" }).click();
  await sleep(3000);
  const toasts = await page.locator("[data-sonner-toast]").allTextContents().catch(() => []);
  const fieldErrors = await page.locator('[aria-invalid="true"]').count();
  step("after save invalid PIB", { toasts, fieldErrors });
  await page.getByLabel("PIB", { exact: true }).scrollIntoViewIfNeeded();
  await shot(page, "verify/flows-admin/flows-admin-04-reproduce-saved");
  await openSettings();
  step("stored after reload", {
    pib: await page.getByLabel("PIB", { exact: true }).inputValue(),
    mb: await page.getByLabel("Matični broj", { exact: true }).inputValue(),
  });
  for (const doc of ["predracun", "otpremnica"]) {
    const p2 = await ctx.newPage();
    await p2.goto(`${BASE}/admin/porudzbine/SK-2026-000112/${doc}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await sleep(3500);
    const body = await txt(p2.locator("body"));
    const i = body.search(/PIB/);
    step(`print ${doc}`, { snippet: i >= 0 ? body.slice(Math.max(0, i - 80), i + 80) : body.slice(0, 200) });
    await shot(p2, `verify/flows-admin/flows-admin-04-reproduce-${doc}`, { clip: { x: 0, y: 0, width: 1440, height: 420 } });
    await p2.close();
  }
} catch (e) {
  step("FAILED", { e: String(e).slice(0, 800) });
} finally {
  // restore PIB/MB
  try {
    if (origPib !== null) {
      await openSettings();
      const curPib = await page.getByLabel("PIB", { exact: true }).inputValue();
      const curMb = await page.getByLabel("Matični broj", { exact: true }).inputValue();
      if (curPib !== origPib || curMb !== origMb) {
        await page.getByLabel("PIB", { exact: true }).fill(origPib);
        await page.getByLabel("Matični broj", { exact: true }).fill(origMb);
        await sleep(400);
        const bar = page.locator("div.sticky", { has: page.getByRole("status") }).first();
        await bar.getByRole("button", { name: "Sačuvaj" }).click();
        await sleep(3000);
      }
      await openSettings();
      step("restored", {
        pib: await page.getByLabel("PIB", { exact: true }).inputValue(),
        mb: await page.getByLabel("Matični broj", { exact: true }).inputValue(),
        origPib,
        origMb,
      });
    }
  } catch (e) {
    step("RESTORE FAILED", { e: String(e).slice(0, 500) });
  }
  step("errors", log);
  writeFileSync(`${OUT}/flows-admin-03-04-reproduce.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
