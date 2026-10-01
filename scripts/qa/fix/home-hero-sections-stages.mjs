// MOT-03 / MOT-05 re-check (home-hero-sections): stage landing after deep links, index buttons
// and the phone stepper; explode state after a client navigation to „/“ from a scrolled page.
// Usage: AUDIT_BASE=http://localhost:3001 node scripts/qa/fix/home-hero-sections-stages.mjs [mot03|mot05|all] [out.json]
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { BASE, launch, newContext } from "../audit/kit.mjs";

const mode = process.argv[2] ?? "all";
const out = process.argv[3];
const read = (page) =>
  page.evaluate(() => {
    const s = window.__sklop3d?.getState();
    const cur = [...document.querySelectorAll('[aria-current="step"]')].find((e) => e.offsetParent);
    const phone = [...document.querySelectorAll("p")].find((p) => /\/ 07/.test(p.textContent ?? "") && p.offsetParent);
    return {
      y: Math.round(window.scrollY * 100) / 100,
      p: s?.progress,
      stage: s?.stage,
      selected: s?.selected,
      current: cur?.getAttribute("aria-label") ?? phone?.textContent?.trim() ?? null,
    };
  });

const results = { mot03: [], mot05: [] };
const browser = await launch();
try {
  if (mode === "mot03" || mode === "all") {
    const deep = { "kocioni-diskovi": 3, "abs-senzori": 3, "amortizeri-opruge": 3, motor: 5 };
    for (const [width, height] of [
      [1440, 900],
      [1280, 800],
      [1920, 1080],
      [390, 844],
    ]) {
      for (const [slug, want] of Object.entries(deep)) {
        const ctx = await newContext(browser, { width, height, tag: "hh-mot03" });
        try {
          const page = await ctx.newPage();
          await page.goto(`${BASE}/?deo=${slug}`, { waitUntil: "load" });
          await page.waitForTimeout(3200);
          const r = await read(page);
          results.mot03.push({ kind: "deeplink", width, slug, want, ...r, ok: r.stage === want });
        } finally {
          await ctx.close();
        }
      }
      // Index buttons (desktop) or the stepper (phone), from the top.
      const ctx = await newContext(browser, { width, height, tag: "hh-mot03b" });
      try {
        const page = await ctx.newPage();
        await page.goto(`${BASE}/`, { waitUntil: "load" });
        await page.waitForTimeout(1500);
        if (width >= 1024) {
          for (let k = 1; k <= 7; k++) {
            await page.locator(`nav ol button[aria-label^="0${k} "]`).first().click();
            await page.waitForTimeout(2200);
            const r = await read(page);
            results.mot03.push({ kind: "index", width, want: k, ...r, ok: r.stage === k });
          }
        } else {
          const next = page.getByRole("button", { name: "Sledeća faza" });
          for (let k = 1; k <= 7; k++) {
            await next.click();
            await page.waitForTimeout(2200);
            const r = await read(page);
            results.mot03.push({ kind: "next", width, want: k, ...r, ok: r.stage === k });
          }
          const prev = page.getByRole("button", { name: "Prethodna faza" });
          for (let k = 6; k >= 0; k--) {
            await prev.click();
            await page.waitForTimeout(2200);
            const r = await read(page);
            results.mot03.push({ kind: "prev", width, want: k, ...r, ok: r.stage === k });
          }
        }
      } finally {
        await ctx.close();
      }
    }
  }
  if (mode === "mot05" || mode === "all") {
    const runs = [
      { from: "/delovi", scroll: 1500, width: 1440, height: 900 },
      { from: "/delovi", scroll: 1500, width: 1440, height: 900 },
      { from: "/delovi", scroll: 1500, width: 1440, height: 900 },
      { from: "/deo/kocioni-disk-prednji-276-24-mm-demo-0004", scroll: 1200, width: 1440, height: 900 },
      { from: "/delovi", scroll: 0, width: 1440, height: 900 },
      { from: "/delovi", scroll: 1500, width: 390, height: 844 },
    ];
    for (const run of runs) {
      const ctx = await newContext(browser, { width: run.width, height: run.height, tag: "hh-mot05" });
      try {
        const page = await ctx.newPage();
        if (process.env.THROTTLE) {
          const cdp = await ctx.newCDPSession(page);
          await cdp.send("Emulation.setCPUThrottlingRate", { rate: Number(process.env.THROTTLE) });
        }
        await page.goto(`${BASE}${run.from}`, { waitUntil: "load" });
        await page.waitForTimeout(1500);
        await page.evaluate((y) => window.scrollTo(0, y), run.scroll);
        await page.waitForTimeout(800);
        const logo = page.getByRole("link", { name: /SKLOP — početna/ }).first();
        if (process.env.LOCATOR_CLICK) await logo.click();
        else {
          const box = await logo.boundingBox();
          await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        }
        await page.waitForURL((u) => u.pathname === "/", { timeout: 20000 });
        const samples = [];
        let last = 0;
        for (const t of [500, 2500, 6000]) {
          await page.waitForTimeout(t - last);
          last = t;
          samples.push({ t, ...(await read(page)) });
        }
        const end = samples.at(-1);
        results.mot05.push({ ...run, samples, ok: end.y === 0 && end.p === 0 && end.stage === 0 });
      } finally {
        await ctx.close();
      }
    }
  }
} finally {
  await browser.close();
}
for (const r of results.mot03)
  console.log("MOT03", r.ok ? "ok " : "BAD", r.kind, r.width, r.slug ?? "", "want", r.want, "got", r.stage, "p", r.p?.toFixed?.(6), "y", r.y, "|", r.current);
for (const r of results.mot05)
  console.log("MOT05", r.ok ? "ok " : "BAD", r.from, r.scroll, r.width, r.samples.map((s) => `${s.t}ms y${s.y} p${s.p} st${s.stage}`).join(" | "));
const bad = [...results.mot03, ...results.mot05].filter((r) => !r.ok).length;
console.log(`SUMMARY mot03 ${results.mot03.length - results.mot03.filter((r) => !r.ok).length}/${results.mot03.length} ok, mot05 ${results.mot05.filter((r) => r.ok).length}/${results.mot05.length} ok, bad ${bad}`);
if (out) {
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(results, null, 1));
}
