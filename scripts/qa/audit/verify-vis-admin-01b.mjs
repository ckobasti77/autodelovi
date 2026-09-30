// vis-admin-01 second pass: horizontal reachability on touch + chart panel captures.
import { writeFileSync } from "node:fs";
import { BASE, launch, newContext, loginAdmin, shot } from "./kit.mjs";
const out = {};
const browser = await launch("chromium");
for (const s of [{ tag: "390", width: 390, height: 844 }, { tag: "768", width: 768, height: 1024 }, { tag: "1024", width: 1024, height: 768 }]) {
  const ctx = await newContext(browser, { width: s.width, height: s.height, tag: `ver-va01b-${s.tag}` });
  const page = await ctx.newPage();
  for (let i = 0; i < 3; i++) { try { await loginAdmin(page); break; } catch (e) { console.log("login retry", i); } }
  await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  const vp = await page.evaluate(() => ({
    innerWidth, clientW: document.documentElement.clientWidth, docW: document.documentElement.scrollWidth,
    vv: { w: visualViewport.width, scale: visualViewport.scale, pageLeft: visualViewport.pageLeft },
    meta: document.querySelector('meta[name="viewport"]')?.content,
  }));
  // Queue card in view, then a horizontal touch swipe (CDP synthesized gesture)
  const q = page.locator("main h2, main h3").filter({ hasText: "Red čekanja" }).first();
  await q.scrollIntoViewIfNeeded();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Input.synthesizeScrollGesture", { x: Math.round(s.width / 2), y: 500, xDistance: -600, yDistance: 0, gestureSourceType: s.width < 1024 ? "touch" : "mouse", speed: 1200 });
  await page.waitForTimeout(600);
  const after = await page.evaluate(() => ({ scrollX, vvPageLeft: visualViewport.pageLeft, vvOffsetLeft: visualViewport.offsetLeft, scale: visualViewport.scale }));
  if (s.tag === "390") await shot(page, `verify/vis-admin/vis-admin-01-reproduce-390-after-swipe`);
  await page.evaluate(() => window.scrollTo(0, window.scrollY));
  // Chart panel
  const c = page.locator("main h2, main h3").filter({ hasText: "Porudžbine po danima" }).first();
  await c.scrollIntoViewIfNeeded();
  await page.evaluate(() => { window.scrollBy(0, -40); window.scrollTo(0, window.scrollY); });
  await page.waitForTimeout(500);
  await shot(page, `verify/vis-admin/vis-admin-01-reproduce-${s.tag}-chart`);
  out[s.tag] = { vp, after };
  console.log(s.tag, JSON.stringify(out[s.tag]));
  await ctx.close();
}
writeFileSync("docs/qa/audit/verify/vis-admin/vis-admin-01-reproduce-b.json", JSON.stringify(out, null, 2));
await browser.close();
