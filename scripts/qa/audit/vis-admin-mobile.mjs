/**
 * vis-admin track: small screens (390, 768) for the screens staff might open on a phone:
 * dashboard, orders list, order detail, inquiry detail; plus the mobile navigation drawer.
 *   node scripts/qa/audit/vis-admin-mobile.mjs → docs/qa/audit/vis-admin/mobile/*.webp + mobile.json
 */
import { writeFileSync } from "node:fs";
import { BASE, launch, newContext, watch, loginAdmin, shot, overflowX } from "./kit.mjs";

const ROUTES = [
  "/admin",
  "/admin/porudzbine",
  "/admin/porudzbine/SK-2026-000092",
  "/admin/upiti",
  "/admin/upiti/UP-2026-000054",
  "/admin/upiti/UP-2026-000003",
  "/admin/proizvodi",
];
const slug = (p) => p.replace(/^\/admin\/?/, "").replace(/[?=&/]/g, "_") || "pregled";

async function settle(page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(700);
}

const b = await launch();
const out = {};
for (const [width, height] of [[390, 844], [768, 1024]]) {
  const ctx = await newContext(b, { width, height, tag: `vis-admin-m${width}` });
  const page = await ctx.newPage();
  const log = watch(page);
  await loginAdmin(page);
  for (const route of ROUTES) {
    await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 60_000 }).catch(() => {});
    await settle(page);
    const ov = await overflowX(page);
    const m = await page.evaluate(() => {
      const small = [];
      for (const el of document.querySelectorAll("main a, main button, main input, main select, main [role=tab], header a, header button")) {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        if (r.height < 24 || r.width < 24) small.push(`${el.tagName.toLowerCase()} ${Math.round(r.width)}x${Math.round(r.height)} ${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 30)}`);
      }
      const scrollers = [...document.querySelectorAll("main *")]
        .filter((e) => {
          const cs = getComputedStyle(e);
          return (cs.overflowX === "auto" || cs.overflowX === "scroll") && e.scrollWidth > e.clientWidth + 1;
        })
        .map((e) => `${e.tagName.toLowerCase()} ${e.scrollWidth}/${e.clientWidth}`);
      const inputs = [...document.querySelectorAll("main input, main textarea, main select, header input")]
        .filter((e) => e.getBoundingClientRect().width)
        .map((e) => parseFloat(getComputedStyle(e).fontSize))
        .filter((s) => s < 16);
      return { small: small.slice(0, 20), smallCount: small.length, scrollers, inputsUnder16: inputs.length, docHeight: document.documentElement.scrollHeight };
    });
    const v = await shot(page, `vis-admin/mobile/${width}-${slug(route)}-top`);
    const f = await shot(page, `vis-admin/mobile/${width}-${slug(route)}-full`, { fullPage: true });
    out[`${width} ${route}`] = { ov, ...m, v, f };
    console.log(width, route, JSON.stringify(ov), m.scrollers.join(";"), "small", m.smallCount, "in<16", m.inputsUnder16);
  }
  // Mobile navigation drawer.
  await page.goto(BASE + "/admin", { waitUntil: "domcontentloaded" });
  await settle(page);
  const menu = page.getByRole("button", { name: /meni/i }).first();
  if (await menu.count()) {
    await menu.click();
    await page.waitForTimeout(700);
    out[`${width} drawer`] = await shot(page, `vis-admin/mobile/${width}-drawer`);
  }
  out[`${width} log`] = log;
  await ctx.close();
}
await b.close();
writeFileSync("docs/qa/audit/vis-admin/mobile.json", JSON.stringify(out, null, 2));
