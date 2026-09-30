// motion-3d-03 verification, part 4: capture the viewport right after Tab lands on the off-screen bar button.
import { BASE, launch, newContext, shot } from "./kit.mjs";
const browser = await launch("chromium");
const ctx = await newContext(browser, { width: 390, height: 844, tag: "v-m3d03-tab1" });
const page = await ctx.newPage();
await page.goto(BASE + "/deo/kocioni-disk-prednji-276-24-mm-demo-0004", { waitUntil: "load" });
await page.waitForTimeout(2500);
await page.mouse.move(195, 400);
for (let i = 0; i < 26; i++) { await page.mouse.wheel(0, 50); await page.waitForTimeout(40); }
await page.waitForTimeout(3000);
await page.evaluate(() => {
  const bar = [...document.querySelectorAll("div.fixed.bottom-0")].find((d) => d.getAttribute("data-reveal") === "off");
  const all = [...document.querySelectorAll("a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex='-1'])")]
    .filter((e) => !bar.contains(e) && bar.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_PRECEDING && e.offsetParent);
  all.at(-1)?.focus({ preventScroll: true });
});
await page.keyboard.press("Tab");
await page.waitForTimeout(300);
const st = await page.evaluate(() => {
  const a = document.activeElement; const r = a.getBoundingClientRect();
  return { scrollY: Math.round(scrollY), vh: innerHeight, tag: a.tagName, name: (a.getAttribute("aria-label") || a.textContent).trim(), top: r.top, bottom: r.bottom };
});
console.log(JSON.stringify(st));
console.log(await shot(page, "verify/motion-3d/motion-3d-03-reproduce-390-tab1"));
await ctx.close(); await browser.close();
