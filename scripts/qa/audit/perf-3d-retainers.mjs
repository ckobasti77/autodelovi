// perf-3d track: who keeps the hero's old WebGL canvas alive after a client-side navigation?
// home → 3D ready → /delovi (header link) → back → 3D ready → /delovi, forced GC, heap snapshot,
// then the shortest strong retaining path from the GC roots to every detached HTMLCanvasElement
// and a count of detached DOM / three.js objects. Also Runtime.getHeapUsage (backing stores).
//
//   node scripts/qa/audit/perf-3d-retainers.mjs [--gpu]
import { writeFileSync, mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";
import { GPU_ARGS, SWIFT_ARGS } from "./perf-3d-gl.mjs";

const args = process.argv.slice(2);
const BASE = process.env.AUDIT_BASE ?? "http://localhost:3200";
const browser = await chromium.launch({ args: args.includes("--gpu") ? GPU_ARGS : SWIFT_ARGS });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "sr-Latn-RS" });
await context.addCookies([
  {
    name: "sk_consent",
    value: encodeURIComponent(JSON.stringify({ v: 1, analytics: false, ads: false, at: Date.now(), id: "audit-perf-3d-0005" })),
    domain: new URL(BASE).hostname,
    path: "/",
  },
]);
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
const gc = async () => {
  for (let i = 0; i < 3; i++) {
    await cdp.send("HeapProfiler.collectGarbage");
    await page.waitForTimeout(250);
  }
};
const usage = async (label) => {
  await gc();
  const u = await cdp.send("Runtime.getHeapUsage");
  const d = await cdp.send("Memory.getDOMCounters").catch(() => ({}));
  const row = { label, usedMB: +(u.usedSize / 1048576).toFixed(1), backingStorageMB: u.backingStorageSize !== undefined ? +(u.backingStorageSize / 1048576).toFixed(1) : null, embedderMB: u.embedderHeapUsedSize !== undefined ? +(u.embedderHeapUsedSize / 1048576).toFixed(1) : null, ...d };
  console.log(JSON.stringify(row));
  return row;
};
const rows = [];
const cycle = async () => {
  const r = await page.evaluate(() => {
    const b = document.querySelector('[data-testid="hero-track"]').getBoundingClientRect();
    return { x: b.left + b.width * 0.6, y: Math.min(b.top + b.height / 2, 500) };
  });
  await page.mouse.move(r.x, r.y, { steps: 3 });
  await page.waitForFunction(() => window.__sklop3d?.getState().status === "ready", null, { timeout: 120_000 });
  await page.evaluate(() => window.__sklop3d.explode(1));
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.__sklop3d.explode(0));
  await page.waitForTimeout(500);
  await page.mouse.move(5, 5);
  await page.locator('header a[href="/delovi"]').first().click();
  await page.waitForURL((u) => u.pathname === "/delovi");
  await page.waitForTimeout(1500);
};
await page.goto(`${BASE}/`, { waitUntil: "load" });
await page.waitForTimeout(800);
rows.push(await usage("home before 3D"));
await cycle();
rows.push(await usage("/delovi after 1 home visit with 3D"));
await page.goBack();
await page.waitForURL((u) => u.pathname === "/");
await page.waitForTimeout(1500);
await cycle();
rows.push(await usage("/delovi after 2 home visits with 3D"));
await page.goBack();
await page.waitForURL((u) => u.pathname === "/");
await page.waitForTimeout(1500);
await cycle();
rows.push(await usage("/delovi after 3 home visits with 3D"));

// Heap snapshot.
let chunks = [];
cdp.on("HeapProfiler.addHeapSnapshotChunk", (e) => chunks.push(e.chunk));
await gc();
await cdp.send("HeapProfiler.takeHeapSnapshot", { reportProgress: false, captureNumericValue: false });
const snap = JSON.parse(chunks.join(""));
chunks = [];
await browser.close();

