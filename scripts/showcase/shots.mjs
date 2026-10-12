// Showcase screenshots for the client demo (steps 23 and 29): docs/showcase/*.webp.
//
//   node scripts/showcase/shots.mjs [--base http://localhost:3100] [--only home,catalog,...]
//
// Every page is scrolled end to end before it is captured, so the site-wide reveal has finished
// and no block is caught mid-entrance; a capture that still shows a pending element is reported.
// The one deliberate exception is `reveal-*`, a frame taken while a grid is arriving.
//
// Needs a production build with NEXT_PUBLIC_TEST_HOOKS=1 (the 3D hero hooks drive the explode),
// SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD for the admin, and .playwright/audit-accounts.json for the
// approved mechanic (created in step 21). Nothing is submitted: the checkout stops at the review step
// and the import stops at the check step, so the database is not changed.
import { mkdirSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import sharp from "sharp";

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const BASE = arg("base", "http://localhost:3100");
const ONLY = (arg("only", "") || "").split(",").filter(Boolean);
const OUT = resolve("docs/showcase");
mkdirSync(OUT, { recursive: true });

const CATEGORY = "/delovi/kocioni-diskovi";
const PRODUCT = "/deo/kocioni-disk-prednji-340-30-mm-gti-demo-0005";
const QUICK_LINES = ["036 121 959 P 2", "038 121 662 1", "ZZ9999999 3"].join("\n");

const DESKTOP = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };
const MOBILE = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
};

const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const problems = [];
const consentCookie = existsSync(".playwright/consent-state.json")
  ? JSON.parse(readFileSync(".playwright/consent-state.json", "utf8")).cookies
  : [];

