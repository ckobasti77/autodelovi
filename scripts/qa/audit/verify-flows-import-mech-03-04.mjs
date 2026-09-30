/** Verifier (step 21): flows-import-mech-03 (plain-text e-mail preview uppercase) and -04 (import plurals). */
import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { BASE, launch, newContext, shot, watch } from "./kit.mjs";
import { loginAdminSafe } from "./flows-import-mech-lib.mjs";

const OUT = "docs/qa/audit/verify/flows-import-mech";
mkdirSync(OUT, { recursive: true });
const log = {};
const note = (k, v) => {
  log[k] = v;
  console.log(`--- ${k}\n${typeof v === "string" ? v : JSON.stringify(v, null, 2)}`);
};
const only = process.argv[2]; // "03" | "04" | undefined (both)

const browser = await launch();
const ctx = await newContext(browser, { width: 1440, height: 900, tag: "verify-fim-admin" });
const page = await ctx.newPage();
const w = watch(page);

const preInfo = (loc) =>
  loc.evaluate((pre) => {
    const cs = getComputedStyle(pre);
    return {
      textTransform: cs.textTransform,
      className: pre.className,
      clientWidth: pre.clientWidth,
      scrollWidth: pre.scrollWidth,
      overflowX: cs.overflowX,
      textContentHead: pre.textContent.slice(0, 260),
      innerTextHead: pre.innerText.slice(0, 260),
      longestLine: pre.textContent.split("\n").reduce((a, b) => (b.length > a.length ? b : a), ""),
    };
  });

