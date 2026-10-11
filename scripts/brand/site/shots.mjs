// Step 25 — screenshots of the rebranded surfaces for review (docs/brand/site/).
// Usage: node scripts/brand/site/shots.mjs <baseUrl> [group ...]
// Groups: header, footer, pages, og, admin. Admin shots need SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD.
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE = process.argv[2] ?? "http://localhost:3000";
const only = process.argv.slice(3);
const OUT = path.resolve(import.meta.dirname, "../../../docs/brand/site");
await mkdir(OUT, { recursive: true });
const want = (name) => only.length === 0 || only.includes(name);

const browser = await chromium.launch();
const errors = [];

async function open(width, height, scale = 1, extra = {}) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: scale,
    reducedMotion: "reduce",
    ...extra,
  });
  const page = await context.newPage();
  // The consent banner would cover the footer: it is answered before the first paint.
  await page.addInitScript(() => {
    window.addEventListener("DOMContentLoaded", () => {
      const tick = () => {
        const reject = [...document.querySelectorAll("button")].find(
          (el) => el.textContent?.trim() === "Odbij sve",
        );
        if (reject) reject.click();
        else if (performance.now() < 15000) setTimeout(tick, 150);
      };
      tick();
    });
  });
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`${page.url()} — ${m.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`${page.url()} — ${e.message}`));
  return { context, page };
}

/** Size of the visible logo artwork inside `scope`, and whether the page scrolls sideways. */
const measure = (page, scope) =>
  page.evaluate((selector) => {
    const root = [...document.querySelectorAll(selector)].pop();
    const art = [...root.querySelectorAll("svg")].find((s) => {
      const r = s.getBoundingClientRect();
      return r.width > 1 && r.height > 1 && s.closest("a[aria-label$='početna'], a[aria-label*='pregled']");
    });
    const r = art?.getBoundingClientRect();
    const row = root.firstElementChild;
    const kids = [...row.children].map((c) => c.getBoundingClientRect()).filter((k) => k.width);
    return {
      logo: r ? `${Math.round(r.width)}x${Math.round(r.height * 10) / 10}` : null,
      pageOverflow: document.documentElement.scrollWidth > window.innerWidth,
      rowOverflow: row.scrollWidth > row.clientWidth,
      overlap: kids.some((a, i) => kids.slice(i + 1).some((b) => a.right > b.left + 0.5)),
    };
  }, scope);

// The header strip at every width where the lockup must fit or give way to the mark.
if (want("header")) {
  for (const width of [360, 390, 480, 640, 768, 1024, 1280, 1440, 1920]) {
    const { context, page } = await open(width, 700, width < 768 ? 2 : 1);
    await page.goto(`${BASE}/delovi`, { waitUntil: "networkidle" });
    await page.locator("[data-sticky-header]").screenshot({
      path: path.join(OUT, `header-night-${width}.png`),
    });
    console.log(`header ${width}:`, JSON.stringify(await measure(page, "[data-sticky-header]")));
    await context.close();
  }
}

if (want("footer")) {
  for (const [width, scale] of [
    [360, 2],
    [390, 2],
    [480, 2],
    [768, 1],
    [1024, 1],
    [1440, 1],
  ]) {
    const { context, page } = await open(width, 900, scale);
    await page.goto(`${BASE}/delovi`, { waitUntil: "networkidle" });
    const footer = page.locator("footer").last();
    await footer.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1200);
    // Clipped from the full page: an element shot would have the sticky header lying over it.
    const clip = await footer.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const box = { x: 0, y: r.top + window.scrollY, width: r.width, height: r.height };
      window.scrollTo(0, 0);
      return box;
    });
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(OUT, `footer-night-${width}.png`),
      fullPage: true,
      clip,
    });
    const fit = await page.evaluate(() => {
      const f = [...document.querySelectorAll("footer")].pop();
      const art = [...f.querySelectorAll("a[aria-label$='početna'] svg")].find(
        (s) => s.getBoundingClientRect().width > 1,
      );
      const r = art.getBoundingClientRect();
      return {
        logo: `${Math.round(r.width)}x${Math.round(r.height * 10) / 10}`,
        pageOverflow: document.documentElement.scrollWidth > window.innerWidth,
      };
    });
    console.log(`footer ${width}:`, JSON.stringify(fit));
    await context.close();
  }
}

if (want("pages")) {
  for (const [name, url, width, height] of [
    ["home-night-1440", "/", 1440, 900],
    ["home-night-390", "/", 390, 844],
    ["404-night-1440", "/ne-postoji", 1440, 700],
    ["404-night-390", "/ne-postoji", 390, 700],
    ["prijava-night-1440", "/prijava", 1440, 800],
    ["prijava-night-390", "/prijava", 390, 800],
    ["styleguide-marka-1440", "/styleguide", 1440, 1300],
  ]) {
    const { context, page } = await open(width, height, width < 768 ? 2 : 1);
    await page.goto(`${BASE}${url}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT, `${name}.png`) });
    console.log(name, "-", await page.title());
    await context.close();
  }
}

