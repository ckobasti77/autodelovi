import sharp from "sharp";
for (const f of process.argv.slice(2)) {
  const { data, info } = await sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, ch = info.channels;
  const bg = [data[0], data[1], data[2]];
  const rows = new Array(H).fill(0), cols = new Array(W).fill(0);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y*W+x)*ch; const d = Math.max(Math.abs(data[i]-bg[0]),Math.abs(data[i+1]-bg[1]),Math.abs(data[i+2]-bg[2])); if (d > 18) { rows[y]++; cols[x]++; } }
  let minY=H,maxY=-1,minX=W,maxX=-1; const mr=Math.round(W*0.004), mc=Math.round(H*0.004);
  rows.forEach((c,y)=>{ if(c>=mr){minY=Math.min(minY,y);maxY=y;} }); cols.forEach((c,x)=>{ if(c>=mc){minX=Math.min(minX,x);maxX=x;} });
  console.log(f.split("/").pop(), W+"x"+H, "car top", (minY/H*100).toFixed(1)+"%", "bottom", (maxY/H*100).toFixed(1)+"%", "left", (minX/W*100).toFixed(1)+"%", "right", (maxX/W*100).toFixed(1)+"%");
}
