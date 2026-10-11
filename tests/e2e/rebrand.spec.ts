/**
 * Step 25 — the rebrand, checked on the production build.
 *
 * Crawls the main routes and the machine-readable files and asserts that
 * - nothing a visitor, a crawler or a preview card can read carries the working name „SKLOP“
 *   (server HTML including the hydration payload, rendered text, accessible names, metadata,
 *   manifest, robots, sitemaps, feeds);
 * - `og:site_name` and `application-name` are „Euromotors Plus“, titles end with both names
 *   where they fit and stay within 60 characters;
 * - the favicon, SVG icon, Apple icon and manifest icons that pages link are the logo kit's
 *   files, and the OG frame carries the new mark;
 * - JSON-LD names the business „Euromotors Plus“ with „OEM Parts“ as `alternateName`, while a
 *   part's brand stays its maker.
 *
 * The name is matched as a word: „Rasklopi“, „Sklopi“ and „Sklopljeno“ are Serbian verbs of the
 * 3D hero, not the brand.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import {
  BRAND_ALTERNATE_NAME,
  BRAND_LOCKUP_NAME,
  BRAND_NAME,
  BRAND_SHORT_NAME,
  DEFAULT_TITLE_SUFFIX,
} from "../../lib/domain/brand";
import { extractJsonLd } from "../../lib/seo/jsonld";
import { TEST_IDS } from "../../constants/testIds";

type Node = Record<string, unknown>;

const OLD_NAME = /\bsklop\b/i;
const SHORT_SUFFIX = ` | ${BRAND_NAME}`;
const kit = (name: string) => readFileSync(path.resolve("public/brand", name));

/** Routes every visitor can reach without an account; the dynamic ones are added from sitemaps. */
const ROUTES = [
  "/",
  "/delovi",
  "/delovi/kocioni-diskovi",
  "/vozila",
  "/vozila/volkswagen",
  "/pretraga?q=disk",
  "/upit",
  "/za-majstore",
  "/za-majstore/registracija",
  "/korpa",
  "/porudzbina",
  "/prijava",
  "/registracija",
  "/zaboravljena-lozinka",
  "/kontakt",
  "/o-nama",
  "/dostava-i-placanje",
  "/reklamacije-i-povrat",
  "/uslovi-koriscenja",
  "/politika-privatnosti",
  "/kolacici",
  "/ponuda/kocione-plocice-golf",
];
const MISSING = "/ova-stranica-ne-postoji-25";

const decode = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
const first = (source: string, re: RegExp) => {
  const m = re.exec(source);
  return m ? decode(m[1]!) : null;
};
const locs = (xml: string) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!);
const pathOf = (url: string) => {
  const u = new URL(url);
  return `${u.pathname}${u.search}`;
};

/** The words around a match, so a failure says where the old name still is. */
function oldNameIn(source: string): string | null {
  const m = OLD_NAME.exec(source);
  return m ? source.slice(Math.max(0, m.index - 80), m.index + 80).replace(/\s+/g, " ") : null;
}

async function get(request: APIRequestContext, url: string, status = 200): Promise<string> {
  const res = await request.get(url);
  expect(res.status(), url).toBe(status);
  return await res.text();
}

/** One product, one category × vehicle landing and one model page, taken from the sitemaps. */
async function dynamicRoutes(request: APIRequestContext): Promise<string[]> {
  const product = locs(await get(request, "/sitemaps/proizvodi-1.xml"))[0];
  const landing = locs(await get(request, "/sitemaps/landing.xml"))[0];
  const model = locs(await get(request, "/sitemaps/vozila.xml")).find(
    (u) => pathOf(u).split("/").length >= 4,
  );
  return [product, landing, model].filter((u): u is string => Boolean(u)).map(pathOf);
}

/**
 * The stored settings row (name, title suffix) is cached for 15 minutes and the cache outlives a
 * build: purge it, so the crawl reads what the database holds now and not what an earlier build
 * cached. In production Convex's dispatcher does the same after `settings.changed`.
 */
