// Bakes the web environment map (PERF-14, D243): three.js prefilters the studio HDRI into its
// PMREM cube-UV atlas once, here, instead of in every visitor's browser. The atlas is written as
// an RLE Radiance file the runtime loads with HDRLoader and uses as is
// (`mapping = CubeUVReflectionMapping`) — no PMREMGenerator, no blur-shader compile at 3D start.
//
//   node 3d/scripts/env.mjs [--cube 64]
//
// Input:  3d/build/env/studio-512.hdr (512 × 256 copy of the poster HDRI, posters.py --set env)
// Output: public/models/env/studio-pmrem.hdr (cube 64 → 336 × 256 atlas, ≈ 0.1–0.2 MB)
//
// The page runs in headless Chromium (Playwright, SwiftShader WebGL2); three is served from
// node_modules so the bake always matches the runtime's three version.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SRC = resolve(ROOT, "3d/build/env/studio-512.hdr");
const DST = resolve(ROOT, "public/models/env/studio-pmrem.hdr");
const argv = process.argv.slice(2);
const cube = Number(argv[argv.indexOf("--cube") + 1] || 64);
if (![32, 64, 128].includes(cube)) throw new Error(`--cube must be 32, 64 or 128 (got ${cube})`);
if (!existsSync(SRC)) throw new Error(`${SRC} missing — run posters.py --set env first`);

const ORIGIN = "http://bake.local";
const TYPES = { ".js": "text/javascript", ".hdr": "application/octet-stream", ".html": "text/html" };
const PAGE = `<!doctype html><script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script>`;

const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
let result;
try {
  const page = await browser.newPage();
  await page.route(`${ORIGIN}/**`, (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/") return route.fulfill({ body: PAGE, contentType: TYPES[".html"] });
    if (path === "/source.hdr") return route.fulfill({ body: readFileSync(SRC), contentType: TYPES[".hdr"] });
    const file = resolve(ROOT, "node_modules", `.${path}`);
    if (!file.startsWith(resolve(ROOT, "node_modules/three"))) return route.fulfill({ status: 404 });
    return route.fulfill({ body: readFileSync(file), contentType: TYPES[extname(file)] ?? "application/octet-stream" });
  });
  await page.goto(`${ORIGIN}/`);
  result = await page.evaluate(async (cubeSize) => {
    const THREE = await import("three");
    const { HDRLoader } = await import("three/addons/loaders/HDRLoader.js");
    const renderer = new THREE.WebGLRenderer();
    const source = await new HDRLoader().setDataType(THREE.FloatType).loadAsync("/source.hdr");
    // fromEquirectangular sizes the cube from the source width (width / 4): box-filter the
    // 512 × 256 source down until it matches the requested cube.
    let { width, height, data } = source.image;
    while (width / 4 > cubeSize) {
      const w = width / 2;
      const h = height / 2;
      const out = new Float32Array(w * h * 4);
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++)
          for (let c = 0; c < 4; c++) {
            const at = (yy, xx) => data[(yy * width + xx) * 4 + c];
            out[(y * w + x) * 4 + c] =
              (at(2 * y, 2 * x) + at(2 * y, 2 * x + 1) + at(2 * y + 1, 2 * x) + at(2 * y + 1, 2 * x + 1)) / 4;
          }
      width = w;
      height = h;
      data = out;
    }
    const equirect = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.FloatType);
    equirect.mapping = THREE.EquirectangularReflectionMapping;
    equirect.colorSpace = THREE.LinearSRGBColorSpace;
    equirect.flipY = source.flipY;
    equirect.minFilter = THREE.LinearFilter;
    equirect.magFilter = THREE.LinearFilter;
    equirect.generateMipmaps = false;
    equirect.needsUpdate = true;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const target = pmrem.fromEquirectangular(equirect);
    const w = target.width;
    const h = target.height;
    const half = new Uint16Array(w * h * 4);
    renderer.readRenderTargetPixels(target, 0, 0, w, h, half);
    const floats = new Float32Array(w * h * 4);
    for (let i = 0; i < half.length; i++) floats[i] = THREE.DataUtils.fromHalfFloat(half[i]);
    const bytes = new Uint8Array(floats.buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    pmrem.dispose();
    target.dispose();
    renderer.dispose();
    return { width: w, height: h, type: target.texture.type, base64: btoa(binary) };
  }, cube);
} finally {
  await browser.close();
}

const { width, height } = result;
const floats = new Float32Array(Buffer.from(result.base64, "base64").buffer.slice(0));

/** Float RGB → shared-exponent RGBE (Greg Ward). */
function rgbe(r, g, b, out, o) {
  const v = Math.max(r, g, b);
  if (!(v > 1e-32)) {
    out[o] = out[o + 1] = out[o + 2] = out[o + 3] = 0;
    return;
  }
  // frexp: v = m · 2^exp with m in [0.5, 1)
  let exp = Math.floor(Math.log2(v)) + 1;
  if (v / 2 ** exp >= 1) exp += 1;
  if (v / 2 ** exp < 0.5) exp -= 1;
  const scale = 256 / 2 ** exp;
  out[o] = Math.min(255, Math.floor(r * scale));
  out[o + 1] = Math.min(255, Math.floor(g * scale));
  out[o + 2] = Math.min(255, Math.floor(b * scale));
  out[o + 3] = exp + 128;
}

/** One scanline in the "new" adaptive RLE layout (per-channel runs; width 8…32767). */
function rleScanline(line) {
  const out = [2, 2, (width >> 8) & 0xff, width & 0xff];
  for (let c = 0; c < 4; c++) {
    const ch = new Uint8Array(width);
    for (let x = 0; x < width; x++) ch[x] = line[x * 4 + c];
    let x = 0;
    while (x < width) {
      let run = 1;
      while (x + run < width && run < 127 && ch[x + run] === ch[x]) run++;
      if (run >= 3) {
        out.push(128 + run, ch[x]);
        x += run;
        continue;
      }
      let lit = 0;
      while (x + lit < width && lit < 128) {
        const next = x + lit;
        if (next + 2 < width && ch[next] === ch[next + 1] && ch[next] === ch[next + 2]) break;
        lit++;
      }
      out.push(lit, ...ch.subarray(x, x + lit));
      x += lit;
    }
  }
  return out;
}

// GL rows are bottom-up; Radiance scanlines top-down ("-Y height +X width"). HDRLoader uploads
// with flipY, so the runtime texture ends up in the render target's exact layout.
const chunks = [Buffer.from(`#?RADIANCE\n# SKLOP PMREM cube-UV atlas, cube ${cube}\nFORMAT=32-bit_rle_rgbe\n\n-Y ${height} +X ${width}\n`, "ascii")];
const line = new Uint8Array(width * 4);
for (let row = height - 1; row >= 0; row--) {
  for (let x = 0; x < width; x++) {
    const i = (row * width + x) * 4;
    rgbe(floats[i], floats[i + 1], floats[i + 2], line, x * 4);
  }
  chunks.push(Buffer.from(rleScanline(line)));
}
mkdirSync(dirname(DST), { recursive: true });
writeFileSync(DST, Buffer.concat(chunks));
console.log(`env: ${DST} (${width} x ${height}, cube ${cube}, ${(Buffer.concat(chunks).length / 1024).toFixed(0)} KB)`);
