/**
 * vis-admin track: interaction states at 1440 (and palette/bell at 1024): command palette with
 * results, bell popover, shortcuts dialog, order status menu + cancel dialog (opened, never
 * confirmed), products bulk bar, product editor dirty save bar (never saved), empty filter result,
 * quote composer (never sent), skeletons (first frame), category tree scroll.
 *   node scripts/qa/audit/vis-admin-states.mjs → docs/qa/audit/vis-admin/states/*.webp + states.json
 */
import { writeFileSync } from "node:fs";
import { BASE, launch, newContext, watch, loginAdmin, shot, axe } from "./kit.mjs";

const out = {};
async function settle(page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(600);
}
async function go(page, route) {
  for (let i = 0; i < 3; i++) {
    try {
      await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 60_000 });
      break;
    } catch {}
  }
  await settle(page);
}
async function step(name, fn) {
  try {
    out[name] = (await fn()) ?? "ok";
  } catch (e) {
    out[name] = `ERR ${String(e).slice(0, 200)}`;
  }
  console.log(name, typeof out[name] === "string" ? out[name] : JSON.stringify(out[name]).slice(0, 300));
}

const b = await launch();
const ctx = await newContext(b, { width: 1440, height: 900, tag: "vis-admin-states" });
const page = await ctx.newPage();
const log = watch(page);
for (let i = 0; i < 4; i++) { try { await loginAdmin(page); break; } catch (e) { console.log("login retry", i); } }

// Skeleton: capture the first frame of a list after a hard navigation.
await step("skeleton", async () => {
  await page.goto(BASE + "/admin/proizvodi", { waitUntil: "commit" });
  await page.waitForSelector("main", { timeout: 30_000 });
  const busy = await page.evaluate(() => ({
    busy: document.querySelectorAll('[aria-busy="true"]').length,
    sk: document.querySelectorAll('[class*="skeleton"], [data-skeleton]').length,
  }));
  const f = await shot(page, "vis-admin/states/skeleton-proizvodi");
  await settle(page);
  return { ...busy, f };
});

await step("palette", async () => {
  await go(page, "/admin");
  await page.keyboard.press("Control+k");
  await page.waitForTimeout(500);
  const a = await shot(page, "vis-admin/states/palette-empty");
  await page.keyboard.type("5Q0");
  await page.waitForTimeout(1800);
  const c = await shot(page, "vis-admin/states/palette-5Q0");
  const ax = await axe(page, { include: "[role=dialog]" });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  return { a, c, axe: ax };
});

await step("bell", async () => {
  await page.getByTestId("admin-notification-bell").click();
  await page.waitForTimeout(700);
  const f = await shot(page, "vis-admin/states/bell");
  const ax = await axe(page, { include: "[role=dialog], [data-radix-popper-content-wrapper]" });
  await page.keyboard.press("Escape");
  return { f, axe: ax };
});

await step("shortcuts", async () => {
  await page.locator("main").click({ position: { x: 5, y: 5 } }).catch(() => {});
  await page.keyboard.press("Shift+?");
  await page.waitForTimeout(600);
  const f = await shot(page, "vis-admin/states/shortcuts");
  await page.keyboard.press("Escape");
  return f;
});

await step("order-menu-dialog", async () => {
  await go(page, "/admin/porudzbine/SK-2026-000092");
  await page.getByRole("button", { name: /Promeni status/ }).click();
  await page.waitForTimeout(500);
  const m = await shot(page, "vis-admin/states/order-status-menu");
  const item = page.getByRole("menuitem", { name: /Otkaž/ }).first();
  let d = null;
  if (await item.count()) {
    await item.click();
    await page.waitForTimeout(700);
    d = await shot(page, "vis-admin/states/order-cancel-dialog");
    out["order-cancel-dialog-axe"] = await axe(page, { include: "[role=dialog], [role=alertdialog]" });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
  }
  return { m, d };
});

await step("tracking-inline", async () => {
  const btn = page.getByRole("button", { name: /Upiši broj pošiljke/ });
  if (!(await btn.count())) return "no button";
  await btn.click();
  await page.waitForTimeout(500);
  const f = await shot(page, "vis-admin/states/order-tracking");
  await page.keyboard.press("Escape");
  return f;
});

