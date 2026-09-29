// Validate the web GLBs + manifest against docs/3D-CONTRACT.md and the budgets.
//
//   node 3d/scripts/validate.mjs            exit 0 = PASS, 1 = FAIL
//
// Checks: budgets (size, triangles, draw calls, textures, nodes), names and hierarchy, extras,
// taxonomy coverage, manifest <-> GLB <-> taxonomy, materials, bbox, files, sha256, explode
// reports, Khronos glTF-Validator.
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import validator from "gltf-validator";
import { MeshoptDecoder } from "meshoptimizer";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const tax = await import("../../lib/catalog/taxonomy.ts");

const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

const NAME_RE = /^(part|mesh|body|sys|chassis)__[a-z0-9-]+(__[a-z0-9-]+){0,2}$/;
const F3 = ["partId", "category", "system", "labelSr", "clickable", "lod", "explodeDir", "explodeDist", "explodeStage", "explodeOrder", "labelAnchor", "focusDir", "focusMinDist"];
const CONTRACT_MATS = new Set([
  "mat_body_xray", "mat_glass_xray", "mat_glass_lens", "mat_cast_iron", "mat_machined_steel", "mat_steel_dark",
  "mat_brushed_alu", "mat_cast_alu", "mat_painted_black", "mat_plastic_black", "mat_plastic_grey", "mat_rubber",
  "mat_tyre", "mat_hose", "mat_chrome", "mat_copper", "mat_ceramic", "mat_caliper", "mat_battery", "mat_heat_shield",
  "mat_wire", "mat_emissive_led", "mat_emissive_tail", "mat_core_fins",
]);
const BUDGET = {
  desktop: { bytesHard: 8e6, bytesWarn: 6.5e6, trisHard: 800000, trisLo: 450000, trisHi: 600000, draws: 220, texSize: 1024, nodes: 400 },
  lite: { bytesHard: 3e6, trisHard: 250000, draws: 150, texSize: 512, nodes: 300 },
};

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });

const manifestPath = resolve(ROOT, "public/models/car.manifest.json");
if (!existsSync(manifestPath)) {
  console.error("FAIL: public/models/car.manifest.json missing");
  process.exit(1);
}
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const partByNode = new Map(manifest.parts.map((p) => [p.node, p]));
const expectedNodes = tax.allPartNodes();

function vecLen(v) {
  return Math.hypot(v[0], v[1], v[2]);
}

