// motion-3d-03 verification, part 2: 768 px (scroll relative to the buy box), another product,
// a real Tab sequence into the bar, and a "what it should look like" capture with transform cleared.
import { writeFileSync } from "node:fs";
import path from "node:path";
import { BASE, launch, newContext, shot, AUDIT_DIR } from "./kit.mjs";

const OUT = "verify/motion-3d";
const results = [];

const probe = (page) =>
  page.evaluate(() => {
    const bar = [...document.querySelectorAll("div.fixed.bottom-0")].find((d) => d.getAttribute("data-reveal") === "off");
    if (!bar) return { bar: null };
    const r = bar.getBoundingClientRect();
    const cs = getComputedStyle(bar);
    return {
      scrollY: Math.round(scrollY),
      vh: innerHeight,
      barTop: r.top,
      barHeight: r.height,
      transform: cs.transform,
      visibility: cs.visibility,
      ariaHidden: bar.getAttribute("aria-hidden"),
      inert: bar.hasAttribute("inert"),
      visiblePx: Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0)),
    };
  });

async function pastBuyBox(page) {
  await page.evaluate(() => {
    const b = document.getElementById("buy-box");
    const y = scrollY + b.getBoundingClientRect().bottom + 300;
    scrollTo(0, y);
  });
  await page.waitForTimeout(3000);
}

const browser = await launch("chromium");

// 1) 768 x 1024, scrolled 300 px past the buy box.
{
  const ctx = await newContext(browser, { width: 768, height: 1024, tag: "v-m3d03-768" });
  const page = await ctx.newPage();
  await page.goto(BASE + "/deo/kocioni-disk-prednji-276-24-mm-demo-0004", { waitUntil: "load" });
  await page.waitForTimeout(2500);
  await pastBuyBox(page);
  results.push({ label: "768-past-buybox", ...(await probe(page)) });
  await shot(page, `${OUT}/motion-3d-03-reproduce-768-past`);
  await ctx.close();
}

// 2) Another orderable product at 390 (first /deo/ link from search "disk" that is not demo-0004).
let other = null;
{
  const ctx = await newContext(browser, { width: 390, height: 844, tag: "v-m3d03-other" });
  const page = await ctx.newPage();
  await page.goto(BASE + "/pretraga?q=pločice", { waitUntil: "load" });
  await page.waitForTimeout(2000);
  const links = await page.$$eval("a[href^='/deo/']", (as) => [...new Set(as.map((a) => a.getAttribute("href")))]);
  for (const href of links) {
    if (href.includes("demo-0004") || href.includes("demo-0012")) continue;
    await page.goto(BASE + href, { waitUntil: "load" });
    await page.waitForTimeout(2500);
    if (await page.$("#buy-box")) {
      const hasBar = await page.evaluate(
        () => !![...document.querySelectorAll("div.fixed.bottom-0")].find((d) => d.getAttribute("data-reveal") === "off"),
      );
      if (hasBar) {
        other = href;
        break;
      }
    }
  }
  if (other) {
    await pastBuyBox(page);
    results.push({ label: "390-other-product", route: other, ...(await probe(page)) });
    await shot(page, `${OUT}/motion-3d-03-reproduce-390-other`);
  } else results.push({ label: "390-other-product", note: "no other orderable product found", links });
  await ctx.close();
}

// 3) Real keyboard Tab into the bar at 390 + corrected-position capture.
{
  const ctx = await newContext(browser, { width: 390, height: 844, tag: "v-m3d03-tab" });
  const page = await ctx.newPage();
  await page.goto(BASE + "/deo/kocioni-disk-prednji-276-24-mm-demo-0004", { waitUntil: "load" });
  await page.waitForTimeout(2500);
  await pastBuyBox(page);
  const before = await probe(page);
  // Focus the last focusable element that precedes the bar in DOM order, then press Tab.
  await page.evaluate(() => {
    const bar = [...document.querySelectorAll("div.fixed.bottom-0")].find((d) => d.getAttribute("data-reveal") === "off");
    const all = [...document.querySelectorAll("a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex='-1'])")].filter(
      (e) => !bar.contains(e) && bar.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_PRECEDING && e.offsetParent,
    );
    all.at(-1)?.focus({ preventScroll: true });
  });
  const tabs = [];
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press("Tab");
    tabs.push(
      await page.evaluate(() => {
        const a = document.activeElement;
        const bar = [...document.querySelectorAll("div.fixed.bottom-0")].find((d) => d.getAttribute("data-reveal") === "off");
        const r = a.getBoundingClientRect();
        return {
          tag: a.tagName,
          name: (a.getAttribute("aria-label") || a.textContent || "").trim().slice(0, 50),
          inBar: bar.contains(a),
          top: r.top,
          bottom: r.bottom,
          vh: innerHeight,
          fullyOffscreen: r.top >= innerHeight,
        };
      }),
    );
  }
  results.push({ label: "390-real-tab", before, tabs });
  await shot(page, `${OUT}/motion-3d-03-reproduce-390-tab-focus`);
  // What the bar would look like at its intended position (translate cleared) — for comparison only.
  await page.evaluate(() => {
    const bar = [...document.querySelectorAll("div.fixed.bottom-0")].find((d) => d.getAttribute("data-reveal") === "off");
    bar.style.transform = "none";
  });
  await page.waitForTimeout(200);
  await shot(page, `${OUT}/motion-3d-03-reproduce-390-intended`);
  await ctx.close();
}

await browser.close();
const file = path.join(AUDIT_DIR, OUT, "motion-3d-03-reproduce-extra.json");
writeFileSync(file, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 1));
