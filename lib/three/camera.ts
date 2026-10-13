/**
 * Camera maths for the hero (docs/3D-CONTRACT.md §F6, §F8; DESIGN-SYSTEM §7.6).
 *
 * The posters were rendered from the manifest cameras (vertical FOV, no lens shift, 16:9 on
 * desktop, 4:5 on phones) on the page background, so the poster box can use
 * `object-fit: contain` and the canvas reproduces exactly the same framing with
 * `setViewOffset`: the canvas is the poster frame extended into the (invisible) margins. The
 * crossfade poster → canvas therefore never moves the car.
 */
import { MathUtils, Spherical, Vector3 } from "three";

import type { ContainFrame } from "@/lib/three/contain";
import type { ManifestCamera } from "@/lib/three/manifest";

export { containFrame, type ContainFrame } from "@/lib/three/contain";

export type CameraPose = { position: Vector3; target: Vector3; fov: number };

export function poseFrom(cam: ManifestCamera): CameraPose {
  return {
    position: new Vector3(...cam.position),
    target: new Vector3(...cam.target),
    fov: cam.fov,
  };
}

export function clonePose(p: CameraPose): CameraPose {
  return { position: p.position.clone(), target: p.target.clone(), fov: p.fov };
}

const sa = new Spherical();
const sb = new Spherical();
const va = new Vector3();
const vb = new Vector3();

function shortestAngle(from: number, to: number): number {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * Dolly + orbit between two poses: the target moves linearly, the camera travels on a
 * sphere around it (azimuth and elevation interpolate, distance interpolates in log space so
 * the dolly feels even). Writes into `out`.
 */
export function orbitBlend(a: CameraPose, b: CameraPose, t: number, out: CameraPose): CameraPose {
  out.target.lerpVectors(a.target, b.target, t);
  sa.setFromVector3(va.subVectors(a.position, a.target));
  sb.setFromVector3(vb.subVectors(b.position, b.target));
  const radius = Math.exp(MathUtils.lerp(Math.log(sa.radius), Math.log(sb.radius), t));
  const phi = MathUtils.lerp(sa.phi, sb.phi, t);
  const theta = sa.theta + shortestAngle(sa.theta, sb.theta) * t;
  out.position.setFromSphericalCoords(radius, phi, theta).add(out.target);
  out.fov = MathUtils.lerp(a.fov, b.fov, t);
  return out;
}

/** Straight blend (focus glide on top of the scroll camera). Writes into `out`. */
export function lerpPose(a: CameraPose, b: CameraPose, t: number, out: CameraPose): CameraPose {
  out.position.lerpVectors(a.position, b.position, t);
  out.target.lerpVectors(a.target, b.target, t);
  out.fov = MathUtils.lerp(a.fov, b.fov, t);
  return out;
}

/**
 * Focus preset for a selected category (contract F8): look at the bbox centre from
 * `dir × max(minDistance, radius × 2.4)`.
 */
export function focusPose(
  center: Vector3,
  radius: number,
  dir: readonly [number, number, number],
  minDistance: number,
  fov: number,
  out: CameraPose,
): CameraPose {
  const distance = Math.max(minDistance, radius * 2.4);
  out.target.copy(center);
  out.position.set(dir[0], dir[1], dir[2]).normalize().multiplyScalar(distance).add(center);
  out.fov = fov;
  return out;
}

/**
 * `setViewOffset` arguments that make a camera with the poster's aspect and FOV render the
 * contain-framed poster into the whole canvas, optionally shifted (CSS px; positive moves the
 * picture left/up).
 */
export function viewOffsetFor(
  frame: ContainFrame,
  width: number,
  height: number,
  shiftX = 0,
  shiftY = 0,
): [number, number, number, number, number, number] {
  return [
    frame.imageWidth,
    frame.imageHeight,
    -frame.offsetX + shiftX,
    -frame.offsetY + shiftY,
    width,
    height,
  ];
}

/**
 * Shift that moves the camera target (the poster centre) to canvas point (x, y) — used to
 * keep a focused part in the free area next to the drawer / above the sheet.
 */
export function shiftToPlace(frame: ContainFrame, x: number, y: number): [number, number] {
  return [
    frame.offsetX + frame.imageWidth / 2 - x,
    frame.offsetY + frame.imageHeight / 2 - y,
  ];
}
