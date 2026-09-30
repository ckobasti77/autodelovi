// Verifier for copy-02 (contact promises without channels) and copy-04 (hard-coded 14 h cut-off).
import { writeFileSync, mkdirSync } from "node:fs";
import { BASE, launch, newContext, scrollThrough, shot, watch } from "./kit.mjs";

const OUT = "docs/qa/audit/verify/copy";
mkdirSync(OUT, { recursive: true });
const TOKEN = "GVl2SHwvba1nbEDG8VWTGcg0IPXAbHGNXGpzjHnowJw";
const log = [];
const p = (s) => {
  log.push(s);
  console.log(s);
};

const browser = await launch();
for (const vp of [
  { tag: "1440", width: 1440, height: 900 },
  { tag: "390", width: 390, height: 844 },
]) {
  const ctx = await newContext(browser, { width: vp.width, height: vp.height, tag: `verify-copy-${vp.tag}` });
  const page = await ctx.newPage();
  const w = watch(page);

  // Site-wide channel links (header, footer, main) on each route.
  async function channels() {
    return page.evaluate(() => {
      const hrefs = [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href"));
      return {
        tel: hrefs.filter((h) => h.startsWith("tel:")),
        mailto: hrefs.filter((h) => h.startsWith("mailto:")),
        viber: hrefs.filter((h) => h.startsWith("viber:")),
        wa: hrefs.filter((h) => /wa\.me|whatsapp/.test(h)),
        phoneText: (document.body.innerText.match(/\+381[\d\s]{6,}|0\d{2}[\s/]\d{3}[\s]?\d{3,4}/g) || []).slice(0, 5),
        emailText: (document.body.innerText.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) || []).slice(0, 5),
      };
    });
  }

  // /kontakt
  await page.goto(`${BASE}/kontakt`, { waitUntil: "networkidle" });
  await scrollThrough(page);
  const kontaktMain = await page.locator("main").innerText();
  p(`\n== /kontakt @${vp.tag}\nMAIN TEXT:\n${kontaktMain}\nCHANNELS: ${JSON.stringify(await channels())}`);
  await shot(page, `verify/copy/copy-02-reproduce-kontakt-${vp.tag}`);

  // home contact strip
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await scrollThrough(page);
  const strip = page.locator("section[aria-labelledby='contact-title']");
  await strip.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500);
  p(`\n== / contact strip @${vp.tag}\n${await strip.innerText()}\nCHANNELS(page): ${JSON.stringify(await channels())}`);
  await shot(page, `verify/copy/copy-02-reproduce-home-strip-${vp.tag}`, { locator: strip });

  // FAQ dostava (copy-04)
  const faq = page.locator("details", { hasText: "Koliko košta dostava" }).first();
  if (await faq.count()) {
    await faq.scrollIntoViewIfNeeded();
    await faq.locator("summary").click();
    await page.waitForTimeout(1200);
    p(`\n== / FAQ dostava @${vp.tag}\n${await faq.innerText()}`);
    await shot(page, `verify/copy/copy-04-reproduce-home-faq-${vp.tag}`, { locator: faq });
  } else p(`FAQ dostava not found @${vp.tag}`);

  // /dostava-i-placanje (copy-04)
  await page.goto(`${BASE}/dostava-i-placanje`, { waitUntil: "networkidle" });
  await scrollThrough(page);
  const para14 = page.locator("main p", { hasText: "14 časova" }).first();
  p(`\n== /dostava-i-placanje @${vp.tag}: 14h paragraph count=${await page.locator("main p", { hasText: "14 časova" }).count()}`);
  if (await para14.count()) {
    await para14.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1200);
    p(await para14.innerText());
    const box = await para14.boundingBox();
    await shot(page, `verify/copy/copy-04-reproduce-dostava-${vp.tag}`);
    p(`box ${JSON.stringify(box)}`);
  }

  // /reklamacije-i-povrat
  await page.goto(`${BASE}/reklamacije-i-povrat`, { waitUntil: "networkidle" });
  await scrollThrough(page);
  const rMain = await page.locator("main").innerText();
  p(`\n== /reklamacije-i-povrat @${vp.tag}\n${rMain}\nCHANNELS: ${JSON.stringify(await channels())}`);
  const odust = page.locator("main li", { hasText: "izjavu o odustanku" }).first();
  if (await odust.count()) {
    await odust.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1200);
    await shot(page, `verify/copy/copy-02-reproduce-reklamacije-${vp.tag}`);
  }
  const hasForm = await page.evaluate(() =>
    [...document.querySelectorAll("main a")].some((a) => /obraz|\.pdf|\.docx?/i.test(a.textContent + a.href)),
  );
  p(`withdrawal form link on page: ${hasForm}`);

  // /politika-privatnosti
  await page.goto(`${BASE}/politika-privatnosti`, { waitUntil: "networkidle" });
  await scrollThrough(page);
  const ppMain = await page.locator("main").innerText();
  p(`\n== /politika-privatnosti @${vp.tag} (first 1200)\n${ppMain.slice(0, 1200)}`);
  const vp2 = page.locator("main p", { hasText: "Zahtev pošaljite" }).first();
  p(`Vaša prava: ${(await vp2.count()) ? await vp2.innerText() : "not found"}`);
  const rk = page.locator("main h2", { hasText: "Rukovalac" }).first();
  if (await rk.count()) {
    await rk.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1200);
    await shot(page, `verify/copy/copy-02-reproduce-privatnost-${vp.tag}`);
  }

  // order status
  await page.goto(`${BASE}/porudzbina/${TOKEN}`, { waitUntil: "networkidle" });
  await scrollThrough(page);
  const q = page.locator("p", { hasText: "Pitanje o porudžbini" }).first();
  if (await q.count()) {
    const parent = q.locator("xpath=..");
    p(`\n== /porudzbina @${vp.tag}\nblock: ${JSON.stringify(await parent.innerText())} links=${await parent.locator("a").count()}`);
    await q.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1200);
    await shot(page, `verify/copy/copy-02-reproduce-porudzbina-${vp.tag}`);
  } else p(`order status: "Pitanje o porudžbini" not found @${vp.tag}`);
  p(`CHANNELS order page: ${JSON.stringify(await channels())}`);
  p(`errors: ${JSON.stringify({ c: w.console.slice(0, 3), pe: w.pageErrors.slice(0, 3) })}`);
  await ctx.close();
}
await browser.close();
writeFileSync(`${OUT}/copy-02-04-reproduce.txt`, log.join("\n"));
