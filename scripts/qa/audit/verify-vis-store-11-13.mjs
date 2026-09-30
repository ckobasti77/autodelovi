// Independent verification of vis-store-11 (sticky rail), vis-store-12 (out-of-stock glyph) and
// vis-store-13 (zero-results search). Evidence: docs/qa/audit/verify/vis-store/.
import { writeFileSync, mkdirSync } from "node:fs";
import { BASE, launch, newContext, watch, scrollThrough, shot } from "./kit.mjs";

const OUT = "docs/qa/audit/verify/vis-store";
mkdirSync(OUT, { recursive: true });
const results = {};
const browser = await launch("chromium");

async function railProbe(url, width, height, tag) {
  const ctx = await newContext(browser, { width, height, tag: `verify-vis-store-${tag}` });
  const page = await ctx.newPage();
  const log = watch(page);
  await page.goto(`${BASE}${url}`, { waitUntil: "networkidle" });
  await scrollThrough(page);
  const measure = () =>
    page.evaluate(() => {
      const aside = document.querySelector('aside[aria-label="Filteri"]');
      if (!aside) return { aside: null };
      const r = aside.getBoundingClientRect();
      let sticky = null;
      for (let e = aside; e; e = e.parentElement) {
        const cs = getComputedStyle(e);
        if (cs.position === "sticky" || cs.position === "fixed") {
          sticky = `${e.tagName.toLowerCase()} ${cs.position} top=${cs.top}`;
          break;
        }
      }
      const grid = document.querySelector("[data-testid='product-grid'], ul") ;
      const results = aside.nextElementSibling?.getBoundingClientRect();
      const label = [...aside.querySelectorAll("label, span, button")].find((n) => /Samo na stanju/.test(n.textContent ?? ""));
      return {
        scrollY: Math.round(scrollY),
        asideTop: Math.round(r.top),
        asideBottom: Math.round(r.bottom),
        asideHeight: Math.round(r.height),
        asidePosition: getComputedStyle(aside).position,
        stickyAncestor: sticky,
        resultsHeight: results ? Math.round(results.height) : null,
        samoNaStanjuTop: label ? Math.round(label.getBoundingClientRect().top) : null,
        docHeight: document.documentElement.scrollHeight,
        cards: document.querySelectorAll("a[href^='/deo/']").length,
      };
    });
  const a = await measure();
  await page.mouse.move(width / 2, height / 2);
  await page.mouse.wheel(0, 900);
  await page.waitForTimeout(900);
  const b = await measure();
  await page.mouse.wheel(0, 900);
  await page.waitForTimeout(900);
  const c = await measure();
  const img = await shot(page, `verify/vis-store/vis-store-11-reproduce-${tag}-scrolled`);
  await ctx.close();
  return { url, width, height, a, b, c, img, console: log.console, pageErrors: log.pageErrors };
}

// ---- vis-store-11
results["vis-store-11"] = [];
for (const [url, w, h, tag] of [
  ["/delovi/kocioni-diskovi", 1440, 900, "cat-1440"],
  ["/delovi/kocioni-diskovi", 1280, 800, "cat-1280"],
  ["/delovi/kocioni-diskovi/volkswagen/golf", 1440, 900, "landing-1440"],
  ["/delovi/kocione-plocice?stanje=na-stanju", 1920, 1080, "plocice-1920"],
]) {
  try {
    results["vis-store-11"].push(await railProbe(url, w, h, tag));
  } catch (e) {
    results["vis-store-11"].push({ url, error: String(e).slice(0, 300) });
  }
}

