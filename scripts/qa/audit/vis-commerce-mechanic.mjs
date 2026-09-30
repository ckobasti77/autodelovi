// vis-commerce: mechanic portal (audit mechanic) — every /majstor page at 360/768/1440/2560 and the
// quick order (empty + results) at all 8 widths, plus the 1440 summary-bar reachability check.
import { readFileSync } from "node:fs";
import { BASE, WIDTHS, launch, newContext, watch, scrollThrough, revealCheck, shot, axe, loginWith } from "./kit.mjs";
import { OUT, probe, save, settle, login , harden } from "./vis-commerce-lib.mjs";

const acc = JSON.parse(readFileSync(".playwright/audit-accounts.json", "utf8")).mechanic;
const mode = process.argv[2] ?? "all"; // all | quick | pages
const LINES = [
  "5Q0 615 505 R 2",
  "036 121 959 P",
  "038 121 662 1",
  "1K0 615 868 F x2",
  "1K0 615 540 Q",
  "1K0 413 165 G",
  "1K0 698 406 F 4",
  "3C0 413 232",
  "5Q0 121 200 E",
  "03L 115 549 DA 3",
  "ZZ9999999 3",
  "1K0 121 753 QN",
  "04L 105 204 K",
];

const browser = await launch();
// sign in once, reuse the storage state
let state;
{
  const ctx = await newContext(browser, { width: 1440, height: 900, tag: "viscom-mech-login" });
  const page = harden(await ctx.newPage());
  await login(page, BASE, acc.email, acc.password, "/majstor");
  state = await ctx.storageState();
  await ctx.close();
}
async function ctxFor(w) {
  return browser.newContext({
    storageState: state,
    viewport: { width: w.width, height: w.height },
    isMobile: w.mobile,
    hasTouch: w.mobile,
    locale: "sr-Latn-RS",
    timezoneId: "Europe/Belgrade",
    userAgent: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36 SklopAudit-viscom-mech-${w.tag}/${Date.now()}`,
  });
}

const results = { pages: {}, quick: {} };
if (mode === "all" || mode === "pages") {
  const portal = ["/majstor", "/majstor/porudzbine", "/majstor/omiljeno", "/majstor/vozila", "/majstor/cenovnik", "/majstor/upiti", "/majstor/profil"];
  for (const w of WIDTHS.filter((x) => ["360", "768", "1440", "2560"].includes(x.tag))) {
    const ctx = await ctxFor(w);
    const page = harden(await ctx.newPage());
    const log = watch(page);
    const r = (results.pages[w.tag] = {});
    for (const url of portal) {
      const name = url.replaceAll("/", "_").replace(/^_/, "");
      await page.goto(`${BASE}${url}`, { waitUntil: "load", timeout: 90000 });
      await settle(page, 2000);
      await shot(page, `vis-commerce/mechanic/${w.tag}-${name}`);
      await scrollThrough(page);
      await shot(page, `vis-commerce/mechanic/${w.tag}-${name}-full`, { fullPage: true });
      r[name] = { probe: await probe(page), reveal: await revealCheck(page) };
      if (w.tag === "360" || w.tag === "1440") r[name].axe = await axe(page);
    }
    // first order detail
    await page.goto(`${BASE}/majstor/porudzbine`, { waitUntil: "load", timeout: 90000 });
    await settle(page, 1500);
    const link = page.locator('main a[href^="/majstor/porudzbine/"]').first();
    if (await link.count()) {
      const href = await link.getAttribute("href");
      await page.goto(`${BASE}${href}`, { waitUntil: "load", timeout: 90000 });
      await settle(page, 1500);
      await shot(page, `vis-commerce/mechanic/${w.tag}-order-detail`);
      await scrollThrough(page);
      await shot(page, `vis-commerce/mechanic/${w.tag}-order-detail-full`, { fullPage: true });
      r.orderDetail = { href, probe: await probe(page) };
    }
    r.log = log;
    await ctx.close();
    console.log("pages", w.tag, JSON.stringify(log).slice(0, 300));
  }
}

if (mode === "all" || mode === "quick") {
  for (const w of WIDTHS.filter((x) => !process.env.W || process.env.W.split(",").includes(x.tag))) {
    const ctx = await ctxFor(w);
    const page = harden(await ctx.newPage());
    const log = watch(page);
    await page.goto(`${BASE}/majstor/brza-porudzbina`, { waitUntil: "load", timeout: 90000 });
    await settle(page, 1500);
    await shot(page, `vis-commerce/quick/${w.tag}-empty`);
    const q = (results.quick[w.tag] = { emptyProbe: await probe(page) });
    await page.getByTestId("mechanic-quick-order-input").fill(LINES.join("\n"));
    await page.getByTestId("mechanic-quick-order-check").click();
    await page.getByTestId("mechanic-quick-order-row").first().waitFor({ timeout: 30000 });
    await page.waitForFunction(() => !document.querySelector('[data-testid="mechanic-quick-order-row"][data-status="pending"]'), null, { timeout: 30000 });
    await page.waitForTimeout(1500);
    await shot(page, `vis-commerce/quick/${w.tag}-results`);
    q.resultsProbe = await probe(page);
    if (w.tag === "390" || w.tag === "1440") q.axe = await axe(page);
    // geometry: sticky bar vs rows at the current scroll, and at the end of the page
    const geo = () =>
      page.evaluate(() => {
        const bar = document.querySelector('[data-testid="mechanic-quick-order-add-all"]')?.closest("div.sticky");
        const b = bar?.getBoundingClientRect();
        const rows = [...document.querySelectorAll('[data-testid="mechanic-quick-order-row"]')].map((e) => e.getBoundingClientRect());
        const vh = window.innerHeight;
        const partly = rows.filter((r) => b && r.top < b.top && r.bottom > b.top).length;
        const hidden = rows.filter((r) => b && r.top >= b.top && r.top < vh).length;
        return { vh, scrollY: window.scrollY, barTop: b?.top, barH: b?.height, rows: rows.length, partlyBehindBar: partly, fullyBehindBar: hidden, docH: document.documentElement.scrollHeight, scrollPaddingBottom: getComputedStyle(document.documentElement).scrollPaddingBottom };
      });
    q.geoTop = await geo();
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(700);
    q.geoEnd = await geo();
    await shot(page, `vis-commerce/quick/${w.tag}-results-end`);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    await scrollThrough(page);
    await shot(page, `vis-commerce/quick/${w.tag}-results-full`, { fullPage: true });

    // keyboard: tab through every control in the results and record whether the focused element
    // ends up covered by the sticky bar (WCAG 2.2 SC 2.4.11) or the sticky header.
    if (["390", "1440", "1920"].includes(w.tag)) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.getByTestId("mechanic-quick-order-check").focus();
      const obscured = [];
      for (let i = 0; i < 90; i++) {
        await page.keyboard.press("Tab");
        const info = await page.evaluate(() => {
          const a = document.activeElement;
          if (!a || a === document.body) return null;
          const r = a.getBoundingClientRect();
          const bar = document.querySelector('[data-testid="mechanic-quick-order-add-all"]')?.closest("div.sticky");
          const b = bar?.getBoundingClientRect();
          const header = document.querySelector('[data-testid="site-header"]')?.getBoundingClientRect();
          const inBar = bar?.contains(a);
          const coveredByBar = !inBar && b && r.top >= b.top - 1 && b.top < window.innerHeight;
          const partlyByBar = !inBar && b && r.bottom > b.top + 1 && r.top < b.top;
          const coveredByHeader = header && r.bottom <= header.bottom + 1;
          const row = a.closest('[data-testid="mechanic-quick-order-row"]');
          return {
            label: (a.getAttribute("aria-label") || a.textContent || a.tagName).trim().slice(0, 40),
            inRow: !!row,
            top: Math.round(r.top),
            bottom: Math.round(r.bottom),
            barTop: b ? Math.round(b.top) : null,
            coveredByBar,
            partlyByBar,
            coveredByHeader,
            inFooter: !!a.closest("footer"),
          };
        });
        if (!info || info.inFooter) break;
        if (info.coveredByBar || info.partlyByBar || info.coveredByHeader) obscured.push(info);
        if (info.coveredByBar && obscured.length === 1) await shot(page, `vis-commerce/quick/${w.tag}-focus-obscured`);
      }
      q.focusObscured = obscured;
    }
    q.log = log;
    await ctx.close();
    console.log("quick", w.tag, JSON.stringify(q.geoTop), JSON.stringify(q.geoEnd), "obscured", q.focusObscured?.length);
  }
}
save(`mechanic-${mode}${process.env.W ? "-" + process.env.W.replaceAll(",", "_") : ""}`, results);
await browser.close();