if (want("og")) {
  const { context, page } = await open(1200, 630);
  // Segment OG routes carry a hash in their path, so the address is read from the page itself.
  const ogOf = async (url) => {
    await page.goto(`${BASE}${url}`, { waitUntil: "domcontentloaded" });
    return page.locator('meta[property="og:image"]').first().getAttribute("content");
  };
  const category = await ogOf("/delovi/kocioni-diskovi");
  const productHref = await page.locator("a[href^='/deo/']").first().getAttribute("href");
  const product = productHref ? await ogOf(productHref) : null;
  for (const [name, url] of [
    ["og-default", `${BASE}/opengraph-image`],
    ["og-category", category],
    ["og-product", product],
  ]) {
    if (!url) continue;
    const res = await page.goto(new URL(url, BASE).toString().replace(/^https?:\/\/[^/]+/, BASE));
    console.log(name, res?.status(), res?.headers()["content-type"]);
    await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  }
  await context.close();
}

if (want("admin")) {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    console.log("admin: SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD missing - skipped");
  } else {
    for (const [width, height] of [
      [1440, 900],
      [1366, 768],
      [1100, 800],
      [390, 844],
    ]) {
      const { context, page } = await open(width, height, width < 768 ? 2 : 1);
      await page.goto(`${BASE}/prijava?next=/admin`, { waitUntil: "networkidle" });
      await page.getByTestId("auth-email").fill(email);
      await page.getByTestId("auth-password").fill(password);
      await page.getByTestId("auth-submit").click();
      await page.waitForURL(/\/admin$/, { timeout: 60_000 });
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(OUT, `admin-paper-${width}.png`) });
      if (width >= 1366) {
        await page.goto(`${BASE}/admin/porudzbine`, { waitUntil: "networkidle" });
        await page.waitForTimeout(1500);
        await page.screenshot({ path: path.join(OUT, `admin-orders-paper-${width}.png`) });
        const fit = await page.evaluate(() => {
          const art = [...document.querySelectorAll("aside a svg")].find(
            (x) => x.getBoundingClientRect().width > 0,
          );
          const r = art?.getBoundingClientRect();
          return {
            pageOverflow: document.documentElement.scrollWidth > window.innerWidth,
            sidebar: Math.round(document.querySelector("aside")?.getBoundingClientRect().width ?? 0),
            logo: r ? `${Math.round(r.width)}x${Math.round(r.height * 10) / 10}` : null,
          };
        });
        console.log(`admin ${width}:`, JSON.stringify(fit));
      }
      if (width === 1440) {
        // An e-mail template as the owner previews it: the logo comes from the admin's own origin.
        await page.goto(`${BASE}/admin/mejlovi/sabloni?sablon=order_confirmed`, {
          waitUntil: "networkidle",
        });
        const frame = page.locator("iframe[title^='Pregled šablona']");
        if (await frame.count()) {
          await frame.first().waitFor({ state: "visible", timeout: 30_000 });
          await page.waitForTimeout(1500);
          const logo = await frame.first().evaluate((el) => {
            const img = el.contentDocument?.querySelector("img");
            return img ? { src: img.getAttribute("src"), loaded: img.complete && img.naturalWidth > 0 } : null;
          });
          console.log("admin e-mail preview logo:", JSON.stringify(logo));
          await page.screenshot({ path: path.join(OUT, "admin-email-preview-1440.png") });
        } else {
          console.log("admin e-mail preview: no preview frame at", page.url());
        }
        // The first order in the list, as its printable predračun: the paper logo on a document.
        await page.goto(`${BASE}/admin/porudzbine`, { waitUntil: "networkidle" });
        const number = (await page.locator("tbody tr").first().innerText()).match(/[A-Z]{1,4}-\d{4}-\d{6}/);
        const href = number ? `/admin/porudzbine/${number[0]}` : null;
        if (href) {
          await page.goto(`${BASE}${href}/predracun`, { waitUntil: "networkidle" });
          await page.waitForTimeout(800);
          await page.screenshot({ path: path.join(OUT, "print-predracun-screen.png") });
          await page.emulateMedia({ media: "print" });
          await page.screenshot({
            path: path.join(OUT, "print-predracun-print.png"),
            fullPage: true,
          });
          console.log("print:", href);
        }
      }
      await context.close();
    }
  }
}

await browser.close();
console.log(
  errors.length ? `console errors:\n${[...new Set(errors)].join("\n")}` : "no console errors",
);
