/**
 * Copy track: collects the rendered copy of storefront routes (visible text, aria-label, placeholder,
 * title, alt, meta title/description, OG, JSON-LD) into docs/qa/audit/copy/crawl-<name>.json.
 *
 *   node scripts/qa/audit/copy-crawl.mjs <name> [--nojs] [--width 1440] [--role anon|customer|mechanic|admin] [--scroll] url1 url2 ...
 *   node scripts/qa/audit/copy-crawl.mjs sitemap --nojs --sitemap     (every sitemap URL, 3000 → 3100)
 *
 * Sequential (one request at a time) so it never competes with the Lighthouse run on :3200.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

import { BASE, launch, newContext, watch, scrollThrough, loginWith, loginAdmin } from "./kit.mjs";

const args = process.argv.slice(2);
const name = args.shift();
let nojs = false;
let width = 1440;
let role = "anon";
let scroll = false;
let fromSitemap = false;
const urls = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--nojs") nojs = true;
  else if (a === "--width") width = Number(args[++i]);
  else if (a === "--role") role = args[++i];
  else if (a === "--scroll") scroll = true;
  else if (a === "--sitemap") fromSitemap = true;
  else urls.push(a);
}

async function sitemapUrls() {
  const idx = await (await fetch(`${BASE}/sitemap.xml`)).text();
  const maps = [...idx.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace("http://localhost:3000", BASE));
  const out = [];
  for (const m of maps) {
    const xml = await (await fetch(m)).text();
    for (const x of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) out.push(x[1].replace("http://localhost:3000", ""));
  }
  return out;
}

const list = fromSitemap ? await sitemapUrls() : urls;
const browser = await launch("chromium");
const context = await newContext(browser, { width, height: 900, tag: `copy-${name}` });
if (nojs) await context.close();
const ctx = nojs
  ? await browser.newContext({ viewport: { width, height: 900 }, javaScriptEnabled: false, locale: "sr-Latn-RS" })
  : context;
const page = await ctx.newPage();
const log = watch(page);

if (!nojs && role !== "anon") {
  const accounts = JSON.parse(readFileSync(".playwright/audit-accounts.json", "utf8"));
  if (role === "admin") await loginAdmin(page);
  else if (role === "customer") await loginWith(page, accounts.customer.email, accounts.customer.password, "/nalog");
  else if (role === "mechanic") await loginWith(page, accounts.mechanic.email, accounts.mechanic.password, "/majstor");
}

const results = [];
for (const u of list) {
  const url = u.startsWith("http") ? u : `${BASE}${u}`;
  let status = 0;
  try {
    const resp = await page.goto(url, { waitUntil: nojs ? "load" : "networkidle", timeout: 60_000 });
    status = resp?.status() ?? 0;
    if (!nojs) {
      await page.waitForTimeout(800);
      if (scroll) await scrollThrough(page, { stepMs: 90 });
    }
    const data = await page.evaluate(() => {
      const meta = (sel) => document.querySelector(sel)?.getAttribute("content") ?? null;
      const attrs = [];
      for (const el of document.querySelectorAll("[aria-label],[placeholder],[title],img[alt],[aria-description],[aria-roledescription],[aria-valuetext],input[type=submit][value],option")) {
        for (const a of ["aria-label", "placeholder", "title", "alt", "aria-description", "aria-roledescription", "aria-valuetext"]) {
          const v = el.getAttribute(a);
          if (v && v.trim()) attrs.push({ tag: el.tagName.toLowerCase(), attr: a, value: v.trim() });
        }
        if (el.tagName === "OPTION" && el.textContent.trim()) attrs.push({ tag: "option", attr: "text", value: el.textContent.trim() });
      }
      // Text that exists in the DOM but is not rendered (sr-only, hidden panels, <template>-free): textContent of hidden nodes
      const hidden = [];
      for (const el of document.querySelectorAll(".sr-only,[hidden],[aria-hidden=true]")) {
        const t = el.textContent.trim();
        if (t && t.length < 300) hidden.push(t);
      }
      return {
        title: document.title,
        description: meta('meta[name="description"]'),
        ogTitle: meta('meta[property="og:title"]'),
        ogDescription: meta('meta[property="og:description"]'),
        ogImageAlt: meta('meta[property="og:image:alt"]'),
        twitterTitle: meta('meta[name="twitter:title"]'),
        robots: meta('meta[name="robots"]'),
        h1: [...document.querySelectorAll("h1")].map((h) => h.innerText.trim()),
        text: document.body.innerText,
        attrs,
        hidden,
        jsonld: [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => s.textContent),
        lang: document.documentElement.lang,
      };
    });
    results.push({ url: u, status, ...data });
    process.stdout.write(`${status} ${u}\n`);
  } catch (e) {
    results.push({ url: u, status, error: String(e).slice(0, 300) });
    process.stdout.write(`ERR ${u} ${String(e).slice(0, 120)}\n`);
  }
}

const dir = path.resolve("docs/qa/audit/copy");
mkdirSync(dir, { recursive: true });
writeFileSync(path.join(dir, `crawl-${name}.json`), JSON.stringify({ base: BASE, nojs, width, role, log, results }, null, 1));
console.log(`saved ${results.length} pages; console errors ${log.console.length}; page errors ${log.pageErrors.length}`);
await browser.close();
