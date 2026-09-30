/**
 * Verifier for flows-shop-17: checkout step 1 back link „Korpa“ renders its ArrowLeft AFTER the label
 * while steps 2–4 show „← Nazad“. Adds one product, opens /porudzbina at 390 and 1440, captures the
 * action row on step 1 and step 2 and records the DOM order of icon vs text. Never submits an order.
 * Evidence: docs/qa/audit/verify/flows-shop/flows-shop-17-reproduce-*.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

import { BASE, launch, newContext, shot } from "./kit.mjs";
import { addToCart } from "./flows-shop-lib.mjs";

const OUTDIR = path.resolve("docs/qa/audit/verify/flows-shop");
mkdirSync(OUTDIR, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = { base: BASE, runs: [] };

async function rowInfo(page) {
  return page.evaluate(() => {
    const next = document.querySelector('[data-testid="checkout-next"]');
    const row = next?.parentElement;
    if (!row) return null;
    const back = row.firstElementChild;
    const kids = [...back.childNodes].map((n) =>
      n.nodeType === 3 ? `text:${n.textContent.trim()}` : n.querySelector?.("svg") || n.tagName === "svg" ? "icon" : `el:${n.textContent.trim()}`,
    );
    const svg = back.querySelector("svg");
    const r = back.getBoundingClientRect();
    const s = svg?.getBoundingClientRect();
    // text box via range
    const range = document.createRange();
    range.selectNodeContents(back);
    return {
      tag: back.tagName.toLowerCase(),
      text: back.textContent.trim(),
      childOrder: kids.filter((k) => k !== "text:"),
      iconLeftOfText: s ? s.left - r.left < 4 : null,
      iconX: s ? Math.round(s.left - r.left) : null,
      width: Math.round(r.width),
      rowRect: (() => {
        const rr = row.getBoundingClientRect();
        return { x: rr.left, y: rr.top + window.scrollY, width: rr.width, height: rr.height };
      })(),
    };
  });
}

async function captureRow(page, name) {
  await page.evaluate(() => {
    const next = document.querySelector('[data-testid="checkout-next"]');
    const y = next.getBoundingClientRect().top + window.scrollY - window.innerHeight / 2;
    window.scrollTo(0, Math.max(0, y));
  });
  await sleep(700);
  const row = page.getByTestId("checkout-next").locator("xpath=..");
  const box = await row.boundingBox();
  const vp = page.viewportSize();
  const clip = {
    x: 0,
    y: Math.max(0, box.y - 120),
    width: vp.width,
    height: Math.min(vp.height - Math.max(0, box.y - 120), box.height + 200),
  };
  return shot(page, `verify/flows-shop/${name}`, { clip });
}

const browser = await launch();
try {
  for (const vp of [
    { width: 390, height: 844, mobile: true },
    { width: 1440, height: 900, mobile: false },
  ]) {
    const ctx = await newContext(browser, { ...vp, tag: `verify-fs17-${vp.width}` });
    const page = await ctx.newPage();
    page.setDefaultTimeout(60_000);
    page.setDefaultNavigationTimeout(150_000);
    await addToCart(page, "abs-senzor-prednji-demo-0022", 1);
    await page.goto(`${BASE}/porudzbina`, { waitUntil: "domcontentloaded" });
    await page.getByTestId("checkout-step-contact").waitFor({ timeout: 60_000 });
    await page.waitForFunction(
      () => Object.keys(document.querySelector('[data-testid="checkout-next"]') ?? {}).some((k) => k.startsWith("__react")),
      null,
      { timeout: 120_000 },
    );
    await sleep(1500);
    const run = { viewport: vp.width };
    run.step1 = await rowInfo(page);
    run.step1Shot = await captureRow(page, `flows-shop-17-reproduce-step1-${vp.width}`);
    // fill contact and go to step 2 (client-side only)
    await page.getByLabel("Ime", { exact: true }).fill("Verifikacija");
    await page.getByLabel("Prezime").fill("Povratak");
    await page.getByLabel("Telefon", { exact: true }).fill("064 765 4321");
    await page.getByLabel("E-pošta").fill(`audit-verify-fs17-${Date.now()}@primer.rs`);
    await page.getByTestId("checkout-next").click();
    await sleep(1500);
    run.step2Heading = await page.evaluate(() => document.querySelector("form h2, form legend")?.textContent?.trim() ?? null);
    run.step2 = await rowInfo(page);
    run.step2Shot = await captureRow(page, `flows-shop-17-reproduce-step2-${vp.width}`);
    out.runs.push(run);
    await ctx.close();
  }
} catch (e) {
  out.error = String(e).slice(0, 600);
  console.error(e);
} finally {
  writeFileSync(path.join(OUTDIR, "flows-shop-17-reproduce.json"), JSON.stringify(out, null, 2));
  await browser.close();
  console.log(JSON.stringify(out, null, 2));
}