try {
  await loginAdminSafe(page);

  if (!only || only === "03") {
    // ---- 03: e-mail log sheet → „Običan tekst“
    await page.goto(`${BASE}/admin/mejlovi`, { waitUntil: "load" });
    const row = page.getByText(/Porudžbina SK-\d{4}-\d{6} je primljena/).first();
    await row.waitFor({ timeout: 60000 });
    note("03:rowText", await row.innerText());
    await row.click();
    const tab = page.getByRole("tab", { name: "Običan tekst" });
    await tab.waitFor({ timeout: 30000 });
    await tab.click();
    const pre = page.getByRole("tabpanel").locator("pre").first();
    await pre.waitFor({ timeout: 30000 });
    await page.waitForTimeout(600);
    note("03:sheetPre", await preInfo(pre));
    await shot(page, "verify/flows-import-mech/flows-import-mech-03-reproduce-sheet-text-1440");
    await pre.evaluate((el) => (el.scrollTop = el.scrollHeight));
    await page.waitForTimeout(300);
    await shot(page, "verify/flows-import-mech/flows-import-mech-03-reproduce-sheet-text-bottom-1440");

    // gallery
    await page.goto(`${BASE}/admin/mejlovi/sabloni?sablon=order_received&prikaz=tekst`, { waitUntil: "load" });
    const gpre = page.locator("main pre").first();
    await gpre.waitFor({ timeout: 60000 });
    await page.waitForTimeout(600);
    note("03:galleryPre", await preInfo(gpre));
    note(
      "03:galleryIntro",
      await page.locator("main").innerText().then((t) => (t.match(/.{0,80}tačno kako.{0,80}/) ?? [""])[0]),
    );
    await shot(page, "verify/flows-import-mech/flows-import-mech-03-reproduce-gallery-text-1440");
    // variant: staff template + 390 px
    await page.goto(`${BASE}/admin/mejlovi/sabloni?sablon=staff_order_new&prikaz=tekst`, { waitUntil: "load" });
    await page.locator("main pre").first().waitFor({ timeout: 60000 });
    note("03:galleryStaffPre", await preInfo(page.locator("main pre").first()));
  }

  if (!only || only === "04") {
    // ---- 04: import wizard copy (dry run only, then cancel — no products change)
    const dir = path.join(os.tmpdir(), "sklop-verify-fim");
    mkdirSync(dir, { recursive: true });
    const csv = path.join(dir, "verify-plural.csv");
    writeFileSync(
      csv,
      "Šifra;Količina;MP cena\nDEMO-0001;3;1.250,00\nDEMO-0002;6;1.500,50\nDEMO-0003;9;0\n",
      "utf8",
    );
    await page.goto(`${BASE}/admin/uvoz`, { waitUntil: "load" });
    await page.getByTestId("import-template").waitFor({ timeout: 60000 });
    await page.getByTestId("import-file-input").setInputFiles(csv);
    await page.getByTestId("import-row-count").waitFor({ timeout: 30000 });
    note("04:fileRowCount", await page.getByTestId("import-row-count").innerText());
    note(
      "04:fileLine",
      await page
        .getByTestId("import-row-count")
        .locator("xpath=..")
        .innerText()
        .catch(() => ""),
    );
    await shot(page, "verify/flows-import-mech/flows-import-mech-04-reproduce-1-file-1440");
    await page.getByTestId("import-to-mapping").click();
    await page.getByTestId("import-mapping").waitFor({ timeout: 30000 });
    await page.getByRole("radio", { name: /Samo lager i cene/ }).click();
    await page.waitForTimeout(800);
    const mapText = await page.locator("main").innerText();
    note("04:mappingEvidence", (mapText.match(/Prepoznato iz fajla[^\n]*/) ?? [""])[0]);
    const evid = page.getByText(/Prepoznato iz fajla/).first();
    await evid.scrollIntoViewIfNeeded();
    await shot(page, "verify/flows-import-mech/flows-import-mech-04-reproduce-2-mapping-1440");
    await page.getByTestId("import-to-check").click();
    await page.getByTestId("import-start-dry-run").waitFor({ timeout: 60000 });
    const checkText = await page.locator("main").innerText();
    note("04:check", (checkText.match(/Ništa se još ne upisuje[^\n]*/) ?? [""])[0]);
    await page.getByText(/Ništa se još ne upisuje/).first().scrollIntoViewIfNeeded();
    await shot(page, "verify/flows-import-mech/flows-import-mech-04-reproduce-3-check-1440");
    await page.getByTestId("import-start-dry-run").click();
    await page.getByTestId("import-commit").waitFor({ timeout: 180000 });
    await page.waitForTimeout(1000);
    const dry = await page.locator("main").innerText();
    note("04:dryrun", {
      warning: (dry.match(/\d+ redova sa upozorenjem|\d+ reda? sa upozorenjem/) ?? [""])[0],
      writes: (dry.match(/[^\n]*se upisuj[eu][^\n]*/) ?? [""])[0],
      head: dry.slice(0, 900),
    });
    await shot(page, "verify/flows-import-mech/flows-import-mech-04-reproduce-4-dryrun-1440");
    const writesLoc = page.getByText(/se upisuj/).first();
    if (await writesLoc.count()) {
      await writesLoc.scrollIntoViewIfNeeded();
      await shot(page, "verify/flows-import-mech/flows-import-mech-04-reproduce-4b-dryrun-writes-1440");
    }
    // cancel the staged batch (nothing was written)
    const cancelBtn = page.getByRole("button", { name: "Otkaži uvoz" }).first();
    if (await cancelBtn.count()) {
      await cancelBtn.click();
      const dlg = page.getByRole("alertdialog");
      await dlg.waitFor({ timeout: 15000 });
      await dlg.getByRole("button", { name: "Otkaži uvoz" }).click();
      await page.waitForTimeout(2500);
      note("04:cancelled", (await page.locator("main").innerText()).slice(0, 300));
    }

    // Import history & an existing rolled-back record (read-only)
    await page.goto(`${BASE}/admin/uvoz/istorija`, { waitUntil: "load" });
    await page.waitForTimeout(4000);
    const hist = await page.locator("main").innerText();
    note("04:history", (hist.match(/\d+ redova/g) ?? []).slice(0, 10));
  }
} catch (e) {
  note("error", String(e).slice(0, 800));
  await shot(page, "verify/flows-import-mech/flows-import-mech-03-04-error-1440").catch(() => {});
} finally {
  note("watch", w);
  writeFileSync(`${OUT}/flows-import-mech-03-04-reproduce${only ? `-${only}` : ""}.json`, JSON.stringify(log, null, 2));
  await browser.close();
}
