// Skeptic verifier for copy-03: home FAQ „Mogu li da vratim deo?“ vs /reklamacije-i-povrat.
// Reads the LIVE text (Convex content, not the seed file), FAQPage JSON-LD, and the legal page section.
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { BASE, launch, newContext, watch, scrollThrough, shot } from "./kit.mjs";

const OUT = "verify/copy";
const outDir = path.resolve("docs/qa/audit", OUT);
mkdirSync(outDir, { recursive: true });
const report = {};

const browser = await launch("chromium");
for (const vp of [
  { tag: "390", width: 390, height: 844 },
  { tag: "1440", width: 1440, height: 900 },
]) {
  const ctx = await newContext(browser, { width: vp.width, height: vp.height, tag: `vcopy03sk-${vp.tag}` });
  const page = await ctx.newPage();
  const log = watch(page);
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  await scrollThrough(page);
  const heading = page.getByRole("heading", { name: /Česta pitanja/ }).first();
  const headingText = await heading.textContent().catch(() => null);
  const faq = page.locator("details", { hasText: "Mogu li da vratim deo?" }).first();
  const faqCount = await page.locator("details", { hasText: "Mogu li da vratim deo?" }).count();
  await faq.scrollIntoViewIfNeeded();
  await faq.locator("summary").click();
  await page.waitForTimeout(1800);
  const faqText = (await faq.innerText()).replace(/\s+/g, " ").trim();
  const faqLinks = await faq
    .locator("a")
    .evaluateAll((as) => as.map((a) => ({ text: a.textContent, href: a.getAttribute("href") })));
  const ldAnswers = await page.evaluate(() => {
    const out = [];
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const j = JSON.parse(s.textContent);
        const nodes = Array.isArray(j) ? j : j["@graph"] ?? [j];
        for (const n of nodes) {
          if (n["@type"] === "FAQPage")
            for (const q of n.mainEntity ?? [])
              if (/vratim/.test(q.name)) out.push({ q: q.name, a: q.acceptedAnswer?.text });
        }
      } catch {}
    }
    return out;
  });
  const box = await faq.boundingBox();
  await page.evaluate((y) => window.scrollBy(0, y), (box?.y ?? 0) - vp.height / 4);
  await page.waitForTimeout(1500);
  const s1 = await shot(page, `${OUT}/copy-03-skeptic-home-faq-${vp.tag}`);

  await page.goto(`${BASE}/reklamacije-i-povrat`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  await scrollThrough(page);
  const legal = await page.evaluate(() => {
    const h = [...document.querySelectorAll("h2")].find((e) => e.textContent.includes("Odustanak"));
    if (!h) return null;
    const parts = [h.textContent.trim()];
    let n = h.nextElementSibling;
    while (n && n.tagName !== "H2") {
      parts.push(n.innerText.replace(/\s+/g, " ").trim());
      n = n.nextElementSibling;
    }
    return parts;
  });
  const h2 = page.locator("h2", { hasText: "Odustanak" }).first();
  const hb = await h2.boundingBox();
  await page.evaluate((y) => window.scrollBy(0, y), (hb?.y ?? 0) - 80);
  await page.waitForTimeout(1500);
  const s2 = await shot(page, `${OUT}/copy-03-skeptic-legal-${vp.tag}`);
  report[vp.tag] = { headingText, faqCount, faqText, faqLinks, ldAnswers, legal, shots: [s1, s2], log };
  await ctx.close();
}
await browser.close();
writeFileSync(path.join(outDir, "copy-03-skeptic.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
