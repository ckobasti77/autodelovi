/**
 * Slot geometry for the hero v2 grid (docs/3d/HERO-V2.md §6.4–6.5): where a docked composition
 * sits in the world for a DOM cell, how it is turned, how large it is, and how the camera backs
 * away to make room. three.js maths only — no DOM, no scene graph; the hot functions write into
 * the objects they are given and allocate nothing.
 */
import { Box3, MathUtils, Matrix4, Quaternion, Vector3, type PerspectiveCamera } from "three";

import type { CameraPose, ContainFrame } from "@/lib/three/camera";

export type SlotBasis = {
  /** Screen-right, screen-up and toward-the-camera at the slot (unit, world space). */
  right: Vector3;
  up: Vector3;
  toCamera: Vector3;
};

export function createBasis(): SlotBasis {
  return { right: new Vector3(), up: new Vector3(), toCamera: new Vector3() };
}

const Y = new Vector3(0, 1, 0);
const a = new Vector3();
const c = new Vector3();
const px = new Vector3();
const py = new Vector3();
const m1 = new Matrix4();
const m2 = new Matrix4();
const box = new Box3();

/** Unit direction for an azimuth (from +Z toward +X) and elevation in degrees. */
export function viewDirection(az: number, el: number, out: Vector3): Vector3 {
  const azr = MathUtils.degToRad(az);
  const elr = MathUtils.degToRad(el);
  return out.set(Math.sin(azr) * Math.cos(elr), Math.sin(elr), Math.cos(azr) * Math.cos(elr));
}

/**
 * World point that projects to canvas pixel (x, y) at view depth `depth`. `forward` is the
 * camera's world direction; the camera's matrices (view offset included) must be current.
 */
export function unprojectAtDepth(
  camera: PerspectiveCamera,
  forward: Vector3,
  x: number,
  y: number,
  width: number,
  height: number,
  depth: number,
  out: Vector3,
): Vector3 {
  out.set((x / width) * 2 - 1, -(y / height) * 2 + 1, 0.5).unproject(camera);
  out.sub(camera.position).normalize();
  return out.multiplyScalar(depth / out.dot(forward)).add(camera.position);
}

/** The slot's own frame: its view ray and the camera's up. */
export function slotBasis(camera: PerspectiveCamera, centre: Vector3, out: SlotBasis): SlotBasis {
  out.toCamera.copy(camera.position).sub(centre).normalize();
  a.setFromMatrixColumn(camera.matrixWorld, 1);
  out.right.crossVectors(a, out.toCamera).normalize();
  out.up.crossVectors(out.toCamera, out.right);
  return out;
}

/** Angle (degrees) between the optical axis and the ray to a slot. */
export function offAxisDeg(forward: Vector3, basis: SlotBasis): number {
  return MathUtils.radToDeg(Math.acos(Math.min(1, Math.max(-1, -basis.toCamera.dot(forward)))));
}

/**
 * Rotation that shows a part in a slot the way its thumbnail shows it: the thumbnail's view
 * direction (part space, world-up) turns to face the camera along the slot's ray.
 */
export function slotRotation(view: Vector3, basis: SlotBasis, out: Quaternion): Quaternion {
  px.crossVectors(Y, view).normalize();
  py.crossVectors(view, px);
  m1.makeBasis(px, py, view).transpose();
  m2.makeBasis(basis.right, basis.up, basis.toCamera).multiply(m1);
  return out.setFromRotationMatrix(m2);
}

export type CompositionPart = {
  /** Assembled box relative to the pivot, and the pivot (world, assembled). */
  localBox: Box3;
  pivot: Vector3;
};

export type Composition = {
  /** Per shown part: offset of its box centre from the cluster centre (slot space, unscaled). */
  offsets: Vector3[];
  /** Per shown part: extra scale (a `row` evens unlike pieces out). */
  norms: number[];
  /** Cluster extents along screen-right and screen-up (world units, unscaled). */
  extR: number;
  extU: number;
};

export function createComposition(count: number): Composition {
  return {
    offsets: Array.from({ length: count }, () => new Vector3()),
    norms: Array.from({ length: count }, () => 1),
    extR: 1,
    extU: 1,
  };
}

const halfR: number[] = [];
const halfU: number[] = [];

/** Half extents of a rotated box along the slot's right / up axes. */
function rotatedHalf(part: CompositionPart, rot: Quaternion, basis: SlotBasis, index: number): void {
  const { min, max } = part.localBox;
  let r0 = Infinity, r1 = -Infinity, u0 = Infinity, u1 = -Infinity;
  for (let i = 0; i < 8; i += 1) {
    a.set(i & 1 ? max.x : min.x, i & 2 ? max.y : min.y, i & 4 ? max.z : min.z).applyQuaternion(rot);
    const r = a.dot(basis.right);
    const u = a.dot(basis.up);
    if (r < r0) r0 = r;
    if (r > r1) r1 = r;
    if (u < u0) u0 = u;
    if (u > u1) u1 = u;
  }
  halfR[index] = (r1 - r0) / 2;
  halfU[index] = (u1 - u0) / 2;
}

/**
 * Lays the shown instances out in slot space. One part sits at the centre; several keep their
 * assembled arrangement (a kit); a `row` puts unlike pieces side by side at an even size.
 */
