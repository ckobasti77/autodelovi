/** verify vis-store-02: darkest renders (part pixels only) vs a reference, composited on the tile ground (#23282E -> #16191D radial). */
import sharp from "sharp";
const names = ["kocioni-diskovi", "kocione-plocice", "kocione-celjusti", "abs-senzori", "amortizeri-opruge", "filter-kabine", "brizgaljke-pumpa-goriva", "spone-stabilizatori", "paljenje-grejaci"];
const S = 320;
const ground = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}"><defs><radialGradient id="g" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="#23282E"/><stop offset="1" stop-color="#16191D"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`);
const tiles = [];
for (const [i, n] of names.entries()) {
  const img = await sharp(`public/images/parts/${n}.webp`).resize(S, S).toBuffer();
  const label = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="24"><text x="6" y="17" font-family="Arial" font-size="14" fill="#F1ECE3">${n}</text></svg>`);
  const t = await sharp(ground).composite([{ input: img }, { input: label, top: S - 24, left: 0 }]).png().toBuffer();
  tiles.push({ input: t, left: (i % 3) * S, top: Math.floor(i / 3) * S });
}
await sharp({ create: { width: S * 3, height: S * 3, channels: 3, background: "#0D0F11" } }).composite(tiles).webp({ quality: 80 }).toFile("docs/qa/audit/verify/vis-store/vis-store-02-skeptic-dark-sheet.webp");
console.log("ok");
