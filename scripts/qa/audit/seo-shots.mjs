/**
 * Step 21 QA audit, track "seo": viewport evidence for thin hub pages, the footer without a contact
 * link, and the product page whose <title> differs from its H1 (title shown via an overlay made
 * from document.title, since browser chrome is not captured).
 *   node scripts/qa/audit/seo-shots.mjs
 */
import { BASE, launch, newContext, scrollThrough, shot, watch, revealCheck } from "./kit.mjs";

const browser = await launch("chromium");
const log = [];
for (const vp of [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
]) {
  const ctx = await newContext(browser, { ...vp, tag: "seo" });
  const page = await ctx.newPage();
  const w = watch(page);
  for (const [name, p] of [
    ["system-hub-kocnice", "/delovi/kocnice"],
    ["model-hub-skoda-rapid", "/vozila/skoda/rapid"],
    ["kontakt", "/kontakt"],
  ]) {
    await page.goto(BASE + p, { waitUntil: "networkidle" });
    await scrollThrough(page);
    await page.waitForTimeout(600);
    log.push({ name, vp: vp.width, reveal: await revealCheck(page) });
    await shot(page, `seo/${name}-${vp.width}`, { fullPage: true });
  }
  // footer (no „Kontakt“ link)
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await scrollThrough(page);
  const footer = page.locator("footer").last();
  await footer.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  await shot(page, `seo/footer-${vp.width}`, { locator: footer });
  // product: overlay document.title above the H1
  await page.goto(BASE + "/deo/kocioni-disk-prednji-276-24-mm-demo-0004", { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const d = document.createElement("div");
    d.setAttribute("data-reveal", "off");
    d.style.cssText =
      "position:fixed;left:0;right:0;top:0;z-index:99999;background:#fff;color:#1a0dab;font:18px/1.4 Arial,sans-serif;padding:10px 14px;border-bottom:3px solid #d93025";
    d.textContent = `<title>: ${document.title}`;
    document.body.appendChild(d);
  });
  await shot(page, `seo/product-title-vs-h1-${vp.width}`);
  log.push({ errors: w.console.slice(0, 5), bad: w.badResponses.slice(0, 5) });
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(log, null, 1));
