/**
 * Copy track: signs in as the owner and records the copy of every admin screen (read-only: no
 * clicks on actions, only navigation) plus the e-mail template gallery (all templates, HTML and text).
 *   node scripts/qa/audit/copy-admin.mjs → docs/qa/audit/copy/crawl-admin.json (+ emails-admin.json)
 */
import { writeFileSync } from "node:fs";
import { BASE, launch, newContext, watch, loginAdmin, shot } from "./kit.mjs";

const LISTS = [
  "/admin", "/admin/porudzbine", "/admin/upiti", "/admin/proizvodi", "/admin/proizvodi/novi", "/admin/kategorije",
  "/admin/vozila", "/admin/proizvodjaci", "/admin/lager", "/admin/kupci", "/admin/majstori", "/admin/cenovni-razredi",
  "/admin/uvoz", "/admin/uvoz/istorija", "/admin/izvoz", "/admin/pretrage", "/admin/izvori", "/admin/mejlovi",
  "/admin/mejlovi/sabloni", "/admin/obavestenja", "/admin/korisnici", "/admin/revizija", "/admin/privatnost",
  ...["firma", "radno-vreme", "prodaja", "obavestenja", "seo", "pracenje", "pravni-tekstovi", "funkcije", "oglasne-strane", "opasna-zona"].map((t) => `/admin/podesavanja?tab=${t}`),
  "/admin/porudzbine/SK-2026-000092", "/admin/porudzbine/SK-2026-000092/predracun", "/admin/porudzbine/SK-2026-000092/otpremnica",
  "/admin/upiti/UP-2026-000054", "/admin/upiti/UP-2026-000003",
];
const DETAIL_FROM = {
  "/admin/proizvodi": /^\/admin\/proizvodi\/[a-z0-9]{20,}$/,
  "/admin/kupci": /^\/admin\/kupci\/[a-z0-9]{20,}$/,
  "/admin/majstori": /^\/admin\/majstori\/[a-z0-9]{20,}$/,
  "/admin/uvoz/istorija": /^\/admin\/uvoz\/[a-z0-9]{20,}$/,
};

const b = await launch();
const ctx = await newContext(b, { width: 1440, height: 900, tag: "copy-admin" });
const page = await ctx.newPage();
const log = watch(page);
await loginAdmin(page);

const results = [];
async function grab(u) {
  const resp = await page.goto(`${BASE}${u}`, { waitUntil: "networkidle", timeout: 60_000 });
  await page.waitForTimeout(1200);
  const data = await page.evaluate(() => {
    const attrs = [];
    for (const el of document.querySelectorAll("[aria-label],[placeholder],[title],img[alt]"))
      for (const a of ["aria-label", "placeholder", "title", "alt"]) {
        const v = el.getAttribute(a);
        if (v && v.trim()) attrs.push({ tag: el.tagName.toLowerCase(), attr: a, value: v.trim() });
      }
    return {
      title: document.title,
      h1: [...document.querySelectorAll("h1")].map((h) => h.innerText.trim()),
      text: document.body.innerText,
      attrs,
      links: [...document.querySelectorAll("a[href^='/admin/']")].map((a) => a.getAttribute("href")),
    };
  });
  results.push({ url: u, status: resp?.status() ?? 0, ...data });
  console.log(resp?.status(), u);
  return data;
}

for (const u of LISTS) {
  try {
    const d = await grab(u);
    const re = DETAIL_FROM[u];
    if (re) {
      const first = d.links.find((l) => re.test(l));
      if (first) await grab(first);
    }
  } catch (e) {
    console.log("ERR", u, String(e).slice(0, 150));
  }
}

// E-mail template gallery: every template in HTML (iframe srcdoc text) and plain text.
const emails = [];
try {
  await page.goto(`${BASE}/admin/mejlovi/sabloni`, { waitUntil: "networkidle" });
  const keys = await page.evaluate(() =>
    [...new Set([...document.querySelectorAll("a[href*='sablon=']")].map((a) => new URL(a.href).searchParams.get("sablon")))].filter(Boolean),
  );
  for (const k of keys) {
    for (const view of ["", "tekst"]) {
      await page.goto(`${BASE}/admin/mejlovi/sabloni?sablon=${k}${view ? `&prikaz=${view}` : ""}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(800);
      const d = await page.evaluate(() => {
        const f = document.querySelector("iframe[srcdoc]");
        let html = "";
        if (f) {
          const doc = new DOMParser().parseFromString(f.getAttribute("srcdoc"), "text/html");
          html = doc.body.innerText || doc.body.textContent;
        }
        const pre = [...document.querySelectorAll("pre")].map((p) => p.innerText).join("\n");
        return { main: document.querySelector("main")?.innerText ?? "", html, pre };
      });
      emails.push({ key: k, view: view || "html", ...d });
    }
    if (["order_received", "order_confirmed", "quote_ready"].includes(k) || emails.length < 4)
      await shot(page, `copy/admin-email-${k}`).catch(() => {});
  }
  console.log("templates", keys.length);
} catch (e) {
  console.log("ERR emails", String(e).slice(0, 200));
}

writeFileSync("docs/qa/audit/copy/crawl-admin.json", JSON.stringify({ base: BASE, role: "admin", log, results }, null, 1));
writeFileSync("docs/qa/audit/copy/emails-admin.json", JSON.stringify(emails, null, 1));
console.log("pages", results.length, "console errors", log.console.length);
await b.close();
