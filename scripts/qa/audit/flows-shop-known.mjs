/**
 * flows-shop: the three known items owned by this track, measured on a 390 px phone.
 * 1. search not narrowed by the selected vehicle (Golf 7 selected → /pretraga?q=pločice)
 * 2. category filter row not sticky (/delovi/kocioni-diskovi scrolled 1200 px)
 * 3. no sticky contact bar (call / Viber / WhatsApp) on product and landing pages
 * Evidence: docs/qa/audit/flows-shop/K-*.webp + known.json.
 */
import { BASE, launch, newContext, shot, watch } from "./kit.mjs";
import { saveJson, sleep } from "./flows-shop-lib.mjs";

const T = "flows-shop";
const out = {};
const browser = await launch();
const ctx = await newContext(browser, { width: 390, height: 844, tag: "flows-known" });
const page = await ctx.newPage();
page.setDefaultTimeout(60_000);
page.setDefaultNavigationTimeout(150_000);
const log = watch(page);

// Select Golf 7 the way the store persists it.
await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
await page.evaluate(() => {
  localStorage.setItem(
    "sk.vehicle.v1",
    JSON.stringify({
      state: {
        vehicle: {
          brand: { slug: "volkswagen", name: "Volkswagen" },
          model: { slug: "golf", name: "Golf" },
          generation: { slug: "golf-7", name: "Golf 7", yearFrom: 2012, yearTo: 2020 },
          engine: null,
        },
      },
      version: 1,
    }),
  );
});
for (const q of ["pločice", "kočioni disk"]) {
  await page.goto(`${BASE}/pretraga?q=${encodeURIComponent(q)}`, { waitUntil: "domcontentloaded" });
  await page.locator("h1").first().waitFor();
  await sleep(4000);
  out[q] = await page.evaluate(() => ({
    h1: document.querySelector("h1")?.textContent,
    meta: document.querySelector("h1 + p")?.textContent,
    headerVehicle: [...document.querySelectorAll("header button, header a")].map((e) => e.textContent?.trim()).filter((t) => /Golf/.test(t ?? "")).slice(0, 2),
    cards: [...document.querySelectorAll('[data-testid="product-card"]')].map((c) => c.innerText.replace(/\s+/g, " ").slice(0, 140)),
    vehicleMention: /Golf 7|vaše vozilo|odgovara/i.test(document.querySelector("main")?.innerText ?? ""),
  }));
  console.log(q, out[q].cards.length, out[q].meta, out[q].headerVehicle);
}
await shot(page, `${T}/K-search-vehicle-selected-390`);

// 2. category filter row sticky?
await page.goto(`${BASE}/delovi/kocioni-diskovi`, { waitUntil: "domcontentloaded" });
await page.locator("h1").first().waitFor();
await sleep(2500);
out.filterBefore = await page.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find((b) => /Filteri|Filter|Sortiraj/i.test(b.textContent ?? ""));
  if (!btn) return null;
  let el = btn;
  const chain = [];
  while (el && el !== document.body) {
    const cs = getComputedStyle(el);
    if (cs.position === "sticky" || cs.position === "fixed") chain.push(`${el.tagName}.${cs.position}`);
    el = el.parentElement;
  }
  return { text: btn.textContent?.trim(), top: btn.getBoundingClientRect().top, stickyAncestors: chain };
});
await page.evaluate(() => window.scrollTo(0, 1400));
await sleep(1200);
out.filterAfter = await page.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find((b) => /Filteri|Filter|Sortiraj/i.test(b.textContent ?? ""));
  return btn ? { top: Math.round(btn.getBoundingClientRect().top), visible: btn.getBoundingClientRect().bottom > 0 } : null;
});
await shot(page, `${T}/K-category-scrolled-390`);

// 3. sticky contact bar on product + landing
for (const [k, u] of [
  ["product", "/deo/kocioni-disk-prednji-276-24-mm-demo-0004"],
  ["landing", "/ponuda/kocione-plocice-golf"],
  ["category", "/delovi/kocioni-diskovi/volkswagen/golf"],
]) {
  const r = await page.goto(`${BASE}${u}`, { waitUntil: "domcontentloaded" });
  if (r?.status() !== 200) {
    out[k] = { status: r?.status() };
    continue;
  }
  await sleep(2500);
  await page.evaluate(() => window.scrollTo(0, 1600));
  await sleep(1200);
  out[k] = await page.evaluate(() => {
    const fixed = [...document.querySelectorAll("body *")]
      .filter((e) => {
        const cs = getComputedStyle(e);
        const r = e.getBoundingClientRect();
        return (cs.position === "fixed" || cs.position === "sticky") && r.height > 0 && r.width > 0 && r.top >= 0 && r.top < innerHeight;
      })
      .map((e) => ({ tag: e.tagName, top: Math.round(e.getBoundingClientRect().top), text: e.innerText.replace(/\s+/g, " ").slice(0, 80) }));
    const contactInView = [...document.querySelectorAll('a[href^="tel:"], a[href^="viber:"], a[href*="wa.me"]')]
      .filter((a) => {
        const r = a.getBoundingClientRect();
        return r.bottom > 0 && r.top < innerHeight && r.width > 0;
      })
      .map((a) => a.getAttribute("href"));
    const contactTotal = document.querySelectorAll('a[href^="tel:"], a[href^="viber:"], a[href*="wa.me"]').length;
    return { status: 200, fixed, contactInView, contactTotal };
  });
  await shot(page, `${T}/K-${k}-scrolled-390`);
}
out.log = log;
console.log(JSON.stringify(out, null, 1).slice(0, 6000));
saveJson("known.json", out);
await browser.close();
