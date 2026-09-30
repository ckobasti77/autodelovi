/**
 * Independent verifier for copy-19 (admin/staff copy slips). Read-only: navigation only.
 *   node scripts/qa/audit/verify-copy-19.mjs → docs/qa/audit/verify/copy/copy-19-reproduce.*
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { BASE, launch, newContext, watch, loginAdmin, shot } from "./kit.mjs";

const OUT = "docs/qa/audit/verify/copy";
mkdirSync(OUT, { recursive: true });
const res = {};
const width = Number(process.env.W ?? 1440);
const b = await launch(process.env.ENGINE ?? "chromium");
const ctx = await newContext(b, { width, height: 900, tag: "verify-copy-19", engine: process.env.ENGINE ?? "chromium" });
const page = await ctx.newPage();
const log = watch(page);
await loginAdmin(page);

// 1. Order detail: note help + history line.
await page.goto(`${BASE}/admin/porudzbine/SK-2026-000092`, { waitUntil: "networkidle", timeout: 60_000 });
await page.waitForTimeout(1500);
res.order = await page.evaluate(() => {
  const t = document.body.innerText;
  const lines = t.split("\n").filter((l) => /napomena vidi|režim log|nije poslata/i.test(l));
  return { lines: [...new Set(lines)].slice(0, 12), noteFieldVisible: /Nova napomena/.test(t) };
});
// Is the note form visible without a click?
const help = page.getByText("Interna napomena vidi samo osoblje", { exact: false }).first();
res.order.helpVisibleInitially = await help.isVisible().catch(() => false);
if (!res.order.helpVisibleInitially) {
  const btn = page.getByRole("button", { name: /napomen/i }).first();
  res.order.noteButton = await btn.textContent().catch(() => null);
  await btn.click().catch(() => {});
  await page.waitForTimeout(600);
  res.order.helpVisibleAfterClick = await help.isVisible().catch(() => false);
}
if (await help.isVisible().catch(() => false)) {
  await help.scrollIntoViewIfNeeded();
  const box = await help.boundingBox();
  if (box)
    res.order.helpShot = await shot(page, `verify/copy/copy-19-reproduce-${width}-note-help`, {
      clip: { x: Math.max(0, box.x - 20), y: Math.max(0, box.y - 90), width: Math.min(900, width - box.x + 20), height: 180 },
    });
}
const hist = page.getByText("režim log", { exact: false }).first();
if (await hist.isVisible().catch(() => false)) {
  await hist.scrollIntoViewIfNeeded();
  const box = await hist.boundingBox();
  if (box)
    res.order.histShot = await shot(page, `verify/copy/copy-19-reproduce-${width}-history`, {
      clip: { x: Math.max(0, box.x - 40), y: Math.max(0, box.y - 60), width: Math.min(900, width - Math.max(0, box.x - 40)), height: 160 },
    });
}

// 2. Settings / outbox mode label.
await page.goto(`${BASE}/admin/podesavanja?tab=obavestenja`, { waitUntil: "networkidle", timeout: 60_000 });
await page.waitForTimeout(1200);
res.settings = await page.evaluate(() =>
  [...new Set(document.body.innerText.split("\n").filter((l) => /Samo zapis|režim log|Režim/i.test(l)))].slice(0, 10),
);
await page.goto(`${BASE}/admin/mejlovi`, { waitUntil: "networkidle", timeout: 60_000 });
await page.waitForTimeout(1200);
res.outbox = await page.evaluate(() =>
  [...new Set(document.body.innerText.split("\n").filter((l) => /Samo zapis|režim log/i.test(l)))].slice(0, 10),
);

// 3. Template gallery, plain-text view.
for (const key of ["back_in_stock", "staff_daily_digest"]) {
  await page.goto(`${BASE}/admin/mejlovi/sabloni?sablon=${key}&prikaz=tekst`, { waitUntil: "networkidle", timeout: 60_000 });
  await page.waitForTimeout(1500);
  const pre = page.locator("pre").first();
  res[key] = await pre
    .evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        className: el.className,
        textTransform: cs.textTransform,
        fontFamily: cs.fontFamily.slice(0, 60),
        fontSize: cs.fontSize,
        source: el.textContent.slice(0, 900),
        renderedFirstLines: el.innerText.split("\n").slice(0, 6),
      };
    })
    .catch((e) => ({ error: String(e) }));
  res[key].description = await page
    .evaluate(() => [...document.querySelectorAll("p")].map((p) => p.textContent).find((t) => /tačno kako/.test(t)) ?? null)
    .catch(() => null);
  res[key].shot = await shot(page, `verify/copy/copy-19-reproduce-${width}-${key}-tekst`, { locator: pre });
  // Viewport shot of the whole page area too (top).
  res[key].pageShot = await shot(page, `verify/copy/copy-19-reproduce-${width}-${key}-tekst-page`);
}
// Admin sidebar name of the dashboard.
res.dashboardLabel = await page.evaluate(() =>
  [...document.querySelectorAll("nav a")].map((a) => a.getAttribute("aria-label") || a.textContent.trim()).filter((t) => /Pregled|Kontroln/i.test(t)).slice(0, 4),
);
res.consoleErrors = log.console.slice(0, 5);
res.pageErrors = log.pageErrors.slice(0, 5);
writeFileSync(`${OUT}/copy-19-reproduce-${width}.json`, JSON.stringify(res, null, 2));
console.log(JSON.stringify(res, null, 2));
await b.close();
