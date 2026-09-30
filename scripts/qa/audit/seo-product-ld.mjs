/**
 * Step 21 QA audit, track "seo": Product/Offer JSON-LD vs visible server-rendered content on every
 * product URL in the products sitemap (price, availability, name, breadcrumb). 2 concurrent requests.
 *   node scripts/qa/audit/seo-product-ld.mjs -> docs/qa/audit/seo/product-jsonld.json
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";

const BASE = process.env.AUDIT_BASE ?? "http://localhost:3100";
const OUT = path.resolve("docs/qa/audit/seo");
const sm = JSON.parse(readFileSync(path.join(OUT, "sitemap-urls.json"), "utf8"));
const urls = Object.entries(sm)
  .filter(([k]) => k.includes("proizvodi"))
  .flatMap(([, v]) => v);

const fmt = (n) => new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(n);
const results = [];
let i = 0;
async function worker() {
  while (i < urls.length) {
    const u = urls[i++];
    const html = await (await fetch(BASE + u, { headers: { "user-agent": "SklopAudit-seo" } })).text();
    const d = new JSDOM(html).window.document;
    const lds = [...d.querySelectorAll('script[type="application/ld+json"]')].flatMap((s) => {
      const j = JSON.parse(s.textContent);
      return Array.isArray(j) ? j : [j];
    });
    const product = lds.find((x) => x["@type"] === "Product");
    const crumbs = lds.find((x) => x["@type"] === "BreadcrumbList");
    const main = d.querySelector("main");
    const badges = [...main.querySelectorAll("span")].filter(
      (e) => /^(Na stanju|Malo na stanju|Nema na stanju|Po porudžbini)/.test(e.textContent.trim()) && !e.closest('[data-testid="product-card"]'),
    );
    const visibleStock = badges[0]?.textContent.trim() ?? null;
    const h1 = d.querySelector("h1")?.textContent.replace(/\s+/g, " ").trim();
    const nav = d.querySelector('nav[aria-label="Putanja"]');
    const visibleCrumbs = nav ? [...nav.querySelectorAll("li")].map((li) => li.textContent.replace(/[/\s]+$/g, "").replace(/\s+/g, " ").trim()) : null;
    const offer = product?.offers ?? {};
    const priceText = main.textContent.replace(/ /g, " ");
    const price = Number(offer.price);
    const availability = String(offer.availability ?? "").split("/").pop();
    const expected = !visibleStock
      ? "?"
      : /^Nema/.test(visibleStock)
        ? "OutOfStock"
        : /^Po porudžbini/.test(visibleStock)
          ? "BackOrder"
          : "InStock";
    results.push({
      url: u,
      h1,
      ldName: product?.name,
      nameMatch: product?.name === h1,
      price,
      priceVisible: priceText.includes(`${fmt(price)} RSD`) || priceText.includes(`${fmt(price)}RSD`),
      visibleStock,
      availability,
      availabilityMatch: expected === availability || (expected === "InStock" && availability === "LimitedAvailability"),
      shipping: offer.shippingDetails?.shippingRate?.value ?? null,
      deliveryTime: Boolean(offer.shippingDetails?.deliveryTime),
      returnFees: offer.hasMerchantReturnPolicy?.returnFees ?? null,
      returnMethod: offer.hasMerchantReturnPolicy?.returnMethod ?? null,
      mpn: product?.mpn ?? null,
      gtin: product?.gtin13 ?? null,
      image: product?.image ?? null,
      brand: product?.brand?.name ?? null,
      description: product?.description?.slice(0, 160),
      ldCrumbs: crumbs?.itemListElement?.map((x) => x.name),
      visibleCrumbs,
    });
  }
}
await Promise.all([worker(), worker()]);
results.sort((a, b) => a.url.localeCompare(b.url));
writeFileSync(path.join(OUT, "product-jsonld.json"), JSON.stringify(results, null, 1));
const bad = (k) => results.filter((r) => !r[k]).map((r) => r.url);
console.log(
  JSON.stringify(
    {
      products: results.length,
      nameMismatch: bad("nameMatch").length,
      priceNotVisible: bad("priceVisible"),
      availabilityMismatch: results.filter((r) => !r.availabilityMatch).map((r) => `${r.url} visible=${r.visibleStock} ld=${r.availability}`),
      withDeliveryTime: results.filter((r) => r.deliveryTime).length,
      withReturnFees: results.filter((r) => r.returnFees).length,
      crumbMismatch: results
        .filter((r) => JSON.stringify(r.ldCrumbs) !== JSON.stringify(r.visibleCrumbs))
        .slice(0, 5)
        .map((r) => ({ url: r.url, ld: r.ldCrumbs, vis: r.visibleCrumbs })),
      shipping: results.reduce((a, r) => ((a[r.shipping] = (a[r.shipping] ?? 0) + 1), a), {}),
      images: results.reduce((a, r) => ((a[JSON.stringify(r.image)] = (a[JSON.stringify(r.image)] ?? 0) + 1), a), {}),
    },
    null,
    1,
  ),
);