await step("bulk-bar", async () => {
  await go(page, "/admin/proizvodi");
  const boxes = page.locator("main tbody [role=checkbox], main tbody input[type=checkbox]");
  const n = await boxes.count();
  for (let i = 0; i < Math.min(3, n); i++) await boxes.nth(i).click();
  await page.waitForTimeout(500);
  const f = await shot(page, "vis-admin/states/products-bulk-bar");
  const bar = await page.evaluate(() => {
    const el = document.querySelector('[aria-label="Grupne radnje"]');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: Math.round(r.top), h: Math.round(r.height), text: el.textContent.trim().slice(0, 200) };
  });
  // Clear selection again.
  for (let i = 0; i < Math.min(3, n); i++) await boxes.nth(i).click();
  return { n, f, bar };
});

await step("orders-bulk-bar", async () => {
  await go(page, "/admin/porudzbine");
  const boxes = page.locator("main tbody [role=checkbox], main tbody input[type=checkbox]");
  const n = await boxes.count();
  for (let i = 0; i < Math.min(3, n); i++) await boxes.nth(i).click();
  await page.waitForTimeout(500);
  const f = await shot(page, "vis-admin/states/orders-bulk-bar", { clip: { x: 232, y: 0, width: 1208, height: 420 } });
  for (let i = 0; i < Math.min(3, n); i++) await boxes.nth(i).click();
  return { n, f };
});

await step("empty-filter", async () => {
  await go(page, "/admin/porudzbine?status=sve&q=zzqqxx999");
  await page.waitForTimeout(1500);
  const f = await shot(page, "vis-admin/states/orders-empty-search");
  await go(page, "/admin/proizvodi?q=zzqqxx999");
  await page.waitForTimeout(1500);
  const g = await shot(page, "vis-admin/states/products-empty-search");
  await go(page, "/admin/upiti?status=istekla");
  const h = await shot(page, "vis-admin/states/inquiries-empty-tab");
  return { f, g, h };
});

await step("editor-dirty", async () => {
  await go(page, "/admin/proizvodi");
  const href = await page.$$eval("main a[href]", (as) => as.map((a) => a.getAttribute("href")).find((h) => /^\/admin\/proizvodi\/[a-z0-9]{20,}$/.test(h)));
  await go(page, href);
  const top = await shot(page, "vis-admin/states/editor-top");
  const name = page.getByLabel(/^Naziv/).first();
  const val = await name.inputValue();
  await name.fill(val + " x");
  await page.waitForTimeout(500);
  const dirty = await shot(page, "vis-admin/states/editor-dirty");
  const bar = await page.evaluate(() => {
    const els = [...document.querySelectorAll("*")].filter((e) => /Odbaci izmene/.test(e.textContent) && e.children.length < 12 && getComputedStyle(e).position.match(/sticky|fixed/));
    return els.map((e) => ({ pos: getComputedStyle(e).position, r: e.getBoundingClientRect().toJSON() })).slice(0, 2);
  });
  await page.getByRole("button", { name: /Odbaci izmene/ }).click().catch(() => {});
  await page.waitForTimeout(500);
  const restored = await name.inputValue();
  const fullp = await shot(page, "vis-admin/states/editor-full", { fullPage: true });
  return { href, top, dirty, bar, restoredOk: restored === val, fullp };
});

await step("quote-composer", async () => {
  await go(page, "/admin/upiti/UP-2026-000054");
  const btn = page.getByTestId("admin-quote-compose");
  if (!(await btn.count())) return "no compose button";
  await btn.click();
  await page.waitForTimeout(900);
  const f = await shot(page, "vis-admin/states/quote-composer", { fullPage: true });
  const v = await shot(page, "vis-admin/states/quote-composer-view");
  return { f, v };
});

await step("category-tree", async () => {
  await go(page, "/admin/kategorije");
  return page.evaluate(() => {
    const groups = [...document.querySelectorAll("main *")].filter((e) => {
      const cs = getComputedStyle(e);
      return (cs.overflowY === "auto" || cs.overflowY === "scroll") && e.scrollHeight > e.clientHeight + 1;
    }).map((e) => ({ tag: e.tagName, sh: e.scrollHeight, ch: e.clientHeight, text: e.textContent.slice(0, 80) }));
    return { scrollers: groups };
  });
});

out.log = log;
await b.close();
writeFileSync("docs/qa/audit/vis-admin/states.json", JSON.stringify(out, null, 2));
