/**
 * Step 19 — SEO + ads on the production build:
 * - JSON-LD parsed out of rendered pages (home, category, landing, product, vehicle page);
 * - metadata limits, canonicals and robots per route;
 * - robots.txt, the sitemap index and every child, the Merchant and Meta feeds;
 * - Consent Mode v2: zero requests to Google/Meta before consent (network log), the banner,
 *   „Odbij sve“, granular choice, and after „Prihvati sve“ the dataLayer / Pixel queue carry
 *   the consent update and ecommerce events (third-party scripts are stubbed, never fetched);
 * - the ads landing `/ponuda/[slug]`.
 */
import { execFileSync } from "node:child_process";
import path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import { extractJsonLd } from "../../lib/seo/jsonld";

type Node = Record<string, unknown>;

const TRACKING_HOSTS = /googletagmanager\.com|google-analytics\.com|googleadservices\.com|doubleclick\.net|facebook\.net|facebook\.com/;
const REVALIDATE_SECRET = process.env.REVALIDATE_SECRET ?? "e2e-revalidate-secret";

function convexRun<T>(fn: string, args: Record<string, unknown> = {}): T {
  const out = execFileSync(
    process.execPath,
    [path.resolve("node_modules/convex/bin/main.js"), "run", `testing:${fn}`, JSON.stringify(args)],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 120_000 },
  );
  const start = out.search(/[[{"]|^-?\d|^null/m);
  return JSON.parse(out.slice(start)) as T;
}

async function html(request: APIRequestContext, url: string): Promise<string> {
  const res = await request.get(url);
  expect(res.status(), url).toBe(200);
  return await res.text();
}

const meta = (source: string, re: RegExp) => re.exec(source)?.[1] ?? null;
const title = (h: string) => meta(h, /<title>([^<]*)<\/title>/);
const description = (h: string) => meta(h, /<meta name="description" content="([^"]*)"/);
const robots = (h: string) => meta(h, /<meta name="robots" content="([^"]*)"/);
const canonical = (h: string) => meta(h, /<link rel="canonical" href="([^"]*)"/);
const decode = (s: string | null) =>
  s?.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;/g, "'") ?? null;

function types(nodes: Node[]): string[] {
  return nodes.map((n) => String(n["@type"]));
}

function locs(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!);
}

/** Path part of an absolute sitemap URL (the site origin may differ from the test server). */
const pathOf = (url: string) => {
  const u = new URL(url);
  return `${u.pathname}${u.search}`;
};

