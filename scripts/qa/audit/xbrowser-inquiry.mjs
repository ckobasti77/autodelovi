/**
 * xbrowser — VIN inquiry with a photo per engine × viewport → testing:inquiryProbe.
 */
import path from "node:path";

import { BASE, convexRun, shot, watch } from "./kit.mjs";
import { ENGINES, VIEWS, cspLog, launch, saveJson, xctx } from "./xbrowser-lib.mjs";

const out = {};
const only = process.env.XB_VIEWS ? process.env.XB_VIEWS.split(",") : null;
for (const engine of ENGINES) {
  const browser = await launch(engine);
  for (const v of VIEWS) {
    if (only && !only.includes(v.tag)) continue;
    const key = `${engine}-${v.tag}`;
    const r = (out[key] = {});
    const context = await xctx(browser, engine, { width: v.width, height: v.height, tag: `inq${v.tag}` });
    const page = await context.newPage();
    page.setDefaultTimeout(30_000);
    const log = watch(page);
    try {
      await page.goto(`${BASE}/upit`, { waitUntil: "domcontentloaded", timeout: 90_000 });
      await page.getByTestId("inquiry-vin-input").waitFor();
      await page.waitForTimeout(2500);
      await shot(page, `xbrowser/inq-${key}-01-form`);
      await page.getByTestId("inquiry-vin-input").fill("WVWZZZ1KZ8W123456");
      await page.waitForTimeout(800);
      r.brand = await page.getByLabel("Marka").inputValue();
      r.brandTag = await page.getByLabel("Marka").evaluate((e) => e.tagName);
      await page.getByLabel("Opis").fill("Turbina za Golf, dizel. Stara duva ulje na izduvnoj strani.");
      await page.getByTestId("inquiry-photo-input").setInputFiles(path.resolve("tests/fixtures/part-photo.jpg"));
      await page.locator('[data-testid="inquiry-photo"][data-status="done"]').first().waitFor({ timeout: 45_000 });
      await page.getByLabel("Ime", { exact: true }).fill("Marko Jovanović");
      await page.getByLabel("Telefon", { exact: true }).fill("065 987 6543");
      await page.getByRole("checkbox", { name: /Slažem se/ }).click();
      await page.waitForTimeout(3300);
      await shot(page, `xbrowser/inq-${key}-02-filled`, { fullPage: true, quality: 55 });
      await page.getByTestId("inquiry-submit").click();
      await page.waitForURL(/\/upit\/hvala\//, { timeout: 45_000 });
      r.number = (await page.getByTestId("inquiry-number").textContent())?.trim();
      await page.waitForTimeout(1200);
      await shot(page, `xbrowser/inq-${key}-03-thanks`);
      r.probe = convexRun("testing:inquiryProbe", { number: r.number });
    } catch (e) {
      r.error = String(e).split("\n").slice(0, 3).join(" | ").slice(0, 400);
      await shot(page, `xbrowser/inq-${key}-error`).catch(() => {});
    }
    r.csp = await cspLog(page);
    r.log = log;
    await context.close();
    console.log(key, JSON.stringify({ brand: r.brand, tag: r.brandTag, number: r.number, probe: r.probe && { status: r.probe.status, kind: r.probe.kind, photos: r.probe.photoCount }, err: r.error, csp: r.csp.length, console: log.console, pageErrors: log.pageErrors, bad: log.badResponses.slice(0, 4) }));
  }
  await browser.close();
}
saveJson(`inquiry-${ENGINES.join("_")}.json`, out);
