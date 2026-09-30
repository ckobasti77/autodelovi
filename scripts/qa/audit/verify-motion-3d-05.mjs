import { writeFileSync } from "node:fs";
import { BASE, launch, newContext, shot } from "./kit.mjs";
const out = {};
const browser = await launch();
const probe = (page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const hit = document.elementFromPoint(cx, cy);
    const panel = document.querySelector('[data-testid="part-panel"]') || hit?.closest('[role="dialog"], aside, [role="complementary"], [role="region"]');
    const pr = document.querySelector('[data-testid="part-panel"]')?.getBoundingClientRect();
    return {
      name: el.getAttribute("aria-label") || el.textContent.trim().slice(0, 40),
      x: [Math.round(r.left), Math.round(r.right)], y: [Math.round(r.top), Math.round(r.bottom)],
      hitSelf: hit === el || el.contains(hit),
      hitDesc: hit ? `${hit.tagName.toLowerCase()}.${String(hit.className).slice(0, 50)} ${hit.textContent.trim().slice(0, 30)}` : null,
      panelLeft: pr ? Math.round(pr.left) : null,
    };
  });
for (const [w, h] of [[1440, 900], [1024, 768], [1280, 800], [1920, 1080]]) {
  const ctx = await newContext(browser, { width: w, height: h, tag: `v05-${w}` });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/?deo=kocioni-diskovi`, { waitUntil: "load" });
  await page.waitForFunction(() => window.__sklop3d?.getState().selected, null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(3500);
  const testids = await page.evaluate(() => [...document.querySelectorAll("[data-testid]")].map((e) => e.dataset.testid).filter((t) => /panel|drawer|sheet/i.test(t)));
  await page.locator("nav ol li button").nth(6).focus();
  const stops = [await probe(page)];
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press("Tab");
    await page.waitForTimeout(250);
    stops.push(await probe(page));
    if (w === 1440 && i === 1) await shot(page, "verify/motion-3d/motion-3d-05-reproduce-focus-rasklopi-1440");
  }
  // where in tab order does the panel come? count tabs until focus enters the panel's close button
  let n = 0, inPanel = false, trail = [];
  for (; n < 200; n++) {
    await page.keyboard.press("Tab");
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      const drawer = el.closest('[data-testid="part-panel"], [role="dialog"], aside');
      return { name: (el.getAttribute("aria-label") || el.textContent.trim()).slice(0, 30), inDrawer: !!drawer, tag: el.tagName };
    });
    trail.push(info.name);
    if (info.inDrawer) { inPanel = true; break; }
  }
  out[w] = { testids, stops, tabsFromListToPanel: inPanel ? n + 1 : `>200`, trailTail: trail.slice(-6) };
  await ctx.close();
}
await browser.close();
writeFileSync("docs/qa/audit/verify/motion-3d/motion-3d-05-reproduce.json", JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
