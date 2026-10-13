/**
 * Loads and prepares the car scene (docs/3D-CONTRACT.md §F2–F5, §F7.3):
 * prefetched GLB → meshopt (worker) decode → GLTFLoader → manifest-driven part registry
 * (every `part__<category>__<instance>` node with its pivot, explode vector, label anchor and
 * focus data) → runtime materials (X-ray shell/glass, per-category PBR clones) → floor, studio
 * environment and contact shadows.
 */
import {
  Box3,
  CubeUVReflectionMapping,
  Group,
  LinearFilter,
  Mesh,
  TextureLoader,
  Vector3,
  type Material,
  type Object3D,
  type Texture,
  type WebGLRenderer,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

import manifestJson from "@/public/models/car.manifest.json";
import { ENV_URL, prefetchModel, SHADOW_URL } from "@/lib/three/assets";
import type { CarManifest, ManifestPart } from "@/lib/three/manifest";
import { readCarManifest } from "@/lib/three/manifestGuard";
import type { Tier } from "@/lib/three/tier";
import {
  createHighlightUniforms,
  createPartMaterial,
  createSharedUniforms,
  createXrayMaterial,
  isXraySlot,
  type HighlightUniforms,
  type SharedUniforms,
} from "@/components/three/canvas/materials";
import { createFloor } from "@/components/three/canvas/floor";
import { yieldToMain } from "@/components/three/canvas/idle";

export type PartEntry = {
  name: string;
  category: string;
  instance: string;
  node: Object3D;
  pivot: Vector3;
  dir: Vector3;
  distance: number;
  stage: number;
  order: number;
  labelAnchor: Vector3;
  /** Assembled bbox relative to the pivot (current bbox = this + node position). */
  localBox: Box3;
  meshes: Mesh[];
  xray: boolean;
};

export type CategoryEntry = {
  slug: string;
  parts: PartEntry[];
  /** Nodes the camera frames when the category is selected (left/front instance first). */
  focusParts: PartEntry[];
  focus: { dir: [number, number, number]; minDistance: number; fov: number };
  highlight: HighlightUniforms;
};

export type CarScene = {
  root: Group;
  manifest: CarManifest;
  parts: Map<string, PartEntry>;
  categories: Map<string, CategoryEntry>;
  pickables: Mesh[];
  /** Shell meshes (X-ray body) that get edge lines on the high tier. */
  shellMeshes: Mesh[];
  shared: SharedUniforms;
  /** Highlight uniforms of the static structure (dims with the rest). */
  staticHighlight: HighlightUniforms;
  floor: ReturnType<typeof createFloor>;
  environment: Texture;
  textures: Texture[];
  dispose: () => void;
};

let workersStarted = false;

function startDecoderWorkers() {
  if (workersStarted) return;
  workersStarted = true;
  const cores = typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 2 : 2;
  // Not a React hook despite the name: decode in Web Workers instead of the main thread.
  const spawnWorkers = MeshoptDecoder.useWorkers.bind(MeshoptDecoder);
  spawnWorkers(Math.max(1, Math.min(4, cores - 1)));
}

/**
 * The studio environment, already prefiltered: the pipeline bakes three's PMREM cube-UV atlas
 * (`3d/scripts/env.mjs`), so the runtime only decodes a small RGBE file — no PMREMGenerator and
 * no blur-shader compile on the main thread at 3D start (PERF-14, D243).
 */
async function loadEnvironment(): Promise<Texture> {
  const atlas = await new HDRLoader().loadAsync(ENV_URL);
  atlas.mapping = CubeUVReflectionMapping;
  atlas.minFilter = LinearFilter;
  atlas.magFilter = LinearFilter;
  atlas.generateMipmaps = false;
  atlas.name = "PMREM.cubeUv";
  return atlas;
}

async function loadShadow(url: string, renderer: WebGLRenderer): Promise<Texture | null> {
  try {
    const texture = await new TextureLoader().loadAsync(url);
    texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    return texture;
  } catch {
    return null;
  }
}

/** Instance code → the left/front instance of a twin pair is the one the camera frames (D85). */
function focusPartsOf(parts: PartEntry[]): PartEntry[] {
  const byInstance = new Map(parts.map((p) => [p.instance, p]));
  for (const preferred of ["fl", "l"]) {
    const hit = byInstance.get(preferred);
    if (hit) return [hit];
  }
  return parts;
}

function vec(v: readonly number[]): Vector3 {
  return new Vector3(v[0], v[1], v[2]);
}

function collectMeshes(node: Object3D): Mesh[] {
  const out: Mesh[] = [];
  node.traverse((o) => {
    if ((o as Mesh).isMesh) out.push(o as Mesh);
  });
  return out;
}

export async function loadCarScene(options: {
  tier: Exclude<Tier, "low">;
  renderer: WebGLRenderer;
}): Promise<CarScene> {
  const { tier, renderer } = options;
  const mobile = tier === "mid";
  startDecoderWorkers();
  const manifest = readCarManifest(manifestJson);

  // One contact shadow: the car is never an exploded cloud any more (hero v2), so the
  // exploded shadow is not fetched.
  const [buffer, environment, shadowA] = await Promise.all([
    prefetchModel(tier),
    loadEnvironment(),
    loadShadow(SHADOW_URL.assembled, renderer),
  ]);
  const shadowB: Texture | null = null;

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.parseAsync(buffer, "");
  await yieldToMain();
  const root = gltf.scene;
  root.name = "sklop_car";

  const shared = createSharedUniforms();
  const staticHighlight = createHighlightUniforms();
  const parts = new Map<string, PartEntry>();
  const categories = new Map<string, CategoryEntry>();
  const pickables: Mesh[] = [];
  const shellMeshes: Mesh[] = [];
  const materials = new Set<Material>();
  const cache = new Map<string, Material>();

  const materialFor = (source: Material, key: string, highlight: HighlightUniforms): Material => {
    const cacheKey = `${key}|${source.uuid}`;
    const hit = cache.get(cacheKey);
    if (hit) return hit;
    const kind = isXraySlot(source.name);
    const material = kind
      ? createXrayMaterial({ kind, mobile, envMap: environment, shared, highlight })
      : createPartMaterial(source, shared, highlight);
    cache.set(cacheKey, material);
    materials.add(material);
    return material;
  };

  const applyMaterials = (mesh: Mesh, key: string, highlight: HighlightUniforms) => {
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const next = list.map((m) => materialFor(m, key, highlight));
    mesh.material = Array.isArray(mesh.material) ? next : next[0];
    const kinds = list.map((m) => isXraySlot(m.name));
    if (kinds.includes("glass")) mesh.renderOrder = 11;
    else if (kinds.includes("body")) mesh.renderOrder = 10;
    else if (list.some((m) => m.name === "mat_glass_lens")) mesh.renderOrder = 9;
    return kinds.includes("body") || kinds.includes("glass");
  };

  const byCategory = new Map<string, ManifestPart[]>();
  for (const p of manifest.parts) {
    byCategory.set(p.category, [...(byCategory.get(p.category) ?? []), p]);
  }

  for (const category of manifest.categories) {
    if (!category.hasMesh) continue;
    const highlight = createHighlightUniforms();
    const entries: PartEntry[] = [];
    for (const p of byCategory.get(category.slug) ?? []) {
      const node = root.getObjectByName(p.node);
      if (!node) continue;
      const pivot = vec(p.pivot);
      node.position.copy(pivot);
      const meshes = collectMeshes(node);
      let xray = false;
      for (const mesh of meshes) {
        const shell = applyMaterials(mesh, category.slug, highlight);
        xray = xray || shell;
        mesh.userData.category = category.slug;
        mesh.userData.partNode = p.node;
        mesh.userData.xray = shell;
        if (p.clickable) pickables.push(mesh);
        if (shell && !mobile) shellMeshes.push(mesh);
      }
      const localBox = new Box3(vec(p.bbox.min).sub(pivot), vec(p.bbox.max).sub(pivot));
      const entry: PartEntry = {
        name: p.node,
        category: category.slug,
        instance: p.node.split("__")[2] ?? "",
        node,
        pivot,
        dir: vec(p.explode.dir).normalize(),
        distance: p.explode.distance,
        stage: p.explode.stage,
        order: p.explode.order,
        labelAnchor: vec(p.labelAnchor),
        localBox,
        meshes,
        xray,
      };
      parts.set(p.node, entry);
      entries.push(entry);
    }
    categories.set(category.slug, {
      slug: category.slug,
      parts: entries,
      focusParts: focusPartsOf(entries),
      focus: { dir: category.focus.dir, minDistance: category.focus.minDistance, fov: category.focus.fov },
      highlight,
    });
  }

  // Static structure: the X-ray shell frame, subframe and knuckles (never clickable).
  root.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh || mesh.userData.category) return;
    const shell = applyMaterials(mesh, "static", staticHighlight);
    if (shell && !mobile) shellMeshes.push(mesh);
    mesh.raycast = () => {};
  });

  const floor = createFloor(shadowA, shadowB);
  root.add(floor.mesh);

  const textures: Texture[] = [environment];
  if (shadowA) textures.push(shadowA);
  // Every texture any material samples, so the canvas uploads them all (one per task) before
  // compileAsync and the first frame never pays a texImage2D.
  for (const m of materials) {
    for (const value of Object.values(m)) {
      const map = value as Texture | null;
      if (map?.isTexture && !textures.includes(map)) textures.push(map);
    }
  }

  const dispose = () => {
    root.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh && !(o as { isLineSegments?: boolean }).isLineSegments) return;
      const geometry = mesh.geometry as Mesh["geometry"] & { disposeBoundsTree?: () => void };
      geometry.disposeBoundsTree?.();
      geometry.dispose();
    });
    for (const m of materials) m.dispose();
    floor.mesh.geometry.dispose();
    (floor.mesh.material as Material).dispose();
    for (const t of textures) t.dispose();
  };

  return {
    root,
    manifest,
    parts,
    categories,
    pickables,
    shellMeshes,
    shared,
    staticHighlight,
    floor,
    environment,
    textures,
    dispose,
  };
}