test.beforeAll(async ({ request }) => {
  await request.post("/api/revalidate", {
    headers: { "x-revalidate-secret": process.env.REVALIDATE_SECRET ?? "e2e-revalidate-secret" },
    data: { tags: ["settings"] },
  });
  // Without a matching secret the purge is refused; a stale entry is then refreshed in the
  // background by the first request that reads it, so ask twice and give it a moment.
  for (let i = 0; i < 2; i++) {
    await request.get("/prijava");
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
});

test.describe("server HTML of the main routes", () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, "HTTP-level checks run once");

  test("no old name, the new site name, both names in titles that have room, new icons linked", async ({
    request,
  }) => {
    test.setTimeout(240_000);
    const routes = [...ROUTES, ...(await dynamicRoutes(request))];
    expect(routes.length).toBeGreaterThanOrEqual(ROUTES.length + 2);
    const titles: Record<string, string> = {};
    for (const url of [...routes, MISSING]) {
      const h = await get(request, url, url === MISSING ? 404 : 200);
      expect(oldNameIn(h), `${url}: old name in the HTML`).toBeNull();

      const title = first(h, /<title>([^<]*)<\/title>/);
      expect(title, `${url}: title`).toBeTruthy();
      titles[url] = title!;
      expect(title!.length, `${url}: „${title}“`).toBeLessThanOrEqual(60);
      // Brand in the title wherever the page's own words leave room for it.
      const bare = title!.replace(DEFAULT_TITLE_SUFFIX, "").replace(SHORT_SUFFIX, "");
      if (bare.length + SHORT_SUFFIX.length <= 60) {
        expect(title, url).toContain(SHORT_SUFFIX);
      }
      if (bare.length + DEFAULT_TITLE_SUFFIX.length <= 60) {
        expect(title!.endsWith(DEFAULT_TITLE_SUFFIX), `${url}: „${title}“`).toBe(true);
      }

      expect(first(h, /<meta name="application-name" content="([^"]*)"/), url).toBe(BRAND_NAME);
      expect(
        first(h, /<meta property="og:site_name" content="([^"]*)"/),
        `${url}: og:site_name`,
      ).toBe(BRAND_NAME);
      const ogTitle = first(h, /<meta property="og:title" content="([^"]*)"/);
      if (ogTitle) expect(ogTitle, `${url}: og:title`).toBe(title);

      expect(h, `${url}: favicon`).toMatch(
        /<link rel="icon" href="\/favicon\.ico\?[^"]*" sizes="48x48" type="image\/x-icon"/,
      );
      expect(h, `${url}: SVG icon`).toMatch(
        /<link rel="icon" href="\/icon\.svg\?[^"]*" sizes="any" type="image\/svg\+xml"/,
      );
      expect(h, `${url}: Apple icon`).toMatch(
        /<link rel="apple-touch-icon" href="\/apple-icon\.png\?[^"]*" sizes="180x180"/,
      );
      expect(h, `${url}: manifest`).toContain('<link rel="manifest" href="/manifest.webmanifest"');
      expect(h, `${url}: old icon folder`).not.toContain("/icons/");
    }
    // Short titles carry both names; the home title was chosen so that they fit (D309).
    expect(titles["/"]).toBe(`Auto delovi VW, Audi, Škoda${DEFAULT_TITLE_SUFFIX}`);
    expect(titles["/prijava"]).toBe(`Prijava${DEFAULT_TITLE_SUFFIX}`);
    expect(titles[MISSING]).toBe(`Stranica nije pronađena${DEFAULT_TITLE_SUFFIX}`);
    expect(Object.values(titles).filter((t) => t.endsWith(DEFAULT_TITLE_SUFFIX)).length).toBeGreaterThan(
      10,
    );
  });

  test("the linked icons and the manifest are the logo kit's files", async ({ request }) => {
    const h = await get(request, "/");
    const href = (re: RegExp) => first(h, re)!;
    const favicon = await request.get(href(/<link rel="icon" href="(\/favicon\.ico[^"]*)"/));
    expect(favicon.status()).toBe(200);
    expect((await favicon.body()).equals(kit("favicon.ico"))).toBe(true);
    // Also at the bare address browsers request on their own.
    expect((await (await request.get("/favicon.ico")).body()).equals(kit("favicon.ico"))).toBe(true);

    const apple = await request.get(href(/<link rel="apple-touch-icon" href="([^"]*)"/));
    expect(apple.headers()["content-type"]).toContain("image/png");
    expect((await apple.body()).equals(kit("apple-touch-icon.png"))).toBe(true);

    const svg = await get(request, href(/<link rel="icon" href="(\/icon\.svg[^"]*)"/));
    expect(svg).toContain("<title>Euromotors Plus</title>");
    // The bracket of the 16 px mark — and nothing of the retired „izvučen deo“.
    expect(svg).toContain('class="h16"');
    expect(svg).not.toContain("M3 14h4v2.5h10V14h4v7H3z");
    expect(svg).toContain("#FF6B1A");

    const manifest = JSON.parse(await get(request, "/manifest.webmanifest")) as {
      name: string;
      short_name: string;
      theme_color: string;
      background_color: string;
      icons: { src: string; sizes: string; purpose: string }[];
    };
    expect(manifest).toMatchObject({
      name: BRAND_LOCKUP_NAME,
      short_name: BRAND_SHORT_NAME,
      theme_color: "#0D0F11",
      background_color: "#0D0F11",
    });
    expect(manifest.icons).toHaveLength(4);
    for (const icon of manifest.icons) {
      const res = await request.get(icon.src);
      expect(res.status(), icon.src).toBe(200);
      expect((await res.body()).equals(kit(path.basename(icon.src))), icon.src).toBe(true);
    }
    // The retired icons are gone, not just unlinked.
    expect((await request.get("/icons/icon-192.png")).status()).toBe(404);
  });

  test("JSON-LD: Euromotors Plus with OEM Parts as the alternate name; a part keeps its maker", async ({
    request,
  }) => {
    const home = extractJsonLd(await get(request, "/")) as Node[];
    const site = home.find((n) => n["@type"] === "WebSite")!;
    expect(site).toMatchObject({ name: BRAND_NAME, alternateName: BRAND_ALTERNATE_NAME });
    const business = home.find((n) => n["@type"] === "Organization" || n["@type"] === "AutoPartsStore")!;
    expect(business).toMatchObject({ name: BRAND_NAME, alternateName: BRAND_ALTERNATE_NAME });
    const logo = String(business.logo);
    expect(pathOf(logo)).toBe("/brand/icon-512.png");
    const logoRes = await request.get(pathOf(logo));
    expect(logoRes.headers()["content-type"]).toContain("image/png");
    expect((await logoRes.body()).equals(kit("icon-512.png"))).toBe(true);

    const [productUrl] = await dynamicRoutes(request);
    const product = (extractJsonLd(await get(request, productUrl!)) as Node[]).find(
      (n) => n["@type"] === "Product",
    ) as Node & { brand: { name: string }; offers?: { seller?: { name: string } } };
    expect(product.brand.name).toBeTruthy();
    expect([BRAND_NAME, BRAND_ALTERNATE_NAME, BRAND_LOCKUP_NAME]).not.toContain(product.brand.name);
    if (product.offers?.seller) expect(product.offers.seller.name).toBe(BRAND_NAME);
    expect(oldNameIn(JSON.stringify([home, product]))).toBeNull();
  });

  test("robots, sitemaps, manifest and feeds: no old name; our name only as the store", async ({
    request,
  }) => {
    for (const url of [
      "/robots.txt",
      "/sitemap.xml",
      "/sitemaps/staticne.xml",
      "/sitemaps/kategorije.xml",
      "/manifest.webmanifest",
      "/feeds/meta-catalog.csv?demo=1",
    ]) {
      expect(oldNameIn(await get(request, url)), url).toBeNull();
    }
    const xml = await get(request, "/feeds/google-merchant.xml?demo=1");
    expect(oldNameIn(xml)).toBeNull();
    expect(first(xml, /<channel>\s*<title>([^<]*)<\/title>/)).toBe(BRAND_NAME);
    const brands = [...xml.matchAll(/<g:brand>([^<]*)<\/g:brand>/g)].map((m) => decode(m[1]!));
    expect(brands.length).toBeGreaterThan(0);
    // A part's brand is its maker (Brembo, Bosch …), never the shop.
    for (const brand of new Set(brands)) {
      expect([BRAND_NAME, BRAND_ALTERNATE_NAME, BRAND_LOCKUP_NAME]).not.toContain(brand);
    }
  });

  test("OG image: 1200 × 630 with the new mark in the frame", async ({ page, request }) => {
    const h = await get(request, "/");
    const og = first(h, /<meta property="og:image" content="([^"]*)"/)!;
    expect(first(h, /<meta property="og:image:alt" content="([^"]*)"/)).toContain(BRAND_NAME);
    await page.goto("/robots.txt");
    const probe = await page.evaluate(async (src) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const at = (x: number, y: number) => [...ctx.getImageData(x, y, 1, 1).data.slice(0, 3)];
      return {
        width: img.naturalWidth,
        height: img.naturalHeight,
        // Centre of the plus, the spine of the bracket, the ground left of the logo.
        plus: at(95, 90),
        spine: at(76, 90),
        ground: at(60, 90),
      };
    }, pathOf(og));
    expect(probe.width).toBe(1200);
    expect(probe.height).toBe(630);
    expect(probe.plus).toEqual([255, 107, 26]);
    expect(probe.spine).toEqual([241, 236, 227]);
    expect(probe.ground).toEqual([13, 15, 17]);
  });
});

