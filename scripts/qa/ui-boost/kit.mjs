/**
 * Shared helpers for the UI boost scripts (steps 26–27): the page set, viewports, a context
 * that has answered the cookie banner, sign-in for the three roles and a scroll-through.
 */
import { existsSync, readFileSync } from "node:fs";

import { chromium } from "@playwright/test";

export const PRODUCT = "/deo/kocioni-disk-prednji-312-25-mm-demo-0007";

/** name → { path, as?: "mechanic" | "customer" | "admin", cart?: boolean, firstRow?: string, firstLink?: string } */
export const PAGES = {
  home: { path: "/" },
  category: { path: "/delovi/kocioni-diskovi" },
  parts: { path: "/delovi" },
  product: { path: PRODUCT },
  search: { path: "/pretraga?q=disk" },
  "search-empty": { path: "/pretraga?q=zzzz-nema" },
  cart: { path: "/korpa", cart: true },
  checkout: { path: "/porudzbina", cart: true },
  inquiry: { path: "/upit" },
  mechanics: { path: "/za-majstore" },
  "mechanics-register": { path: "/za-majstore/registracija" },
  vehicles: { path: "/vozila" },
  "vehicle-generation": { path: "/vozila/volkswagen/golf/golf-7" },
  contact: { path: "/kontakt" },
  delivery: { path: "/dostava-i-placanje" },
  styleguide: { path: "/styleguide" },
  "reveal-lab": { path: "/styleguide/otkrivanje" },
  signin: { path: "/prijava" },
  portal: { path: "/majstor", as: "mechanic" },
  "portal-quick": { path: "/majstor/brza-porudzbina", as: "mechanic" },
  "portal-orders": { path: "/majstor/porudzbine", as: "mechanic" },
  "portal-pricelist": { path: "/majstor/cenovnik", as: "mechanic" },
  account: { path: "/nalog", as: "customer" },
  "account-orders": { path: "/nalog/porudzbine", as: "customer" },
  admin: { path: "/admin", as: "admin" },
  "admin-orders": { path: "/admin/porudzbine", as: "admin" },
  "admin-order": { path: "/admin/porudzbine", as: "admin", firstRow: "/admin/porudzbine/" },
  "admin-inquiries": { path: "/admin/upiti", as: "admin" },
  "admin-products": { path: "/admin/proizvodi", as: "admin" },
  "admin-product": { path: "/admin/proizvodi", as: "admin", firstRow: "/admin/proizvodi/" },
  "admin-import": { path: "/admin/uvoz", as: "admin" },
  "admin-mechanics": { path: "/admin/majstori", as: "admin" },
  "admin-settings": { path: "/admin/podesavanja", as: "admin" },
  // Step 27: the rest of the templates.
  "parts-system": { path: "/delovi/kocnice" },
  "category-empty": { path: "/delovi/kocioni-diskovi?cena=900000-999999" },
  "category-filtered": {
    path: "/delovi/kocioni-diskovi?dostupnost=na-stanju&proizvodjac=brembo,ate",
  },
  "category-vehicle": {
    path: "/delovi/kocioni-diskovi?marka=volkswagen&model=golf&generacija=golf-7",
  },
  "search-code": { path: "/pretraga?q=1K0615301AA" },
  "vehicle-brand": { path: "/vozila/volkswagen" },
  "vehicle-model": { path: "/vozila/volkswagen/golf" },
  about: { path: "/o-nama" },
  returns: { path: "/reklamacije-i-povrat" },
  terms: { path: "/uslovi-koriscenja" },
  privacy: { path: "/politika-privatnosti" },
  cookies: { path: "/kolacici" },
  signup: { path: "/registracija" },
  forgot: { path: "/zaboravljena-lozinka" },
  notfound: { path: "/ova-strana-ne-postoji" },
  "portal-order": {
    path: "/majstor/porudzbine",
    as: "mechanic",
    firstLink: "/majstor/porudzbine/",
  },
  "portal-inquiries": { path: "/majstor/upiti", as: "mechanic" },
  "portal-favorites": { path: "/majstor/omiljeno", as: "mechanic" },
  "portal-vehicles": { path: "/majstor/vozila", as: "mechanic" },
  "portal-profile": { path: "/majstor/profil", as: "mechanic" },
  "account-order": { path: "/nalog/porudzbine", as: "customer", firstLink: "/nalog/porudzbine/" },
  "account-inquiries": { path: "/nalog/upiti", as: "customer" },
  "account-vehicles": { path: "/nalog/vozila", as: "customer" },
  "account-profile": { path: "/nalog/profil", as: "customer" },
  "admin-inquiry": { path: "/admin/upiti", as: "admin", firstRow: "/admin/upiti/" },
  "admin-product-new": { path: "/admin/proizvodi/novi", as: "admin" },
  "admin-categories": { path: "/admin/kategorije", as: "admin" },
  "admin-vehicles": { path: "/admin/vozila", as: "admin" },
  "admin-manufacturers": { path: "/admin/proizvodjaci", as: "admin" },
  "admin-stock": { path: "/admin/lager", as: "admin" },
  "admin-customers": { path: "/admin/kupci", as: "admin" },
  "admin-customer": { path: "/admin/kupci", as: "admin", firstRow: "/admin/kupci/" },
  "admin-mechanic": { path: "/admin/majstori", as: "admin", firstRow: "/admin/majstori/" },
  "admin-tiers": { path: "/admin/cenovni-razredi", as: "admin" },
  "admin-users": { path: "/admin/korisnici", as: "admin" },
  "admin-audit": { path: "/admin/revizija", as: "admin" },
  "admin-privacy": { path: "/admin/privatnost", as: "admin" },
  "admin-emails": { path: "/admin/mejlovi", as: "admin" },
  "admin-email-templates": { path: "/admin/mejlovi/sabloni", as: "admin" },
  "admin-searches": { path: "/admin/pretrage", as: "admin" },
  "admin-sources": { path: "/admin/izvori", as: "admin" },
  "admin-notifications": { path: "/admin/obavestenja", as: "admin" },
  "admin-import-history": { path: "/admin/uvoz/istorija", as: "admin" },
  "admin-export": { path: "/admin/izvoz", as: "admin" },
};

