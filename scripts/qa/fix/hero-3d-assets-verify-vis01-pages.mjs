// Step 22 verifier (hero-3d-assets, VIS-01): the re-rendered category renders as visitors see
// them. Re-runs the audit's corrected reproduction (/delovi, /delovi/kocnice, / „Najtraženije
// kategorije“, /delovi/kocione-plocice, /ponuda/kocione-plocice-golf at 390 DPR2, the product
// gallery at 1440 DPR1/DPR2), records what each <img> actually served (currentSrc, natural and
// drawn size) and checks the served bytes are the new renders, not a stale optimizer copy
// (mean abs difference vs the new file and vs the pre-fix file from git, both flattened on
// #23282E at 96 px).
// Usage: AUDIT_BASE=http://localhost:3001 OLD_PARTS=<dir with pre-fix webps> \
//          [FRESH=1] node scripts/qa/fix/hero-3d-assets-verify-vis01-pages.mjs
// FRESH=1 serves the part renders from disk (cold optimizer cache); the served-bytes check still
// asks the real server (page.request bypasses page.route).
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { BASE, launch, newContext, scrollThrough, shot, watch } from "../audit/kit.mjs";

// FRESH=1 simulates a cold image-optimizer cache (see the page.route below).
const FRESH = process.env.FRESH === "1";
const SUB = FRESH ? "vis01-fresh" : "vis01";
const OUT_REL = `../fix/hero-3d-assets/verify/${SUB}`;
const OUT = path.resolve(`docs/qa/fix/hero-3d-assets/verify/${SUB}`);
mkdirSync(OUT, { recursive: true });
const OLD = process.env.OLD_PARTS;

async function flat(buf) {
  return sharp(buf)
    .flatten({ background: "#23282e" })
    .resize(96, 96, { fit: "contain", background: "#23282e" })
    .removeAlpha()
    .raw()
    .toBuffer();
}
function mad(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
  return +(s / a.length).toFixed(2);
}

async function partImages(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("img")]
      .filter((i) => /images\/parts|_next\/image\?url=%2Fimages%2Fparts/.test(i.currentSrc || i.src))
      .map((i) => {
        const r = i.getBoundingClientRect();
        return {
          src: i.currentSrc,
          slug: decodeURIComponent(i.currentSrc).match(/images\/parts\/([a-z0-9-]+)\.webp/)?.[1],
          natural: [i.naturalWidth, i.naturalHeight],
          drawn: [Math.round(r.width), Math.round(r.height)],
          complete: i.complete,
          opacity: getComputedStyle(i).opacity,
        };
      }),
  );
}

async function servedCheck(page, imgs) {
  const out = [];
  const seen = new Set();
  for (const im of imgs) {
    if (!im.slug || seen.has(im.src)) continue;
    seen.add(im.src);
    // without an Accept header the optimizer answers with an alpha-less JPEG
    const res = await page.request.get(im.src, { headers: { Accept: "image/avif,image/webp" } });
    const served = await flat(Buffer.from(await res.body()));
    const now = await flat(path.resolve("public/images/parts", `${im.slug}.webp`));
    const row = { slug: im.slug, src: im.src.replace(BASE, ""), madVsNew: mad(served, now) };
    if (OLD) row.madVsOld = mad(served, await flat(path.join(OLD, `${im.slug}.webp`)));
    out.push(row);
  }
  return out;
}

const PAGES = [
  { tag: "delovi-1440", url: "/delovi", w: 1440, h: 900, find: "Kočnice" },
  { tag: "kocnice-1440", url: "/delovi/kocnice", w: 1440, h: 900 },
  { tag: "home-1440", url: "/", w: 1440, h: 900, find: "Najtraženije kategorije" },
  { tag: "home-390", url: "/", w: 390, h: 844, dpr: 2, find: "Najtraženije kategorije" },
  { tag: "plocice-cat-1440", url: "/delovi/kocione-plocice", w: 1440, h: 900, find: "card" },
  { tag: "ponuda-390", url: "/ponuda/kocione-plocice-golf", w: 390, h: 844, dpr: 2, find: "card" },
  { tag: "deo-1440-dpr1", url: "/deo/kocione-plocice-prednje-demo-0012", w: 1440, h: 900 },
  { tag: "deo-1440-dpr2", url: "/deo/kocione-plocice-prednje-demo-0012", w: 1440, h: 900, dpr: 2 },
  { tag: "deo-390", url: "/deo/kocione-plocice-prednje-demo-0012", w: 390, h: 844, dpr: 2 },
];

const browser = await launch();
const report = [];
try {
  for (const p of PAGES) {
    const ctx = await newContext(browser, {
      width: p.w,
      height: p.h,
      deviceScaleFactor: p.dpr ?? 1,
      tag: `vfy-vis01-${p.tag}`,
    });
    try {
      const page = await ctx.newPage();
      const log = watch(page);
      if (FRESH) {
        // Simulate a cold optimizer cache: answer /_next/image for the part renders straight from
        // the file on disk (sharp resize to w, WebP), so stale cached variants cannot mask the fix.
        await page.route(/\/_next\/image\?url=%2Fimages%2Fparts%2F/, async (route) => {
          const u = new URL(route.request().url());
          const rel = (u.searchParams.get("url") ?? "").replace(/^\//, "");
          const w = Number(u.searchParams.get("w"));
          const body = await sharp(path.resolve("public", rel))
            .resize({ width: w, withoutEnlargement: true })
            .webp({ quality: 80 })
            .toBuffer();
          await route.fulfill({ status: 200, contentType: "image/webp", body });
        });
      }
      const res = await page.goto(`${BASE}${p.url}`, { waitUntil: "networkidle" });
      await scrollThrough(page);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(400);
      let y = 0;
      if (p.find === "card") {
        y = await page.evaluate(() => {
          const img = [...document.querySelectorAll("img")].find((i) =>
            /images(%2F|\/)parts/.test(i.currentSrc || i.src),
          );
          return img ? img.getBoundingClientRect().top + scrollY - 140 : 0;
        });
      } else if (p.find) {
        y = await page.evaluate((t) => {
          const h = [...document.querySelectorAll("h1,h2,h3")].find((e) => e.textContent.includes(t));
          return h ? h.getBoundingClientRect().top + scrollY - 90 : 0;
        }, p.find);
      }
      await page.evaluate((v) => window.scrollTo(0, Math.max(0, v)), y);
      await page.waitForTimeout(1500);
      await shot(page, `${OUT_REL}/${p.tag}`);
      const imgs = await partImages(page);
      const served = await servedCheck(page, imgs);
      report.push({
        ...p,
        status: res?.status(),
        images: imgs.slice(0, 16).map((i) => ({ ...i, src: i.src.replace(BASE, "") })),
        served,
        errors: { console: log.console.slice(0, 5), pageErrors: log.pageErrors.slice(0, 5) },
      });
      console.log(
        p.tag,
        res?.status(),
        `imgs ${imgs.length}`,
        served.map((s) => `${s.slug} new ${s.madVsNew}${s.madVsOld != null ? ` old ${s.madVsOld}` : ""}`).join("; "),
        imgs
          .filter((i) => i.slug === "kocione-plocice")
          .slice(0, 1)
          .map((i) => `plocice natural ${i.natural} drawn ${i.drawn}`)
          .join(""),
        log.pageErrors.length ? `pageErrors ${log.pageErrors.length}` : "",
      );
    } finally {
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}
writeFileSync(path.join(OUT, "pages.json"), JSON.stringify(report, null, 2));
