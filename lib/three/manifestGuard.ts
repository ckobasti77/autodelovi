/**
 * Runtime check of the 3D manifest (contract F4) without zod: the canvas chunk has a 350 KB gzip
 * budget and zod alone would take ~90 KB of it (D102). The full schema (`parseCarManifest` in
 * `lib/three/manifest.ts`) still guards the build — `tests/unit/3d-manifest.test.ts` and
 * `3d/scripts/validate.mjs`. This guard checks exactly what the runtime reads before it touches
 * the GLB, and fails loudly (the hero then stays on the posters).
 */
import type { CarManifest } from "@/lib/three/manifest";

type Json = Record<string, unknown>;

function isVec3(v: unknown): boolean {
  return Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === "number" && Number.isFinite(n));
}

function isCam(v: unknown): boolean {
  const c = v as Json | null;
  return Boolean(c && isVec3(c.position) && isVec3(c.target) && typeof c.fov === "number");
}

function fail(reason: string): never {
  throw new Error(`car.manifest.json: ${reason}`);
}

export function readCarManifest(json: unknown): CarManifest {
  const m = json as Json | null;
  if (!m || m.schemaVersion !== 1) fail("schemaVersion 1 expected");
  if (m.units !== "meters") fail("units must be meters");
  const parts = m.parts;
  if (!Array.isArray(parts) || parts.length === 0) fail("parts missing");
  for (const raw of parts) {
    const p = raw as Json;
    const explode = p.explode as Json | undefined;
    const bbox = p.bbox as Json | undefined;
    if (typeof p.node !== "string" || !/^part__[a-z0-9-]+__[a-z0-9-]+$/.test(p.node))
      fail(`bad part node ${String(p.node)}`);
    if (typeof p.category !== "string") fail(`${p.node}: category`);
    if (!isVec3(p.pivot) || !isVec3(p.labelAnchor)) fail(`${p.node}: pivot/labelAnchor`);
    if (!bbox || !isVec3(bbox.min) || !isVec3(bbox.max)) fail(`${p.node}: bbox`);
    if (
      !explode ||
      !isVec3(explode.dir) ||
      typeof explode.distance !== "number" ||
      typeof explode.order !== "number" ||
      typeof explode.stage !== "number" ||
      explode.stage < 1 ||
      explode.stage > 7
    )
      fail(`${p.node}: explode`);
  }
  const categories = m.categories;
  if (!Array.isArray(categories)) fail("categories missing");
  for (const raw of categories) {
    const c = raw as Json;
    const focus = c.focus as Json | undefined;
    if (typeof c.slug !== "string" || !Array.isArray(c.nodes)) fail("category slug/nodes");
    if (!focus || !isVec3(focus.dir) || typeof focus.minDistance !== "number" || typeof focus.fov !== "number")
      fail(`${c.slug}: focus`);
  }
  const cameras = m.cameras as Json | undefined;
  const hero = cameras?.hero as Json | undefined;
  const exploded = cameras?.exploded as Json | undefined;
  if (!hero || !exploded) fail("cameras missing");
  for (const cam of [hero.desktop, hero.mobile, exploded.desktop, exploded.mobile]) {
    if (!isCam(cam)) fail("camera shape");
  }
  return json as CarManifest;
}
