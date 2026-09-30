// Independent verification of copy-07 … copy-10 (step 21 QA audit, verify track).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { BASE, launch, newContext, watch, scrollThrough, shot, loginWith } from "./kit.mjs";

const OUT = "docs/qa/audit/verify/copy";
mkdirSync(OUT, { recursive: true });
const acc = JSON.parse(readFileSync(".playwright/audit-accounts.json", "utf8"));
const only = process.argv[2] ?? "all";
const result = {};

async function pageInfo(page) {
  return page.evaluate(() => ({
    url: location.pathname,
    title: document.title,
    lang: document.documentElement.lang,
    h1: [...document.querySelectorAll("h1")].map((h) => h.textContent.trim()),
    text: document.body.innerText.slice(0, 300),
    links: [...document.querySelectorAll("a")].map((a) => a.textContent.trim()).slice(0, 10),
  }));
}

// ---------- copy-07 ----------
if (only === "all" || only === "07") {
  const r = {};
  for (const engine of ["chromium", "firefox"]) {
    const browser = await launch(engine);
    const widths = engine === "chromium" ? [1440, 390] : [1440];
    for (const width of widths) {
      for (const role of engine === "chromium" && width === 1440 ? ["customer", "mechanic"] : ["customer"]) {
        const ctx = await newContext(browser, { width, height: width < 1024 ? 844 : 900, tag: `v07-${engine}-${role}-${width}`, engine });
        const page = await ctx.newPage();
        const log = watch(page);
        await loginWith(page, acc[role].email, acc[role].password, "/nalog");
        for (const route of ["/admin", "/admin/porudzbine", "/admin/korisnici", "/admin/porudzbine/SK-2026-000092/predracun"]) {
          const resp = await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
          await page.waitForTimeout(800);
          const info = await pageInfo(page);
          r[`${engine} ${role} ${width} ${route}`] = { status: resp?.status(), ...info };
          if (route === "/admin" || route === "/admin/porudzbine/SK-2026-000092/predracun") {
            const name = `${OUT}/copy-07-reproduce-${engine}-${role}-${width}${route.replaceAll("/", "_")}`.replace("docs/qa/audit/", "");
            await shot(page, name);
          }
        }
        r[`${engine} ${role} ${width} log`] = log;
        await ctx.close();
      }
    }
    await browser.close();
  }
  // Route handlers
  for (const u of [
    "/slike/deo/nepostoji-1-abc.jpg",
    "/slike/deo/kocioni-disk-prednji-276-24-mm-demo-0004-9-zzzz.webp",
    "/slike/deo/nesto",
    "/sitemaps/nepostoji.xml",
    "/sitemaps/proizvodi-99.xml",
    "/sitemaps/staticne",
    "/ovo-ne-postoji",
  ]) {
    const res = await fetch(`${BASE}${u}`);
    const body = await res.text();
    r[`fetch ${u}`] = {
      status: res.status,
      type: res.headers.get("content-type"),
      body: body.length < 200 ? body : `${body.length} bytes html; title=${(body.match(/<title>([^<]*)<\/title>/) ?? [])[1]}`,
    };
  }
  result["copy-07"] = r;
}

