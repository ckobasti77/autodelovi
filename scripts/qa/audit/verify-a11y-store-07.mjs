/**
 * Verify a11y-store-07: focus + announcements after removing a cart line (/korpa and drawer).
 *   node scripts/qa/audit/verify-a11y-store-07.mjs [engine]
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { launch, newContext, shot, BASE } from "./kit.mjs";

const engine = process.argv[2] ?? "chromium";
const DIR = "docs/qa/audit/verify/a11y-store";
mkdirSync(DIR, { recursive: true });
const out = {};
const note = (k, v) => {
  out[k] = v;
  console.log("--", k, (typeof v === "string" ? v : JSON.stringify(v)).slice(0, 1500));
};
const act = (page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return "BODY";
    return `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""} "${(el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 60)}"`;
  });
// Record every text change inside live regions (incl. transient ones) from now on.
const armLiveLog = (page) =>
  page.evaluate(() => {
    window.__live = [];
    const sel = "[aria-live],[role=status],[role=alert],[role=log]";
    const rec = (el) => {
      const r = el.closest(sel);
      if (!r) return;
      const t = r.textContent.replace(/\s+/g, " ").trim();
      if (t) window.__live.push(`${r.getAttribute("role") || ""}/${r.getAttribute("aria-live") || ""}#${r.id || ""}: ${t.slice(0, 100)}`);
    };
    new MutationObserver((ms) => {
      for (const m of ms) {
        const el = m.target.nodeType === 1 ? m.target : m.target.parentElement;
        if (el) rec(el);
        for (const n of m.addedNodes) {
          if (n.nodeType === 1) {
            if (n.matches(sel)) rec(n);
            n.querySelectorAll?.(sel).forEach(rec);
          }
        }
      }
    }).observe(document.body, { subtree: true, childList: true, characterData: true });
  });
const liveLog = (page) => page.evaluate(() => [...new Set(window.__live)]);

async function addFromPdp(page, slug) {
  await page.goto(`${BASE}/deo/${slug}`, { waitUntil: "load", timeout: 180000 });
  await page.waitForTimeout(2500);
  await page.getByTestId("product-add-to-cart").first().click();
  await page.waitForTimeout(1800);
}

async function tabTo(page, re, max = 40) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press("Tab");
    const name = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || document.activeElement?.textContent || "");
    if (re.test(name.trim())) return i + 1;
  }
  return -1;
}

const browser = await launch(engine);
const SLUG1 = "kocioni-disk-prednji-276-24-mm-demo-0004";
for (const [w, h] of [[1440, 900], [390, 844]]) {
  const tag = `${engine}-${w}`;
  // Scenario A: one line on /korpa
  {
    const ctx = await newContext(browser, { width: w, height: h, tag: `v07a${w}`, engine });
    const page = await ctx.newPage();
    try {
      await addFromPdp(page, SLUG1);
      await page.goto(`${BASE}/korpa`, { waitUntil: "load", timeout: 180000 });
      await page.waitForTimeout(3000);
      await armLiveLog(page);
      // +1 via keyboard
      await page.locator("main").getByRole("button", { name: "Povećaj količinu" }).first().focus();
      await page.keyboard.press("Enter");
      await page.waitForTimeout(1800);
      note(`${tag} A live after +1`, await liveLog(page));
      note(`${tag} A focus after +1`, await act(page));
      // Tab from the product link to the remove button
      await page.locator("main [data-testid=cart-line] a").first().focus();
      const tabs = await tabTo(page, /^Ukloni/);
      note(`${tag} A tabs to remove`, `${tabs} -> ${await act(page)}`);
      await armLiveLog(page);
      await page.keyboard.press("Enter");
      await page.waitForTimeout(2500);
      note(`${tag} A focus after remove`, await act(page));
      note(`${tag} A live after remove`, await liveLog(page));
      note(`${tag} A empty state h2`, await page.evaluate(() => { const h = [...document.querySelectorAll("main h2")].find((x) => /prazna/.test(x.textContent)); return h ? { text: h.textContent, tabindex: h.getAttribute("tabindex") } : null; }));
      await shot(page, `verify/a11y-store/a11y-store-07-reproduce-A-${tag}`);
      // next Tab lands where?
      await page.keyboard.press("Tab");
      note(`${tag} A first Tab after remove`, await act(page));
    } catch (e) {
      note(`${tag} A error`, String(e).slice(0, 300));
    }
    await ctx.close();
  }
  // Scenario B: two lines on /korpa, remove the first
  {
    const ctx = await newContext(browser, { width: w, height: h, tag: `v07b${w}`, engine });
    const page = await ctx.newPage();
    try {
      await page.goto(`${BASE}/delovi/kocioni-diskovi`, { waitUntil: "load", timeout: 180000 });
      await page.waitForTimeout(2500);
      const slugs = await page.$$eval("[data-product-slug]", (els) => els.map((e) => e.getAttribute("data-product-slug")));
      const other = slugs.find((s) => s !== SLUG1);
      await addFromPdp(page, SLUG1);
      await addFromPdp(page, other);
      await page.goto(`${BASE}/korpa`, { waitUntil: "load", timeout: 180000 });
      await page.waitForTimeout(3000);
      note(`${tag} B lines`, await page.locator("main [data-testid=cart-line]").count());
      await page.locator("main [data-testid=cart-line] a").first().focus();
      const tabs = await tabTo(page, /^Ukloni/);
      note(`${tag} B tabs to remove`, `${tabs} -> ${await act(page)}`);
      await armLiveLog(page);
      await page.keyboard.press("Enter");
      await page.waitForTimeout(2500);
      note(`${tag} B lines after`, await page.locator("main [data-testid=cart-line]").count());
      note(`${tag} B focus after remove`, await act(page));
      note(`${tag} B live after remove`, await liveLog(page));
      await page.keyboard.press("Tab");
      note(`${tag} B first Tab after remove`, await act(page));
      await shot(page, `verify/a11y-store/a11y-store-07-reproduce-B-${tag}`);
      // Scenario C: drawer removal of the remaining line
      await page.goto(`${BASE}/deo/${SLUG1}`, { waitUntil: "load", timeout: 180000 });
      await page.waitForTimeout(2500);
      await page.locator("header a[href='/korpa'], header button[aria-label^='Korpa']").first().focus();
      await page.keyboard.press("Enter");
      await page.waitForTimeout(1500);
      const inDlg = await page.locator("[role=dialog]:visible").count();
      note(`${tag} C drawer open`, inDlg);
      if (inDlg) {
        await armLiveLog(page);
        const rm = page.locator("[role=dialog]").getByRole("button", { name: /^Ukloni/ }).first();
        await rm.focus();
        await page.keyboard.press("Enter");
        await page.waitForTimeout(2500);
        note(`${tag} C drawer focus after remove`, await act(page));
        note(`${tag} C drawer live after remove`, await liveLog(page));
        await shot(page, `verify/a11y-store/a11y-store-07-reproduce-C-${tag}`);
      }
    } catch (e) {
      note(`${tag} B/C error`, String(e).slice(0, 300));
    }
    await ctx.close();
  }
}
writeFileSync(`${DIR}/a11y-store-07-reproduce-${engine}.json`, JSON.stringify(out, null, 1));
await browser.close();