const meta = snap.snapshot.meta;
const NF = meta.node_fields.length;
const EF = meta.edge_fields.length;
const nTypes = meta.node_types[0];
const eTypes = meta.edge_types[0];
const nodes = snap.nodes;
const edges = snap.edges;
const strings = snap.strings;
const N = nodes.length / NF;
const fType = meta.node_fields.indexOf("type");
const fName = meta.node_fields.indexOf("name");
const fEC = meta.node_fields.indexOf("edge_count");
const fSelf = meta.node_fields.indexOf("self_size");
const fDet = meta.node_fields.indexOf("detachedness");
const eType = meta.edge_fields.indexOf("type");
const eName = meta.edge_fields.indexOf("name_or_index");
const eTo = meta.edge_fields.indexOf("to_node");
const firstEdge = new Uint32Array(N + 1);
for (let i = 0, e = 0; i < N; i++) {
  firstEdge[i] = e;
  e += nodes[i * NF + fEC] * EF;
  firstEdge[i + 1] = e;
}
const nodeName = (i) => strings[nodes[i * NF + fName]];
const nodeType = (i) => nTypes[nodes[i * NF + fType]];
// BFS from the root over strong edges.
const parent = new Int32Array(N).fill(-1);
const parentEdge = new Int32Array(N).fill(-1);
const seen = new Uint8Array(N);
const queue = [0];
seen[0] = 1;
for (let q = 0; q < queue.length; q++) {
  const i = queue[q];
  for (let e = firstEdge[i]; e < firstEdge[i + 1]; e += EF) {
    const t = eTypes[edges[e + eType]];
    if (t === "weak" || t === "shortcut") continue;
    const to = edges[e + eTo] / NF;
    if (seen[to]) continue;
    seen[to] = 1;
    parent[to] = i;
    parentEdge[to] = e;
    queue.push(to);
  }
}
const edgeLabel = (e) => {
  const t = eTypes[edges[e + eType]];
  const n = edges[e + eName];
  return t === "element" || t === "hidden" ? `[${n}]` : `.${strings[n]}`;
};
const pathTo = (i) => {
  const out = [];
  let cur = i;
  let guard = 0;
  while (cur > 0 && parent[cur] >= 0 && guard++ < 60) {
    out.push(`${edgeLabel(parentEdge[cur])} → ${nodeType(cur)} ${nodeName(cur).slice(0, 70)}`);
    cur = parent[cur];
  }
  return out.reverse();
};
const counts = {};
const canvases = [];
const renderers = [];
for (let i = 0; i < N; i++) {
  const name = nodeName(i);
  if (/^(Detached )?HTMLCanvasElement/.test(name)) canvases.push(i);
  if (name === "WebGLRenderer" || name === "WebGL2RenderingContext") renderers.push(i);
  for (const key of ["WebGLRenderer", "WebGL2RenderingContext", "Detached HTMLCanvasElement", "HTMLCanvasElement", "BufferGeometry", "Mesh", "HeroScene3D", "Scene", "PMREMGenerator", "ScrollTrigger", "Detached HTMLDivElement", "Detached Text", "Detached HTMLParagraphElement", "Detached HTMLHeadingElement"]) {
    if (name === key || name.startsWith(`${key} `)) counts[key] = (counts[key] ?? 0) + 1;
  }
  if (fDet >= 0 && nodes[i * NF + fDet] === 2) counts.detachedAll = (counts.detachedAll ?? 0) + 1;
}
const report = { rows, counts, canvases: canvases.map((i) => ({ name: nodeName(i), reachable: !!seen[i], path: pathTo(i).slice(-22) })), renderers: renderers.slice(0, 6).map((i) => ({ name: nodeName(i), path: pathTo(i).slice(-18) })) };
mkdirSync("docs/qa/audit/perf-3d", { recursive: true });
writeFileSync("docs/qa/audit/perf-3d/retainers.json", JSON.stringify(report, null, 1));
console.log(JSON.stringify(counts));
for (const c of report.canvases) {
  console.log(`\n${c.name} reachable=${c.reachable}`);
  for (const p of c.path) console.log("   ", p);
}
for (const c of report.renderers) {
  console.log(`\n${c.name}`);
  for (const p of c.path) console.log("   ", p);
}
