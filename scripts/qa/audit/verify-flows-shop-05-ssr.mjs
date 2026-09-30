// Verifier (flows-shop-05): fetch 404 routes without JS and inspect the server HTML.
import { writeFileSync } from "node:fs";
const BASE = process.env.AUDIT_BASE ?? "http://localhost:3100";
const routes = [
  "/ovo-ne-postoji",
  "/deo/ne-postoji-demo-9999",
  "/delovi/ne-postoji-kategorija",
  "/delovi/kocioni-diskovi/ne-marka",
  "/delovi/kocioni-diskovi/volkswagen/ne-model",
  "/vozila/ne-marka",
  "/porudzbina/losToken123",
  "/upit/losToken123",
  "/ponuda/ne-postoji",
];
const out = [];
for (const r of routes) {
  let res;
  for (let i = 0; i < 2; i++) {
    try { res = await fetch(BASE + r); break; } catch (e) { if (i) throw e; }
  }
  const h = await res.text();
  const title = (h.match(/<title>([^<]*)<\/title>/) || [])[1];
  const noScripts = h.replace(/<script[\s\S]*?<\/script>/g, "");
  const body = (noScripts.match(/<body[^>]*>([\s\S]*)<\/body>/) || [])[1] ?? "";
  const text = body.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const robots = (h.match(/<meta name="robots" content="([^"]*)"/) || [])[1];
  const hiddenDiv = /<div hidden[^>]*><!--\$--><!--\/\$--><\/div>/.test(h);
  out.push({
    route: r, status: res.status, bytes: h.length, title, robots,
    h1_in_html: (noScripts.match(/<h1[\s>]/g) || []).length,
    notFoundText_in_html: noScripts.includes("Stranica nije prona"),
    notFoundText_in_rsc: h.includes("Stranica nije prona"),
    main_in_html: (noScripts.match(/<main[\s>]/g) || []).length,
    header_in_html: (noScripts.match(/<header[\s>]/g) || []).length,
    emptyHiddenDivPattern: hiddenDiv,
    visibleTextLen: text.length,
    visibleTextSample: text.slice(0, 160),
  });
}
writeFileSync("docs/qa/audit/verify/flows-shop/flows-shop-05-reproduce.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 1));
