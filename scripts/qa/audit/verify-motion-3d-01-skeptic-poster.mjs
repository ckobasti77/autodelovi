// verify motion-3d-01 (skeptic): car bbox inside the poster files themselves (layout-independent).
import sharp from "sharp";
const files = process.argv.slice(2);
for (const f of files) {
  const { data, info } = await sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, ch = info.channels;
  const samples = [];
  for (let y = 0; y < 8; y++) for (let x = 0; x < W; x += 4) { const i = (y * W + x) * ch; samples.push([data[i], data[i+1], data[i+2], data[i+3]]); }
  const med = [0,1,2,3].map((c) => samples.map((s) => s[c]).sort((a,b)=>a-b)[Math.floor(samples.length/2)]);
  const T = 14;
  const row = new Array(H).fill(0), col = new Array(W).fill(0);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * ch;
    const d = Math.max(Math.abs(data[i]-med[0]), Math.abs(data[i+1]-med[1]), Math.abs(data[i+2]-med[2]), Math.abs(data[i+3]-med[3]));
    if (d > T) { row[y]++; }
  }
  const minPix = Math.max(3, Math.round(W * 0.006));
  let minY = H, maxY = -1;
  for (let y = 0; y < H; y++) if (row[y] >= minPix) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  for (let y = minY; y <= maxY; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * ch;
    const d = Math.max(Math.abs(data[i]-med[0]), Math.abs(data[i+1]-med[1]), Math.abs(data[i+2]-med[2]), Math.abs(data[i+3]-med[3]));
    if (d > T) col[x]++;
  }
  const minPixC = Math.max(3, Math.round((maxY - minY) * 0.006));
  let minX = W, maxX = -1;
  for (let x = 0; x < W; x++) if (col[x] >= minPixC) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); }
  const cw = maxX - minX + 1, chh = maxY - minY + 1;
  console.log(JSON.stringify({ f, W, H, bg: med, car: { x: minX, y: minY, w: cw, h: chh },
    topPct: +(minY / H * 100).toFixed(1), bottomGapPct: +((H - 1 - maxY) / H * 100).toFixed(1),
    hPct: +(chh / H * 100).toFixed(1), wPct: +(cw / W * 100).toFixed(1),
    centreXPct: +((minX + cw / 2) / W * 100).toFixed(1), centreYPct: +((minY + chh / 2) / H * 100).toFixed(1) }));
}