async function checkGlb(kind) {
  const model = manifest.models?.[kind];
  if (!model) return err(`${kind}: manifest.models.${kind} missing`), null;
  const file = resolve(ROOT, "public", model.url.replace(/^\//, ""));
  if (!existsSync(file)) return err(`${kind}: ${model.url} missing`), null;
  const bytes = readFileSync(file);
  const b = BUDGET[kind];
  const sha = createHash("sha256").update(bytes).digest("hex");
  if (sha !== model.sha256) err(`${kind}: sha256 mismatch`);
  if (bytes.length !== model.bytes) err(`${kind}: byte size mismatch`);
  if (bytes.length > b.bytesHard) err(`${kind}: ${(bytes.length / 1e6).toFixed(2)} MB > ${b.bytesHard / 1e6} MB`);
  else if (b.bytesWarn && bytes.length > b.bytesWarn) warn(`${kind}: ${(bytes.length / 1e6).toFixed(2)} MB > target ${b.bytesWarn / 1e6} MB`);

  const doc = await io.readBinary(new Uint8Array(bytes));
  const root = doc.getRoot();
  const scene = root.getDefaultScene() ?? root.listScenes()[0];
  const names = new Map();
  let tris = 0;
  let draws = 0;
  let nodeCount = 0;
  const top = scene.listChildren();
  if (top.length !== 1 || top[0].getName() !== "sklop_car") err(`${kind}: scene root must be the single node sklop_car`);
  scene.traverse((n) => {
    nodeCount++;
    const name = n.getName();
    if (!name) err(`${kind}: unnamed node`);
    else if (name !== "sklop_car" && !NAME_RE.test(name)) err(`${kind}: bad node name ${name}`);
    if (names.has(name)) err(`${kind}: duplicate node name ${name}`);
    names.set(name, n);
    const mesh = n.getMesh();
    if (mesh) {
      if (n.listChildren().length) err(`${kind}: mesh node ${name} has children`);
      const parent = n.getParentNode();
      if (!parent || !/^(part|body|chassis)__/.test(parent.getName()) && !/^(body|chassis)__/.test(name)) err(`${kind}: mesh node ${name} lacks a part/body/chassis parent`);
      for (const prim of mesh.listPrimitives()) {
        const idx = prim.getIndices();
        tris += Math.floor((idx ? idx.getCount() : prim.getAttribute("POSITION").getCount()) / 3);
        draws++;
        const mat = prim.getMaterial();
        if (!mat) err(`${kind}: primitive without material in ${name}`);
        else {
          if (!CONTRACT_MATS.has(mat.getName())) err(`${kind}: material ${mat.getName()} not in contract`);
          if (mat.getNormalTexture() && !prim.getAttribute("TEXCOORD_0")) err(`${kind}: ${name} normal-mapped without TEXCOORD_0`);
        }
      }
    }
    const extras = n.getExtras() ?? {};
    const keys = Object.keys(extras);
    if (name.startsWith("part__")) {
      const t = n.getTranslation();
      const r = n.getRotation();
      const s = n.getScale();
      if (Math.abs(r[0]) + Math.abs(r[1]) + Math.abs(r[2]) > 1e-6 || Math.abs(Math.abs(r[3]) - 1) > 1e-6) err(`${kind}: ${name} rotation not identity`);
      if (Math.abs(s[0] - 1) + Math.abs(s[1] - 1) + Math.abs(s[2] - 1) > 1e-6) err(`${kind}: ${name} scale not 1`);
      if (!n.getParentNode()?.getName().startsWith("sys__")) err(`${kind}: ${name} parent is not sys__*`);
      for (const k of F3) if (!(k in extras)) err(`${kind}: ${name} extras missing ${k}`);
      for (const k of keys) if (!F3.includes(k)) err(`${kind}: ${name} unexpected extra ${k}`);
      const mp = partByNode.get(name);
      if (!mp) err(`${kind}: ${name} not in manifest`);
      else {
        const d = Math.hypot(t[0] - mp.pivot[0], t[1] - mp.pivot[1], t[2] - mp.pivot[2]);
        if (d > 1e-4) err(`${kind}: ${name} translation != manifest pivot (${d.toFixed(5)} m)`);
      }
      if (Math.abs(vecLen(extras.explodeDir ?? [0, 0, 0]) - 1) > 1e-3) err(`${kind}: ${name} explodeDir not unit`);
      if (typeof extras.clickable !== "boolean") err(`${kind}: ${name} clickable not boolean`);
      const [cat, inst] = name.slice(6).split("__");
      const c = tax.findCategory(cat);
      const i = c?.instances.find((x) => x.instance === inst);
      if (!c || !i) err(`${kind}: ${name} not in taxonomy`);
      else {
        if (extras.category !== cat || extras.partId !== `${cat}__${inst}`) err(`${kind}: ${name} category/partId mismatch`);
        if (extras.system !== c.system) err(`${kind}: ${name} system mismatch`);
        if (extras.labelSr !== i.labelSr) err(`${kind}: ${name} labelSr != taxonomy`);
        const stage = i.stage ?? c.stage;
        if (extras.explodeStage !== stage) err(`${kind}: ${name} stage ${extras.explodeStage} != ${stage}`);
      }
    } else if (keys.length) err(`${kind}: ${name} must not carry extras (${keys.join(",")})`);
  });
  for (const node of expectedNodes) if (!names.has(node)) err(`${kind}: missing node ${node}`);
  if (tris >= b.trisHard) err(`${kind}: ${tris} triangles >= ${b.trisHard}`);
  if (b.trisLo && (tris < b.trisLo || tris > b.trisHi)) warn(`${kind}: ${tris} triangles outside target ${b.trisLo}-${b.trisHi}`);
  if (draws > b.draws) err(`${kind}: ${draws} draw calls > ${b.draws}`);
  if (nodeCount > b.nodes) err(`${kind}: ${nodeCount} nodes > ${b.nodes}`);
  const textures = root.listTextures();
  if (textures.length > 10) err(`${kind}: ${textures.length} textures > 10`);
  for (const t of textures) {
    const size = t.getSize();
    if (t.getMimeType() !== "image/webp") err(`${kind}: texture ${t.getName()} is ${t.getMimeType()}`);
    if (size && Math.max(...size) > b.texSize) err(`${kind}: texture ${t.getName()} ${size.join("x")} > ${b.texSize}`);
  }
  if (tris !== model.triangles) err(`${kind}: manifest triangles ${model.triangles} != ${tris}`);
  if (draws !== model.drawCalls) err(`${kind}: manifest drawCalls ${model.drawCalls} != ${draws}`);
  // Khronos validator
  const report = await validator.validateBytes(new Uint8Array(bytes), { maxIssues: 50 });
  if (report.issues.numErrors > 0) {
    err(`${kind}: glTF-Validator ${report.issues.numErrors} errors: ${report.issues.messages.filter((m) => m.severity === 0).slice(0, 5).map((m) => `${m.code} ${m.pointer}`).join("; ")}`);
  }
  return { kind, bytes: bytes.length, tris, draws, nodes: nodeCount, textures: textures.length, names: new Set(names.keys()), warnings: report.issues.numWarnings };
}

const d = await checkGlb("desktop");
const l = await checkGlb("lite");
if (d && l) {
  for (const n of d.names) if (!l.names.has(n)) err(`lite lacks node ${n}`);
  for (const n of l.names) if (!d.names.has(n)) err(`lite has extra node ${n}`);
}

// ---- manifest <-> taxonomy
const tc = tax.CATEGORIES;
if (manifest.categories.length !== tc.length) err(`manifest categories ${manifest.categories.length} != ${tc.length}`);
for (const c of tc) {
  const m = manifest.categories.find((x) => x.slug === c.slug);
  if (!m) { err(`manifest lacks category ${c.slug}`); continue; }
  if (m.labelSr !== c.labelSr || m.system !== c.system) err(`category ${c.slug} label/system mismatch`);
  if (m.hasMesh !== c.instances.length > 0) err(`category ${c.slug} hasMesh mismatch`);
  const nodes = c.instances.map((i) => tax.partNodeName(c.slug, i.instance));
  if (JSON.stringify(m.nodes) !== JSON.stringify(nodes)) err(`category ${c.slug} nodes mismatch`);
  const thumb = resolve(ROOT, "public", m.thumbnail.replace(/^\//, ""));
  if (!existsSync(thumb)) err(`thumbnail missing: ${m.thumbnail}`);
}
for (const s of tax.SUBCATEGORIES) if (!existsSync(resolve(ROOT, `public/images/parts/${s.slug}.webp`))) err(`thumbnail missing: ${s.slug}`);
if (JSON.stringify(manifest.stages) !== JSON.stringify(tax.STAGES)) err("manifest stages != taxonomy");
if (JSON.stringify(manifest.systems) !== JSON.stringify(tax.SYSTEMS)) err("manifest systems != taxonomy");
if (manifest.parts.length !== 91) err(`manifest parts ${manifest.parts.length} != 91`);
const len = manifest.bbox.max[2] - manifest.bbox.min[2];
if (len < 4.2 || len > 4.4) err(`car length ${len.toFixed(3)} m outside 4.2-4.4`);
for (const p of manifest.parts) {
  const low = p.bbox.min[1] + p.explode.dir[1] * p.explode.distance;
  if (p.category !== "felne-gume" && low < 0.02 - 1e-6) err(`${p.node} ends below the floor (${low.toFixed(3)})`);
}
if (manifest.materials.length > 24) err(`more than 24 materials`);
for (const m of manifest.materials) if (!CONTRACT_MATS.has(m.name)) err(`manifest material ${m.name} not in contract`);

// ---- files
for (const f of ["public/models/car-shadow.webp", "public/models/car-shadow-exploded.webp", "public/images/hero/car-assembled.webp", "public/images/hero/car-assembled.avif", "public/images/hero/car-exploded.webp", "public/images/hero/car-exploded.avif"]) {
  if (!existsSync(resolve(ROOT, f))) err(`missing ${f}`);
}

// ---- explode reports
for (const r of ["packaging", "motion", "visibility"]) {
  const p = resolve(ROOT, `3d/build/reports/${r}.json`);
  if (!existsSync(p)) { err(`report ${r}.json missing (run explode.py / render.py --set audit)`); continue; }
  const rep = JSON.parse(readFileSync(p, "utf8"));
  if (rep.scriptsHash && rep.scriptsHash !== manifest.source.scriptsHash) warn(`report ${r} is stale (scriptsHash differs)`);
  if ((rep.errors ?? []).length) err(`report ${r}: ${rep.errors.length} errors (${rep.errors.slice(0, 3).join("; ")})`);
  for (const w of (rep.warnings ?? []).slice(0, 5)) warn(`${r}: ${w}`);
}

const table = [d, l].filter(Boolean).map((x) => `${x.kind.padEnd(8)} ${(x.bytes / 1e6).toFixed(2)} MB  ${String(x.tris).padStart(7)} tris  ${String(x.draws).padStart(4)} draws  ${String(x.nodes).padStart(4)} nodes  ${x.textures} textures`);
console.log(table.join("\n"));
for (const w of warnings) console.log(`WARN  ${w}`);
for (const e of errors) console.log(`ERROR ${e}`);
console.log(errors.length ? `FAIL (${errors.length} errors, ${warnings.length} warnings)` : `PASS (${warnings.length} warnings)`);
process.exit(errors.length ? 1 : 0);