/** Text a visitor can read or hear: visible text, accessible names, tooltips, placeholders. */
async function readableText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const attrs = ["aria-label", "alt", "title", "placeholder", "aria-description", "value"];
    const out = [document.title, document.body.innerText];
    for (const el of document.querySelectorAll("*")) {
      for (const a of attrs) {
        const v = el.getAttribute(a);
        if (v) out.push(v);
      }
      if (el instanceof SVGElement && el.tagName.toLowerCase() === "title") out.push(el.textContent ?? "");
    }
    for (const m of document.querySelectorAll("meta[content]")) out.push(m.getAttribute("content")!);
    return out.join("\n");
  });
}

test.describe("rendered pages", () => {
  test("header and footer logos: named, visible, never under their minimum size", async ({ page }) => {
    await page.goto("/delovi");
    const header = page.getByTestId(TEST_IDS.header);
    const home = header.getByRole("link", { name: `${BRAND_NAME} — početna`, exact: true });
    await expect(home).toBeVisible();
    await expect(home).toHaveAttribute("href", "/");
    const art = await home.evaluate((link) => {
      const shown = [...link.querySelectorAll("svg")].filter((s) => s.getBoundingClientRect().width > 0);
      const r = shown[0]!.getBoundingClientRect();
      return { count: shown.length, w: r.width, h: r.height, ink: getComputedStyle(shown[0]!).color };
    });
    expect(art.count, "exactly one form of the logo is shown").toBe(1);
    const lockup = art.w / art.h > 4;
    // Lockup from 640 px (≥ 28 px tall), the compact mark below (≥ 16 px).
    expect(lockup).toBe((page.viewportSize()?.width ?? 0) >= 640);
    expect(art.h).toBeGreaterThanOrEqual(lockup ? 28 : 16);
    expect(art.ink).toBe("rgb(241, 236, 227)");
    // The target stays at least 44 × 44 px.
    const target = (await home.boundingBox())!;
    expect(Math.min(target.width, target.height)).toBeGreaterThanOrEqual(44);

    const footer = page.getByTestId(TEST_IDS.footer);
    await footer.scrollIntoViewIfNeeded();
    const footerLink = footer.getByRole("link", {
      name: `${BRAND_LOCKUP_NAME} — početna`,
      exact: true,
    });
    await expect(footerLink).toBeVisible();
    const signed = await footerLink.evaluate((link) => {
      const shown = [...link.querySelectorAll("svg")].filter((s) => s.getBoundingClientRect().height > 1);
      const r = shown[0]!.getBoundingClientRect();
      const plus = shown[0]!.querySelector("use")!;
      return {
        count: shown.length,
        w: r.width,
        h: r.height,
        // The referenced outlines really paint: the mark occupies its place in the artwork.
        markWidth: plus.getBoundingClientRect().width,
      };
    });
    expect(signed.count).toBe(1);
    const stacked = signed.w / signed.h < 4;
    expect(stacked).toBe((page.viewportSize()?.width ?? 0) < 480);
    // 56 px for the horizontal form; the stacked form fills the column (343 px wide = 120 px).
    if (stacked) expect(signed.w).toBeGreaterThanOrEqual(328);
    else expect(signed.h).toBeGreaterThanOrEqual(56);
    expect(signed.markWidth).toBeGreaterThan(20);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
      true,
    );
  });

  test("no old name in anything a visitor reads or hears", async ({ page, request }) => {
    test.setTimeout(240_000);
    const [product] = await dynamicRoutes(request);
    const routes = ["/", "/delovi/kocioni-diskovi", product!, "/upit", "/kontakt", "/o-nama", "/prijava", MISSING];
    for (const url of routes) {
      await page.goto(url);
      await page.getByTestId(TEST_IDS.footer).or(page.locator("main")).first().waitFor();
      // Let streamed sections and client islands arrive.
      await page.waitForLoadState("networkidle");
      expect(oldNameIn(await readableText(page)), `${url}: old name on the page`).toBeNull();
      await expect(page.locator(`meta[property="og:site_name"], meta[name="application-name"]`).first()).toHaveAttribute(
        "content",
        BRAND_NAME,
      );
    }
  });

  test("status pages outside the shop layout show the logo", async ({ page }) => {
    await page.goto(MISSING);
    await expect(page.getByRole("link", { name: `${BRAND_NAME} — početna`, exact: true }).first()).toBeVisible();
    await expect(page).toHaveTitle(`Stranica nije pronađena${DEFAULT_TITLE_SUFFIX}`);
  });
});

