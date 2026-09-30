// Verifier: copy-18 — OG product titles uppercase units and orphan them
import { writeFileSync } from "node:fs";
import sharp from "sharp";
import { BASE } from "./kit.mjs";

const slugs = [
  "kocioni-disk-prednji-276-24-mm-demo-0004",
  "kocioni-disk-prednji-256-22-mm-demo-0006",
  "turbina-1-9-tdi-77-kw-nova-demo-0047",
  "akumulator-60-ah-540-a-demo-0102",
  "metlica-zadnjeg-brisaca-280-mm-demo-0125",
  "motorno-ulje-edge-5w-30-ll-5-l-demo-0146",
];
const out = [];
const crops = [];
for (const slug of slugs) {
  const html = await (await fetch(`${BASE}/deo/${slug}`)).text();
  const og = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1];
  const url = og.replace("http://localhost:3000", BASE).replaceAll("&amp;", "&");
  const res = await fetch(url);
  const buf = Buffer.from(await res.arrayBuffer());
  const name = html.match(/"@type":"Product"[^}]*?"name":"([^"]+)"/)?.[1] ?? html.match(/"name":"([^"]+)"/)?.[1];
  out.push({ slug, og: url.replace(BASE, ""), status: res.status, type: res.headers.get("content-type"), bytes: buf.length, name });
  crops.push(await sharp(buf).extract({ left: 40, top: 130, width: 640, height: 290 }).png().toBuffer());
}
// contact sheet 2 columns x 3 rows
const W = 640, H = 290;
const sheet = sharp({ create: { width: W * 2, height: H * 3, channels: 3, background: "#000" } }).composite(
  crops.map((input, i) => ({ input, left: (i % 2) * W, top: Math.floor(i / 2) * H })),
);
await sheet.webp({ quality: 80 }).toFile("docs/qa/audit/verify/copy/copy-18-reproduce-og-variants.webp");
writeFileSync("docs/qa/audit/verify/copy/copy-18-reproduce.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 1));
