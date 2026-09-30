// motion-3d: text reveal in the non-default modes —
//  A) client-side navigation (click links) then scrollThrough → contract check;
//  B) reduced motion: nothing hidden at any moment (sampled right after commit);
//  C) JavaScript disabled: nothing hidden;
//  D) print media: pending copy is visible;
//  E) anchor jump to a section far down: copy above shown instantly, target revealed;
//  F) the mechanic favourites page re-check (words left in the DOM).
import { readFileSync, writeFileSync } from "node:fs";
import { BASE, launch, newContext, watch, scrollThrough, revealCheck, shot } from "./kit.mjs";

const out = {};
const browser = await launch();
const hiddenCount = (page) =>
  page.evaluate(() => {
    const els = [...document.querySelectorAll("main *")].filter(
      (e) => e.offsetParent && e.childNodes.length && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && getComputedStyle(e).opacity === "0",
    );
    return { n: els.length, sample: els.slice(0, 5).map((e) => `${e.tagName.toLowerCase()}: ${e.textContent.trim().slice(0, 40)}`), trjs: document.documentElement.className };
  });

// A) client-side navigation chain.
{
  const ctx = await newContext(browser, { width: 390, height: 844, tag: "m3d-modes-a" });
  const page = await ctx.newPage();
  const log = watch(page);
  await page.goto(`${BASE}/delovi`, { waitUntil: "load", timeout: 90_000 });
  await page.waitForTimeout(2500);
  const chain = [];
  const hops = [
    ['main a[href="/delovi/kocioni-diskovi"]', "/delovi/kocioni-diskovi"],
    ['main a[href^="/deo/"]', "/deo/"],
    ['header a[href="/"], header a[aria-label*="početna"]', "/"],
    ['main a[href="/za-majstore"], a[href="/za-majstore"]', "/za-majstore"],
    ['a[href="/vozila"]', "/vozila"],
    ['main a[href="/vozila/volkswagen"]', "/vozila/volkswagen"],
  ];
  for (const [sel, expect] of hops) {
    const link = page.locator(sel).first();
    try {
      await link.evaluate((el) => el.scrollIntoView({ block: "center" }));
      await page.waitForTimeout(400);
      await link.click({ timeout: 15_000 });
    } catch (e) {
      // Mobile header links sit in the menu sheet: fall back to a client push through a created link.
      await page.evaluate((href) => {
        const a = document.createElement("a");
        a.href = href;
        document.body.appendChild(a);
        a.click();
      }, expect);
    }
    await page.waitForURL((u) => u.pathname.startsWith(expect), { timeout: 60_000 }).catch(() => {});
    await page.waitForTimeout(2500);
    const navType = await page.evaluate(() => performance.getEntriesByType("navigation")[0]?.name);
    await scrollThrough(page);
    await page.waitForTimeout(800);
    const r = await revealCheck(page);
    const states = await page.evaluate(() => document.querySelectorAll("[data-reveal-state]").length);
    chain.push({ at: page.url().replace(BASE, ""), firstDocument: navType?.replace(BASE, ""), ...r, states });
    console.log("A", page.url().replace(BASE, ""), JSON.stringify(r), "states", states);
    if (r.stuck.length || r.pending) await shot(page, `motion-3d/modes-clientnav-fail-${chain.length}`);
  }
  out.clientNav = { chain, log };
  await ctx.close();
}

// B) reduced motion — sample immediately after commit and after load.
{
  const ctx = await newContext(browser, { width: 390, height: 844, tag: "m3d-modes-b", reducedMotion: "reduce" });
  const page = await ctx.newPage();
  const rows = [];
  for (const url of ["/", "/delovi/kocioni-diskovi", "/za-majstore", "/deo/kocioni-disk-prednji-276-24-mm-demo-0004"]) {
    await page.goto(`${BASE}${url}`, { waitUntil: "commit", timeout: 90_000 });
    await page.waitForSelector("main", { timeout: 60_000 });
    const early = await hiddenCount(page);
    await page.waitForLoadState("load");
    await page.waitForTimeout(1500);
    const late = await hiddenCount(page);
    const trackH = await page.evaluate(() => document.querySelector('[data-testid="hero-track"]')?.getBoundingClientRect().height ?? null);
    rows.push({ url, early, late, heroTrackH: trackH });
    console.log("B", url, JSON.stringify({ early: early.n, late: late.n, trackH }));
  }
  // Rasklopi under reduced motion: cut, no scroll-driven explode.
  await page.goto(`${BASE}/`, { waitUntil: "load", timeout: 90_000 });
  await page.waitForTimeout(1500);
  const trig = page.getByRole("button", { name: /^Rasklopi$/ }).first();
  await trig.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(500);
  const y0 = await page.evaluate(() => scrollY);
  await trig.tap();
  const samples = [];
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(120);
    const s = await page.evaluate(() => window.__sklop3d?.getState());
    samples.push({ t: (i + 1) * 120, progress: s ? +s.progress.toFixed(3) : null, status: s?.status });
  }
  const y1 = await page.evaluate(() => scrollY);
  rows.push({ rasklopi: { y0, y1, samples } });
  console.log("B rasklopi", JSON.stringify({ y0, y1, samples }));
  await shot(page, "motion-3d/modes-reduced-rasklopi");
  out.reduced = rows;
  await ctx.close();
}

