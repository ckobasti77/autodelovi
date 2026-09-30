// vis-commerce (3rd reviewer): account at 1440 (prior capture lost the session), status chip widths,
// legal table on mobile, predračun table on mobile, ads landing and unsubscribe first viewports.
//   node scripts/qa/audit/vis-commerce-verify4.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { BASE, launch, newContext, watch, shot, scrollThrough, revealCheck } from "./kit.mjs";
import { OUT, login, harden, settle } from "./vis-commerce-lib.mjs";

const acc = JSON.parse(readFileSync(".playwright/audit-accounts.json", "utf8")).customer;
const res = {};
const flush = () => writeFileSync(`${OUT}/v4-verify.json`, JSON.stringify(res, null, 2));
const browser = await launch();
const ua = (t) => `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36 SklopAudit-viscom4-${t}/${Date.now()}`;

// Public pages at 360
{
  const ctx = await newContext(browser, { width: 360, height: 780, tag: "viscom4-pub" });
  const page = harden(await ctx.newPage());
  const log = watch(page);
  await page.goto(`${BASE}/dostava-i-placanje`);
  await settle(page, 1500);
  res.dostavaTable = await page.evaluate(() => {
    const t = document.querySelector("main table");
    if (!t) return null;
    let w = t.parentElement;
    while (w && w !== document.body && !["auto", "scroll"].includes(getComputedStyle(w).overflowX)) w = w.parentElement;
    const headers = [...t.querySelectorAll("th")].map((th) => th.textContent.trim());
    const cells = [...t.querySelectorAll("tr")].slice(1).map((tr) => [...tr.children].map((c) => `${c.textContent.trim().slice(0, 30)} w${Math.round(c.getBoundingClientRect().width)} h${Math.round(c.getBoundingClientRect().height)}`));
    return { headers, cells, tableW: Math.round(t.getBoundingClientRect().width), wrapperW: w && Math.round(w.getBoundingClientRect().width), wrapperScrollW: w?.scrollWidth, wrapperTabindex: w?.getAttribute("tabindex"), wrapperRole: w?.getAttribute("role"), wrapperLabel: w?.getAttribute("aria-label"), vw: innerWidth };
  });
  const tb = await page.locator("main table").first().boundingBox();
  if (tb) await shot(page, "vis-commerce/v4/360-dostava-table", { clip: { x: 0, y: Math.max(0, tb.y - 20), width: 360, height: Math.min(420, tb.height + 40) } });
  console.log("dostava", JSON.stringify(res.dostavaTable));

  // predračun table at 360
  await page.goto(`${BASE}/porudzbina/GVl2SHwvba1nbEDG8VWTGcg0IPXAbHGNXGpzjHnowJw/predracun`);
  await settle(page, 1500);
  res.predracun360 = await page.evaluate(() => {
    const t = document.querySelector("table");
    if (!t) return null;
    const heads = [...t.querySelectorAll("th")].map((th) => `${th.textContent.trim()} w${Math.round(th.getBoundingClientRect().width)}`);
    const first = t.querySelector("tbody tr td");
    const lh = first ? parseFloat(getComputedStyle(first).lineHeight) : 0;
    return { heads, firstCellW: first && Math.round(first.getBoundingClientRect().width), firstCellH: first && Math.round(first.getBoundingClientRect().height), approxLines: first && lh ? Math.round(first.getBoundingClientRect().height / lh) : null };
  });
  const pt = await page.locator("table").first().boundingBox();
  if (pt) await shot(page, "vis-commerce/v4/360-predracun-table", { clip: { x: 0, y: Math.max(0, pt.y - 10), width: 360, height: Math.min(460, pt.height + 20) } });
  console.log("predracun", JSON.stringify(res.predracun360));

  for (const [url, name] of [["/ponuda/kocione-plocice-golf", "ponuda"], ["/obavestenja/odjava/nevazeci-token-123", "odjava"]]) {
    await page.goto(`${BASE}${url}`);
    await settle(page, 2000);
    await shot(page, `vis-commerce/v4/360-${name}`);
    await scrollThrough(page);
    res[name] = { reveal: await revealCheck(page), h1: await page.locator("h1").first().textContent().catch(() => null), H: await page.evaluate(() => document.documentElement.scrollHeight) };
  }
  res.pubLog = log;
  flush();
  await ctx.close();
}

// Customer account
{
  let state;
  {
    const ctx = await newContext(browser, { width: 1440, height: 900, tag: "viscom4-login" });
    const page = harden(await ctx.newPage());
    for (let i = 0; i < 3; i++) {
      try { await login(page, BASE, acc.email, acc.password, "/nalog"); break; } catch (e) { console.log("login retry", String(e).slice(0, 80)); }
    }
    state = await ctx.storageState();
    await ctx.close();
  }
  res.account = {};
  for (const [w, h, mobile] of [[1440, 900, false], [360, 780, true]]) {
    const ctx = await browser.newContext({ storageState: state, viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, locale: "sr-Latn-RS", timezoneId: "Europe/Belgrade", userAgent: ua(`a${w}`) });
    const page = harden(await ctx.newPage());
    const log = watch(page);
    const r = (res.account[w] = {});
    for (const p of ["/nalog", "/nalog/porudzbine", "/nalog/profil"]) {
      await page.goto(`${BASE}${p}`);
      await settle(page, 1800);
      const path = new URL(page.url()).pathname;
      r[p] = await page.evaluate(() => {
        const chips = [...document.querySelectorAll("main span, main p, main div")].filter((e) => /^(Primljena|Potvrđena|Poslata|Isporučena|Otkazana)$/.test(e.textContent.trim()) && e.children.length <= 1)
          .map((e) => { const r = e.getBoundingClientRect(); return `${Math.round(r.width)}x${Math.round(r.height)} ${getComputedStyle(e).display}`; });
        return { h1: document.querySelector("h1")?.textContent, chips: [...new Set(chips)].slice(0, 6), over: document.documentElement.scrollWidth - document.documentElement.clientWidth };
      });
      r[p].landed = path;
      if (w === 1440 || p === "/nalog") await shot(page, `vis-commerce/v4/${w}-${p.replaceAll("/", "_").slice(1)}`);
    }
    r.log = log;
    console.log("account", w, JSON.stringify(r).slice(0, 1500));
    flush();
    await ctx.close();
  }
}
flush();
await browser.close();
console.log("done");
