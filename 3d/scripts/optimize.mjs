// Optimise the raw Blender exports into the web GLBs and complete the manifest.
//
//   node 3d/scripts/optimize.mjs
//
// Programmatic gltf-transform pipeline (never the CLI `optimize`, whose defaults flatten/join/
// instance/palette would destroy the part hierarchy): dedup(keepUniqueNames) -> prune -> weld ->
// (lite: optional simplify top-up) -> textureCompress(webp near-lossless) -> meshopt('medium',
// 10-bit normals). Also writes quantized-only QA copies for Blender re-import.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, meshopt, prune, quantize, simplify, textureCompress, weld } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const BUILD = resolve(ROOT, "3d/build");
const PUB = resolve(ROOT, "public/models");

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
await MeshoptSimplifier.ready;

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.encoder": MeshoptEncoder, "meshopt.decoder": MeshoptDecoder });

/** Triangles of every primitive reachable from a node (instances counted per node). */
function nodeTriangles(node) {
  let tris = 0;
  node.traverse((n) => {
    const mesh = n.getMesh();
    if (!mesh) return;
    for (const prim of mesh.listPrimitives()) {
      const idx = prim.getIndices();
      const count = idx ? idx.getCount() : prim.getAttribute("POSITION").getCount();
      tris += Math.floor(count / 3);
    }
  });
  return tris;
}

export function stats(doc) {
  const root = doc.getRoot();
  const scene = root.getDefaultScene() ?? root.listScenes()[0];
  let triangles = 0;
  let drawCalls = 0;
  let nodes = 0;
  const partTris = {};
  scene.traverse((n) => {
    nodes++;
    const mesh = n.getMesh();
    if (mesh) {
      for (const prim of mesh.listPrimitives()) {
        const idx = prim.getIndices();
        const count = idx ? idx.getCount() : prim.getAttribute("POSITION").getCount();
        triangles += Math.floor(count / 3);
        drawCalls++;
      }
    }
    if (n.getName().startsWith("part__")) partTris[n.getName()] = nodeTriangles(n);
  });
  return { triangles, drawCalls, nodes, textures: root.listTextures().length, partTris };
}

async function optimise(rawName, outName, { lite }) {
  const raw = resolve(BUILD, rawName);
  if (!existsSync(raw)) {
    console.warn(`skip: ${rawName} not found`);
    return null;
  }
  const size = lite ? 512 : 1024;
  const base = async () => {
    const doc = await io.read(raw);
    await doc.transform(
      dedup({ keepUniqueNames: true }),
      prune({ keepLeaves: false, keepAttributes: false, keepExtras: true }),
      weld(),
    );
    if (lite) {
      const s = stats(doc);
      if (s.triangles > 250000) {
        console.log(`lite: ${s.triangles} tris > 250k, simplify top-up`);
        await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: 0.85, error: 0.0005, lockBorder: true }));
      }
    }
    await doc.transform(
      textureCompress({ encoder: sharp, targetFormat: "webp", nearLossless: true, quality: 90, resize: [size, size] }),
    );
    return doc;
  };
  // Web GLB (meshopt)
  const doc = await base();
  await doc.transform(meshopt({ encoder: MeshoptEncoder, level: "medium" }));
  const out = resolve(PUB, outName);
  mkdirSync(PUB, { recursive: true });
  await io.write(out, doc);
  const bytes = readFileSync(out);
  const s = stats(doc);
  // QA copy (quantized only, Blender can import it)
  const qa = await base();
  await qa.transform(quantize());
  await io.write(resolve(BUILD, outName.replace(".glb", ".qa.glb")), qa);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  console.log(`${outName}: ${(bytes.length / 1e6).toFixed(2)} MB, ${s.triangles} tris, ${s.drawCalls} draw calls, ${s.nodes} nodes, ${s.textures} textures`);
  return { url: `/models/${outName}`, bytes: bytes.length, sha256, triangles: s.triangles, drawCalls: s.drawCalls, textures: s.textures, nodes: s.nodes, partTris: s.partTris };
}

const desktop = await optimise("car.raw.glb", "car.glb", { lite: false });
const lite = await optimise("car-lite.raw.glb", "car-lite.glb", { lite: true });

const basePath = resolve(BUILD, "manifest.base.json");
if (!existsSync(basePath)) throw new Error("manifest.base.json missing — run export.py first");
const manifest = JSON.parse(readFileSync(basePath, "utf8"));
const strip = (m) => (m ? { url: m.url, bytes: m.bytes, sha256: m.sha256, triangles: m.triangles, drawCalls: m.drawCalls, textures: m.textures } : null);
manifest.models = { desktop: strip(desktop), lite: strip(lite) };
for (const p of manifest.parts) {
  p.triangles = { desktop: desktop?.partTris[p.node] ?? 0, lite: lite?.partTris[p.node] ?? 0 };
}
const outPath = resolve(PUB, "car.manifest.json");
if (existsSync(outPath)) {
  const prev = JSON.parse(readFileSync(outPath, "utf8"));
  const a = { ...prev, generatedAt: "" };
  const b = { ...manifest, generatedAt: "" };
  if (JSON.stringify(a) === JSON.stringify(b)) manifest.generatedAt = prev.generatedAt;
}
writeFileSync(outPath, JSON.stringify(manifest, null, 1) + "\n", "utf8");
console.log(`manifest: ${outPath}`);
