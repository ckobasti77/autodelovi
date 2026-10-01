// Independent re-verification of COPY-02 (home FAQ „Mogu li da vratim deo?“ vs /reklamacije-i-povrat):
// anonymous visitor at 390 and 1440, mouse + keyboard, reduced motion, FAQPage JSON-LD, link target.
// AUDIT_BASE=http://localhost:3001 node scripts/qa/fix/search-catalog-content-verify-copy02.mjs
import fs from "node:fs";

import sharp from "sharp";

import { BASE, launch, newContext, revealCheck, scrollThrough, watch } from "../audit/kit.mjs";

const OUT = "docs/qa/fix/search-catalog-content/verify";
fs.mkdirSync(OUT, { recursive: true });
const report = { base: BASE, runs: [] };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const Q = "Mogu li da vratim deo?";

const browser = await launch();
try {
  for (const [w, h, reducedMotion] of [
    [390, 844, "no-preference"],
    [1440, 900, "no-preference"],
    [390, 844, "reduce"],
  ]) {
    const ctx = await newContext(browser, {
      width: w,
      height: h,
      reducedMotion,
      tag: `vfy-copy02-${w}`,
    });
    const page = await ctx.newPage();
    page.setDefaultTimeout(90_000);
    const log = watch(page);
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    const jsonLd = await page.$$eval('script[type="application/ld+json"]', (els) =>
      els.flatMap((e) => {
        try {
          const d = JSON.parse(e.textContent);
          return [d].flat();
        } catch {
          return [];
        }
      }),
    );
    const faqLd = jsonLd.find((d) => d["@type"] === "FAQPage");
    const ldAnswer = faqLd?.mainEntity?.find((q) => q.name === Q)?.acceptedAnswer?.text ?? null;
    await scrollThrough(page);
    const details = page.locator("details", { has: page.locator("summary", { hasText: Q }) });
    const summary = details.locator("summary");
    await summary.scrollIntoViewIfNeeded();
    let keyboard = null;
    if (w === 390 && reducedMotion === "no-preference") {
      // Keyboard: focus the summary, open it with Enter, Tab to the link inside.
      await summary.focus();
      await page.keyboard.press("Enter");
      await sleep(900);
      await page.keyboard.press("Tab");
      keyboard = await page.evaluate(() => {
        const e = document.activeElement;
        const cs = getComputedStyle(e);
        return {
          tag: e.tagName,
          text: e.textContent.trim(),
          href: e.getAttribute("href"),
          outline: `${cs.outlineStyle} ${cs.outlineWidth}`,
        };
      });
    } else {
      await summary.click();
      await sleep(900);
    }
    const open = await details.evaluate((d) => d.open);
    const answer = await details.evaluate((d) => {
      const s = d.querySelector("summary");
      return [...d.childNodes]
        .filter((n) => n !== s)
        .map((n) => n.textContent)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
    });
    const links = await details
      .locator("a")
      .evaluateAll((as) =>
        as.map((a) => ({
          text: a.textContent.trim(),
          href: a.getAttribute("href"),
          underline: getComputedStyle(a).textDecorationLine,
        })),
      );
    const reveal = await revealCheck(page);
    const box = await details.boundingBox();
    const buf = await page.screenshot({
      type: "png",
      clip: { x: 0, y: Math.max(0, box.y - 20), width: w, height: Math.min(h, box.height + 60) },
    });
    const shotPath = `${OUT}/copy02-home-faq-${w}${reducedMotion === "reduce" ? "-reduce" : ""}.webp`;
    await sharp(buf).webp({ quality: 75 }).toFile(shotPath);
    // Follow the link.
    let target = null;
    if (links[0]) {
      await details.locator("a").first().click();
      await page.waitForURL(/reklamacije-i-povrat/);
      await page.locator("h1").first().waitFor();
      target = {
        url: page.url(),
        h1: await page.locator("h1").first().textContent(),
        withdrawal: await page.evaluate(() => {
          const h = [...document.querySelectorAll("h2")].find((e) =>
            /Odustanak/.test(e.textContent),
          );
          if (!h) return null;
          const out = [];
          for (let n = h.nextElementSibling; n && n.tagName !== "H2"; n = n.nextElementSibling)
            out.push(n.textContent.replace(/\s+/g, " ").trim());
          return out.join(" | ");
        }),
      };
    }
    report.runs.push({
      width: w,
      reducedMotion,
      open,
      answer,
      links,
      keyboard,
      ldAnswer,
      ldHasMarkdown: ldAnswer ? /\]\(|\[/.test(ldAnswer) : null,
      reveal,
      shot: shotPath,
      target,
      log,
    });
    console.log(w, reducedMotion, "→", answer, JSON.stringify(links), "LD:", ldAnswer);
    await ctx.close();
  }
} finally {
  await browser.close();
}
fs.writeFileSync(`${OUT}/copy02.json`, JSON.stringify(report, null, 2));
