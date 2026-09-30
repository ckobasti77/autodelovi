/**
 * vis-admin track: targeted checks (read-only; nothing is saved):
 *  1 palette via the top-bar trigger (1440 + 1024)   2 cancel dialog initial focus
 *  3 bulk bar layout shift (orders, products)         4 product editor + dirty save bar (discarded)
 *  5 empty filter results                             6 sidebar reachability at 1440x900 / 1280x800
 *  7 settings danger zone, customer / mechanic / product detail pages
 *   node scripts/qa/audit/vis-admin-verify.mjs [only]
 */
import { writeFileSync } from "node:fs";
import { BASE, launch, newContext, watch, shot, axe } from "./kit.mjs";

const only = process.argv[2] ?? "";
const out = {};
async function login(page) {
  for (let i = 0; i < 5; i++) {
    try {
      await page.goto(`${BASE}/prijava?next=%2Fadmin`, { waitUntil: "domcontentloaded", timeout: 90_000 });
      await page.getByTestId("auth-email").fill(process.env.SEED_ADMIN_EMAIL, { timeout: 60_000 });
      await page.getByTestId("auth-password").fill(process.env.SEED_ADMIN_PASSWORD);
      await page.getByTestId("auth-submit").click();
      await page.waitForURL((u) => u.pathname.startsWith("/admin"), { timeout: 90_000 });
      return;
    } catch (e) {
      console.log("login retry", i, String(e).slice(0, 80));
    }
  }
  throw new Error("login failed");
}
async function settle(page) {
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
  await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, { timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(700);
}
async function go(page, route) {
  for (let i = 0; i < 3; i++) {
    try {
      await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 90_000 });
      break;
    } catch {}
  }
  await settle(page);
}
async function step(name, fn) {
  if (only && !name.startsWith(only)) return;
  try {
    out[name] = (await fn()) ?? "ok";
  } catch (e) {
    out[name] = `ERR ${String(e).slice(0, 300)}`;
  }
  console.log(name, JSON.stringify(out[name]).slice(0, 600));
}

const b = await launch();
const ctx = await newContext(b, { width: 1440, height: 900, tag: "vis-admin-verify" });
const page = await ctx.newPage();
const log = watch(page);
await login(page);

await step("1-palette", async () => {
  await go(page, "/admin");
  await page.getByRole("button", { name: "Pretraga" }).first().click();
  await page.waitForTimeout(800);
  const e = await shot(page, "vis-admin/verify/palette-empty-1440");
  await page.keyboard.type("5Q0 615", { delay: 40 });
  await page.waitForTimeout(3000);
  const r = await shot(page, "vis-admin/verify/palette-results-1440");
  const info = await page.evaluate(() => {
    const d = document.querySelector("[role=dialog]");
    if (!d) return null;
    const rr = d.getBoundingClientRect();
    return { w: Math.round(rr.width), h: Math.round(rr.height), top: Math.round(rr.top), groups: [...d.querySelectorAll("[role=group], [role=presentation]")].length, text: d.innerText.slice(0, 500) };
  });
  const ax = await axe(page, { include: "[role=dialog]" }).catch((er) => String(er).slice(0, 100));
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 1024, height: 768 });
  await go(page, "/admin");
  await page.getByRole("button", { name: "Pretraga" }).first().click();
  await page.waitForTimeout(800);
  await page.keyboard.type("golf", { delay: 40 });
  await page.waitForTimeout(3000);
  const r1024 = await shot(page, "vis-admin/verify/palette-results-1024");
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 1440, height: 900 });
  return { e, r, r1024, info, axe: ax };
});

await step("2-dialog-focus", async () => {
  await go(page, "/admin/porudzbine/SK-2026-000092");
  await page.getByRole("button", { name: /Promeni status/ }).click();
  await page.waitForTimeout(500);
  await page.getByRole("menuitem", { name: /Otkaž/ }).first().click();
  await page.waitForTimeout(900);
  const active = await page.evaluate(() => {
    const a = document.activeElement;
    return { tag: a?.tagName, label: a?.getAttribute("aria-label"), text: a?.textContent?.trim().slice(0, 40) };
  });
  const f = await shot(page, "vis-admin/verify/cancel-dialog-focus");
  const ax = await axe(page, { include: "[role=dialog], [role=alertdialog]" }).catch((er) => String(er).slice(0, 100));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  return { active, f, axe: ax };
});