// ---------- copy-08 ----------
if (only === "all" || only === "08") {
  const r = { counts: {}, samples: {} };
  const sm = await (await fetch(`${BASE}/sitemaps/proizvodi-1.xml`)).text();
  const urls = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace("http://localhost:3000", BASE)).filter((u) => u.includes("/deo/"));
  r.productUrls = urls.length;
  for (const u of urls) {
    const html = await (await fetch(u)).text();
    const m = html.match(/Garancija<\/dt><dd[^>]*>([^<]*(?:<!-- -->)?[^<]*)<\/dd>/);
    const val = m ? m[1].replace(/<!-- -->/g, "") : "(none)";
    r.counts[val] = (r.counts[val] ?? 0) + 1;
    if (!r.samples[val]) r.samples[val] = u.replace(BASE, "");
  }
  // Out-of-stock and noindex pages (not in sitemap) too
  for (const p of ["/deo/kocione-plocice-prednje-demo-0012"]) {
    const html = await (await fetch(`${BASE}${p}`)).text();
    const m = html.match(/Garancija<\/dt><dd[^>]*>([^<]*(?:<!-- -->)?[^<]*)<\/dd>/);
    r.samples[`extra ${p}`] = m ? m[1].replace(/<!-- -->/g, "") : "(none)";
  }
  const browser = await launch();
  for (const width of [1440, 390]) {
    const ctx = await newContext(browser, { width, height: width < 1024 ? 844 : 900, tag: `v08-${width}` });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/deo/kocioni-disk-prednji-276-24-mm-demo-0004`, { waitUntil: "networkidle" });
    await scrollThrough(page);
    const dt = page.locator("dt", { hasText: "Garancija" }).first();
    await dt.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, -200));
    await page.waitForTimeout(2500);
    r[`dom ${width}`] = await page.evaluate(() => {
      const dt = [...document.querySelectorAll("dt")].find((d) => d.textContent.trim() === "Garancija");
      return dt ? `${dt.textContent.trim()} | ${dt.nextElementSibling?.textContent.trim()}` : null;
    });
    await shot(page, `verify/copy/copy-08-reproduce-${width}`);
    await ctx.close();
  }
  await browser.close();
  result["copy-08"] = r;
}

// ---------- copy-09 ----------
if (only === "all" || only === "09") {
  const r = {};
  const browser = await launch();
  for (const width of [1440, 390]) {
    const ctx = await newContext(browser, { width, height: width < 1024 ? 844 : 900, tag: `v09-${width}` });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await scrollThrough(page);
    const h = page.locator("#cats-title");
    await h.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, -120));
    await page.waitForTimeout(2500);
    r[`link ${width}`] = await page.evaluate(() => {
      const sec = document.querySelector("#cats-title")?.closest("section");
      const a = sec?.querySelector("a");
      return { text: a?.textContent, href: a?.getAttribute("href") };
    });
    await shot(page, `verify/copy/copy-09-reproduce-${width}`);
    await ctx.close();
  }
  await browser.close();
  // category count on /delovi for cross-check
  const html = await (await fetch(`${BASE}/delovi`)).text();
  r.deloviTitle = (html.match(/<title>([^<]*)<\/title>/) ?? [])[1];
  r.homeSsr = ((await (await fetch(`${BASE}/`)).text()).match(/Svi[^<]{0,4}(?:<!-- -->)?[^<]{0,40}kategorij[^<]*/g) ?? []).slice(0, 3);
  result["copy-09"] = r;
}

// ---------- copy-10 ----------
if (only === "all" || only === "10") {
  const r = { pages: 0, doubleI: [], moreOne: 0, samples: [] };
  const sm = await (await fetch(`${BASE}/sitemaps/landing.xml`)).text();
  const urls = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace("http://localhost:3000", BASE));
  r.sitemapUrls = urls.length;
  for (const u of urls) {
    const html = (await (await fetch(u)).text()).replace(/<!-- -->/g, "");
    const m = html.match(/Proizvođači: [^<]*/);
    r.pages++;
    if (m && / i [^,<]*\(\d+\) i još \d+/.test(m[0])) {
      r.doubleI.push(`${u.replace(BASE, "")} :: ${m[0]}`);
      if (/i još 1\./.test(m[0])) r.moreOne++;
    } else if (m) r.samples.push(`${u.replace(BASE, "")} :: ${m[0]}`);
  }
  const browser = await launch();
  for (const width of [1440, 390]) {
    const ctx = await newContext(browser, { width, height: width < 1024 ? 844 : 900, tag: `v10-${width}` });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/delovi/kocioni-diskovi/volkswagen/golf`, { waitUntil: "networkidle" });
    await scrollThrough(page);
    const p = page.locator("p", { hasText: "Proizvođači:" }).first();
    await p.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, -150));
    await page.waitForTimeout(2500);
    r[`dom ${width}`] = await p.textContent();
    await shot(page, `verify/copy/copy-10-reproduce-${width}`);
    await ctx.close();
  }
  await browser.close();
  result["copy-10"] = r;
}

writeFileSync(`${OUT}/copy-07-10-reproduce-${only}.json`, JSON.stringify(result, null, 1));
console.log(JSON.stringify(result, null, 1).slice(0, 12000));