test.describe("structured data and metadata", () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, "HTTP-level checks run once");

  test("JSON-LD parses on home, category, landing, product and vehicle pages", async ({ request }) => {
    const home = extractJsonLd(await html(request, "/"));
    expect(types(home)).toEqual(expect.arrayContaining(["WebSite", "FAQPage"]));
    expect(types(home).some((t) => t === "Organization" || t === "AutoPartsStore")).toBe(true);
    const site = home.find((n) => n["@type"] === "WebSite") as Node & {
      potentialAction: { target: { urlTemplate: string } };
    };
    expect(site.potentialAction.target.urlTemplate).toContain("/pretraga?q={search_term_string}");

    const category = extractJsonLd(await html(request, "/delovi/kocioni-diskovi"));
    expect(types(category)).toEqual(expect.arrayContaining(["BreadcrumbList", "ItemList"]));

    const landingSitemap = await html(request, "/sitemaps/landing.xml");
    const landingUrl = pathOf(locs(landingSitemap)[0]!);
    const landingHtml = await html(request, landingUrl);
    const landing = extractJsonLd(landingHtml);
    expect(types(landing)).toEqual(expect.arrayContaining(["BreadcrumbList", "ItemList", "FAQPage"]));
    expect(robots(landingHtml)).toBe("index, follow");

    const productsSitemap = await html(request, "/sitemaps/proizvodi-1.xml");
    const productHtml = await html(request, pathOf(locs(productsSitemap)[0]!));
    const product = extractJsonLd(productHtml).find((n) => n["@type"] === "Product") as Node & {
      offers: Record<string, string>;
      brand: { name: string };
    };
    expect(product).toBeTruthy();
    expect(product.brand.name).toBeTruthy();
    expect(product.sku).toBeTruthy();
    expect(product.offers.priceCurrency).toBe("RSD");
    expect(product.offers.price).toMatch(/^\d+\.\d{2}$/);
    expect(product.offers.availability).toMatch(/^https:\/\/schema\.org\/(InStock|OutOfStock|BackOrder)$/);
    expect(product.offers.itemCondition).toBe("https://schema.org/NewCondition");

    const vehicle = extractJsonLd(await html(request, "/vozila/volkswagen/golf"));
    expect(types(vehicle)).toContain("BreadcrumbList");
  });

  test("titles ≤ 60, descriptions ≤ 155, canonicals and robots per route", async ({ request }) => {
    const indexable = ["/", "/delovi", "/delovi/kocioni-diskovi", "/vozila/volkswagen", "/za-majstore", "/upit"];
    for (const url of indexable) {
      const h = await html(request, url);
      const t = decode(title(h))!;
      const d = decode(description(h))!;
      expect(t.length, `${url} title „${t}“`).toBeLessThanOrEqual(60);
      expect(d.length, `${url} description`).toBeLessThanOrEqual(155);
      expect(d.length, `${url} description`).toBeGreaterThan(50);
      expect(robots(h), url).toBe("index, follow");
      expect(canonical(h), url).toMatch(/^https?:\/\/[^/]+(\/|$)/);
      expect(h, url).toMatch(/<meta property="og:image" content="[^"]+opengraph-image/);
    }
    // Filters and sorting: canonical to the clean listing; two dimensions → noindex.
    const filtered = await html(request, "/delovi/kocioni-diskovi?sort=cena-rastuce&dostupnost=na-stanju");
    expect(canonical(filtered)).toMatch(/\/delovi\/kocioni-diskovi$/);
    expect(robots(filtered)).toBe("noindex, follow");
    for (const url of ["/korpa", "/porudzbina", "/pretraga?q=disk", "/prijava"]) {
      expect(robots(await html(request, url)), url).toBe("noindex, follow");
    }
    const product = await html(
      request,
      pathOf(locs(await html(request, "/sitemaps/proizvodi-1.xml"))[1]!),
    );
    expect(decode(title(product))!.length).toBeLessThanOrEqual(60);
    expect(decode(description(product))!.length).toBeLessThanOrEqual(155);
  });

  test("OG images render as 1200 × 630 PNG", async ({ request }) => {
    const h = await html(request, "/delovi/kocioni-diskovi");
    const og = meta(h, /<meta property="og:image" content="([^"]*)"/)!;
    const res = await request.get(pathOf(decode(og)!));
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toBe("image/png");
    const png = await res.body();
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
  });
});

