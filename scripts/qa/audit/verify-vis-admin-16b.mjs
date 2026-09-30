// vis-admin-16 (customer detail part): e-mail line breaks in the Kontakt card.
import { writeFileSync } from "node:fs";
import { BASE, launch, newContext, loginAdmin, shot } from "./kit.mjs";

const DIR = "verify/vis-admin";
const out = {};
const browser = await launch("chromium");
const ctx = await newContext(browser, { width: 1440, height: 900, tag: "ver-va16b" });
const page = await ctx.newPage();
for (let i = 0; i < 3; i++) {
  try {
    await loginAdmin(page);
    break;
  } catch (e) {
    console.log("login retry", i, String(e).slice(0, 120));
  }
}

async function emailBreaks() {
  return page.evaluate(() =>
    [...document.querySelectorAll('main a[href^="mailto:"]')]
      .filter((a) => a.offsetParent)
      .map((a) => {
        const tn = a.firstChild;
        const text = a.textContent;
        const frags = [];
        let cur = "";
        let lastTop = null;
        for (let i = 0; tn && tn.nodeType === 3 && i < text.length; i++) {
          const r = document.createRange();
          r.setStart(tn, i);
          r.setEnd(tn, i + 1);
          const t = Math.round(r.getBoundingClientRect().top);
          if (lastTop !== null && Math.abs(t - lastTop) > 3) {
            frags.push(cur);
            cur = "";
          }
          cur += text[i];
          lastTop = t;
        }
        frags.push(cur);
        const dd = a.closest("dd");
        return {
          email: text,
          frags,
          aWordBreak: getComputedStyle(a).wordBreak,
          ddWidth: dd ? Math.round(dd.getBoundingClientRect().width) : null,
        };
      }),
  );
}

for (const email of ["audit-majstor-5455287@primer.rs", "audit-kupac-5455287@primer.rs"]) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/admin/kupci`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.getByPlaceholder("tačna e-mail adresa…").fill(email);
  await page.waitForTimeout(3000);
  const row = page.locator("main table tbody tr").first();
  await row.click();
  await page.waitForURL(/\/admin\/kupci\/[^/]+$/, { timeout: 30_000 }).catch(() => {});
  const url = new URL(page.url()).pathname;
  out[email] = { url };
  for (const [w, h] of [
    [1440, 900],
    [1280, 800],
    [1920, 1080],
    [1024, 768],
    [390, 844],
  ]) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto(`${BASE}${url}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2500);
    out[email][w] = await emailBreaks();
    if (w === 1440 && email.startsWith("audit-majstor")) {
      const aside = page.locator('aside[aria-label="Podaci o kupcu"]');
      if (await aside.count()) await shot(page, `${DIR}/vis-admin-16-reproduce-customer-1440`, { locator: aside });
    }
  }
}
await browser.close();
writeFileSync("docs/qa/audit/verify/vis-admin/vis-admin-16b-reproduce.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
