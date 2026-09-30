/**
 * vis-store (third reviewer): re-verification of candidate findings with fresh contexts.
 * Usage: node scripts/qa/audit/vis-store-v3.mjs [buybar,hero,clamp,thumb,vozila,hub,sections]
 */
import { writeFileSync } from "node:fs";
import { BASE, launch, newContext, shot, scrollThrough } from "./kit.mjs";

const want = (process.argv[2] ?? "buybar,hero,clamp,thumb,vozila,hub,sections").split(",");
const out = {};
const browser = await launch();
const open = async (w, h, url, extra = {}) => {
  const ctx = await newContext(browser, { width: w, height: h, tag: `vis-store-v3-${w}-${Math.random().toString(36).slice(2, 6)}`, ...extra });
  const page = await ctx.newPage();
  await page.goto(BASE + url, { waitUntil: "load", timeout: 120000 });
  await page.waitForTimeout(1500);
  return { ctx, page };
};

// A: mobile sticky buy bar (components/product/StickyBuyBar.tsx) after the buy box leaves the viewport
if (want.includes("buybar")) {
  out.buybar = [];
  for (const [w, h, rm] of [
    [390, 844, "no-preference"],
    [390, 844, "reduce"],
    [360, 780, "no-preference"],
  ]) {
    const { ctx, page } = await open(w, h, "/deo/kocioni-disk-prednji-276-24-mm-demo-0004", { reducedMotion: rm });
    for (let i = 0; i < 16; i++) {
      await page.mouse.wheel(0, 150);
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(2500);
    const r = await page.evaluate(() => {
      const bb = document.getElementById("buy-box")?.getBoundingClientRect();
      const bar = [...document.querySelectorAll("div.fixed")].find((e) => /bottom-0/.test(String(e.className)) && /U korpu/.test(e.textContent));
      if (!bar) return { noBar: true };
      const r = bar.getBoundingClientRect();
      const cs = getComputedStyle(bar);
      return {
        scrollY: Math.round(scrollY),
        vh: innerHeight,
        buyBoxBottom: bb && Math.round(bb.bottom),
        ariaHidden: bar.getAttribute("aria-hidden"),
        inert: bar.inert,
        visibility: cs.visibility,
        opacity: cs.opacity,
        inlineTransform: bar.style.transform,
        computedTransform: cs.transform,
        barTop: Math.round(r.top),
        barHeight: Math.round(r.height),
        visiblePx: Math.max(0, Math.round(innerHeight - r.top)),
      };
    });
    r.w = w;
    r.reducedMotion = rm;
    out.buybar.push(r);
    console.log("buybar", JSON.stringify(r));
    await shot(page, `vis-store/v3/buybar-${w}-${rm === "reduce" ? "rm" : "motion"}`);
    await ctx.close();
  }
}

// B: hero stage vs its corner-tick drawing frame at wide screens
if (want.includes("hero")) {
  out.hero = {};
  for (const [w, h] of [
    [1440, 900],
    [1920, 1080],
    [2560, 1440],
  ]) {
    const { ctx, page } = await open(w, h, "/");
    await page.waitForTimeout(3000);
    const r = await page.evaluate(() => {
      const canvas = document.querySelector("main canvas");
      const poster = document.querySelector("main img[src*='hero'], main picture img");
      const rect = (e) => {
        if (!e) return null;
        const b = e.getBoundingClientRect();
        return { l: Math.round(b.left), t: Math.round(b.top), r: Math.round(b.right), b: Math.round(b.bottom), w: Math.round(b.width), h: Math.round(b.height) };
      };
      // corner ticks: small absolutely positioned boxes with two borders, 10-20 px
      const ticks = [...document.querySelectorAll("main *")]
        .filter((e) => {
          const b = e.getBoundingClientRect();
          const cs = getComputedStyle(e);
          return b.width >= 10 && b.width <= 20 && b.height >= 10 && b.height <= 20 && cs.position === "absolute" && b.top < innerHeight && (parseFloat(cs.borderTopWidth) > 0 || parseFloat(cs.borderBottomWidth) > 0) && (parseFloat(cs.borderLeftWidth) > 0 || parseFloat(cs.borderRightWidth) > 0);
        })
        .map(rect);
      const headerInner = document.querySelector("header nav, header > div > div, header > div");
      return { canvas: rect(canvas), poster: rect(poster), ticks, header: rect(headerInner), h1: rect(document.querySelector("main h1")) };
    });
    // opaque extent of the drawn car in the viewport screenshot (luminance > ground)
    const buf = await page.screenshot({ type: "png" });
    const sharp = (await import("sharp")).default;
    const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    let maxX = 0;
    let minX = info.width;
    const x0 = Math.round(info.width * 0.35);
    for (let y = Math.round(info.height * 0.2); y < info.height * 0.85; y += 2) {
      for (let x = x0; x < info.width; x += 2) {
        const i = (y * info.width + x) * 3;
        const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
        if (lum > 60) {
          if (x > maxX) maxX = x;
          if (x < minX) minX = x;
        }
      }
    }
    r.drawnCar = { minX, maxX };
    out.hero[w] = r;
    console.log("hero", w, JSON.stringify(r));
    if (w !== 1440) await shot(page, `vis-store/v3/hero-${w}`);
    await ctx.close();
  }
}

// C: product-card names clamped to two lines (distinguishing words hidden) per width
if (want.includes("clamp")) {
  out.clamp = {};
  for (const [w, h] of [
    [1024, 768],
    [1280, 800],
    [1440, 900],
    [1920, 1080],
    [2560, 1440],
  ]) {
    const { ctx, page } = await open(w, h, "/delovi/kocioni-diskovi");
    await scrollThrough(page, { stepMs: 60 });
    const r = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('[data-testid="product-card"]')];
      const cw = cards[0] ? Math.round(cards[0].getBoundingClientRect().width) : null;
      const clamped = [];
      for (const c of cards) {
        const a = c.querySelector("h3 a, h3, [data-card-link]");
        if (!a) continue;
        if (a.scrollHeight > a.clientHeight + 2) clamped.push(a.textContent.trim());
      }
      const grid = cards[0]?.parentElement;
      const cols = grid ? getComputedStyle(grid).gridTemplateColumns.split(" ").length : null;
      return { cardWidth: cw, cols, clamped };
    });
    out.clamp[w] = r;
    console.log("clamp", w, JSON.stringify(r));
    if (w === 2560) {
      const card = page.locator('[data-testid="product-card"]').nth(3);
      await card.scrollIntoViewIfNeeded();
      const b = await card.boundingBox();
      await shot(page, "vis-store/v3/clamp-2560", { clip: { x: b.x - 420, y: b.y - 10, width: 900, height: b.height + 20 } });
    }
    await ctx.close();
  }
}

