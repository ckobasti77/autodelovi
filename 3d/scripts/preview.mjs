// GLB web check: serves the repo on a local port, loads public/models/car.glb and car-lite.glb in
// headless Chromium with three.js + MeshoptDecoder, compares node names with the manifest, applies
// a stand-in x-ray material and screenshots the hero and exploded cameras from the manifest.
// Run: node 3d/scripts/preview.mjs   (writes 3d/renders/preview/web-*.png)
import { createReadStream, existsSync, mkdirSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = resolve(ROOT, "3d/renders/preview");
const PORT = 3199;
const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".json": "application/json",
  ".glb": "model/gltf-binary",
  ".wasm": "application/wasm",
  ".webp": "image/webp",
  ".hdr": "application/octet-stream",
};

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#0D0F11}</style>
<script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js","three/addons/":"/node_modules/three/examples/jsm/"}}</script></head>
<body><script type="module">
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
const q = new URLSearchParams(location.search);
const model = q.get("model"), state = q.get("state");
const manifest = await (await fetch("/public/models/car.manifest.json")).json();
const W = 1440, H = 810;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H); renderer.setPixelRatio(1);
renderer.toneMapping = THREE.NeutralToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color("#0D0F11");
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.6;
const key = new THREE.DirectionalLight("#FFF4E8", 1.6); key.position.set(Math.sin(0.61) * 5, 4, Math.cos(0.61) * 5); scene.add(key);
const rim = new THREE.DirectionalLight("#CFEFFF", 1.2); rim.position.set(Math.sin(3.49) * 5, 2.3, Math.cos(3.49) * 5); scene.add(rim);
scene.add(new THREE.HemisphereLight("#1C2530", "#0D0F11", 0.35));
const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
const t0 = performance.now();
const gltf = await loader.loadAsync("/public/models/" + model);
const loadMs = performance.now() - t0;
const root = gltf.scene; scene.add(root);
const names = []; let tris = 0, draws = 0;
root.traverse((o) => { if (o.name) names.push(o.name); if (o.isMesh) { draws++; tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
  const m = o.material; if (m && (m.name === "mat_body_xray" || m.name === "mat_glass_xray")) {
    o.material = new THREE.MeshBasicMaterial({ color: m.name === "mat_body_xray" ? "#4DB5D6" : "#9FE9FF", transparent: true, opacity: m.name === "mat_body_xray" ? 0.16 : 0.08, depthWrite: false }); o.renderOrder = 10; } } });
if (state === "exploded") {
  for (const p of manifest.parts) { const n = root.getObjectByName(p.node); if (!n) continue;
    n.position.add(new THREE.Vector3(...p.explode.dir).multiplyScalar(p.explode.distance)); }
}
const cam = manifest.cameras[state === "exploded" ? "exploded" : "hero"].desktop;
const camera = new THREE.PerspectiveCamera(cam.fov, W / H, 0.05, 100);
camera.position.set(...cam.position); camera.lookAt(new THREE.Vector3(...cam.target));
renderer.render(scene, camera);
const wanted = manifest.parts.map((p) => p.node);
window.__result = { loadMs: Math.round(loadMs), tris: Math.round(tris), draws, nodes: names.length,
  missing: wanted.filter((n) => !names.includes(n)), extras: root.getObjectByName(wanted[0])?.userData ?? null };
</script></body></html>`;

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname === "/__preview.html") {
    res.writeHead(200, { "content-type": "text/html" });
    res.end(PAGE);
    return;
  }
  const p = resolve(ROOT, "." + decodeURIComponent(url.pathname));
  if (!p.startsWith(ROOT) || !existsSync(p) || !statSync(p).isFile()) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, { "content-type": MIME[extname(p)] ?? "application/octet-stream" });
  createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(PORT, r));
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
let failed = false;
try {
  for (const [model, state] of [
    ["car.glb", "assembled"],
    ["car.glb", "exploded"],
    ["car-lite.glb", "assembled"],
  ]) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await page.goto(`http://localhost:${PORT}/__preview.html?model=${model}&state=${state}`);
    await page.waitForFunction(() => window.__result, null, { timeout: 180000 });
    const r = await page.evaluate(() => window.__result);
    const shot = resolve(OUT, `web-${model.replace(".glb", "")}-${state}.png`);
    await page.locator("canvas").screenshot({ path: shot });
    console.log(
      `${model} ${state}: load ${r.loadMs} ms, ${r.tris} tris, ${r.draws} meshes, ${r.nodes} named nodes, missing ${r.missing.length}, errors ${errors.length} -> ${shot}`,
    );
    if (r.missing.length || errors.length) {
      failed = true;
      console.log(r.missing.slice(0, 5), errors.slice(0, 5));
    }
    if (state === "assembled" && model === "car.glb")
      console.log("extras sample:", JSON.stringify(r.extras));
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}
process.exit(failed ? 1 : 0);
