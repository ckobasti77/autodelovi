// motion-3d-03 verification, part 3: why the bar stays hidden at 768 px.
import { BASE, launch, newContext } from "./kit.mjs";
const browser = await launch("chromium");
for (const [w, h] of [[768, 1024], [820, 1180], [1000, 800]]) {
  const ctx = await newContext(browser, { width: w, height: h, tag: `v-m3d03-${w}` });
  const page = await ctx.newPage();
  await page.goto(BASE + "/deo/kocioni-disk-prednji-276-24-mm-demo-0004", { waitUntil: "load" });
  await page.waitForTimeout(2500);
  const info = await page.evaluate(() => {
    const els = document.querySelectorAll("#buy-box");
    const b = els[0];
    const cs = getComputedStyle(b);
    return { count: els.length, position: cs.position, top: b.getBoundingClientRect().top, h: b.getBoundingClientRect().height,
      mq: matchMedia("(max-width: 63.999rem)").matches, docH: document.documentElement.scrollHeight, iw: innerWidth };
  });
  const samples = [];
  for (const y of [600, 1200, 1800, 2400, 3000]) {
    await page.mouse.move(w / 2, h / 2);
    await page.evaluate((y) => scrollTo(0, y), y);
    await page.waitForTimeout(1200);
    samples.push(await page.evaluate(() => {
      const bar = [...document.querySelectorAll("div.fixed.bottom-0")].find((d) => d.getAttribute("data-reveal") === "off");
      const b = document.getElementById("buy-box").getBoundingClientRect();
      const r = bar.getBoundingClientRect();
      return { scrollY: Math.round(scrollY), boxTop: Math.round(b.top), boxBottom: Math.round(b.bottom), barVis: getComputedStyle(bar).visibility, barTop: r.top, tr: getComputedStyle(bar).transform };
    }));
  }
  console.log(JSON.stringify({ w, h, info, samples }));
  await ctx.close();
}
await browser.close();