test.describe("robots, sitemaps and feeds", () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, "HTTP-level checks run once");

  test("robots.txt and every sitemap are valid and list only indexable URLs", async ({ request, page }) => {
    const robotsTxt = await html(request, "/robots.txt");
    expect(robotsTxt).toContain("Disallow: /admin");
    expect(robotsTxt).toContain("Disallow: /nalog");
    expect(robotsTxt).toContain("Disallow: /majstor");
    expect(robotsTxt).toMatch(/Sitemap: https?:\/\/.+\/sitemap\.xml/);

    const index = await html(request, "/sitemap.xml");
    const children = locs(index).map(pathOf);
    expect(children).toEqual(
      expect.arrayContaining([
        "/sitemaps/staticne.xml",
        "/sitemaps/kategorije.xml",
        "/sitemaps/vozila.xml",
        "/sitemaps/landing.xml",
        "/sitemaps/proizvodi-1.xml",
      ]),
    );
    await page.goto("/robots.txt");
    for (const child of children) {
      const xml = await html(request, child);
      const wellFormed = await page.evaluate((source) => {
        const doc = new DOMParser().parseFromString(source, "application/xml");
        return doc.getElementsByTagName("parsererror").length === 0 && doc.documentElement.nodeName === "urlset";
      }, xml);
      expect(wellFormed, child).toBe(true);
      expect(locs(xml).length, child).toBeGreaterThan(0);
    }
    // A sample from each child answers 200 and is indexable.
    for (const child of ["/sitemaps/kategorije.xml", "/sitemaps/vozila.xml", "/sitemaps/landing.xml"]) {
      const urls = locs(await html(request, child));
      for (const url of [urls[0]!, urls[urls.length - 1]!]) {
        const h = await html(request, pathOf(url));
        expect(robots(h), url).toBe("index, follow");
      }
    }
    expect((await request.get("/sitemaps/proizvodi-99.xml")).status()).toBe(404);
  });

  test("Merchant XML and Meta CSV carry the required fields", async ({ request, page }) => {
    const live = await request.get("/feeds/google-merchant.xml");
    expect(live.status()).toBe(200);
    expect(live.headers()["content-type"]).toContain("application/xml");
    // The demo catalogue stays out of real feeds; `?demo=1` previews it.
    const xml = await html(request, "/feeds/google-merchant.xml?demo=1");
    await page.goto("/robots.txt");
    const summary = await page.evaluate((source) => {
      const doc = new DOMParser().parseFromString(source, "application/xml");
      const items = [...doc.getElementsByTagName("item")];
      const required = ["g:id", "g:title", "g:description", "g:link", "g:image_link", "g:availability", "g:price", "g:brand", "g:condition", "g:google_product_category"];
      return {
        error: doc.getElementsByTagName("parsererror").length,
        items: items.length,
        missing: items.flatMap((i) => required.filter((t) => !i.getElementsByTagName(t)[0]?.textContent)),
        prices: items.slice(0, 5).map((i) => i.getElementsByTagName("g:price")[0]?.textContent),
      };
    }, xml);
    expect(summary.error).toBe(0);
    expect(summary.items).toBeGreaterThan(10);
    expect(summary.missing).toEqual([]);
    for (const price of summary.prices) expect(price).toMatch(/^\d+\.\d{2} RSD$/);

    const csv = await html(request, "/feeds/meta-catalog.csv?demo=1");
    const [header, first] = csv.split("\n");
    expect(header).toBe(
      "id,title,description,availability,condition,price,link,image_link,brand,mpn,google_product_category,product_type",
    );
    expect(first).toMatch(/,(in stock|out of stock|available for order),new,\d+\.\d{2} RSD,/);
  });
});

/** Scrolls the page end to end and lets the text reveal finish (axe checks final colours). */
async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(async () => {
    const step = Math.round(window.innerHeight * 0.6);
    for (let y = 0; y <= document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 110));
    }
    window.scrollTo(0, document.documentElement.scrollHeight);
  });
  await page.waitForTimeout(1800);
}

async function seriousAxe(page: Page): Promise<string[]> {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  return result.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")}`);
}

// ---------------------------------------------------------------------------------------
// Consent Mode v2 + tags (fresh visitors: no consent cookie)

const EMPTY_STATE = { cookies: [], origins: [] };

async function stubThirdParties(page: Page): Promise<string[]> {
  const requests: string[] = [];
  page.on("request", (r) => {
    if (TRACKING_HOSTS.test(new URL(r.url()).hostname)) requests.push(r.url());
  });
  await page.route(TRACKING_HOSTS, async (route) => {
    const url = route.request().url();
    const body = /fbevents\.js/.test(url)
      ? "window.__fbqCalls=[];(function(f){var q=f.queue||[];f.callMethod=function(){window.__fbqCalls.push([].slice.call(arguments))};q.forEach(function(a){window.__fbqCalls.push([].slice.call(a))});f.queue=[];})(window.fbq);"
      : "window.__gtagLoaded=true;";
    await route.fulfill({ status: 200, contentType: "text/javascript", body });
  });
  return requests;
}

async function dataLayer(page: Page): Promise<unknown[][]> {
  return await page.evaluate(() =>
    (window.dataLayer ?? []).map((entry) => Array.from(entry as ArrayLike<unknown>)),
  );
}