// ---- vis-store-12
results["vis-store-12"] = [];
for (const [w, h, tag] of [
  [1440, 900, "1440"],
  [390, 844, "390"],
]) {
  const ctx = await newContext(browser, { width: w, height: h, tag: `verify-vis-store-12-${tag}` });
  const page = await ctx.newPage();
  const log = watch(page);
  await page.goto(`${BASE}/deo/kocione-plocice-prednje-demo-0012`, { waitUntil: "networkidle" });
  await scrollThrough(page);
  const info = await page.evaluate(() => {
    const badges = [...document.querySelectorAll("span[data-reveal='off']")].filter((s) =>
      /^Nema na stanju/.test((s.textContent ?? "").trim()),
    );
    const vis = badges.filter((b) => b.offsetParent);
    const b = vis[0];
    const br = b?.getBoundingClientRect();
    const svg = b?.querySelector("svg")?.getBoundingClientRect();
    const cs = b ? getComputedStyle(b) : null;
    const cb = document.querySelector("button[role='checkbox'], input[type='checkbox']");
    const cbr = cb?.getBoundingClientRect();
    const cbLabel = cb?.closest("label")?.textContent?.trim().slice(0, 90) ?? cb?.parentElement?.textContent?.trim().slice(0, 90);
    return {
      badgeCount: badges.length,
      visibleBadges: vis.length,
      badge: br && {
        top: Math.round(br.top + scrollY),
        left: Math.round(br.left),
        fontSize: cs.fontSize,
        color: cs.color,
        bg: cs.backgroundColor,
        height: Math.round(br.height),
        icon: svg && { w: Math.round(svg.width), h: Math.round(svg.height) },
      },
      checkbox: cbr && {
        top: Math.round(cbr.top + scrollY),
        left: Math.round(cbr.left),
        w: Math.round(cbr.width),
        h: Math.round(cbr.height),
        border: getComputedStyle(cb).borderColor,
        radius: getComputedStyle(cb).borderRadius,
        label: cbLabel,
      },
      gapPx: br && cbr ? Math.round(cbr.top - br.bottom) : null,
      primaryButtons: [...document.querySelectorAll("button, a")]
        .filter((n) => n.offsetParent && /Javi mi|Pošaljite upit|Dodaj u korpu/.test(n.textContent ?? ""))
        .map((n) => (n.textContent ?? "").trim().slice(0, 40)),
    };
  });
  // Viewport shot of the buy column area around the badge.
  if (info.badge) {
    const y = Math.max(0, info.badge.top - 200);
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(500);
  }
  const img = await shot(page, `verify/vis-store/vis-store-12-reproduce-${tag}`);
  let crop = null;
  if (info.badge && info.checkbox) {
    const top = await page.evaluate(() => scrollY);
    const x0 = Math.max(0, Math.min(info.badge.left, info.checkbox.left) - 24);
    const y0 = Math.max(0, info.badge.top - top - 40);
    const y1 = Math.min(h, info.checkbox.top - top + 80);
    if (y1 > y0 + 10) {
      crop = await shot(page, `verify/vis-store/vis-store-12-reproduce-${tag}-crop`, {
        clip: { x: x0, y: y0, width: Math.min(560, w - x0), height: y1 - y0 },
      });
    }
  }
  results["vis-store-12"].push({ w, info, img, crop, console: log.console });
  await ctx.close();
}

// ---- vis-store-13
results["vis-store-13"] = [];
for (const [q, w, h, tag] of [
  ["qqzzvvkk", 390, 844, "text-390"],
  ["qqzzvvkk", 1440, 900, "text-1440"],
  ["1K0999999ZZ", 390, 844, "code-390"],
  ["kocioni zzqq", 390, 844, "mixed-390"],
]) {
  const ctx = await newContext(browser, { width: w, height: h, tag: `verify-vis-store-13-${tag}` });
  const page = await ctx.newPage();
  const log = watch(page);
  await page.goto(`${BASE}/pretraga?q=${encodeURIComponent(q)}`, { waitUntil: "networkidle" });
  await scrollThrough(page);
  const info = await page.evaluate(() => {
    const main = document.querySelector("main") ?? document.body;
    const h1 = main.querySelector("h1");
    const codes = [...main.querySelectorAll(".type-code")].map((n) => n.textContent?.trim());
    const actions = [...main.querySelectorAll("a, button")]
      .filter((n) => n.offsetParent && !n.closest("header, footer, nav[aria-label='Glavna navigacija']"))
      .map((n) => `${n.tagName.toLowerCase()} ${(n.textContent ?? "").trim().slice(0, 50)} -> ${n.getAttribute("href") ?? ""}`);
    return {
      h1: h1?.textContent?.trim(),
      h1Font: h1 ? getComputedStyle(h1).fontFamily.slice(0, 60) : null,
      tried: [...main.querySelectorAll("p")].map((p) => p.textContent?.trim()).filter((t) => t && /Tražili smo|nemamo artikal/.test(t)),
      monoEcho: codes,
      telLinks: [...document.querySelectorAll("a[href^='tel:']")].map((a) => a.textContent?.trim()),
      mainActions: actions.slice(0, 20),
      categoryNav: !!main.querySelector("nav[aria-label='Kategorije']"),
    };
  });
  const img = await shot(page, `verify/vis-store/vis-store-13-reproduce-${tag}`);
  results["vis-store-13"].push({ q, w, info, img, console: log.console });
  await ctx.close();
}

// 404 for comparison of alternative paths
{
  const ctx = await newContext(browser, { width: 390, height: 844, tag: "verify-vis-store-13-404" });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/ovo-ne-postoji`, { waitUntil: "networkidle" });
  const acts = await page.evaluate(() =>
    [...(document.querySelector("main") ?? document.body).querySelectorAll("a, button")]
      .filter((n) => n.offsetParent)
      .map((n) => (n.textContent ?? "").trim().slice(0, 40))
      .slice(0, 20),
  );
  results["vis-store-13-404"] = acts;
  await ctx.close();
}

await browser.close();
writeFileSync(`${OUT}/vis-store-11-13-reproduce.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