await step("3-bulk-shift", async () => {
  const res = {};
  for (const route of ["/admin/porudzbine", "/admin/proizvodi"]) {
    await go(page, route);
    const measure = () =>
      page.evaluate(() => {
        const t = document.querySelector("main table");
        const firstBox = document.querySelector("main tbody [role=checkbox], main tbody input[type=checkbox]");
        return { tableTop: Math.round(t.getBoundingClientRect().top), box1Top: Math.round(firstBox.getBoundingClientRect().top) };
      });
    const before = await measure();
    await page.locator("main tbody [role=checkbox], main tbody input[type=checkbox]").first().click();
    await page.waitForTimeout(600);
    const after = await measure();
    const sel = await page.evaluate(() => document.querySelector('[aria-label="Grupne radnje"]')?.textContent.trim().slice(0, 60) ?? null);
    // A second click at the coordinates where row 2's checkbox WAS before the shift.
    res[route] = { before, after, shift: after.tableTop - before.tableTop, bar: sel };
    await page.locator("main tbody [role=checkbox], main tbody input[type=checkbox]").first().click();
    await page.waitForTimeout(400);
  }
  return res;
});

await step("4-editor", async () => {
  await go(page, "/admin/proizvodi");
  await page.locator("main tbody tr").nth(20).locator("td").nth(2).click();
  await page.waitForURL(/\/admin\/proizvodi\/[a-z0-9]{20,}/, { timeout: 60_000 });
  await settle(page);
  const url = page.url();
  const top = await shot(page, "vis-admin/verify/editor-top");
  const full = await shot(page, "vis-admin/verify/editor-full", { fullPage: true });
  const name = page.getByLabel(/^Naziv/).first();
  const val = await name.inputValue();
  await name.fill(val + " x");
  await page.waitForTimeout(600);
  const dirty = await shot(page, "vis-admin/verify/editor-dirty");
  const bar = await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((x) => /Odbaci izmene/.test(x.textContent));
    let el = btn;
    while (el && !/sticky|fixed/.test(getComputedStyle(el).position)) el = el.parentElement;
    return el ? { pos: getComputedStyle(el).position, top: Math.round(el.getBoundingClientRect().top), h: Math.round(el.getBoundingClientRect().height), left: Math.round(el.getBoundingClientRect().left), w: Math.round(el.getBoundingClientRect().width) } : null;
  });
  await page.getByRole("button", { name: /Odbaci izmene/ }).click();
  await page.waitForTimeout(600);
  const restored = (await name.inputValue()) === val;
  const ax = await axe(page).catch((er) => String(er).slice(0, 100));
  return { url, top, full, dirty, bar, restored, axe: ax };
});

await step("5-empty", async () => {
  await go(page, "/admin/porudzbine?status=sve&q=zzqqxx999");
  await page.waitForTimeout(2000);
  const a = await shot(page, "vis-admin/verify/empty-orders-search");
  await go(page, "/admin/proizvodi?q=zzqqxx999");
  await page.waitForTimeout(2000);
  const c = await shot(page, "vis-admin/verify/empty-products-search");
  await go(page, "/admin/upiti?status=istekla");
  const d = await shot(page, "vis-admin/verify/empty-inquiries-tab");
  return { a, c, d };
});

await step("6-sidebar", async () => {
  const res = {};
  for (const [w, h] of [[1440, 900], [1280, 800], [1920, 1080]]) {
    await page.setViewportSize({ width: w, height: h });
    await go(page, "/admin");
    res[`${w}x${h}`] = await page.evaluate(() => {
      const nav = document.querySelector('aside nav[aria-label="Administracija"]');
      const sc = nav?.querySelector(".overflow-y-auto");
      const links = [...(nav?.querySelectorAll("a") ?? [])];
      const vh = window.innerHeight;
      const hidden = links.filter((a) => a.getBoundingClientRect().bottom > vh).map((a) => a.textContent.trim());
      return { scrollH: sc?.scrollHeight, clientH: sc?.clientHeight, links: links.length, hiddenBelowFold: hidden };
    });
    await shot(page, `vis-admin/verify/sidebar-${w}`, { clip: { x: 0, y: 0, width: w >= 1366 ? 232 : 64, height: h } });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  return res;
});

await step("7-details", async () => {
  const res = {};
  await go(page, "/admin/podesavanja?tab=opasna-zona");
  res.danger = await shot(page, "vis-admin/verify/settings-opasna-zona", { fullPage: true });
  await go(page, "/admin/kupci");
  await page.locator("main tbody tr").nth(7).locator("td").first().click();
  await page.waitForURL(/\/admin\/kupci\/[a-z0-9]{20,}/, { timeout: 60_000 }).catch(() => {});
  await settle(page);
  res.customerUrl = page.url();
  res.customer = await shot(page, "vis-admin/verify/customer-detail", { fullPage: true });
  await go(page, "/admin/majstori?status=odobreni");
  const rows = page.locator("main tbody tr");
  if (await rows.count()) {
    await rows.first().locator("td").first().click();
    await page.waitForURL(/\/admin\/majstori\/[a-z0-9]{20,}/, { timeout: 60_000 }).catch(() => {});
    await settle(page);
  }
  res.mechanicUrl = page.url();
  res.mechanic = await shot(page, "vis-admin/verify/mechanic-detail", { fullPage: true });
  return res;
});

out.log = log;
await b.close();
writeFileSync(`docs/qa/audit/vis-admin/verify${only ? "-" + only : ""}.json`, JSON.stringify(out, null, 2));
