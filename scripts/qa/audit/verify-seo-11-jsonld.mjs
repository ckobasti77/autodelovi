// Verifier for seo-11: parse Product JSON-LD from server HTML on product pages.
import { writeFileSync, mkdirSync } from "node:fs";
const BASE = process.env.AUDIT_BASE ?? "http://localhost:3100";
const urls = process.argv.slice(2);
const out = {};
const extract = (html) =>
  [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
const flat = (nodes) => nodes.flat(Infinity).flatMap((n) => (n["@graph"] ? n["@graph"] : Array.isArray(n) ? n : [n]));
for (const u of urls) {
  const html = await (await fetch(BASE + u)).text();
  const nodes = flat(extract(html));
  const ids = nodes.map((n) => n["@id"]).filter(Boolean);
  const product = nodes.find((n) => n["@type"] === "Product");
  out[u] = { types: nodes.map((n) => n["@type"]), ids, product };
}
mkdirSync("docs/qa/audit/verify/seo", { recursive: true });
writeFileSync("docs/qa/audit/verify/seo/seo-11-reproduce-jsonld.json", JSON.stringify(out, null, 2));
for (const [u, r] of Object.entries(out)) {
  const o = r.product?.offers;
  console.log("==", u);
  console.log(" types:", JSON.stringify(r.types), "ids:", JSON.stringify(r.ids));
  console.log(" seller:", JSON.stringify(o?.seller));
  console.log(" shippingDetails:", JSON.stringify(o?.shippingDetails));
  console.log(" returnPolicy:", JSON.stringify(o?.hasMerchantReturnPolicy));
}