export const VIEWPORTS = [
  { tag: "1440", width: 1440, height: 900, mobile: false },
  { tag: "390", width: 390, height: 844, mobile: true },
];

/** Step 28: the widths of the final review (`sheets.mjs --widths=390,768,1440,1920`). */
export const ALL_VIEWPORTS = [
  { tag: "390", width: 390, height: 844, mobile: true },
  { tag: "768", width: 768, height: 1024, mobile: true },
  { tag: "1440", width: 1440, height: 900, mobile: false },
  { tag: "1920", width: 1920, height: 1080, mobile: false },
];

/** One page per main template (`--main`): storefront, portal, account, admin. */
export const MAIN_TEMPLATES = [
  "home",
  "parts",
  "category",
  "product",
  "search",
  "cart",
  "checkout",
  "inquiry",
  "mechanics",
  "vehicle-generation",
  "contact",
  "delivery",
  "signin",
  "notfound",
  "portal",
  "portal-quick",
  "portal-orders",
  "account",
  "admin",
  "admin-orders",
  "admin-order",
  "admin-products",
  "admin-product",
  "admin-settings",
];

export function parseArgs(argv = process.argv.slice(2)) {
  const flag = (name) =>
    argv
      .find((a) => a.startsWith(`--${name}=`))
      ?.split("=")
      .slice(1)
      .join("=");
  return {
    positional: argv.filter((a) => !a.startsWith("--")),
    flag,
    has: (name) => argv.includes(`--${name}`),
    base: flag("base") ?? "http://localhost:3000",
    only: flag("only")?.split(",") ?? (argv.includes("--main") ? MAIN_TEMPLATES : undefined),
  };
}

export async function launch() {
  return chromium.launch({
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  });
}

const accounts = existsSync(".playwright/audit-accounts.json")
  ? JSON.parse(readFileSync(".playwright/audit-accounts.json", "utf8"))
  : null;

