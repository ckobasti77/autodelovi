// Fix verification (step 22, package admin-flows): FLOW-14, FLOW-15, FLOW-18, FLOW-24,
// A11Y-17, VIS-18. Never saves settings; the import dry run is cancelled; only a throwaway
// pending mechanic (testing:createPendingMechanic) is rejected.
// Usage (PowerShell, owner env set): $env:AUDIT_BASE="http://localhost:3001"; node scripts/qa/fix/admin-flows-verify.mjs [parts]
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { BASE, convexRun, launch, loginAdmin, newContext, watch } from "../audit/kit.mjs";

const OUT = "docs/qa/fix/admin-flows";
mkdirSync(OUT, { recursive: true });
const parts = (process.argv[2] ?? "settings,mechanic,import,order").split(",");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const report = {};
const log = (k, v) => {
  report[k] = v;
  console.log(k, JSON.stringify(v).slice(0, 400));
};

function pibCheck(first8) {
  let s = 10;
  for (const ch of first8) {
    s = (s + Number(ch)) % 10;
    s = ((s === 0 ? 10 : s) * 2) % 11;
  }
  return (11 - s) % 10;
}
function mbCheck(first7) {
  const w = [2, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 7; i++) sum += Number(first7[i]) * w[i];
  const k = 11 - (sum % 11);
  return k > 9 ? 0 : k;
}

