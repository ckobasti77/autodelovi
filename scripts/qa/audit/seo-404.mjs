/**
 * Step 21 QA audit, track "seo": 404 rendering for unknown product / category / vehicle URLs, with
 * and without JavaScript (status, title, H1, visible main text), screenshots at 390 px.
 *   node scripts/qa/audit/seo-404.mjs
 */
import { writeFileSync } from "node:fs";
import path from "node:path";

import { BASE, launch, shot, watch } from "./kit.mjs";

const PATHS = ["/deo/ne-postoji-demo-9999", "/delovi/nepostojeca-kategorija", "/vozila/volkswagen/golf/golf-99", "/ovo-ne-postoji"];
const browser = await launch("chromium");
const out = [];
for (const js of [true, false]) {
  for (const p of PATHS) {
    const ctx = await browser.newContext({ javaScriptEnabled: js, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await ctx.addCookies([{ name: "sk_consent", value: encodeURIComponent(JSON.stringify({ v: 1, analytics: false, ads: false, at: Date.now(), id: "audit-seo-0002" })), domain: "localhost", path: "/" }]);
    const page = await ctx.newPage();
    const log = watch(page);
    const res = await page.goto(BASE + p, { waitUntil: js ? "networkidle" : "load" });
    await page.waitForTimeout(js ? 1500 : 200);
    const f = await page.evaluate(() => ({
      title: document.title,
      h1: [...document.querySelectorAll("h1")].map((h) => h.innerText),
      main: (document.querySelector("main")?.innerText ?? "").replace(/\s+/g, " ").slice(0, 200),
    }));
    const name = `seo/404-${js ? "js" : "nojs"}-${p.split("/").filter(Boolean).slice(0, 2).join("-")}-390`;
    out.push({ path: p, js, status: res.status(), ...f, shot: await shot(page, name), console: log.console.slice(0, 3) });
    await ctx.close();
  }
}
await browser.close();
writeFileSync(path.resolve("docs/qa/audit/seo/404-check.json"), JSON.stringify(out, null, 1));
for (const o of out) console.log(o.js ? "JS  " : "noJS", o.status, o.path, "|", o.title, "|", JSON.stringify(o.h1), "|", o.main.slice(0, 80));
