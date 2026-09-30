/**
 * vis-store: capture every storefront catalog template at all 8 widths (top viewport + full page),
 * plus per-page metrics (overflow, reveal, console, touch targets, clipped text, upscaled images,
 * container edges). Usage: node scripts/qa/audit/vis-store-capture.mjs [routeKey,...] [--widths=360,390]
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { BASE, WIDTHS, AUDIT_DIR, launch, newContext, watch, scrollThrough, revealCheck, overflowX } from "./kit.mjs";

export const ROUTES = {
  home: "/",
  delovi: "/delovi",
  hub: "/delovi/kocnice",
  cat: "/delovi/kocioni-diskovi",
  catf: "/delovi/kocioni-diskovi?dostupnost=na-stanju&marka=volkswagen&model=golf&generacija=golf-7",
  landb: "/delovi/kocioni-diskovi/volkswagen",
  landm: "/delovi/kocioni-diskovi/volkswagen/golf",
  pin: "/deo/kocioni-disk-prednji-276-24-mm-demo-0004",
  pout: "/deo/kocione-plocice-prednje-demo-0012",
  porder: "/deo/set-zupcastog-kaisa-sa-vodenom-pumpom-1-9-tdi-demo-e007",
  plong: "/deo/kociona-celjust-zadnja-desna-sa-motorom-rucne-demo-0018",
  soem: "/pretraga?q=5Q0615505R",
  sname: "/pretraga?q=disk",
  szero: "/pretraga?q=XQ9Z%20777%20000",
  voz: "/vozila",
  vozb: "/vozila/volkswagen",
  vozm: "/vozila/volkswagen/golf",
  vozg: "/vozila/volkswagen/golf/golf-7",
  nf: "/ovo-ne-postoji",
  sg: "/styleguide",
};

const args = process.argv.slice(2);
const keys = (args.find((a) => !a.startsWith("--")) ?? Object.keys(ROUTES).join(",")).split(",");
const wArg = args.find((a) => a.startsWith("--widths="));
const widths = wArg ? WIDTHS.filter((w) => wArg.slice(9).split(",").includes(w.tag)) : WIDTHS;
const noFull = args.includes("--nofull");

async function saveWebp(buf, rel, maxW) {
  const file = path.join(AUDIT_DIR, `${rel}.webp`);
  mkdirSync(path.dirname(file), { recursive: true });
  let img = sharp(buf, { limitInputPixels: false });
  const meta = await img.metadata();
  let w = meta.width;
  let h = meta.height;
  if (maxW && w > maxW) {
    h = Math.round((h * maxW) / w);
    w = maxW;
  }
  if (h > 16000) h = 16000;
  let q = 62;
  for (;;) {
    const out = await sharp(buf, { limitInputPixels: false })
      .resize({ width: w })
      .extract({ left: 0, top: 0, width: w, height: Math.min(h, Math.round((meta.height * w) / meta.width)) })
      .webp({ quality: q })
      .toBuffer();
    if (out.length < 480_000 || q <= 30) {
      writeFileSync(file, out);
      return { file: path.relative(process.cwd(), file).replaceAll("\\", "/"), kb: Math.round(out.length / 1024) };
    }
    q -= 8;
    if (q <= 38 && w > 600) w = Math.round(w * 0.8);
  }
}

async function metrics(page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const vis = (el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none";
    };
    const label = (el) =>
      `${el.tagName.toLowerCase()}${el.getAttribute("data-testid") ? `[${el.getAttribute("data-testid")}]` : ""}:${(el.getAttribute("aria-label") || el.textContent || el.getAttribute("placeholder") || "").trim().replace(/\s+/g, " ").slice(0, 40)}`;
    // touch targets
    const inter = [...document.querySelectorAll("a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=tab], summary")].filter(vis);
    const small24 = [];
    const small44 = [];
    for (const el of inter) {
      if (el.closest("[aria-hidden=true]")) continue;
      const r = el.getBoundingClientRect();
      // inline text links inside paragraphs are exempt from 2.5.8 (inline)
      const inline = getComputedStyle(el).display === "inline" && el.closest("p, li, dd, td");
      const item = `${label(el)} ${Math.round(r.width)}x${Math.round(r.height)}`;
      if ((r.width < 24 || r.height < 24) && !inline) small24.push(item);
      else if ((r.width < 44 || r.height < 44) && !inline) small44.push(item);
    }
    // clipped text
    const clipped = [];
    for (const el of document.querySelectorAll("body *")) {
      if (!vis(el) || el.children.length > 3) continue;
      const cs = getComputedStyle(el);
      const txt = el.textContent.trim();
      if (!txt) continue;
      if ((cs.overflowX === "hidden" || cs.overflow === "hidden" || cs.textOverflow === "ellipsis") && el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 2) {
        clipped.push(`${label(el)} sw${el.scrollWidth}>cw${el.clientWidth} ${cs.textOverflow === "ellipsis" ? "(ellipsis)" : ""}`);
      }
      if (cs.webkitLineClamp && cs.webkitLineClamp !== "none" && el.scrollHeight > el.clientHeight + 2) {
        clipped.push(`${label(el)} clamp ${cs.webkitLineClamp} sh${el.scrollHeight}>ch${el.clientHeight}`);
      }
    }
    // images: upscaled
    const imgs = [...document.querySelectorAll("img")].filter(vis).map((i) => {
      const r = i.getBoundingClientRect();
      return { src: (i.currentSrc || i.src).replace(location.origin, "").slice(0, 90), nat: `${i.naturalWidth}x${i.naturalHeight}`, shown: `${Math.round(r.width)}x${Math.round(r.height)}`, up: i.naturalWidth > 0 && i.naturalWidth < r.width * 0.98, alt: i.alt?.slice(0, 50) };
    });
    // headings
    const heads = [...document.querySelectorAll("h1,h2,h3")].filter(vis).slice(0, 30).map((h) => {
      const cs = getComputedStyle(h);
      return `${h.tagName} ${cs.fontFamily.split(",")[0].replace(/"/g, "")} ${cs.fontSize}/${cs.fontWeight} ${cs.textTransform === "uppercase" ? "CAPS" : ""} :: ${h.textContent.trim().replace(/\s+/g, " ").slice(0, 60)}`;
    });
    // main content edges
    const main = document.querySelector("main") ?? document.body;
    const edges = new Map();
    for (const el of main.querySelectorAll("h1, h2, nav[aria-label], [class*=grid], section > div, p")) {
      if (!vis(el)) continue;
      const r = el.getBoundingClientRect();
      const k = Math.round(r.left);
      edges.set(k, (edges.get(k) ?? 0) + 1);
    }
    const header = document.querySelector("header");
    const hr = header?.getBoundingClientRect();
    return {
      vw,
      docH: document.documentElement.scrollHeight,
      headerH: hr ? Math.round(hr.height) : null,
      headerPos: header ? getComputedStyle(header).position : null,
      small24: small24.slice(0, 25),
      small24n: small24.length,
      small44: small44.slice(0, 25),
      small44n: small44.length,
      clipped: clipped.slice(0, 20),
      imgs: imgs.slice(0, 20),
      heads,
      leftEdges: [...edges.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8),
    };
  });
}

async function run() {
  const browser = await launch("chromium");
  const results = {};
  const outJson = path.join(AUDIT_DIR, "vis-store", "capture-metrics.json");
  if (existsSync(outJson)) Object.assign(results, JSON.parse(readFileSync(outJson, "utf8")));
  const jobs = [];
  for (const key of keys) for (const w of widths) jobs.push({ key, w });
  let i = 0;
  const worker = async () => {
    while (i < jobs.length) {
      const { key, w } = jobs[i++];
      const url = BASE + ROUTES[key];
      const ctx = await newContext(browser, { width: w.width, height: w.height, tag: `vis-store-${key}-${w.tag}` });
      const page = await ctx.newPage();
      const log = watch(page);
      const t0 = Date.now();
      try {
        const resp = await page.goto(url, { waitUntil: "load", timeout: 90_000 });
        await page.waitForTimeout(1500);
        await scrollThrough(page);
        await page.waitForTimeout(600);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(700);
        const top = await saveWebp(await page.screenshot({ type: "png" }), `vis-store/${key}/${w.tag}-top`);
        let full = null;
        if (!noFull) {
          full = await saveWebp(await page.screenshot({ type: "png", fullPage: true }), `vis-store/${key}/${w.tag}-full`, w.width > 1100 ? 1100 : undefined);
        }
        const m = await metrics(page);
        const ov = await overflowX(page);
        const rv = await revealCheck(page);
        results[`${key}@${w.tag}`] = { url: ROUTES[key], status: resp?.status(), ms: Date.now() - t0, top, full, overflow: ov, reveal: rv, log, ...m };
        console.log(`${key}@${w.tag} ${resp?.status()} ov=${ov.over} stuck=${rv.stuck.length} pend=${rv.pending} cons=${log.console.length} s24=${m.small24n} s44=${m.small44n} clip=${m.clipped.length} up=${m.imgs.filter((x) => x.up).length} ${Date.now() - t0}ms`);
      } catch (e) {
        console.log(`${key}@${w.tag} ERROR ${String(e).slice(0, 200)}`);
        results[`${key}@${w.tag}`] = { url: ROUTES[key], error: String(e).slice(0, 300) };
      }
      await ctx.close();
      writeFileSync(outJson, JSON.stringify(results, null, 1));
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  await browser.close();
}

run();
