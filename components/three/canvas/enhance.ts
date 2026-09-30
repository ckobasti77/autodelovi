/**
 * Work that follows the first frame, in idle slices (contract F7.3, DESIGN-SYSTEM §7.2):
 * - BVH per geometry for fast hover raycasts (three-mesh-bvh, loaded on demand; shared
 *   geometries built once). Fine pointers only: touch devices raycast once per tap, where
 *   three's plain raycast is fast enough and the build (the largest meshes take 150–200 ms
 *   each on a 4x-throttled CPU) would be pure main-thread cost;
 * - X-ray edge lines on the high tier: EdgesGeometry(shell, 28°) as LineSegments children of
 *   each shell mesh, so they move with exploded panels.
 */
import {
  BufferGeometry,
  Color,
  EdgesGeometry,
  FrontSide,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
} from "three";

import { XRAY_RUNTIME } from "@/constants/xray";
import { runInIdleSlices } from "@/components/three/canvas/idle";

let bvh: Promise<void> | null = null;

/** Loads three-mesh-bvh (own chunk) and installs its raycast on three's prototypes, once. */
export function loadBvh(): Promise<void> {
  bvh ??= import("three-mesh-bvh").then(({ acceleratedRaycast, computeBoundsTree, disposeBoundsTree }) => {
    const proto = BufferGeometry.prototype as BufferGeometry & {
      computeBoundsTree: typeof computeBoundsTree;
      disposeBoundsTree: typeof disposeBoundsTree;
    };
    proto.computeBoundsTree = computeBoundsTree;
    proto.disposeBoundsTree = disposeBoundsTree;
    Mesh.prototype.raycast = acceleratedRaycast;
  });
  return bvh;
}

type BvhGeometry = BufferGeometry & { boundsTree?: unknown; computeBoundsTree?: () => void };

export function buildBvhInIdle(meshes: Mesh[], onDone?: () => void): () => void {
  const seen = new Set<BufferGeometry>();
  const jobs: Array<() => void> = [];
  for (const mesh of meshes) {
    const geometry = mesh.geometry as BvhGeometry;
    if (seen.has(geometry)) continue;
    seen.add(geometry);
    jobs.push(() => {
      if (!geometry.boundsTree) geometry.computeBoundsTree?.();
    });
  }
  return runInIdleSlices(jobs, onDone);
}

/**
 * Edge materials — a drafting convention that reproduces the posters' Freestyle lines
 * (crease 28° + borders, quantitative invisibility ≤ 1): every edge draws faintly (hidden
 * lines, depth-tested against the opaque parts only), then a depth-only pass of the shell's
 * front faces lets only the edges on the visible surface draw again at full strength.
 */
export type EdgeMaterials = {
  hidden: LineBasicMaterial;
  visible: LineBasicMaterial;
  depth: MeshBasicMaterial;
};

export function createEdgeMaterials(): EdgeMaterials {
  const line = (name: string) => {
    const material = new LineBasicMaterial({
      color: new Color(XRAY_RUNTIME.edgeColor),
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    material.name = name;
    return material;
  };
  // Transparent queue (renderOrder sorts inside it), colour off, depth on, pushed back a hair
  // so the edges lying on the surface still pass.
  const depth = new MeshBasicMaterial({
    colorWrite: false,
    depthWrite: true,
    transparent: true,
    side: FrontSide,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 4,
  });
  depth.name = "sk_xray_depth";
  return { hidden: line("sk_xray_edges_hidden"), visible: line("sk_xray_edges"), depth };
}

/** Adds the edge lines + the depth pass to every shell mesh (shared geometry → shared edges). */
export function buildEdgesInIdle(
  meshes: Mesh[],
  materials: EdgeMaterials,
  onDone?: () => void,
): () => void {
  const byGeometry = new Map<BufferGeometry, EdgesGeometry>();
  const jobs = meshes.map((mesh) => () => {
    let edges = byGeometry.get(mesh.geometry);
    if (!edges) {
      edges = new EdgesGeometry(mesh.geometry, XRAY_RUNTIME.edgeThresholdDeg);
      byGeometry.set(mesh.geometry, edges);
    }
    const hidden = new LineSegments(edges, materials.hidden);
    hidden.name = `${mesh.name}__edges_hidden`;
    hidden.renderOrder = 11.2;
    const depth = new Mesh(mesh.geometry, materials.depth);
    depth.name = `${mesh.name}__depth`;
    depth.renderOrder = 11.5;
    const visible = new LineSegments(edges, materials.visible);
    visible.name = `${mesh.name}__edges`;
    visible.renderOrder = 12;
    for (const o of [hidden, depth, visible]) {
      o.raycast = () => {};
      mesh.add(o);
    }
  });
  return runInIdleSlices(jobs, onDone);
}