/** A context for `viewport` that has already declined the cookie banner. */
export async function newContext(browser, base, viewport, { tag = "visitor", reducedMotion } = {}) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    isMobile: viewport.mobile,
    hasTouch: viewport.mobile,
    locale: "sr-Latn-RS",
    timezoneId: "Europe/Belgrade",
    ...(reducedMotion ? { reducedMotion } : {}),
    userAgent: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36 UiBoost-${tag}/${Date.now()}`,
  });
  await context.addCookies([
    {
      name: "sk_consent",
      value: encodeURIComponent(
        JSON.stringify({ v: 1, analytics: false, ads: false, at: Date.now(), id: "uiboost-0001" }),
      ),
      domain: new URL(base).hostname,
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "Lax",
    },
  ]);
  return context;
}

async function login(page, base, email, password, next) {
  await page.goto(`${base}/prijava?next=${encodeURIComponent(next)}`, { waitUntil: "networkidle" });
  await page.getByTestId("auth-email").fill(email);
  await page.getByTestId("auth-password").fill(password);
  await page.getByTestId("auth-submit").click();
  await page.waitForURL((u) => u.pathname.startsWith(next), { timeout: 90_000 });
}

/** Signs `page` in for `role` (visitor: nothing to do). Throws when credentials are missing. */
export async function signIn(page, base, role) {
  if (role === "visitor") return;
  if (role === "admin") {
    const { SEED_ADMIN_EMAIL: email, SEED_ADMIN_PASSWORD: password } = process.env;
    if (!email || !password) throw new Error("SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set");
    return login(page, base, email, password, "/admin");
  }
  if (!accounts)
    throw new Error(".playwright/audit-accounts.json missing (scripts/qa/audit/accounts.mjs)");
  if (role === "mechanic")
    return login(page, base, accounts.mechanic.email, accounts.mechanic.password, "/majstor");
  return login(page, base, accounts.customer.email, accounts.customer.password, "/nalog");
}

/** Network idle, but never longer than 20 s (pages with a live upload or long poll never idle). */
async function settle(page) {
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
}

/** Opens a page of the set (adds a product to the cart first when it needs one). */
export async function open(page, base, spec, state) {
  if (spec.cart && !state.cartReady) {
    await page.goto(`${base}${PRODUCT}`, { waitUntil: "networkidle", timeout: 120_000 });
    await page.locator("#buy-box").getByTestId("product-add-to-cart").click();
    await page.getByText("Dodato").first().waitFor({ timeout: 30_000 });
    state.cartReady = true;
  }
  await page.goto(`${base}${spec.path}`, { waitUntil: "load", timeout: 120_000 });
  await settle(page);
  if (spec.firstRow) {
    // Admin rows open their record with Enter (DataTable roving focus).
    const row = page.locator("tr[data-row]").first();
    await row.waitFor({ timeout: 30_000 });
    await row.focus();
    await page.keyboard.press("Enter");
    await page.waitForURL(
      (u) => u.pathname.startsWith(spec.firstRow) && u.pathname.length > spec.firstRow.length,
      { timeout: 30_000, waitUntil: "commit" },
    );
    await settle(page);
  }
  if (spec.firstLink) {
    // Storefront lists (portal and account orders) link to their record.
    const link = page.locator(`main a[href^="${spec.firstLink}"]`).first();
    await link.waitFor({ timeout: 30_000 });
    await page.goto(new URL(await link.getAttribute("href"), base).href, {
      waitUntil: "load",
      timeout: 120_000,
    });
    await settle(page);
  }
  await page.waitForTimeout(600);
}

/** Scrolls to the end in 60 % steps and back, so every reveal has run. */
export async function scrollThrough(page) {
  await page.evaluate(async () => {
    const step = window.innerHeight * 0.6;
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 160));
    }
    window.scrollTo(0, document.documentElement.scrollHeight);
    await new Promise((r) => setTimeout(r, 1100));
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 800));
  });
}

/** Full-page captures must not skip `content-visibility: auto` sections. */
export async function renderEverything(page) {
  await page.addStyleTag({ content: "*{content-visibility:visible!important}" });
  await page.waitForTimeout(200);
}

/** Runs `visit(page, name, spec, viewport)` for every selected page, grouped by role. */
export async function forEachPage(
  browser,
  { base, only, viewports = VIEWPORTS, reducedMotion },
  visit,
) {
  const names = Object.keys(PAGES).filter((n) => !only || only.includes(n));
  const roles = [...new Set(names.map((n) => PAGES[n].as ?? "visitor"))];
  for (const viewport of viewports) {
    for (const role of roles) {
      const context = await newContext(browser, base, viewport, { tag: role, reducedMotion });
      const page = await context.newPage();
      try {
        await signIn(page, base, role);
      } catch (error) {
        console.log(`${role}@${viewport.tag}: sign-in failed — ${String(error).slice(0, 160)}`);
        await context.close();
        continue;
      }
      const state = { cartReady: false };
      for (const name of names.filter((n) => (PAGES[n].as ?? "visitor") === role)) {
        try {
          await open(page, base, PAGES[name], state);
          await visit(page, name, PAGES[name], viewport);
        } catch (error) {
          console.log(`${name}@${viewport.tag}: FAILED — ${String(error).slice(0, 200)}`);
        }
      }
      await context.close();
    }
  }
}
