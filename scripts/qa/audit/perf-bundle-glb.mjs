// perf-bundle track: static inspection of the 3D assets in public/models (sizes raw/gzip/brotli,
// glTF extensions, textures, meshes, draw calls) against docs/3D-CONTRACT.md budgets.
//   node scripts/qa/audit/perf-bundle-glb.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";

const out = {};
for (const f of ["car.glb", "car-lite.glb", "env/studio-512.hdr", "car.manifest.json", "car-shadow.webp", "car-shadow-exploded.webp"]) {
  const b = readFileSync(`public/models/${f}`);
  out[f] = { raw: b.length, gz: gzipSync(b, { level: 6 }).length, br: brotliCompressSync(b, { params: { [constants.BROTLI_PARAM_QUALITY]: 9 } }).length };
}
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });
for (const f of ["car.glb", "car-lite.glb"]) {
  const json = await io.readAsJSON(`public/models/${f}`);
  const j = json.json;
  const imgs = (j.images ?? []).map((im, i) => {
    const bv = j.bufferViews[im.bufferView];
    return { i, mime: im.mimeType, bytes: bv?.byteLength ?? 0, name: im.name };
  });
  const doc = await io.read(`public/models/${f}`);
  const root = doc.getRoot();
  let tris = 0;
  let prims = 0;
  for (const m of root.listMeshes()) for (const p of m.listPrimitives()) {
    prims++;
    const idx = p.getIndices();
    tris += idx ? idx.getCount() / 3 : (p.getAttribute("POSITION")?.getCount() ?? 0) / 3;
  }
  const texDims = await Promise.all(root.listTextures().map(async (t) => ({ name: t.getName(), mime: t.getMimeType(), size: t.getSize(), bytes: t.getImage()?.byteLength })));
  out[f].gltf = {
    extensionsUsed: j.extensionsUsed,
    extensionsRequired: j.extensionsRequired,
    meshes: root.listMeshes().length,
    primitives: prims,
    triangles: Math.round(tris),
    materials: root.listMaterials().length,
    nodes: root.listNodes().length,
    textures: texDims,
    textureBytes: imgs.reduce((n, x) => n + x.bytes, 0),
  };
}
writeFileSync("docs/qa/audit/perf-bundle/glb.json", JSON.stringify(out, null, 2));
for (const [k, v] of Object.entries(out)) {
  console.log(`${k.padEnd(26)} raw ${(v.raw / 1024).toFixed(0)} KB  gzip ${(v.gz / 1024).toFixed(0)} KB  br ${(v.br / 1024).toFixed(0)} KB`);
  if (v.gltf) {
    const g = v.gltf;
    console.log(`   ext ${g.extensionsUsed?.join(",")} | required ${g.extensionsRequired?.join(",")} | meshes ${g.meshes} prims ${g.primitives} tris ${g.triangles} materials ${g.materials} nodes ${g.nodes}`);
    console.log(`   textures ${g.textures.length}, ${(g.textureBytes / 1024).toFixed(0)} KB: ${g.textures.map((t) => `${t.name || "?"} ${t.mime} ${t.size?.join("x")} ${((t.bytes ?? 0) / 1024).toFixed(0)}KB`).join("; ")}`);
  }
}