test.describe("admin shell", () => {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  test.skip(!email || !password, "SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD are not set");

  test("the sidebar carries the logo: lockup when wide, mark on the rail, in the drawer on phones", async ({
    page,
  }) => {
    await page.goto(`/prijava?next=${encodeURIComponent("/admin")}`);
    await page.getByTestId(TEST_IDS.authEmail).fill(email!);
    await page.getByTestId(TEST_IDS.authPassword).fill(password!);
    await page.getByTestId(TEST_IDS.authSubmit).click();
    await expect(page).toHaveURL(/\/admin$/, { timeout: 60_000 });
    await expect(page.getByRole("heading", { level: 1, name: "Pregled" })).toBeVisible({
      timeout: 30_000,
    });
    const wide = (page.viewportSize()?.width ?? 0) >= 1366;
    if (!wide) {
      // Below 1024 px the navigation is a drawer; its head carries the same lockup.
      await page.getByRole("button", { name: /Meni|navigacij/i }).first().click();
    }
    // The desktop sidebar and the drawer both hold this link; only one of them is on screen.
    const link = page
      .getByRole("link", { name: `${BRAND_NAME} — pregled administracije`, exact: true })
      .filter({ visible: true });
    await expect(link).toHaveCount(1);
    const art = await link.evaluate((el) => {
      const s = [...el.querySelectorAll("svg")].find((x) => x.getBoundingClientRect().width > 0)!;
      const r = s.getBoundingClientRect();
      return { w: r.width, h: r.height, ink: getComputedStyle(s).color };
    });
    expect(art.h).toBeGreaterThanOrEqual(28);
    expect(art.w / art.h).toBeGreaterThan(8);
    // The sidebar pins the night theme inside the paper workspace.
    expect(art.ink).toBe("rgb(241, 236, 227)");
    expect(await page.title()).not.toMatch(OLD_NAME);
  });
});