// C) JavaScript disabled.
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false, locale: "sr-Latn-RS" });
  const page = await ctx.newPage();
  const rows = [];
  for (const url of ["/", "/delovi/kocioni-diskovi", "/deo/kocioni-disk-prednji-276-24-mm-demo-0004", "/za-majstore"]) {
    await page.goto(`${BASE}${url}`, { waitUntil: "load", timeout: 90_000 });
    await page.waitForTimeout(800);
    const h = await hiddenCount(page);
    rows.push({ url, ...h });
    console.log("C", url, JSON.stringify(h));
  }
  await shot(page, "motion-3d/modes-nojs-za-majstore", { fullPage: true });
  out.noJs = rows;
  await ctx.close();
}

// D) print media: load, do NOT scroll, emulate print, count hidden copy.
{
  const ctx = await newContext(browser, { width: 1440, height: 900, tag: "m3d-modes-d" });
  const page = await ctx.newPage();
  const rows = [];
  for (const url of ["/deo/kocioni-disk-prednji-276-24-mm-demo-0004", "/uslovi-koriscenja", "/porudzbina/GVl2SHwvba1nbEDG8VWTGcg0IPXAbHGNXGpzjHnowJw"]) {
    await page.goto(`${BASE}${url}`, { waitUntil: "load", timeout: 90_000 });
    await page.waitForTimeout(2500);
    const screenPending = await page.evaluate(() => document.querySelectorAll('[data-reveal-state="pending"]').length);
    await page.emulateMedia({ media: "print" });
    const h = await hiddenCount(page);
    await page.emulateMedia({ media: "screen" });
    rows.push({ url, screenPending, printHidden: h });
    console.log("D", url, "pending on screen", screenPending, "hidden in print", h.n);
  }
  out.print = rows;
  await ctx.close();
}

// E) anchor jump: landing model page with a generation anchor, and /za-majstore FAQ.
{
  const ctx = await newContext(browser, { width: 390, height: 844, tag: "m3d-modes-e" });
  const page = await ctx.newPage();
  const rows = [];
  for (const url of ["/delovi/kocioni-diskovi/volkswagen/golf#golf-7", "/vozila/volkswagen#m-tiguan", "/politika-privatnosti#kolacici"]) {
    await page.goto(`${BASE}${url}`, { waitUntil: "load", timeout: 90_000 });
    await page.waitForTimeout(2500);
    const r = await page.evaluate(() => {
      const above = [...document.querySelectorAll('[data-reveal-state="pending"]')].filter((e) => e.getBoundingClientRect().bottom <= 0).length;
      const inView = [...document.querySelectorAll("[data-reveal-state]")].filter((e) => {
        const b = e.getBoundingClientRect();
        return b.top >= 0 && b.bottom <= innerHeight * 0.85;
      });
      return {
        scrollY: Math.round(scrollY),
        hash: location.hash,
        target: !!document.querySelector(location.hash),
        pendingAbove: above,
        inViewStates: inView.reduce((m, e) => ((m[e.getAttribute("data-reveal-state")] = (m[e.getAttribute("data-reveal-state")] ?? 0) + 1), m), {}),
      };
    });
    rows.push({ url, ...r });
    console.log("E", url, JSON.stringify(r));
    await shot(page, `motion-3d/modes-anchor-${rows.length}`);
  }
  out.anchor = rows;
  await ctx.close();
}

// F) mechanic favourites: words left in the DOM?
{
  const acc = JSON.parse(readFileSync(".playwright/audit-accounts.json", "utf8"));
  const ctx = await newContext(browser, { width: 1440, height: 900, tag: "m3d-modes-f" });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/prijava?next=%2Fmajstor`, { waitUntil: "load", timeout: 90_000 });
  await page.waitForTimeout(2500);
  await page.getByTestId("auth-email").fill(acc.mechanic.email);
  await page.getByTestId("auth-password").fill(acc.mechanic.password);
  await page.getByTestId("auth-submit").click();
  await page.waitForURL((u) => u.pathname.startsWith("/majstor"), { timeout: 90_000 });
  const rows = [];
  for (let i = 0; i < 3; i++) {
    await page.goto(`${BASE}/majstor/omiljeno`, { waitUntil: "load", timeout: 90_000 });
    await page.waitForTimeout(1500);
    await scrollThrough(page);
    await page.waitForTimeout(3000);
    const r = await revealCheck(page);
    const running = await page.evaluate(() => [...document.querySelectorAll('[data-reveal-state="running"]')].map((e) => `${e.tagName.toLowerCase()}: ${e.textContent.trim().slice(0, 60)}`));
    rows.push({ run: i, ...r, running });
    console.log("F", i, JSON.stringify(r), running);
    if (r.words) await shot(page, `motion-3d/modes-omiljeno-words-${i}`);
  }
  out.favourites = rows;
  await ctx.close();
}
writeFileSync("docs/qa/audit/motion-3d/reveal-modes.json", JSON.stringify(out, null, 2));
await browser.close();
