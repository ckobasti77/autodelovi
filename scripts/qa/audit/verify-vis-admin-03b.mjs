// vis-admin-03: same capture with real (non-hidden) scrollbars, as a Windows desktop Chrome shows them.
import { chromium } from "@playwright/test";
import { BASE, newContext, loginAdmin, shot } from "./kit.mjs";
const browser = await chromium.launch({ ignoreDefaultArgs: ["--hide-scrollbars"] });
const ctx = await newContext(browser, { width: 1366, height: 768, tag: "ver-va03b" });
const page = await ctx.newPage();
for (let i = 0; i < 3; i++) { try { await loginAdmin(page); break; } catch (e) { console.log("login retry", i); } }
await page.goto(`${BASE}/admin/podesavanja?tab=firma`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
const g = await page.evaluate(() => { const sc = document.querySelector('aside nav .overflow-y-auto'); return { gutter: sc.offsetWidth - sc.clientWidth, sw: getComputedStyle(sc).scrollbarWidth }; });
console.log(JSON.stringify(g));
await shot(page, "verify/vis-admin/vis-admin-03-reproduce-1366x768-real-scrollbar", { clip: { x: 0, y: 0, width: 520, height: 768 } });
await browser.close();