// D: card thumbnail geometry (render position inside the 4:3 frame, chip overlap)
if (want.includes("thumb")) {
  out.thumb = {};
  for (const [w, h] of [
    [1440, 900],
    [2560, 1440],
  ]) {
    const { ctx, page } = await open(w, h, "/delovi/kocioni-diskovi");
    const r = await page.evaluate(() => {
      const card = document.querySelector('[data-testid="product-card"]');
      const img = card.querySelector("img");
      const frame = img.parentElement;
      const chip = [...card.querySelectorAll("span, div")].find((e) => /^(OEM kvalitet|Original VAG|Aftermarket)$/.test(e.textContent.trim()) && e.getBoundingClientRect().top < img.getBoundingClientRect().bottom);
      const rr = (e) => {
        const b = e.getBoundingClientRect();
        return { l: Math.round(b.left), t: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height) };
      };
      const cs = getComputedStyle(img);
      return { img: rr(img), frame: rr(frame), chip: chip ? rr(chip) : null, objectFit: cs.objectFit, objectPosition: cs.objectPosition, natural: `${img.naturalWidth}x${img.naturalHeight}`, src: img.currentSrc.slice(-60) };
    });
    out.thumb[w] = r;
    console.log("thumb", w, JSON.stringify(r));
    await ctx.close();
  }
}

// E: vehicle navigation links on phones (touch target = only the word?)
if (want.includes("vozila")) {
  out.vozila = {};
  for (const url of ["/vozila", "/vozila/volkswagen"]) {
    const { ctx, page } = await open(390, 844, url);
    const r = await page.evaluate(() => {
      const links = [...document.querySelectorAll("main a[href^='/vozila/']")].slice(0, 12);
      return links.map((a) => {
        const b = a.getBoundingClientRect();
        const row = a.closest("li, tr, div");
        const rb = row?.getBoundingClientRect();
        return { text: a.textContent.trim().replace(/\s+/g, " ").slice(0, 30), link: `${Math.round(b.width)}x${Math.round(b.height)}`, row: rb ? `${Math.round(rb.width)}x${Math.round(rb.height)}` : null, rowTag: row?.tagName };
      });
    });
    out.vozila[url] = r;
    console.log("vozila", url, JSON.stringify(r));
    const first = page.locator("main a[href^='/vozila/']").nth(1);
    await first.scrollIntoViewIfNeeded();
    const b = await first.boundingBox();
    await page.evaluate(() => {
      for (const a of document.querySelectorAll("main a[href^='/vozila/']")) a.style.outline = "1px dashed #ff6a13";
    });
    await shot(page, `vis-store/v3/vozila-targets-${url === "/vozila" ? "all" : "vw"}`, { clip: { x: 0, y: Math.max(0, b.y - 80), width: 390, height: 360 } });
    await ctx.close();
  }
}

// F: system hub composition
if (want.includes("hub")) {
  out.hub = {};
  for (const [w, h, url] of [
    [1440, 900, "/delovi/kocnice"],
    [1440, 900, "/delovi/kocioni-diskovi"],
    [1440, 900, "/delovi"],
    [1920, 1080, "/delovi/kocnice"],
  ]) {
    const { ctx, page } = await open(w, h, url);
    const r = await page.evaluate(() => {
      const main = document.querySelector("main");
      const h1 = main.querySelector("h1");
      const ps = [...main.querySelectorAll("p")].filter((p) => p.textContent.trim().length > 40).length;
      const footer = document.querySelector("footer")?.getBoundingClientRect();
      return { h1: h1?.textContent.trim(), paragraphsOver40: ps, footerTop: footer && Math.round(footer.top + scrollY), docH: document.documentElement.scrollHeight, tiles: main.querySelectorAll("a img").length };
    });
    out.hub[`${url}@${w}`] = r;
    console.log("hub", url, w, JSON.stringify(r));
    await ctx.close();
  }
}

// G: home "Delovi po sistemima" length on phones
if (want.includes("sections")) {
  const { ctx, page } = await open(390, 844, "/");
  await scrollThrough(page, { stepMs: 60 });
  const r = await page.evaluate(() => {
    const secs = [...document.querySelectorAll("main section")].map((s) => ({
      heading: s.querySelector("h2")?.textContent.trim(),
      h: Math.round(s.getBoundingClientRect().height),
      links: s.querySelectorAll("a").length,
    }));
    return { docH: document.documentElement.scrollHeight, vh: innerHeight, secs };
  });
  out.sections = r;
  console.log("sections", JSON.stringify(r));
  await ctx.close();
}

writeFileSync(`docs/qa/audit/vis-store/v3-${want.join("-")}.json`, JSON.stringify(out, null, 1));
await browser.close();
