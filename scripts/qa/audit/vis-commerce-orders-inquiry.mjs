// vis-commerce: order confirmation, status, predračun (screen + print), inquiry form (empty, errors,
// photos), inquiry status with quote. Widths 360, 768, 1440, 2560 (argv overrides).
import { writeFileSync } from "node:fs";
import sharp from "sharp";
import { BASE, WIDTHS, launch, newContext, watch, scrollThrough, revealCheck, shot, axe } from "./kit.mjs";
import { OUT, probe, save, settle , harden } from "./vis-commerce-lib.mjs";

const ORDER = "GVl2SHwvba1nbEDG8VWTGcg0IPXAbHGNXGpzjHnowJw";
const QUOTE = "3UMmrdzw1RNGw5ToQh06cANjxl8c_-Ajvp7eBwA1ayI";
const want = process.argv.slice(2);
const tags = want.length ? want : ["360", "768", "1440", "2560"];
const widths = WIDTHS.filter((w) => tags.includes(w.tag));

// three small test photos for the upload state
const photos = [];
for (const [i, c] of [[200, 90, 40], [60, 70, 80], [140, 140, 130]].entries()) {
  const f = `${OUT}/_state/photo-${i + 1}.jpg`;
  await sharp({ create: { width: 800, height: 600, channels: 3, background: { r: c[0], g: c[1], b: c[2] } } }).jpeg().toFile(f);
  photos.push(f);
}

const browser = await launch();
const results = {};
const pages = [
  ["hvala", `/porudzbina/hvala/${ORDER}`],
  ["status", `/porudzbina/${ORDER}`],
  ["predracun", `/porudzbina/${ORDER}/predracun`],
  ["upit-status", `/upit/${QUOTE}`],
  ["upit-hvala", `/upit/hvala/${QUOTE}`],
];

for (const w of widths) {
  const r = (results[w.tag] = {});
  const ctx = await newContext(browser, { width: w.width, height: w.height, tag: `viscom-ord-${w.tag}` });
  const page = harden(await ctx.newPage());
  const log = watch(page);
  for (const [name, url] of pages) {
    await page.goto(`${BASE}${url}`, { waitUntil: "load", timeout: 90000 });
    await settle(page, 1800);
    await shot(page, `vis-commerce/orders/${w.tag}-${name}`);
    await scrollThrough(page);
    await shot(page, `vis-commerce/orders/${w.tag}-${name}-full`, { fullPage: true });
    r[name] = { probe: await probe(page), reveal: await revealCheck(page) };
    if (w.tag === "360" || w.tag === "1440") r[name].axe = await axe(page);
  }
  // inquiry form
  await page.goto(`${BASE}/upit`, { waitUntil: "load", timeout: 90000 });
  await settle(page, 1800);
  await shot(page, `vis-commerce/orders/${w.tag}-upit`);
  await scrollThrough(page);
  await shot(page, `vis-commerce/orders/${w.tag}-upit-full`, { fullPage: true });
  r.upit = { probe: await probe(page), reveal: await revealCheck(page) };
  if (w.tag === "360" || w.tag === "1440") r.upit.axe = await axe(page);
  await page.getByTestId("inquiry-submit").click();
  await page.waitForTimeout(1000);
  await shot(page, `vis-commerce/orders/${w.tag}-upit-errors`);
  await shot(page, `vis-commerce/orders/${w.tag}-upit-errors-full`, { fullPage: true });
  r.upitErrors = await page.evaluate(() => ({
    active: document.activeElement?.outerHTML.slice(0, 200),
    invalid: [...document.querySelectorAll("[aria-invalid=true]")].map((e) => e.id || e.name),
  }));
  await page.getByTestId("inquiry-vin-input").fill("WVWZZZAUZHW123456");
  await page.waitForTimeout(800);
  await page.getByTestId("inquiry-photo-input").setInputFiles(photos);
  await page.waitForTimeout(2500);
  await page.getByTestId("inquiry-photo-input").evaluate((e) => e.closest("fieldset,section,div")?.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(400);
  await shot(page, `vis-commerce/orders/${w.tag}-upit-photos`);
  await page.getByTestId("inquiry-vin-input").scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -120));
  await shot(page, `vis-commerce/orders/${w.tag}-upit-vin`);
  r.upitAfter = { probe: await probe(page) };
  r.log = log;
  await ctx.close();
  console.log(w.tag, "done", JSON.stringify(log).slice(0, 400));
}

// predračun print emulation (A4 width) + PDF page count
{
  const ctx = await newContext(browser, { width: 794, height: 1123, tag: "viscom-print" });
  const page = harden(await ctx.newPage());
  await page.goto(`${BASE}/porudzbina/${ORDER}/predracun`, { waitUntil: "load", timeout: 90000 });
  await settle(page, 1500);
  await page.emulateMedia({ media: "print" });
  await page.waitForTimeout(500);
  await shot(page, "vis-commerce/orders/print-predracun", { fullPage: true, quality: 80 });
  const pdf = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
  const pagesN = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  results.print = { pdfBytes: pdf.length, pdfPages: pagesN };
  writeFileSync(`${OUT}/_state/predracun.pdf`, pdf);
  // hidden-in-print check
  results.print.visible = await page.evaluate(() =>
    [...document.querySelectorAll("header,nav,footer,button,a")]
      .filter((e) => e.getBoundingClientRect().height > 0 && getComputedStyle(e).display !== "none")
      .slice(0, 20)
      .map((e) => `${e.tagName.toLowerCase()}: ${e.textContent.trim().slice(0, 40)}`),
  );
  await ctx.close();
}
save(`orders-inquiry-${tags.join("_")}`, results);
await browser.close();
