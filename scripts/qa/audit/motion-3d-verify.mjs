// motion-3d (second reviewer): re-verification of the hero keyboard paths at 1440 —
// parts-list dialog focus return (Escape, close button, pick → panel → Escape), panel close via
// click → focus, pin-spacer / ScrollTrigger residue across client navigation.
import { writeFileSync } from "node:fs";
import { BASE, launch, newContext, watch, shot } from "./kit.mjs";

const OUT = "docs/qa/audit/motion-3d";
const browser = await launch();
const ctx = await newContext(browser, { width: 1440, height: 900, tag: "m3d-verify" });
const page = await ctx.newPage();
const log = watch(page);
const rows = [];
const rec = (k, v) => {
  rows.push({ k, v });
  console.log(k, typeof v === "string" ? v : JSON.stringify(v));
};
const active = () =>
  page.evaluate(() => {
    const a = document.activeElement;
    if (!a || a === document.body) return "BODY";
    return `${a.tagName.toLowerCase()}[${a.getAttribute("data-testid") ?? a.getAttribute("role") ?? ""}] "${(a.getAttribute("aria-label") || a.textContent || "").trim().slice(0, 40)}"`;
  });
const dialogOpen = () =>
  page.evaluate(() =>
    [...document.querySelectorAll('[role="dialog"]')].some((e) => e.getBoundingClientRect().width > 0),
  );
const state = () => page.evaluate(() => window.__sklop3d?.getState?.() ?? null);

await page.goto(`${BASE}/`, { waitUntil: "load", timeout: 90_000 });
await page.waitForTimeout(2500);
rec("pinSpacers home initial", await page.evaluate(() => document.querySelectorAll(".pin-spacer").length));

const trigger = page.getByTestId("parts-list-trigger");
async function openList() {
  await trigger.focus();
  await page.keyboard.press("Enter");
  for (let i = 0; i < 40 && !(await dialogOpen()); i++) await page.waitForTimeout(250);
  await page.waitForTimeout(500);
  return dialogOpen();
}

// 1) Escape.
rec("1 open", await openList());
rec("1 focus inside", await active());
await page.keyboard.press("Escape");
await page.waitForTimeout(900);
rec("1 after Escape open", await dialogOpen());
rec("1 after Escape focus", await active());
await shot(page, "motion-3d/v2-partslist-after-escape-1440", {});

// 2) Close button.
rec("2 open", await openList());
await page.locator('[role="dialog"] button[aria-label="Zatvori"]').last().click();
await page.waitForTimeout(900);
rec("2 after close button focus", await active());

// 3) Pick from the list by keyboard → panel → Escape.
rec("3 open", await openList());
await page.keyboard.press("Tab"); // first category button after the close button
const firstItem = await active();
rec("3 focused item", firstItem);
await page.keyboard.press("Enter");
await page.waitForTimeout(2500);
rec("3 state after pick", await state());
rec("3 focus in panel", await active());
await page.keyboard.press("Escape");
await page.waitForTimeout(1200);
rec("3 after panel Escape", { state: await state(), focus: await active() });

// 4) Panel from the canvas (select via hook as a click would) → Zatvori → focus should go to stage.
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(600);
const ok = await page.evaluate(() => window.__sklop3d?.selectPart?.("kocioni-diskovi"));
await page.waitForTimeout(2500);
rec("4 select via hook", { ok, state: await state(), focus: await active() });
const closeBtn = page.locator('[role="dialog"] button[aria-label="Zatvori"]').last();
if (await closeBtn.isVisible().catch(() => false)) {
  await closeBtn.click();
  await page.waitForTimeout(1200);
  rec("4 after panel close button", { state: await state(), focus: await active() });
}

// 5) Pin spacers / ScrollTrigger residue across client navigation.
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(500);
await page.locator('header a[href="/delovi"]').first().click();
await page.waitForURL(/\/delovi$/, { timeout: 60_000 });
await page.waitForTimeout(2500);
rec("5 /delovi pinSpacers + body style", await page.evaluate(() => ({
  pinSpacers: document.querySelectorAll(".pin-spacer").length,
  bodyStyle: document.body.getAttribute("style"),
  htmlStyle: document.documentElement.getAttribute("style"),
  docH: document.documentElement.scrollHeight,
})));
await page.goBack();
await page.waitForURL((u) => u.pathname === "/", { timeout: 60_000 });
await page.waitForTimeout(3000);
rec("5 back home pinSpacers", await page.evaluate(() => ({
  pinSpacers: document.querySelectorAll(".pin-spacer").length,
  docH: document.documentElement.scrollHeight,
})));
rec("errors", log);
writeFileSync(`${OUT}/v2-verify-1440.json`, JSON.stringify(rows, null, 2));
await browser.close();
