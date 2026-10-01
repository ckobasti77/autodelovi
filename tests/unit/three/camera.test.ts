import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PerspectiveCamera, Vector3 } from "three";
import { describe, expect, test } from "vitest";

import {
  clonePose,
  containFrame,
  focusPose,
  orbitBlend,
  poseFrom,
  shiftToPlace,
  viewOffsetFor,
} from "@/lib/three/camera";
import { POSTER_ASPECT, STAGE_FRAME_MAX, framingFor, posterFrame } from "@/lib/three/framing";
import { parseCarManifest } from "@/lib/three/manifest";

const manifest = parseCarManifest(
  JSON.parse(readFileSync(resolve(__dirname, "../../../public/models/car.manifest.json"), "utf8")),
);

/** Projects a world point with a camera to CSS px of a width × height canvas. */
function toScreen(camera: PerspectiveCamera, p: Vector3, width: number, height: number) {
  const v = p.clone().project(camera);
  return { x: ((v.x + 1) / 2) * width, y: ((1 - v.y) / 2) * height };
}

function cameraFor(
  pose: ReturnType<typeof poseFrom>,
  aspect: number,
  offset?: ReturnType<typeof viewOffsetFor>,
) {
  const camera = new PerspectiveCamera(pose.fov, aspect, 0.05, 100);
  camera.position.copy(pose.position);
  camera.lookAt(pose.target);
  if (offset) camera.setViewOffset(...offset);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  return camera;
}

describe("contain framing (poster ↔ canvas parity)", () => {
  test("width-limited and height-limited boxes", () => {
    const narrow = containFrame(16 / 9, 1024, 704, 0.5, 1);
    expect(narrow.imageWidth).toBe(1024);
    expect(narrow.imageHeight).toBeCloseTo(576, 6);
    expect(narrow.offsetX).toBe(0);
    expect(narrow.offsetY).toBeCloseTo(128, 6);

    const wide = containFrame(16 / 9, 2560, 1376, 0.5, 1);
    expect(wide.imageHeight).toBe(1376);
    expect(wide.imageWidth).toBeCloseTo(1376 * (16 / 9), 6);
    expect(wide.offsetX).toBeCloseTo((2560 - 1376 * (16 / 9)) / 2, 6);
  });

  test("a point lands on the same pixel as in the contain-drawn poster", () => {
    const pose = poseFrom(manifest.cameras.hero.desktop);
    const posterW = 1920;
    const posterH = 1080;
    const poster = cameraFor(pose, posterW / posterH);
    const point = new Vector3(0.6, 0.4, 1.8);
    const inPoster = toScreen(poster, point, posterW, posterH);

    for (const [W, H, ax, ay] of [
      [1440, 836, 0.5, 1],
      [1024, 704, 0.5, 1],
      [2560, 1376, 0.5, 1],
      [1280, 656, 0.3, 0.8],
    ] as const) {
      const frame = containFrame(posterW / posterH, W, H, ax, ay);
      const canvas = cameraFor(pose, posterW / posterH, viewOffsetFor(frame, W, H));
      const inCanvas = toScreen(canvas, point, W, H);
      const scale = frame.imageWidth / posterW;
      expect(inCanvas.x).toBeCloseTo(frame.offsetX + inPoster.x * scale, 3);
      expect(inCanvas.y).toBeCloseTo(frame.offsetY + inPoster.y * scale, 3);
    }
  });

  test("overlay framing: 8 % left inset, bottom-right anchor (matches the poster CSS)", () => {
    const f = framingFor(false, true);
    expect(f).toMatchObject({ crop: "desktop", anchorX: 1, anchorY: 1, insetLeft: 0.08 });
    const frame = posterFrame(16 / 9, 1440, 836, f);
    // width-limited inside the inset box: image = 1324.8 px wide, flush right and bottom
    expect(frame.imageWidth).toBeCloseTo(1440 * 0.92, 6);
    expect(frame.offsetX + frame.imageWidth).toBeCloseTo(1440, 6);
    expect(frame.offsetY + frame.imageHeight).toBeCloseTo(836, 6);
  });

  test("phones and tablets: own crop, centred in the stage (MOT-01)", () => {
    const phone = framingFor(true, false);
    expect(phone).toMatchObject({ crop: "mobile", anchorX: 0.5, anchorY: 0.5, insetLeft: 0 });
    expect(POSTER_ASPECT.mobile).toBeCloseTo(4 / 5, 9);
    // 390 × 672 stage: width-limited 390 × 487.5, the spare 184.5 px split above and below
    const stacked = posterFrame(POSTER_ASPECT.mobile, 390, 672, phone);
    expect(stacked.offsetX).toBe(0);
    expect(stacked.imageWidth).toBe(390);
    expect(stacked.offsetY).toBeCloseTo((672 - 487.5) / 2, 6);

    const tablet = framingFor(false, false);
    expect(tablet).toMatchObject({ crop: "tablet", anchorX: 0.5, anchorY: 0.5, insetLeft: 0 });
    expect(POSTER_ASPECT.tablet).toBe(1);
    const portrait = posterFrame(POSTER_ASPECT.tablet, 768, 852, tablet);
    expect(portrait).toMatchObject({ imageWidth: 768, imageHeight: 768, offsetX: 0, offsetY: 42 });
  });

  test("wide screens: the framing box stops at STAGE_FRAME_MAX and stays centred (VIS-06)", () => {
    const f = framingFor(false, true);
    expect(f.maxWidth).toBe(STAGE_FRAME_MAX);
    // ≤ the cap nothing changes
    const at1680 = posterFrame(16 / 9, 1680, 1016, f);
    expect(at1680.offsetX + at1680.imageWidth).toBeCloseTo(1680, 6);
    for (const [W, H] of [
      [1920, 1016],
      [2560, 1376],
      [3440, 1376],
    ] as const) {
      const frame = posterFrame(16 / 9, W, H, f);
      const boxLeft = (W - STAGE_FRAME_MAX) / 2;
      expect(frame.imageWidth).toBeCloseTo(STAGE_FRAME_MAX * 0.92, 6);
      expect(frame.offsetX).toBeCloseTo(boxLeft + STAGE_FRAME_MAX * 0.08, 6);
      expect(frame.offsetX + frame.imageWidth).toBeCloseTo(W - boxLeft, 6);
    }
  });

  test("shiftToPlace moves the camera target to the requested pixel", () => {
    const pose = poseFrom(manifest.cameras.exploded.desktop);
    const W = 1440;
    const H = 836;
    const frame = containFrame(16 / 9, W, H, 0.5, 1);
    const [sx, sy] = shiftToPlace(frame, 700, 400);
    const camera = cameraFor(pose, 16 / 9, viewOffsetFor(frame, W, H, sx, sy));
    const p = toScreen(camera, pose.target, W, H);
    expect(p.x).toBeCloseTo(700, 3);
    expect(p.y).toBeCloseTo(400, 3);
  });
});

