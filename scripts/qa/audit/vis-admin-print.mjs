/**
 * vis-admin track: A4 print views (predračun, otpremnica, bulk otpremnice) — screen capture,
 * print-media capture at A4 width and a real PDF (page count, overflow) for each.
 *   node scripts/qa/audit/vis-admin-print.mjs → docs/qa/audit/vis-admin/print/*
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { BASE, launch, newContext, watch, loginAdmin, shot } from "./kit.mjs";

const DOCS = [
  ["predracun", "/admin/porudzbine/SK-2026-000092/predracun"],
  ["otpremnica", "/admin/porudzbine/SK-2026-000092/otpremnica"],
  ["predracun-majstor", "/admin/porudzbine/SK-2026-000033/predracun"],
  ["otpremnice-bulk", "/admin/stampa/otpremnice?brojevi=SK-2026-000092,SK-2026-000033"],
];
mkdirSync("docs/qa/audit/vis-admin/print", { recursive: true });
const b = await launch();
const ctx = await newContext(b, { width: 1440, height: 900, tag: "vis-admin-print" });
const page = await ctx.newPage();
const log = watch(page);
for (let i = 0; i < 4; i++) { try { await loginAdmin(page); break; } catch { console.log("login retry", i); } }
const out = {};
for (const [name, route] of DOCS) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ media: "screen" });
  await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 60_000 }).catch(() => {});
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1500);
  const screen = await shot(page, `vis-admin/print/${name}-screen`, { fullPage: true });
  await page.emulateMedia({ media: "print" });
  await page.setViewportSize({ width: 794, height: 1123 });
  await page.waitForTimeout(500);
  const m = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    return {
      scrollW: document.documentElement.scrollWidth,
      vw,
      h: document.documentElement.scrollHeight,
      hiddenOnPrint: [...document.querySelectorAll("body *")].filter((e) => e.textContent.trim() && getComputedStyle(e).display === "none").length,
      text: document.body.innerText.slice(0, 1500),
    };
  });
  const printShot = await shot(page, `vis-admin/print/${name}-print`, { fullPage: true });
  const pdf = `docs/qa/audit/vis-admin/print/${name}.pdf`;
  await page.pdf({ path: pdf, format: "A4", preferCSSPageSize: true, printBackground: true });
  const { readFileSync } = await import("node:fs");
  const pages = (readFileSync(pdf, "latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
  out[name] = { route, screen, printShot, pdf, pages, ...m };
  console.log(name, "pages", pages, "scrollW", m.scrollW, "vw", m.vw, "h", m.h);
}
out.log = log;
writeFileSync("docs/qa/audit/vis-admin/print.json", JSON.stringify(out, null, 2));
await b.close();