const browser = await launch();
try {
  const ctx = await newContext(browser, { width: 1440, height: 900, tag: "fix-af", mobile: false });
  const page = await ctx.newPage();
  page.setDefaultTimeout(60_000);
  const errors = watch(page);
  const dialogs = [];
  page.on("dialog", async (d) => {
    dialogs.push(d.type());
    await d.dismiss();
  });
  await loginAdmin(page);
  await sleep(2500);
  const go = async (url) => {
    for (let i = 0; i < 3; i++) {
      try {
        return await page.goto(url, { waitUntil: "domcontentloaded" });
      } catch (e) {
        if (i === 2) throw e;
        await sleep(1500);
      }
    }
  };

  if (parts.includes("settings")) {
    await go(`${BASE}/admin/podesavanja`);
    const slogan = page.getByLabel("Slogan");
    await slogan.waitFor();
    const original = await slogan.inputValue();
    await slogan.fill(`${original} QA`);
    await page.getByRole("tab", { name: "SEO" }).click();
    const alert = page.getByRole("alertdialog");
    await alert.waitFor({ timeout: 5000 });
    const alertText = (await alert.textContent())?.replace(/\s+/g, " ").trim();
    await alert.getByRole("button", { name: "Odustani" }).click();
    await alert.waitFor({ state: "hidden" });
    const afterStay = {
      url: new URL(page.url()).search,
      slogan: await slogan.inputValue(),
      firmaSelected: await page.getByRole("tab", { name: "Firma" }).getAttribute("aria-selected"),
    };
    // beforeunload guard while dirty
    await page.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
    await sleep(800);
    const beforeUnload = dialogs.filter((d) => d === "beforeunload").length;
    const stillDirty = await slogan.inputValue().catch(() => null);
    await page.getByRole("tab", { name: "SEO" }).click();
    await alert.waitFor({ timeout: 5000 });
    await alert.getByRole("button", { name: "Odbaci i pređi" }).click();
    await page.waitForURL(/tab=seo/);
    await page.getByRole("tab", { name: "Firma" }).click();
    await slogan.waitFor();
    const afterDiscard = { url: new URL(page.url()).search, slogan: await slogan.inputValue() };
    log("FLOW-14", { original, alertText, afterStay, beforeUnload, stillDirty, afterDiscard });

    // FLOW-15: PIB / MB / bank account checks on the client, nothing saved.
    const pib = page.getByTestId("admin-settings-pib");
    const pibBefore = await pib.inputValue();
    await pib.fill("123");
    await pib.blur();
    const pibInvalid = await pib.getAttribute("aria-invalid");
    const describedBy = (await pib.getAttribute("aria-describedby")) ?? "";
    const pibMessage = await page.evaluate(
      (ids) =>
        ids
          .split(" ")
          .map((id) => document.getElementById(id)?.textContent?.trim())
          .filter(Boolean)
          .join(" | "),
      describedBy,
    );
    await page.getByText("Podaci o firmi nisu sačuvani.").waitFor();
    const bar = page.locator("div.sticky", { hasText: "Podaci o firmi nisu sačuvani." });
    await bar.getByRole("button", { name: "Sačuvaj" }).click();
    await sleep(400);
    const focused = await page.evaluate(() => document.activeElement?.getAttribute("data-testid"));
    const toastText = await page
      .getByText("Proverite označena polja.")
      .first()
      .isVisible()
      .catch(() => false);
    await pib.fill("154552870");
    const okText = await page
      .getByText("PIB je ispravan.")
      .isVisible()
      .catch(() => false);
    const pibValidInvalidAttr = await pib.getAttribute("aria-invalid");
    const mb = page.getByTestId("admin-settings-mb");
    await mb.fill("12");
    await mb.blur();
    const mbInvalid = await mb.getAttribute("aria-invalid");
    await page.getByRole("button", { name: "Dodaj račun" }).click();
    const accounts = await page.locator('[data-testid^="admin-settings-bank-"]').count();
    const bank = page.getByTestId(`admin-settings-bank-${accounts - 1}`);
    await bank.fill("160-123-45");
    await bank.blur();
    const bankInvalid = await bank.getAttribute("aria-invalid");
    await bar.getByRole("button", { name: "Odbaci izmene" }).click();
    const pibAfterDiscard = await pib.inputValue();
    log("FLOW-15", {
      pibBefore,
      pibInvalid,
      pibMessage,
      focusedAfterSave: focused,
      toastText,
      okText,
      pibValidInvalidAttr,
      mbInvalid,
      bankInvalid,
      pibAfterDiscard,
    });
  }

  if (parts.includes("mechanic") || parts.includes("suspend")) {
    const alert = page.getByRole("alertdialog");
    if (parts.includes("mechanic")) {
      const tag = `fixaf${Date.now().toString().slice(-7)}`;
      const p8 = `1${Date.now().toString().slice(-7)}`;
      const m7 = `7${Date.now().toString().slice(-6)}`;
      const { profileId } = convexRun("testing:createPendingMechanic", {
        tag,
        pib: `${p8}${pibCheck(p8)}`,
        mb: `${m7}${mbCheck(m7)}`,
      });
      await go(`${BASE}/admin/majstori/${profileId}`);
      const reject = page.getByRole("button", { name: "Odbij registraciju" });
      await reject.waitFor();
      await reject.click();
      await sleep(300);
      const emptyReason = {
        dialog: await page.getByRole("alertdialog").count(),
        focusedTag: await page.evaluate(() => document.activeElement?.tagName),
        fieldInvalid: await page.getByLabel("Razlog odbijanja").getAttribute("aria-invalid"),
      };
      await page.getByLabel("Razlog odbijanja").fill("Nedostaje rešenje iz APR-a.");
      await reject.click();
      await alert.waitFor({ timeout: 5000 });
      const alertText = (await alert.textContent())?.replace(/\s+/g, " ").trim();
      await alert.getByRole("button", { name: "Odustani" }).click();
      await sleep(1200);
      const statusAfterCancel = convexRun("testing:mechanicProfileProbe", { profileId });
      await reject.click();
      await alert.waitFor();
      await alert.getByRole("button", { name: "Odbij registraciju" }).click();
      await alert.waitFor({ state: "hidden" });
      await sleep(1500);
      const statusAfterConfirm = convexRun("testing:mechanicProfileProbe", { profileId });
      log("FLOW-18-reject", {
        profileId,
        emptyReason,
        alertText,
        statusAfterCancel: statusAfterCancel?.status ?? statusAfterCancel,
        statusAfterConfirm: statusAfterConfirm?.status ?? statusAfterConfirm,
      });
    }
    // Suspend on the approved audit mechanic: open the dialog, then cancel.
    const approvedId = "p578dq9d2cdkx47b5j5ssyph5n8fc1t9";
    await go(`${BASE}/admin/majstori/${approvedId}`);
    const suspend = page.getByRole("button", { name: "Pauziraj nalog" });
    const hasSuspend = await suspend
      .waitFor({ timeout: 30_000 })
      .then(() => true)
      .catch(() => false);
    if (hasSuspend) {
      await suspend.click();
      await alert.waitFor({ timeout: 5000 });
      const text = (await alert.textContent())?.replace(/\s+/g, " ").trim();
      await alert.getByRole("button", { name: "Odustani" }).click();
      await sleep(1000);
      const probe = convexRun("testing:mechanicProfileProbe", { profileId: approvedId });
      log("FLOW-18-suspend", { alertText: text, statusAfterCancel: probe?.status ?? probe });
    } else log("FLOW-18-suspend", { skipped: "approved mechanic has no suspend button" });
  }

  if (parts.includes("seo")) {
    await go(`${BASE}/admin/podesavanja?tab=seo`);
    const field = page.getByLabel("Podrazumevani opis");
    await field.waitFor();
    const counters = await field.evaluate((ta) => {
      let box = ta.parentElement;
      while (box && !box.querySelector("label")) box = box.parentElement;
      return box ? (box.textContent.match(/\d+\s*\/\s*\d+/g) ?? []) : null;
    });
    log("VIS-31", { counters });
  }

  if (parts.includes("import")) {
    await go(`${BASE}/admin/uvoz`);
    await page
      .getByTestId("import-file-input")
      .setInputFiles(path.resolve("tests/fixtures/import/lager-cene.xlsx"));
    const rowCount = page.getByTestId("import-row-count");
    await rowCount.waitFor({ timeout: 30_000 });
    const rows = (await rowCount.textContent())?.trim();
    await page.getByTestId("import-to-mapping").focus();
    await page.keyboard.press("Enter");
    await page.getByTestId("import-mapping").waitFor();
    await sleep(300);
    const focusStep2 = await page.evaluate(() => ({
      tag: document.activeElement?.tagName,
      text: document.activeElement?.textContent?.trim(),
    }));
    const detected = await page
      .getByText(/Prepoznato iz fajla/)
      .first()
      .textContent()
      .catch(() => null);
    await page
      .getByText("Samo lager i cene")
      .first()
      .click()
      .catch(() => {});
    await page.getByTestId("import-to-check").click();
    await page.getByTestId("import-start-dry-run").waitFor({ timeout: 60_000 });
    await sleep(300);
    const focusStep3 = await page.evaluate(() => document.activeElement?.textContent?.trim());
    const most = await page
      .getByText(/Upisaće se najviše/)
      .textContent()
      .catch(() => null);
    await page.getByTestId("import-start-dry-run").click();
    await page.getByTestId("import-commit").waitFor({ timeout: 180_000 });
    await sleep(500);
    const focusStep4 = await page.evaluate(() => document.activeElement?.textContent?.trim());
    const writes = await page
      .getByText(/se upisuj/)
      .first()
      .textContent()
      .catch(() => null);
    const warnHint = await page
      .getByText(/sa upozorenjem/)
      .first()
      .textContent()
      .catch(() => null);
    await page.getByRole("button", { name: "Otkaži uvoz" }).first().click();
    const alert = page.getByRole("alertdialog");
    await alert.waitFor();
    await alert.getByRole("button", { name: "Otkaži uvoz" }).click();
    await page.getByTestId("import-file-input").waitFor({ state: "attached", timeout: 30_000 });
    await sleep(300);
    const focusAfterCancel = await page.evaluate(() => document.activeElement?.textContent?.trim());
    log("FLOW-24+A11Y-17-wizard", {
      rows,
      detected,
      most,
      writes,
      warnHint,
      focusStep2,
      focusStep3,
      focusStep4,
      focusAfterCancel,
    });
    // Status region on a finished batch (/admin/uvoz/<id>).
    await go(`${BASE}/admin/uvoz/istorija`);
    const link = page.locator('a[href^="/admin/uvoz/"]').filter({ hasNotText: "Istorija" });
    await link
      .first()
      .waitFor({ timeout: 30_000 })
      .catch(() => {});
    const hrefs = await link.evaluateAll((as) => as.map((a) => a.getAttribute("href")));
    const href = hrefs.find((h) => /\/admin\/uvoz\/[a-z0-9]{20,}$/.test(h ?? ""));
    if (href) {
      await go(`${BASE}${href}`);
      const status = page.getByTestId("import-status");
      await status.waitFor({ state: "attached", timeout: 30_000 }).catch(() => {});
      log("A11Y-17-batch", {
        href,
        role: await status.getAttribute("role").catch(() => null),
        text: await status.textContent().catch(() => null),
        description: await page
          .locator("header p, p")
          .filter({ hasText: /\d\s(red|reda|redova)\b/ })
          .first()
          .textContent()
          .catch(() => null),
      });
    } else log("A11Y-17-batch", { skipped: "no batch link", hrefs: hrefs.slice(0, 5) });
  }

  if (parts.includes("order")) {
    const out = {};
    for (const [w, h] of [
      [1024, 768],
      [1100, 800],
      [1440, 900],
      [390, 844],
    ]) {
      await page.setViewportSize({ width: w, height: h });
      await go(`${BASE}/admin/porudzbine/SK-2026-000092`);
      const table = page.locator("table", {
        has: page.locator("caption", { hasText: "Stavke porudžbine" }),
      });
      await table.waitFor({ timeout: 60_000 });
      await sleep(400);
      out[w] = await table.evaluate((t) => {
        const wrap = t.parentElement;
        const heads = [...t.querySelectorAll("thead th")]
          .filter((th) => th.offsetParent !== null && getComputedStyle(th).display !== "none")
          .map((th) => th.textContent.trim());
        const firstRow = t.querySelector("tbody tr");
        const cells = firstRow
          ? [...firstRow.cells]
              .filter((c) => getComputedStyle(c).display !== "none")
              .map((c) => c.innerText.replace(/\s+/g, " ").trim().slice(0, 120))
          : [];
        const card = t.closest("section") ?? wrap;
        const cr = card.getBoundingClientRect();
        const tr = t.getBoundingClientRect();
        return {
          heads,
          cells,
          tableW: Math.round(tr.width),
          wrapClient: wrap.clientWidth,
          wrapScroll: wrap.scrollWidth,
          overflows: wrap.scrollWidth > wrap.clientWidth + 1,
          tableRightInsideCard: tr.right <= cr.right + 1,
        };
      });
      // Edit mode (never saved): every column must still fit from 1024 px up.
      const edit = page.getByRole("button", { name: "Izmeni stavke" });
      if (w >= 1024 && (await edit.count()) > 0) {
        await edit.click();
        await sleep(300);
        out[`${w}-edit`] = await table.evaluate((t) => ({
          heads: [...t.querySelectorAll("thead th")].map((th) => th.textContent.trim()),
          tableW: Math.round(t.getBoundingClientRect().width),
          wrapClient: t.parentElement.clientWidth,
          overflows: t.parentElement.scrollWidth > t.parentElement.clientWidth + 1,
        }));
        await page.getByRole("button", { name: "Odbaci izmene" }).click();
      }
    }
    log("VIS-18", out);
  }
  report.consoleErrors = errors?.errors ?? errors;
} finally {
  writeFileSync(path.join(OUT, `verify-${parts.join("-")}.json`), JSON.stringify(report, null, 2));
  await browser.close();
}