describe("camera blends", () => {
  test("orbit blend hits both manifest cameras exactly", () => {
    const a = poseFrom(manifest.cameras.hero.desktop);
    const b = poseFrom(manifest.cameras.exploded.desktop);
    const out = clonePose(a);
    orbitBlend(a, b, 0, out);
    expect(out.position.distanceTo(a.position)).toBeLessThan(1e-9);
    orbitBlend(a, b, 1, out);
    expect(out.position.distanceTo(b.position)).toBeLessThan(1e-9);
    expect(out.target.distanceTo(b.target)).toBeLessThan(1e-9);
  });

  test("orbit blend stays on the interpolated sphere (no chord shortcut)", () => {
    const a = poseFrom(manifest.cameras.hero.desktop);
    const b = poseFrom(manifest.cameras.exploded.desktop);
    const out = clonePose(a);
    orbitBlend(a, b, 0.5, out);
    const ra = a.position.distanceTo(a.target);
    const rb = b.position.distanceTo(b.target);
    const r = out.position.distanceTo(out.target);
    expect(r).toBeCloseTo(Math.sqrt(ra * rb), 6);
  });

  test("focus pose keeps the minimum distance", () => {
    const out = clonePose(poseFrom(manifest.cameras.hero.desktop));
    focusPose(new Vector3(1, 0.5, 1), 0.1, [0, 1, 0], 1.5, 30, out);
    expect(out.position.distanceTo(out.target)).toBeCloseTo(1.5, 9);
    focusPose(new Vector3(1, 0.5, 1), 1, [0, 1, 0], 1.5, 30, out);
    expect(out.position.distanceTo(out.target)).toBeCloseTo(2.4, 9);
    expect(out.fov).toBe(30);
  });
});
