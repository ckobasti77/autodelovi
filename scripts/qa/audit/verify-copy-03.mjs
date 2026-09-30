// Verifier for copy-03: home FAQ „Mogu li da vratim deo?“ vs /reklamacije-i-povrat (withdrawal right).
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { BASE, launch, newContext, watch, scrollThrough, shot } from "./kit.mjs";

const OUT = "verify/copy";
const outDir = path.resolve("docs/qa/audit", OUT);
mkdirSync(outDir, { recursive: true });
const report = {};

const browser = await launch("chromium");
for (const vp of [
  { tag: "1440", width: 1440, height: 900 },
  { tag: "390", width: 390, height: 844 },
]) {
  const ctx = await newContext(browser, { width: vp.width, height: vp.height, tag: `vcopy03-${vp.tag}` });
  const page = await ctx.newPage();
  const log = watch(page);
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await scrollThrough(page);
  const faq = page.locator("details", { hasText: "Mogu li da vratim deo?" }).first();
  await faq.scrollIntoViewIfNeeded();
  await faq.locator("summary").click();
  await page.waitForTimeout(1500);
  const faqText = (await faq.innerText()).replace(/\s+/g, " ").trim();
  const faqLinks = await faq.locator("a").evaluateAll((as) => as.map((a) => ({ text: a.textContent, href: a.getAttribute("href") })));
  // JSON-LD on home
  const ld = await page.evaluate(() =>
    [...document.querySelectorAll('script[type="application/ld+json"]')]
      .map((s) => s.textContent)
      .filter((t) => t && t.includes("FAQPage")),
  );
  let ldAnswer = null;
  for (const t of ld) {
    try {
      const j = JSON.parse(t);
      const arr = Array.isArray(j) ? j : j["@graph"] ?? [j];
      for (const node of arr) {
        if (node["@type"] === "FAQPage") {
          const q = node.mainEntity.find((e) => e.name.includes("vratim"));
          if (q) ldAnswer = q.acceptedAnswer?.text;
        }
      }
    } catch (e) {
      ldAnswer = `parse error ${e}`;
    }
  }
  await page.waitForTimeout(800);
  const box = await faq.boundingBox();
  const vpH = vp.height;
  await page.evaluate((y) => window.scrollBy(0, y), (box?.y ?? 0) - vpH / 3);
  await page.waitForTimeout(1200);
  const s1 = await shot(page, `${OUT}/copy-03-reproduce-home-faq-${vp.tag}`, { locator: faq });
  const s1v = await shot(page, `${OUT}/copy-03-reproduce-home-faq-viewport-${vp.tag}`);

  // Legal page
  await page.goto(`${BASE}/reklamacije-i-povrat`, { waitUntil: "networkidle" });
  await scrollThrough(page);
  const h2 = page.locator("h2", { hasText: "Odustanak od ugovora" }).first();
  const legal = await page.evaluate(() => {
    const h = [...document.querySelectorAll("h2")].find((e) => e.textContent.includes("Odustanak od ugovora"));
    if (!h) return null;
    const parts = [h.textContent];
    let n = h.nextElementSibling;
    while (n && n.tagName !== "H2") {
      parts.push(n.innerText.replace(/\s+/g, " ").trim());
      n = n.nextElementSibling;
    }
    return parts.join("\n");
  });
  await h2.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -120));
  await page.waitForTimeout(1500);
  const s2 = await shot(page, `${OUT}/copy-03-reproduce-legal-${vp.tag}`);
  report[vp.tag] = { faqText, faqLinks, ldAnswer, legal, shots: [s1, s1v, s2], log };
  await ctx.close();
}
await browser.close();
writeFileSync(path.join(outDir, "copy-03-reproduce.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