export function compose(
  parts: readonly CompositionPart[],
  row: boolean,
  rot: Quaternion,
  basis: SlotBasis,
  out: Composition,
): Composition {
  const n = parts.length;
  for (let i = 0; i < n; i += 1) rotatedHalf(parts[i], rot, basis, i);
  if (row && n > 1) {
    let ref = 0;
    for (let i = 0; i < n; i += 1) ref = Math.max(ref, 2 * Math.max(halfR[i], halfU[i]));
    let x = 0;
    for (let i = 0; i < n; i += 1) {
      const norm = Math.min(ref / Math.max(2 * Math.max(halfR[i], halfU[i]), 1e-4), 4);
      const w = 2 * halfR[i] * norm;
      out.norms[i] = norm;
      out.offsets[i].set(x + w / 2, 0, 0);
      x += w + ref * 0.12;
    }
    const total = x - ref * 0.12;
    for (let i = 0; i < n; i += 1) out.offsets[i].x -= total / 2;
  } else {
    box.makeEmpty();
    for (let i = 0; i < n; i += 1) {
      box.expandByPoint(a.copy(parts[i].localBox.min).add(parts[i].pivot));
      box.expandByPoint(a.copy(parts[i].localBox.max).add(parts[i].pivot));
    }
    box.getCenter(c);
    for (let i = 0; i < n; i += 1) {
      parts[i].localBox.getCenter(a).add(parts[i].pivot).sub(c).applyQuaternion(rot);
      out.offsets[i].set(a.dot(basis.right), a.dot(basis.up), a.dot(basis.toCamera));
      out.norms[i] = 1;
    }
  }
  let r0 = Infinity, r1 = -Infinity, u0 = Infinity, u1 = -Infinity;
  for (let i = 0; i < n; i += 1) {
    const o = out.offsets[i];
    const hr = halfR[i] * out.norms[i];
    const hu = halfU[i] * out.norms[i];
    if (o.x - hr < r0) r0 = o.x - hr;
    if (o.x + hr > r1) r1 = o.x + hr;
    if (o.y - hu < u0) u0 = o.y - hu;
    if (o.y + hu > u1) u1 = o.y + hu;
  }
  const cx = (r0 + r1) / 2;
  const cy = (u0 + u1) / 2;
  for (let i = 0; i < n; i += 1) {
    out.offsets[i].x -= cx;
    out.offsets[i].y -= cy;
  }
  out.extR = Math.max(r1 - r0, 1e-4);
  out.extU = Math.max(u1 - u0, 1e-4);
  return out;
}

/** Uniform scale that fits a composition into a cell of `cellW × cellH` world units. */
export function fitScale(comp: Composition, cellW: number, cellH: number, fit: number): number {
  return fit * Math.min(cellW / comp.extR, cellH / comp.extU);
}

/** 0 … 1 from a string, stable (per-slot float phase and period). */
export function hashUnit(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967295;
}

export type Rect = { x: number; y: number; w: number; h: number };

/** Normalised device box of the car's assembled bbox for a camera (no view offset). */
export function projectBox(
  camera: PerspectiveCamera,
  min: readonly number[],
  max: readonly number[],
  out: { x0: number; x1: number; y0: number; y1: number },
): void {
  out.x0 = out.y0 = Infinity;
  out.x1 = out.y1 = -Infinity;
  for (let i = 0; i < 8; i += 1) {
    a.set(i & 1 ? max[0] : min[0], i & 2 ? max[1] : min[1], i & 4 ? max[2] : min[2]).project(camera);
    if (a.x < out.x0) out.x0 = a.x;
    if (a.x > out.x1) out.x1 = a.x;
    if (a.y < out.y0) out.y0 = a.y;
    if (a.y > out.y1) out.y1 = a.y;
  }
}

export type DockSolution = {
  /** Camera distance multiplier along its view line (≥ 1: backs away). */
  distance: number;
  fov: number;
  /** Top-left of the poster frame once docked (canvas px); the frame keeps its size. */
  offsetX: number;
  offsetY: number;
};

const ndc = { x0: 0, x1: 0, y0: 0, y1: 0 };

/**
 * How the camera shows the car inside `band`: it backs away along its view line and takes a
 * longer lens, while the contain frame keeps its poster size — the focal length in pixels stays
 * long, so every slot stays near the optical axis. Shrinking the frame instead breaks short
 * screens (HERO-V2 §6.5). `camera` is used as scratch and left at the solved pose.
 */
export function solveDock(
  camera: PerspectiveCamera,
  hero: CameraPose,
  aspect: number,
  dockFov: number,
  carMin: readonly number[],
  carMax: readonly number[],
  frame: ContainFrame,
  band: Rect,
  fill: { width: number; height: number },
  out: DockSolution,
): DockSolution {
  camera.aspect = aspect;
  camera.clearViewOffset();
  camera.up.set(0, 1, 0);
  let distance = 1;
  for (let pass = 0; pass < 3; pass += 1) {
    camera.fov = dockFov;
    camera.position.copy(hero.position).sub(hero.target).multiplyScalar(distance).add(hero.target);
    camera.lookAt(hero.target);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    projectBox(camera, carMin, carMax, ndc);
    const carW = ((ndc.x1 - ndc.x0) / 2) * frame.imageWidth;
    const carH = ((ndc.y1 - ndc.y0) / 2) * frame.imageHeight;
    const scale = Math.min((band.w * fill.width) / carW, (band.h * fill.height) / carH);
    // never closer than the hero pose would be at this lens
    distance = Math.max(distance / scale, 1e-3);
  }
  camera.position.copy(hero.position).sub(hero.target).multiplyScalar(distance).add(hero.target);
  camera.lookAt(hero.target);
  camera.updateMatrixWorld();
  projectBox(camera, carMin, carMax, ndc);
  out.distance = distance;
  out.fov = dockFov;
  out.offsetX = band.x + band.w / 2 - (((ndc.x0 + ndc.x1) / 2 + 1) / 2) * frame.imageWidth;
  out.offsetY = band.y + band.h / 2 - ((1 - (ndc.y0 + ndc.y1) / 2) / 2) * frame.imageHeight;
  return out;
}
