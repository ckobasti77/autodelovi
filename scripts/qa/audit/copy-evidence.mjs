/**
 * Copy track: focused evidence screenshots for the reported findings (element or viewport captures).
 *   node scripts/qa/audit/copy-evidence.mjs
 */
import { BASE, launch, newContext, scrollThrough, shot } from "./kit.mjs";

const b = await launch();
const log = [];
async function at(width, fn) {
  const ctx = await newContext(b, { width, height: width < 800 ? 844 : 900, tag: `copy-ev-${width}` });
  const page = await ctx.newPage();
  try {
    await fn(page);
  } catch (e) {
    log.push(String(e).slice(0, 200));
    console.log("ERR", String(e).slice(0, 200));
  }
  await ctx.close();
}
const go = (page, u) => page.goto(`${BASE}${u}`, { waitUntil: "networkidle" });
async function el(page, locator, name) {
  await locator.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1600); // let the text reveal finish
  console.log(await shot(page, `copy/${name}`, { locator }));
}

await at(1440, async (page) => {
  await go(page, "/deo/kocioni-disk-prednji-276-24-mm-demo-0004");
  console.log("title:", await page.title());
  await el(page, page.locator("dl", { hasText: "Garancija" }).first(), "ev-warranty-24-meseci-1440");

  await go(page, "/");
  await page.waitForTimeout(1500);
  console.log(await shot(page, "copy/ev-home-hero-42-vs-44-1440"));
  await scrollThrough(page);
  await el(page, page.getByRole("link", { name: /Svih 44 kategorija/ }), "ev-home-svih-44-kategorija-1440");
  const strip = page.locator("section", { hasText: "Pitanje za majstora?" }).last();
  await el(page, strip, "ev-home-contact-strip-1440");
  const faq = page.locator("details", { hasText: "Mogu li da vratim deo?" }).first();
  await faq.locator("summary").click();
  await el(page, faq, "ev-home-faq-povrat-1440");
  const faq2 = page.locator("details", { hasText: "Koliko košta dostava" }).first();
  await faq2.locator("summary").click();
  await el(page, faq2, "ev-home-faq-dostava-14h-1440");

  await go(page, "/kontakt");
  await page.waitForTimeout(1600);
  console.log(await shot(page, "copy/ev-kontakt-1440"));

  await go(page, "/dostava-i-placanje");
  await el(page, page.locator("table").first(), "ev-dostava-table-1440");
  await el(page, page.getByText("do 14 časova", { exact: false }).first(), "ev-dostava-14h-1440");

  await go(page, "/vozila/skoda");
  await page.waitForTimeout(1600);
  console.log(await shot(page, "copy/ev-vozila-skoda-h1-1440", { clip: { x: 0, y: 0, width: 1440, height: 420 } }));
  await go(page, "/delovi/kocioni-diskovi/skoda");
  await page.waitForTimeout(1600);
  console.log(await shot(page, "copy/ev-landing-skoda-h1-1440", { clip: { x: 0, y: 0, width: 1440, height: 520 } }));

  await go(page, "/porudzbina/GVl2SHwvba1nbEDG8VWTGcg0IPXAbHGNXGpzjHnowJw/predracun");
  await el(page, page.locator("table").first(), "ev-predracun-cena-sa-pdv-1440");

  await go(page, "/za-majstore");
  await el(page, page.getByText("otpremite CSV", { exact: false }).first().locator(".."), "ev-za-majstore-otpremite-csv-1440");

  await go(page, "/upit");
  await el(page, page.getByText("(nije obavezno)").first().locator("xpath=ancestor::div[1]"), "ev-upit-vin-label-1440");

  await go(page, "/delovi/kocioni-diskovi?strana=2");
  console.log("strana=2 title:", await page.title());

  await go(page, "/uslovi-koriscenja");
  await el(page, page.getByText("Nalog je opcion", { exact: false }).first(), "ev-uslovi-opcion-1440");
});

await at(390, async (page) => {
  await go(page, "/delovi/kocioni-diskovi");
  const card = page.locator("article", { hasText: "340 × 30 mm, GTI" }).first();
  await el(page, card, "ev-card-original-vag-dup-390");
  await go(page, "/");
  await page.waitForTimeout(1800);
  console.log(await shot(page, "copy/ev-home-hero-390"));
  await page.evaluate(() => window.scrollTo(0, 900));
  await page.waitForTimeout(1800);
  console.log(await shot(page, "copy/ev-home-hero-stage-390"));
});

console.log("errors", log);
await b.close();
