/**
 * vis-admin track (run 2): signs in as the owner and captures every admin route at one width,
 * saving metrics after every route (so a partial run still leaves data).
 *   node scripts/qa/audit/vis-admin-sweep2.mjs <width> [full=1|0] [filter]
 * Evidence: docs/qa/audit/vis-admin/sweep2/<width>/<slug>.webp + sweep2-<width>.json
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { BASE, launch, newContext, watch, loginAdmin, shot, overflowX } from "./kit.mjs";

const width = Number(process.argv[2] ?? "1440");
const full = (process.argv[3] ?? "1") === "1";
const filter = process.argv[4] ?? "";

const STATIC = [
  "/admin", "/admin/porudzbine", "/admin/porudzbine?status=sve", "/admin/porudzbine/SK-2026-000092",
  "/admin/upiti", "/admin/upiti/UP-2026-000054", "/admin/upiti/UP-2026-000003",
  "/admin/proizvodi", "/admin/proizvodi/novi", "/admin/kategorije", "/admin/vozila", "/admin/proizvodjaci",
  "/admin/lager", "/admin/kupci", "/admin/majstori", "/admin/cenovni-razredi", "/admin/uvoz", "/admin/uvoz/istorija",
  "/admin/uvoz/n571yqf64h6nfr4j3894281q6n8fdmmv", "/admin/izvoz", "/admin/pretrage", "/admin/izvori", "/admin/mejlovi",
  "/admin/mejlovi/sabloni", "/admin/obavestenja", "/admin/korisnici", "/admin/revizija", "/admin/privatnost",
  ...["firma", "radno-vreme", "prodaja", "obavestenja", "seo", "pracenje", "pravni-tekstovi", "funkcije", "oglasne-strane", "opasna-zona"].map(
    (t) => `/admin/podesavanja?tab=${t}`,
  ),
];

const slug = (p) => p.replace(/^\/admin\/?/, "").replace(/[?=&/]/g, "_") || "pregled";

async function settle(page) {
  await page.waitForLoadState("load").catch(() => {});
  await page
    .waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, { timeout: 12_000 })
    .catch(() => {});
  await page.waitForTimeout(900);
}

async function metrics(page) {
  return page.evaluate(() => {
    const vis = (e) => {
      const r = e.getBoundingClientRect();
      const cs = getComputedStyle(e);
      return r.width > 2 && r.height > 2 && cs.visibility !== "hidden" && cs.clip !== "rect(0px, 0px, 0px, 0px)" && cs.clipPath !== "inset(50%)";
    };
    const num = /^[-−+]?\s?[\d.\s ]+(,\d+)?\s?(RSD|kom\.?|%|din\.?)?$/;
    const misaligned = [];
    let numericCells = 0;
    for (const td of document.querySelectorAll("main td")) {
      if (!vis(td)) continue;
      const t = td.innerText.trim();
      if (!t || !num.test(t) || t.length > 24) continue;
      numericCells++;
      const cs = getComputedStyle(td);
      let align = cs.textAlign;
      const child = td.firstElementChild;
      if (child) {
        const c = getComputedStyle(child);
        if (c.display.includes("flex") && c.justifyContent.includes("end")) align = "right";
        if (c.textAlign === "right" || c.textAlign === "end") align = "right";
      }
      const tab = cs.fontVariantNumeric.includes("tabular") || (child && getComputedStyle(child).fontVariantNumeric.includes("tabular"));
      if (!(align === "right" || align === "end") || !tab) {
        const table = td.closest("table");
        const idx = [...td.parentElement.children].indexOf(td);
        const head = table?.querySelectorAll("thead th")[idx]?.innerText.trim() ?? "";
        misaligned.push(`${head || "?"}: "${t}" align=${align} tabular=${!!tab}`);
      }
    }
    const clipped = [];
    for (const e of document.querySelectorAll("main *")) {
      if (!vis(e) || e.children.length > 3) continue;
      const cs = getComputedStyle(e);
      if (e.scrollWidth > e.clientWidth + 1 && (cs.overflowX === "hidden" || cs.overflow === "hidden" || cs.overflowX === "clip") && e.innerText?.trim()) {
        const titled = !!(e.getAttribute("title") || e.closest("[title]"));
        clipped.push(`${e.tagName.toLowerCase()}${cs.textOverflow === "ellipsis" ? "(…)" : "(cut)"}: ${e.innerText.trim().slice(0, 50)} title=${titled ? "y" : "n"}`);
      }
    }
    const tiny = new Set();
    for (const e of document.querySelectorAll("body *")) {
      if (!vis(e) || !e.childNodes.length) continue;
      const own = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!own) continue;
      const fs = parseFloat(getComputedStyle(e).fontSize);
      if (fs < 12) tiny.add(`${fs}px ${e.tagName.toLowerCase()}: ${e.textContent.trim().slice(0, 30)}`);
    }
    const scrollers = [...document.querySelectorAll("main *")]
      .filter((e) => {
        const cs = getComputedStyle(e);
        return (cs.overflowX === "auto" || cs.overflowX === "scroll") && e.scrollWidth > e.clientWidth + 1 && vis(e);
      })
      .map((e) => `${e.tagName.toLowerCase()}.${String(e.className).split(" ").slice(0, 2).join(".")} ${e.scrollWidth}/${e.clientWidth}`);
    const h1 = document.querySelector("main h1")?.innerText.trim() ?? null;
    const main = document.querySelector("main")?.getBoundingClientRect();
    const nav = document.querySelector("aside, nav[aria-label]")?.getBoundingClientRect();
    return {
      h1,
      mainWidth: main ? Math.round(main.width) : null,
      mainLeft: main ? Math.round(main.left) : null,
      navWidth: nav ? Math.round(nav.width) : null,
      docHeight: document.documentElement.scrollHeight,
      numericCells,
      misaligned: misaligned.slice(0, 15),
      misalignedCount: misaligned.length,
      clipped: clipped.slice(0, 20),
      clippedCount: clipped.length,
      tiny: [...tiny].slice(0, 10),
      scrollers,
    };
  });
}

const height = width >= 2560 ? 1440 : width >= 1920 ? 1080 : width >= 1440 ? 900 : width >= 1280 ? 800 : width >= 1024 ? 768 : width >= 768 ? 1024 : 844;
const outFile = `docs/qa/audit/vis-admin/sweep2-${width}${filter ? "-" + slug(filter) : ""}.json`;
mkdirSync("docs/qa/audit/vis-admin", { recursive: true });
const b = await launch();
const ctx = await newContext(b, { width, height, tag: `vis-admin2-${width}` });
const page = await ctx.newPage();
const log = watch(page);
await loginAdmin(page);
const routes = [...STATIC];
for (const [list, re] of [
  ["/admin/proizvodi", /^\/admin\/proizvodi\/[a-z0-9]{20,}$/],
  ["/admin/kupci", /^\/admin\/kupci\/[a-z0-9]{20,}$/],
  ["/admin/majstori?status=approved", /^\/admin\/majstori\/[a-z0-9]{20,}$/],
]) {
  await page.goto(BASE + list);
  await settle(page);
  const hrefs = await page.$$eval("main a[href]", (as) => as.map((a) => a.getAttribute("href")));
  const hit = hrefs.find((h) => re.test(h));
  if (hit) routes.push(hit);
}
const out = {};
for (const route of routes) {
  if (filter && !route.includes(filter)) continue;
  const before = { c: log.console.length, p: log.pageErrors.length, b: log.badResponses.length };
  const t0 = Date.now();
  let ok = false;
  for (let i = 0; i < 3 && !ok; i++) {
    try {
      await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 60_000 });
      ok = true;
    } catch (e) {
      console.log("retry", route, String(e).slice(0, 80));
    }
  }
  if (!ok) {
    out[route] = { error: "navigation timeout x3" };
    writeFileSync(outFile, JSON.stringify(out, null, 2));
    continue;
  }
  await settle(page);
  const m = await metrics(page);
  const ov = await overflowX(page);
  const file = await shot(page, `vis-admin/sweep2/${width}/${slug(route)}`, { fullPage: full });
  out[route] = {
    ms: Date.now() - t0,
    ...m,
    overflow: ov,
    console: log.console.slice(before.c).map((s) => s.slice(0, 200)),
    pageErrors: log.pageErrors.slice(before.p),
    bad: log.badResponses.slice(before.b).map((s) => s.slice(0, 160)),
    file,
  };
  writeFileSync(outFile, JSON.stringify(out, null, 2));
  console.log(width, route, `ov=${ov.over}`, `num=${m.numericCells} mis=${m.misalignedCount}`, `clip=${m.clippedCount}`, `scr=${m.scrollers.length}`, `nav=${m.navWidth}`, (m.console?.length ?? 0));
}
await ctx.close();
await b.close();
console.log("DONE");
