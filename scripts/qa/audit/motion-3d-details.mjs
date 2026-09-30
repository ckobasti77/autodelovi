// motion-3d (second reviewer): copy that is not visible during a normal scroll sweep —
// <details> answers (FAQ, fitment, listing, checkout) and dialog/sheet content. For every
// <details>: open it after scrollThrough, sample the hidden copy inside at 60 ms and 1500 ms, and
// record how the panel opens (instant vs animated height). Overlays: sample inside the dialog.
import { writeFileSync } from "node:fs";
import { BASE, launch, newContext, watch, scrollThrough, shot } from "./kit.mjs";

const OUT = "docs/qa/audit/motion-3d";
const vpArg = process.argv[2] ?? "1440";
const VP = vpArg === "390" ? { width: 390, height: 844 } : { width: 1440, height: 900 };
const browser = await launch();
const ctx = await newContext(browser, { ...VP, tag: `m3d-details-${vpArg}` });
const page = await ctx.newPage();
const log = watch(page);
const rows = [];

const hiddenInside = (sel, idx) =>
  page.evaluate(
    ([sel, idx]) => {
      const root = document.querySelectorAll(sel)[idx];
      if (!root) return null;
      const els = [...root.querySelectorAll("*")].filter(
        (e) => e.offsetParent && e.textContent.trim() && e.children.length < 50,
      );
      const hidden = els.filter((e) => parseFloat(getComputedStyle(e).opacity) < 0.05);
      const states = {};
      for (const e of root.querySelectorAll("[data-reveal-state]")) {
        const s = e.getAttribute("data-reveal-state");
        states[s] = (states[s] ?? 0) + 1;
      }
      return {
        hidden: hidden.length,
        sample: hidden.slice(0, 4).map((e) => `${e.tagName.toLowerCase()}: ${e.textContent.trim().slice(0, 50)}`),
        states,
        words: root.querySelectorAll(".reveal-word").length,
        h: Math.round(root.getBoundingClientRect().height),
      };
    },
    [sel, idx],
  );

for (const url of ["/", "/za-majstore", "/deo/kocioni-disk-prednji-276-24-mm-demo-0004", "/delovi/kocioni-diskovi"]) {
  await page.goto(`${BASE}${url}`, { waitUntil: "load", timeout: 90_000 });
  await page.waitForTimeout(1500);
  await scrollThrough(page);
  const n = await page.evaluate(() => document.querySelectorAll("details").length);
  for (let i = 0; i < Math.min(n, 3); i++) {
    const summary = page.locator("details > summary").nth(i);
    if (!(await summary.isVisible().catch(() => false))) {
      rows.push({ url, i, skipped: "summary not visible" });
      continue;
    }
    await summary.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    const before = await hiddenInside("details", i);
    await summary.click();
    await page.waitForTimeout(60);
    const at60 = await hiddenInside("details", i);
    if (i === 0) await shot(page, `motion-3d/v2-details-${vpArg}-${url.replace(/\W+/g, "_")}-60ms`, {});
    await page.waitForTimeout(1500);
    const at1500 = await hiddenInside("details", i);
    const title = (await summary.textContent())?.trim().slice(0, 50);
    rows.push({ url, i, title, before, at60, at1500 });
    console.log(url, i, title, JSON.stringify({ h: [before?.h, at60?.h, at1500?.h], at60: at60?.hidden, at1500: at1500?.hidden, states: at1500?.states, sample: at1500?.sample }));
    await summary.click(); // close again
    await page.waitForTimeout(300);
  }
}

// Overlays: hidden copy inside the dialog at 100 ms and 1200 ms after opening.
await page.goto(`${BASE}/`, { waitUntil: "load", timeout: 90_000 });
await page.waitForTimeout(2000);
const overlays = [
  ["parts list", () => page.getByTestId("parts-list-trigger").click()],
  ["header vehicle", () => page.locator("header").getByRole("button", { name: /Izaberite vozilo/ }).first().click()],
  ["cart", () => page.locator("header").getByRole("link", { name: /Korpa/ }).first().click()],
];
if (VP.width < 1024) overlays.push(["menu", () => page.locator("header").getByRole("button", { name: /meni/i }).first().click()]);
for (const [name, open] of overlays) {
  try {
    await open();
  } catch (e) {
    rows.push({ overlay: name, error: String(e).slice(0, 120) });
    continue;
  }
  await page.waitForTimeout(100);
  const a = await page.evaluate(() => {
    const d = [...document.querySelectorAll('[role="dialog"]')].filter((e) => e.getBoundingClientRect().width > 0).pop();
    if (!d) return null;
    const hidden = [...d.querySelectorAll("*")].filter((e) => e.offsetParent && e.textContent.trim() && parseFloat(getComputedStyle(e).opacity) < 0.05);
    return { hidden: hidden.length, words: d.querySelectorAll(".reveal-word").length, pending: d.querySelectorAll('[data-reveal-state="pending"]').length };
  });
  await page.waitForTimeout(1100);
  const b = await page.evaluate(() => {
    const d = [...document.querySelectorAll('[role="dialog"]')].filter((e) => e.getBoundingClientRect().width > 0).pop();
    if (!d) return null;
    const hidden = [...d.querySelectorAll("*")].filter((e) => e.offsetParent && e.textContent.trim() && parseFloat(getComputedStyle(e).opacity) < 0.05);
    return { hidden: hidden.length, sample: hidden.slice(0, 3).map((e) => e.textContent.trim().slice(0, 40)), words: d.querySelectorAll(".reveal-word").length, pending: d.querySelectorAll('[data-reveal-state="pending"]').length };
  });
  rows.push({ overlay: name, at100: a, at1200: b, url: page.url() });
  console.log("overlay", name, JSON.stringify({ at100: a, at1200: b }));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(700);
  if (!page.url().endsWith("/")) {
    await page.goto(`${BASE}/`, { waitUntil: "load", timeout: 90_000 });
    await page.waitForTimeout(1500);
  }
}
rows.push({ log });
console.log("errors", JSON.stringify(log));
writeFileSync(`${OUT}/v2-details-${vpArg}.json`, JSON.stringify(rows, null, 2));
await browser.close();