async function newPage(device, label) {
  const context = await browser.newContext({
    ...device,
    locale: "sr-Latn-RS",
    timezoneId: "Europe/Belgrade",
    userAgent: `Mozilla/5.0 (SklopShowcase ${label} ${Date.now()}) Chrome/140`,
  });
  // Visitors who already answered the cookie banner, so it never covers the screenshot.
  if (consentCookie.length) {
    await context.addCookies(
      consentCookie.map((c) => ({ ...c, domain: new URL(BASE).hostname })),
    );
  }
  const page = await context.newPage();
  page.on("pageerror", (e) => problems.push(`${label}: pageerror ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(`${label}: console ${m.text().slice(0, 200)}`);
  });
  return { context, page };
}

async function settle(page, ms = 900) {
  await page.waitForTimeout(ms);
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))),
  );
}

/** Scrolls the page end to end so every text-reveal element has arrived, then back to `y`. */
async function revealAll(page, y = 0) {
  await page.evaluate(async () => {
    const step = Math.max(300, Math.round(window.innerHeight * 0.7));
    for (let pos = 0; pos < document.documentElement.scrollHeight; pos += step) {
      window.scrollTo(0, pos);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, document.documentElement.scrollHeight);
    await new Promise((r) => setTimeout(r, 400));
  });
  await page.evaluate((top) => window.scrollTo(0, top), y);
  await settle(page, 1200);
}

/** WebP stores at most 16383 px a side; a full-page phone capture at 2× can be taller. */
const WEBP_MAX = 16000;

async function shot(page, name, { fullPage = false, clip, owed = true } = {}) {
  if (owed) {
    // Nothing on the captured area may still be waiting for its entrance.
    const pending = await page.evaluate((whole) => {
      const vh = window.innerHeight;
      return [...document.querySelectorAll('[data-reveal-state="pending"]')].filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && (whole || (r.bottom > 0 && r.top < vh));
      }).length;
    }, fullPage);
    if (pending) problems.push(`${name}: ${pending} element(s) still pending at capture`);
  }
  const png = await page.screenshot({ fullPage, clip });
  const { height } = await sharp(png).metadata();
  const image = height > WEBP_MAX ? sharp(png).resize({ height: WEBP_MAX }) : sharp(png);
  await image.webp({ quality: 82 }).toFile(`${OUT}/${name}.webp`);
  console.log(`  ${name}.webp`);
}

/** Scroll-through, back to `y`, capture: what every still of a page goes through. */
async function capture(page, name, { y = 0, ...options } = {}) {
  await revealAll(page, y);
  await shot(page, name, options);
}

/** Scrolls so that `selector` sits `offset` px under the top edge; returns the scroll position. */
async function scrollToElement(page, selector, offset = 96) {
  return page.evaluate(
    ([sel, off]) => {
      const el = document.querySelector(sel);
      if (!el) return 0;
      const y = Math.max(0, Math.round(el.getBoundingClientRect().top + window.scrollY - off));
      window.scrollTo(0, y);
      return y;
    },
    [selector, offset],
  );
}

async function addToCart(page) {
  await page.goto(`${BASE}${PRODUCT}`, { waitUntil: "networkidle" });
  await page.locator("#buy-box").getByTestId("product-add-to-cart").click();
  await page.waitForFunction(
    () =>
      document
        .querySelector('#buy-box [data-testid="product-add-to-cart"]')
        ?.textContent?.includes("Dodato"),
    null,
    { timeout: 20_000 },
  );
}

async function signIn(page, email, password, next) {
  await page.goto(`${BASE}/prijava?next=${encodeURIComponent(next)}`, { waitUntil: "networkidle" });
  await page.getByTestId("auth-email").fill(email);
  await page.getByTestId("auth-password").fill(password);
  await page.getByTestId("auth-submit").click();
  await page.waitForURL((u) => u.pathname.startsWith(next), { timeout: 60_000 });
}

const jobs = {
  async home() {
    for (const [tag, device] of [
      ["desktop", DESKTOP],
      ["mobile", MOBILE],
    ]) {
      const { context, page } = await newPage(device, `home-${tag}`);
      // SwiftShader is classed as a low tier (poster only); `?3d=` forces the tier this device
      // class gets on real hardware (high at 1440, mid on the phone), as the hero e2e does.
      await page.goto(`${BASE}/?3d=${tag === "desktop" ? "high" : "mid"}`, { waitUntil: "load" });
      await settle(page, 1200);
      // First intent (scrolling past 40 px) starts the 3D, as in tests/e2e/hero-3d.spec.ts.
      await page.mouse.move(1000, 450);
      await page.evaluate(() => window.scrollTo(0, 80));
      await page.waitForFunction(() => window.__sklop3d?.ready === true, null, { timeout: 180_000 });
      await revealAll(page, 0);
      await settle(page, 1600);
      if (tag === "mobile") {
        await page.evaluate(() => {
          const track = document.querySelector('[data-testid="hero-track"]');
          // 48 px into the track: the frame is pinned under the header by then, and the last line
          // of the copy above it is no longer showing through the translucent header.
          if (track) window.scrollTo(0, track.getBoundingClientRect().top + window.scrollY - 56 + 48);
        });
        await settle(page, 1400);
      }
      await page.evaluate(() => window.__sklop3d.explode(0));
      await settle(page, 1400);
      if (tag === "mobile") {
        // explode(0) returns to the very start of the track, where the last line of the copy
        // above still shows through the translucent header. 48 px on, the frame is pinned and
        // the stage is still 00.
        await page.evaluate(() => window.scrollBy(0, 48));
        await settle(page, 900);
      }
      await shot(page, `home-assembled-${tag}`);
      await page.evaluate(() => window.__sklop3d.explode(1));
      await settle(page, 1600);
      await shot(page, `home-exploded-${tag}`);
      await page.evaluate(() => window.__sklop3d.selectPart("turbina"));
      await page.waitForSelector('[data-testid="part-panel"]', { timeout: 20_000 });
      await page
        .waitForSelector('[data-testid="part-panel-product"]', { timeout: 20_000 })
        .catch(() => null);
      await settle(page, 1800);
      await shot(page, `home-part-${tag}`);
      await context.close();
    }
    // The rest of the home page below the hero (desktop, one tall frame).
    for (const [tag, device] of [
      ["desktop", DESKTOP],
      ["mobile", MOBILE],
    ]) {
      const { context, page } = await newPage(device, `home-page-${tag}`);
      await page.goto(`${BASE}/`, { waitUntil: "load" });
      await capture(page, `home-page-${tag}`, { fullPage: true });
      // The two sections step 27 added to the home page, as the visitor meets them.
      for (const [name, selector] of [
        ["home-featured", "#featured-title"],
        ["home-systems", "#systems-title"],
      ]) {
        const y = await scrollToElement(page, selector, tag === "desktop" ? 120 : 84);
        await settle(page, 900);
        await page.evaluate((top) => window.scrollTo(0, top), y);
        await settle(page, 500);
        await shot(page, `${name}-${tag}`);
      }
      await context.close();
    }
  },

  async catalog() {
    for (const [tag, device] of [
      ["desktop", DESKTOP],
      ["mobile", MOBILE],
    ]) {
      const { context, page } = await newPage(device, `category-${tag}`);
      await page.goto(`${BASE}${CATEGORY}`, { waitUntil: "networkidle" });
      await capture(page, `category-${tag}`);
      await page.goto(`${BASE}${PRODUCT}`, { waitUntil: "networkidle" });
      await capture(page, `product-${tag}`);
      await context.close();
    }
  },

  async checkout() {
    for (const [tag, device] of [
      ["desktop", DESKTOP],
      ["mobile", MOBILE],
    ]) {
      const { context, page } = await newPage(device, `checkout-${tag}`);
      await addToCart(page);
      await page.goto(`${BASE}/korpa`, { waitUntil: "networkidle" });
      await settle(page, 1200);
      await capture(page, `cart-${tag}`);
      await page.goto(`${BASE}/porudzbina`, { waitUntil: "networkidle" });
      await page.getByTestId("checkout-step-contact").waitFor({ timeout: 20_000 });
      await page.getByLabel("Ime", { exact: true }).fill("Nikola");
      await page.getByLabel("Prezime").fill("Stanković");
      await page.getByLabel("Telefon", { exact: true }).fill("064 123 4567");
      await page.getByLabel("E-pošta").fill("nikola.stankovic@primer.rs");
      await capture(page, `checkout-contact-${tag}`);
      await page.getByTestId("checkout-next").click();
      await page.getByTestId("checkout-step-delivery").waitFor();
      await page.getByRole("radio", { name: /Kurirska služba/ }).click();
      await page.getByLabel("Ulica i broj").fill("Bulevar oslobođenja 12");
      await page.getByLabel("Poštanski broj").fill("21000");
      await page.getByLabel("Mesto").fill("Novi Sad");
      await page.getByTestId("checkout-next").click();
      await page.getByTestId("checkout-step-payment").waitFor();
      await page.getByTestId("checkout-next").click();
      await page.getByTestId("checkout-step-review").waitFor();
      await capture(page, `checkout-review-${tag}`);
      await context.close();
    }
  },

  async inquiry() {
    for (const [tag, device] of [
      ["desktop", DESKTOP],
      ["mobile", MOBILE],
    ]) {
      const { context, page } = await newPage(device, `inquiry-${tag}`);
      await page.goto(`${BASE}/upit`, { waitUntil: "networkidle" });
      await page.getByTestId("inquiry-vin-input").fill("WVWZZZ1KZ8W123456");
      await page.getByTestId("inquiry-vin-input").blur();
      await settle(page, 1500);
      await capture(page, `inquiry-${tag}`);
      await context.close();
    }
  },

  async mechanic() {
    const accounts = JSON.parse(readFileSync(".playwright/audit-accounts.json", "utf8"));
    for (const [tag, device] of [
      ["desktop", DESKTOP],
      ["mobile", MOBILE],
    ]) {
      const { context, page } = await newPage(device, `mechanic-${tag}`);
      await signIn(page, accounts.mechanic.email, accounts.mechanic.password, "/majstor");
      await page.goto(`${BASE}/majstor`, { waitUntil: "networkidle" });
      await settle(page, 1200);
      await capture(page, `mechanic-dashboard-${tag}`);
      await page.goto(`${BASE}/majstor/brza-porudzbina`, { waitUntil: "networkidle" });
      await page.getByTestId("mechanic-quick-order-input").fill(QUICK_LINES);
      await page.getByTestId("mechanic-quick-order-check").click();
      await page
        .getByTestId("mechanic-quick-order-row")
        .nth(2)
        .waitFor({ timeout: 20_000 });
      await capture(page, `mechanic-quick-order-${tag}`);
      await page.goto(`${BASE}${PRODUCT}`, { waitUntil: "networkidle" });
      await capture(page, `mechanic-price-${tag}`);
      await context.close();
    }
  },

  async admin() {
    const email = process.env.SEED_ADMIN_EMAIL;
    const password = process.env.SEED_ADMIN_PASSWORD;
    if (!email || !password) throw new Error("SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set");
    const { context, page } = await newPage(DESKTOP, "admin");
    await signIn(page, email, password, "/admin");
    const pages = [
      ["admin-dashboard", "/admin"],
      ["admin-orders", "/admin/porudzbine"],
      ["admin-inquiries", "/admin/upiti"],
      ["admin-products", "/admin/proizvodi"],
      ["admin-mechanics", "/admin/majstori"],
    ];
    for (const [name, path] of pages) {
      await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
      await settle(page, 1200);
      await capture(page, `${name}-desktop`);
    }
    // Newest order detail.
    await page.goto(`${BASE}/admin/porudzbine`, { waitUntil: "networkidle" });
    await settle(page, 1500);
    const number = (await page.locator("table").first().innerText()).match(/SK-\d{4}-\d{6}/)?.[0];
    if (number) {
      await page.goto(`${BASE}/admin/porudzbine/${number}`, { waitUntil: "networkidle" });
      await settle(page, 1400);
      await capture(page, "admin-order-detail-desktop");
    } else {
      problems.push("admin: no order number found in the orders table");
    }
    // Import wizard: file → column mapping → check (no dry run, nothing is written).
    await page.goto(`${BASE}/admin/uvoz`, { waitUntil: "networkidle" });
    await page
      .getByTestId("import-file-input")
      .setInputFiles(resolve("tests/fixtures/import/proizvodi-500.xlsx"));
    await page.getByTestId("import-row-count").waitFor({ timeout: 30_000 });
    await settle(page, 1000);
    await capture(page, "admin-import-file-desktop");
    await page.getByTestId("import-to-mapping").click();
    await page.getByTestId("import-mapping").waitFor();
    await settle(page, 1200);
    await capture(page, "admin-import-mapping-desktop");
    await page.getByTestId("import-to-check").click();
    await page.getByTestId("import-problems").waitFor({ timeout: 30_000 });
    await settle(page, 1200);
    await capture(page, "admin-import-check-desktop");
    // E-mail sample: the „order confirmed“ template, desktop and phone preview.
    for (const [query, name] of [
      ["sablon=order_confirmed", "email-order-confirmed-desktop"],
      ["sablon=order_confirmed&prikaz=telefon", "email-order-confirmed-mobile"],
      ["sablon=quote_ready", "email-quote-ready-desktop"],
    ]) {
      await page.goto(`${BASE}/admin/mejlovi/sabloni?${query}`, { waitUntil: "networkidle" });
      const preview = page.getByTestId("template-preview");
      await preview.waitFor({ timeout: 30_000 });
      await settle(page, 1500);
      await capture(page, `${name}-admin`);
      const frame = preview.locator("iframe").first();
      if (await frame.count()) {
        await frame.screenshot().then((png) =>
          sharp(png).webp({ quality: 85 }).toFile(`${OUT}/${name}.webp`),
        );
        console.log(`  ${name}.webp`);
      }
    }
    await context.close();

    // The admin on a phone (dashboard and orders).
    const phone = await newPage(MOBILE, "admin-mobile");
    await signIn(phone.page, email, password, "/admin");
    for (const [name, path] of [
      ["admin-dashboard", "/admin"],
      ["admin-orders", "/admin/porudzbine"],
    ]) {
      await phone.page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
      await settle(phone.page, 1200);
      await capture(phone.page, `${name}-mobile`);
    }
    await phone.context.close();
  },
};

/** Extra admin screens used by docs/PREDAJA.md (settings, inquiry detail, stock, e-mail outbox). */
jobs.adminExtra = async () => {
  const { context, page } = await newPage(DESKTOP, "admin-extra");
  await signIn(page, process.env.SEED_ADMIN_EMAIL, process.env.SEED_ADMIN_PASSWORD, "/admin");
  for (const [name, path] of [
    ["admin-settings", "/admin/podesavanja"],
    ["admin-categories", "/admin/kategorije"],
    ["admin-stock", "/admin/lager"],
    ["admin-outbox", "/admin/mejlovi"],
    ["admin-searches", "/admin/pretrage"],
    ["admin-sources", "/admin/izvori"],
    ["admin-users", "/admin/korisnici"],
    ["admin-export", "/admin/izvoz"],
  ]) {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    await settle(page, 1200);
    await capture(page, `${name}-desktop`);
  }
  await page.goto(`${BASE}/admin/upiti`, { waitUntil: "networkidle" });
  await settle(page, 1500);
  const number = (await page.locator("table").first().innerText()).match(/UP-\d{4}-\d{6}/)?.[0];
  if (number) {
    await page.goto(`${BASE}/admin/upiti/${number}`, { waitUntil: "networkidle" });
    await settle(page, 1400);
    await capture(page, "admin-inquiry-detail-desktop");
  }
  await page.goto(`${BASE}/admin/proizvodi`, { waitUntil: "networkidle" });
  await settle(page, 1500);
  const productLink = page.locator('a[href^="/admin/proizvodi/"]:not([href$="/novi"])').first();
  if (await productLink.count()) {
    await page.goto(`${BASE}${await productLink.getAttribute("href")}`, { waitUntil: "networkidle" });
    await settle(page, 1400);
    await capture(page, "admin-product-editor-desktop");
  }
  await context.close();
};

/**
 * What steps 26–28 added (step 29): the shell (header, mobile action bar, menu, search), the
 * catalog index, search with and without results, sign-in, the account, and one frame of a grid
 * while it is arriving.
 */
jobs.whatsNew = async () => {
  for (const [tag, device] of [
    ["desktop", DESKTOP],
    ["mobile", MOBILE],
  ]) {
    const { context, page } = await newPage(device, `new-${tag}`);
    // Catalog index: the header at the top of a page (tall, no surface) and, on the phone, the
    // action bar.
    await page.goto(`${BASE}/delovi`, { waitUntil: "networkidle" });
    await capture(page, `parts-${tag}`);
    // Scrolled: the header condensed onto its surface.
    await page.goto(`${BASE}${CATEGORY}`, { waitUntil: "networkidle" });
    await capture(page, `category-scrolled-${tag}`, { y: tag === "desktop" ? 520 : 460 });
    // Search from the header.
    await page.evaluate(() => window.scrollTo(0, 0));
    await settle(page, 400);
    await page.getByTestId("header-search-trigger").first().click();
    // The test id is on the field's wrapper; the control inside is the input.
    const input = page.getByTestId("header-search-input").first().locator("input");
    await input.waitFor({ timeout: 20_000 });
    await input.fill("disk");
    await settle(page, 2200);
    await shot(page, `search-open-${tag}`, { owed: false });
    await page.keyboard.press("Escape");
    for (const [name, query] of [
      ["search", "disk"],
      ["search-empty", "zzzz-nema"],
    ]) {
      await page.goto(`${BASE}/pretraga?q=${query}`, { waitUntil: "networkidle" });
      await capture(page, `${name}-${tag}`);
    }
    await page.goto(`${BASE}/prijava`, { waitUntil: "networkidle" });
    await capture(page, `signin-${tag}`);
    if (tag === "mobile") {
      await page.goto(`${BASE}/delovi`, { waitUntil: "networkidle" });
      await revealAll(page, 0);
      await page.getByTestId("mobile-menu-trigger").click();
      await page.getByRole("dialog").first().waitFor({ timeout: 20_000 });
      await settle(page, 1200);
      await shot(page, "menu-mobile", { owed: false });
    }
    await context.close();
  }

  // The customer's account (two columns on a desktop, section tabs on a phone).
  const accounts = JSON.parse(readFileSync(".playwright/audit-accounts.json", "utf8"));
  for (const [tag, device] of [
    ["desktop", DESKTOP],
    ["mobile", MOBILE],
  ]) {
    const { context, page } = await newPage(device, `account-${tag}`);
    await signIn(page, accounts.customer.email, accounts.customer.password, "/nalog");
    await page.goto(`${BASE}/nalog`, { waitUntil: "networkidle" });
    await settle(page, 1200);
    await capture(page, `account-${tag}`);
    await context.close();
  }

  // One frame of the reveal: the lab grid 140 ms after its first card started.
  for (const [tag, device] of [
    ["desktop", DESKTOP],
    ["mobile", MOBILE],
  ]) {
    const { context, page } = await newPage(device, `reveal-${tag}`);
    await page.goto(`${BASE}/styleguide/otkrivanje`, { waitUntil: "networkidle" });
    await settle(page, 1500);
    const running = '[data-testid="reveal-grid"] [data-reveal-state="running"]';
    let caught = false;
    for (let i = 0; i < 400 && !caught; i += 1) {
      await page.mouse.wheel(0, 36);
      await page.waitForTimeout(16);
      caught = (await page.locator(running).count()) > 0;
    }
    if (!caught) problems.push(`reveal-${tag}: the grid never started`);
    await page.waitForTimeout(140);
    await shot(page, `reveal-${tag}`, { owed: false });
    await context.close();
  }
};

try {
  for (const [name, job] of Object.entries(jobs)) {
    if (ONLY.length && !ONLY.includes(name)) continue;
    console.log(`${name}:`);
    try {
      await job();
    } catch (error) {
      problems.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
      console.error(error);
    }
  }
} finally {
  await browser.close();
}
if (problems.length) {
  console.log(`\n${problems.length} problem(s):`);
  for (const p of problems) console.log(`  ${p}`);
  process.exit(1);
}
console.log("\nno console errors");