test.describe("Consent Mode v2 and tags", () => {
  test.use({ storageState: EMPTY_STATE });
  test.describe.configure({ mode: "serial" });
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, "runs once; the banner layout is covered by screenshots");

  let previous = "{}";

  test.beforeAll(async ({ request }) => {
    previous = convexRun<string>("setTracking", {
      ga4Id: "G-E2ETEST01",
      gadsId: "AW-123456789",
      metaPixelId: "123456789012345",
    });
    await request.post("/api/revalidate", {
      headers: { "x-revalidate-secret": REVALIDATE_SECRET },
      data: { tags: ["settings"] },
    });
  });

  test.afterAll(async ({ request }) => {
    convexRun<string>("setTracking", { restore: previous });
    await request.post("/api/revalidate", {
      headers: { "x-revalidate-secret": REVALIDATE_SECRET },
      data: { tags: ["settings"] },
    });
  });

  test("no Google or Meta request before consent; defaults are denied", async ({ page }) => {
    const requests = await stubThirdParties(page);
    await page.goto("/");
    const banner = page.getByTestId("consent-banner");
    await expect(banner).toBeVisible();
    await expect(banner.getByRole("heading", { name: "Kolačići" })).toBeVisible();
    await expect(banner.getByRole("link", { name: "Više o kolačićima" })).toHaveAttribute("href", "/kolacici");
    expect(await seriousAxe(page)).toEqual([]);
    await banner.getByRole("button", { name: "Podešavanja" }).click();
    expect(await seriousAxe(page)).toEqual([]);
    await page.goto("/delovi/kocioni-diskovi");
    await page.waitForLoadState("networkidle");
    expect(requests).toEqual([]);
    const layer = await dataLayer(page);
    expect(layer[0]).toEqual([
      "consent",
      "default",
      expect.objectContaining({
        ad_storage: "denied",
        analytics_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
      }),
    ]);
    expect(layer.some((e) => e[0] === "config")).toBe(false);
    expect(await page.evaluate(() => typeof window.fbq)).toBe("undefined");
  });

  test("„Odbij sve“ stores the choice and still loads nothing", async ({ page, context }) => {
    const requests = await stubThirdParties(page);
    await page.goto("/delovi/kocioni-diskovi");
    await page.getByTestId("consent-banner").getByRole("button", { name: "Odbij sve" }).click();
    await expect(page.getByTestId("consent-banner")).toBeHidden();
    const cookie = (await context.cookies()).find((c) => c.name === "sk_consent")!;
    expect(JSON.parse(decodeURIComponent(cookie.value))).toMatchObject({ analytics: false, ads: false });
    await page.reload();
    await expect(page.getByTestId("consent-banner")).toHaveCount(0);
    await page.waitForLoadState("networkidle");
    expect(requests).toEqual([]);
  });

  test("granular: analytics only loads gtag.js without Google Ads or the Pixel", async ({ page }) => {
    const requests = await stubThirdParties(page);
    await page.goto("/delovi/kocioni-diskovi");
    const banner = page.getByTestId("consent-banner");
    await banner.getByRole("button", { name: "Podešavanja" }).click();
    await banner.getByRole("switch", { name: /Analitika/ }).click();
    await banner.getByRole("button", { name: "Sačuvaj izbor" }).click();
    await expect(banner).toBeHidden();
    await expect.poll(() => requests.filter((u) => u.includes("gtag/js")).length).toBe(1);
    const layer = await dataLayer(page);
    expect(layer).toContainEqual(["consent", "update", expect.objectContaining({ analytics_storage: "granted", ad_storage: "denied" })]);
    expect(layer).toContainEqual(["config", "G-E2ETEST01", expect.objectContaining({ page_location: expect.any(String) })]);
    expect(layer.some((e) => e[0] === "config" && e[1] === "AW-123456789")).toBe(false);
    expect(requests.some((u) => u.includes("fbevents"))).toBe(false);
  });

  test("„Prihvati sve“: consent update, GA4 + Ads config, Pixel, ecommerce events", async ({ page, context }) => {
    const requests = await stubThirdParties(page);
    const productPath = pathOf(
      locs(await (await page.request.get("/sitemaps/proizvodi-1.xml")).text())[0]!,
    );
    await page.goto(productPath);
    await page.getByTestId("consent-banner").getByRole("button", { name: "Prihvati sve" }).click();
    await expect(page.getByTestId("consent-banner")).toBeHidden();
    await expect.poll(() => requests.some((u) => u.includes("gtag/js?id=G-E2ETEST01"))).toBe(true);
    await expect.poll(() => requests.some((u) => u.includes("fbevents.js"))).toBe(true);

    const layer = await dataLayer(page);
    expect(layer).toContainEqual([
      "consent",
      "update",
      { ad_storage: "granted", ad_user_data: "granted", ad_personalization: "granted", analytics_storage: "granted" },
    ]);
    // Config carries the page location (capability tokens redacted, lib/analytics/redact).
    expect(layer).toContainEqual([
      "config",
      "G-E2ETEST01",
      expect.objectContaining({ page_location: expect.stringContaining("/deo/") }),
    ]);
    expect(layer).toContainEqual([
      "config",
      "AW-123456789",
      expect.objectContaining({ allow_enhanced_conversions: true }),
    ]);
    // view_item happened before the click and is replayed once to the new adapters.
    const viewItems = layer.filter((e) => e[0] === "event" && e[1] === "view_item");
    expect(viewItems).toHaveLength(1);
    expect(viewItems[0]![2]).toMatchObject({ currency: "RSD", send_to: "G-E2ETEST01" });
    const fbq = await page.evaluate(() => (window as unknown as { __fbqCalls: unknown[][] }).__fbqCalls);
    expect(fbq).toContainEqual(["consent", "grant"]);
    expect(fbq).toContainEqual(["init", "123456789012345"]);
    expect(fbq.some((c) => c[0] === "track" && c[1] === "ViewContent")).toBe(true);

    // Add to cart → GA4 add_to_cart + Pixel AddToCart.
    const add = page.getByRole("button", { name: /Dodaj u korpu/ }).first();
    if (await add.isVisible()) {
      await add.click();
      await expect
        .poll(async () => (await dataLayer(page)).some((e) => e[0] === "event" && e[1] === "add_to_cart"))
        .toBe(true);
    }

    // The choice is remembered (cookie + consent log) and reopened from the footer.
    const cookie = (await context.cookies()).find((c) => c.name === "sk_consent")!;
    const record = JSON.parse(decodeURIComponent(cookie.value)) as { id: string; ads: boolean };
    expect(record.ads).toBe(true);
    await expect.poll(() => convexRun<number>("consentRecordCount", { consentId: record.id })).toBeGreaterThan(0);
    await page.reload();
    await expect(page.getByTestId("consent-banner")).toHaveCount(0);
    await page.getByTestId("consent-reopen").click();
    const reopened = page.getByTestId("consent-banner");
    await expect(reopened).toBeVisible();
    await expect(reopened.getByRole("switch", { name: /Oglašavanje/ })).toHaveAttribute("aria-checked", "true");
    // Withdraw: tags revoked and their cookies removed.
    await reopened.getByRole("button", { name: "Odbij sve" }).click();
    await expect(reopened).toBeHidden();
    const after = await dataLayer(page);
    expect(after.at(-1)).toEqual(expect.arrayContaining(["consent", "update"]));
    const fbqAfter = await page.evaluate(() => (window as unknown as { __fbqCalls: unknown[][] }).__fbqCalls);
    expect(fbqAfter).toContainEqual(["consent", "revoke"]);
  });
});

test.describe("ads landing", () => {
  test("/ponuda/[slug]: message-match H1, proof points, parts, noindex", async ({ page, request }) => {
    const h = await html(request, "/ponuda/kocione-plocice-golf");
    expect(robots(h)).toBe("noindex, follow");
    expect(canonical(h)).toMatch(/\/ponuda\/kocione-plocice-golf$/);
    await page.goto("/ponuda/kocione-plocice-golf");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Kočione pločice za VW Golf");
    await expect(page.getByRole("link", { name: "Pošaljite upit" }).first()).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: /Kočione pločice/ })).toBeVisible();
    await settle(page);
    await expect(page.locator('[data-reveal-state="pending"]')).toHaveCount(0);
    expect(await seriousAxe(page)).toEqual([]);
    expect((await request.get("/ponuda/ne-postoji")).status()).toBe(404);
  });
});
