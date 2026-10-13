import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Box3, Object3D, PerspectiveCamera, Quaternion, Vector3 } from "three";
import { describe, expect, test } from "vitest";

import { SLOT, SLOT_PREFERRED, SLOT_VIEWS, SLOT_VIEW_DEFAULT } from "@/constants/heroSlots";
import { CATEGORIES } from "@/lib/catalog/taxonomy";
import { poseFrom } from "@/lib/three/camera";
import { CAR_IN_POSTER, POSTER_ASPECT, carBand, posterDock, posterFrame, type Crop } from "@/lib/three/framing";
import { HERO_PAGES, PAGE_LENGTH, pageRest, pageReveal, pageStart, slotOf } from "@/lib/three/pages";
import {
  compose,
  createBasis,
  createComposition,
  fitScale,
  hashUnit,
  offAxisDeg,
  projectBox,
  slotBasis,
  slotRotation,
  solveDock,
  unprojectAtDepth,
  viewDirection,
  type DockSolution,
  type Rect,
} from "@/lib/three/slots";
import { viewOffsetFor } from "@/lib/three/camera";
import { DockPoses } from "@/components/three/canvas/poses";
import type { CarScene, CategoryEntry, PartEntry } from "@/components/three/canvas/loadCar";

const root = resolve(__dirname, "../../..");
const manifest = JSON.parse(readFileSync(resolve(root, "public/models/car.manifest.json"), "utf8"));
const thumbs = readFileSync(resolve(root, "3d/blender/config/thumbs.py"), "utf8");

describe("slot views mirror the thumbnail config (3d/blender/config/thumbs.py)", () => {
  const body = thumbs.slice(thumbs.indexOf("THUMBS"), thumbs.indexOf("\n}\n", thumbs.indexOf("THUMBS")));
  const entries = [...body.matchAll(/"([a-z0-9-]+)":\s*\{([^}]*)\}/g)].map((m) => {
    const [, slug, inner] = m;
    const nodes = [...inner.matchAll(/"[a-z0-9-]+__([a-z0-9-]+)"/g)].map((n) => n[1]);
    const num = (key: string) => {
      const hit = inner.match(new RegExp(`"${key}":\\s*(-?[0-9.]+)`));
      return hit ? Number(hit[1]) : undefined;
    };
    return { slug, nodes, az: num("az"), el: num("el"), yaw: num("yaw"), row: /"row":\s*True/.test(inner) };
  });

  test("every thumbnail composition and camera override is mirrored", () => {
    expect(entries.length).toBe(Object.keys(SLOT_VIEWS).length);
    for (const entry of entries) {
      const view = SLOT_VIEWS[entry.slug];
      expect(view, entry.slug).toBeDefined();
      expect(view.nodes, entry.slug).toEqual(entry.nodes);
      expect(view.az, entry.slug).toBe(entry.az);
      expect(view.el, entry.slug).toBe(entry.el);
      expect(view.yaw, entry.slug).toBe(entry.yaw);
      expect(view.row === true, entry.slug).toBe(entry.row);
    }
  });

  test("the preferred-instance order is mirrored", () => {
    const list = thumbs.match(/PREFERRED\s*=\s*\(([^)]*)\)/)?.[1] ?? "";
    expect(SLOT_PREFERRED).toEqual([...list.matchAll(/"([a-z0-9-]+)"/g)].map((m) => m[1]));
  });

  test("every named instance exists in the taxonomy", () => {
    for (const [slug, view] of Object.entries(SLOT_VIEWS)) {
      const category = CATEGORIES.find((c) => c.slug === slug);
      expect(category, slug).toBeDefined();
      for (const node of view.nodes ?? []) {
        expect(category!.instances.map((i) => i.instance), `${slug}__${node}`).toContain(node);
      }
    }
  });
});

function heroCamera(crop: Crop): PerspectiveCamera {
  const pose = manifest.cameras.hero[crop];
  const camera = new PerspectiveCamera(pose.fov, POSTER_ASPECT[crop], 0.05, 60);
  camera.position.set(pose.position[0], pose.position[1], pose.position[2]);
  camera.lookAt(new Vector3(pose.target[0], pose.target[1], pose.target[2]));
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  return camera;
}

describe("the car in its poster and in its band", () => {
  test("CAR_IN_POSTER is the car's bounding box under the manifest's hero cameras", () => {
    for (const crop of ["desktop", "tablet", "mobile"] as const) {
      const ndc = { x0: 0, x1: 0, y0: 0, y1: 0 };
      projectBox(heroCamera(crop), manifest.bbox.min, manifest.bbox.max, ndc);
      const box = CAR_IN_POSTER[crop];
      expect((ndc.x0 + 1) / 2).toBeCloseTo(box.left, 3);
      expect((ndc.x1 + 1) / 2).toBeCloseTo(box.right, 3);
      expect((1 - ndc.y1) / 2).toBeCloseTo(box.top, 3);
      expect((1 - ndc.y0) / 2).toBeCloseTo(box.bottom, 3);
    }
  });

  const cases: { name: string; crop: Crop; canvas: [number, number]; stage: Rect; band: Rect }[] = [
    { name: "desktop 1440×900", crop: "desktop", canvas: [1440, 824], stage: { x: 0, y: 0, w: 1440, h: 824 }, band: { x: 618, y: 398, w: 774, h: 338 } },
    { name: "laptop 1366×768", crop: "desktop", canvas: [1366, 692], stage: { x: 0, y: 0, w: 1366, h: 692 }, band: { x: 587, y: 398, w: 731, h: 206 } },
    { name: "phone 390×844", crop: "mobile", canvas: [390, 656], stage: { x: 0, y: 0, w: 390, h: 487.5 }, band: { x: 0, y: 0, w: 390, h: 226 } },
  ];

  test.each(cases)("the dolly keeps the poster frame and fits the car into its band: $name", (c) => {
    const framing =
      c.crop === "desktop"
        ? { anchorX: 1, anchorY: 1, insetLeft: 0.08, maxWidth: 1680 }
        : { anchorX: 0.5, anchorY: 0.5, insetLeft: 0, maxWidth: 1680 };
    const frame = posterFrame(POSTER_ASPECT[c.crop], c.stage.w, c.stage.h, framing);
    const camera = new PerspectiveCamera();
    const hero = poseFrom(manifest.cameras.hero[c.crop]);
    const out: DockSolution = { distance: 1, fov: 0, offsetX: 0, offsetY: 0 };
    const fill = SLOT.bandFill[c.crop];
    solveDock(camera, hero, POSTER_ASPECT[c.crop], SLOT.dockFov[c.crop], manifest.bbox.min, manifest.bbox.max, frame, c.band, fill, out);
    expect(out.distance).toBeGreaterThan(1);
    expect(out.fov).toBe(SLOT.dockFov[c.crop]);

    // the car's box, as the docked camera draws it, sits in the band and is centred on it
    const ndc = { x0: 0, x1: 0, y0: 0, y1: 0 };
    projectBox(camera, manifest.bbox.min, manifest.bbox.max, ndc);
    const w = ((ndc.x1 - ndc.x0) / 2) * frame.imageWidth;
    const h = ((ndc.y1 - ndc.y0) / 2) * frame.imageHeight;
    expect(w).toBeLessThanOrEqual(c.band.w * fill.width + 1);
    expect(h).toBeLessThanOrEqual(c.band.h * fill.height + 1);
    expect(Math.max(w / (c.band.w * fill.width), h / (c.band.h * fill.height))).toBeGreaterThan(0.98);
    const cx = out.offsetX + (((ndc.x0 + ndc.x1) / 2 + 1) / 2) * frame.imageWidth;
    const cy = out.offsetY + ((1 - (ndc.y0 + ndc.y1) / 2) / 2) * frame.imageHeight;
    expect(cx).toBeCloseTo(c.band.x + c.band.w / 2, 3);
    expect(cy).toBeCloseTo(c.band.y + c.band.h / 2, 3);

    // …and every corner of the grid's side of the canvas stays near the optical axis
    camera.setViewOffset(...viewOffsetFor({ ...frame, offsetX: out.offsetX, offsetY: out.offsetY }, c.canvas[0], c.canvas[1]));
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    const forward = camera.getWorldDirection(new Vector3());
    const basis = createBasis();
    const grid =
      c.crop === "desktop"
        ? { x: c.band.x, y: 60, w: c.band.w, h: c.band.y - 60 }
        : { x: 16, y: c.band.h + 40, w: c.canvas[0] - 32, h: c.canvas[1] - c.band.h - 60 };
    let worst = 0;
    for (const [x, y] of [
      [grid.x + 60, grid.y + 60],
      [grid.x + grid.w - 60, grid.y + 60],
      [grid.x + 60, grid.y + grid.h - 60],
      [grid.x + grid.w - 60, grid.y + grid.h - 60],
    ]) {
      const centre = unprojectAtDepth(camera, forward, x, y, c.canvas[0], c.canvas[1], SLOT.depth, new Vector3());
      worst = Math.max(worst, offAxisDeg(forward, slotBasis(camera, centre, basis)));
    }
    expect(worst).toBeLessThan(24);
  });

  test("the car is fitted into its band less the room it leaves free", () => {
    const band = { x: 0, y: 22, w: 390, h: 200 };
    expect(carBand(band, SLOT.bandInset.desktop)).toEqual(band);
    const phone = carBand(band, SLOT.bandInset.mobile);
    expect(phone.x).toBe(0);
    expect(phone.w).toBe(390);
    expect(phone.y).toBeCloseTo(22 + 200 * SLOT.bandInset.mobile.top, 9);
    expect(phone.y + phone.h).toBeCloseTo(222 - 200 * SLOT.bandInset.mobile.bottom, 9);
    // headroom under the header on every layout with the grid under the car
    expect(SLOT.bandInset.mobile.top).toBeGreaterThan(0);
    expect(SLOT.bandInset.tablet.top).toBeGreaterThan(0);
    // a band too small to inset still has a size
    expect(carBand({ x: 0, y: 0, w: 10, h: 0 }, SLOT.bandInset.mobile).h).toBeGreaterThan(0);
  });

  test("the poster's stand-in for the dolly lands the car on the same band", () => {
    const frame = posterFrame(POSTER_ASPECT.desktop, 1440, 824, { anchorX: 1, anchorY: 1, insetLeft: 0.08, maxWidth: 1680 });
    const band = { x: 618, y: 398, w: 774, h: 338 };
    expect(posterDock("desktop", frame, band, SLOT.bandFill.desktop, 0)).toEqual({ scale: 1, x: 0, y: 0 });
    const t = posterDock("desktop", frame, band, SLOT.bandFill.desktop, 1);
    const car = CAR_IN_POSTER.desktop;
    const cx = frame.offsetX + ((car.left + car.right) / 2) * frame.imageWidth;
    const cy = frame.offsetY + ((car.top + car.bottom) / 2) * frame.imageHeight;
    expect(t.x + t.scale * cx).toBeCloseTo(band.x + band.w / 2, 6);
    expect(t.y + t.scale * cy).toBeCloseTo(band.y + band.h / 2, 6);
    expect(t.scale).toBeLessThan(1);
  });
});

describe("slot geometry", () => {
  test("the thumbnail's view direction turns to face the camera", () => {
    const camera = heroCamera("desktop");
    const basis = slotBasis(camera, new Vector3(0.4, 1.2, 2.5), createBasis());
    const view = viewDirection(SLOT_VIEW_DEFAULT.az, SLOT_VIEW_DEFAULT.el, new Vector3());
    const rot = slotRotation(view, basis, new Quaternion());
    const turned = view.clone().applyQuaternion(rot);
    expect(turned.distanceTo(basis.toCamera)).toBeLessThan(1e-6);
    // world-up stays up on screen
    expect(new Vector3(0, 1, 0).applyQuaternion(rot).dot(basis.up)).toBeGreaterThan(0.9);
    expect(basis.right.dot(basis.up)).toBeCloseTo(0, 6);
  });

  test("one part is centred; a row evens unlike pieces out; the scale fits the cell", () => {
    const basis = { right: new Vector3(1, 0, 0), up: new Vector3(0, 1, 0), toCamera: new Vector3(0, 0, 1) };
    const identity = new Quaternion();
    const small = { localBox: new Box3(new Vector3(-0.05, -0.05, -0.05), new Vector3(0.05, 0.05, 0.05)), pivot: new Vector3(0, 0, 0) };
    const long = { localBox: new Box3(new Vector3(-0.5, -0.1, -0.1), new Vector3(0.5, 0.1, 0.1)), pivot: new Vector3(2, 0, 0) };

    const single = compose([long], false, identity, basis, createComposition(1));
    expect(single.offsets[0].length()).toBeCloseTo(0, 9);
    expect(single.extR).toBeCloseTo(1, 9);
    expect(single.extU).toBeCloseTo(0.2, 9);
    expect(fitScale(single, 0.5, 0.5, 0.8)).toBeCloseTo(0.4, 9);

    const row = compose([small, long], true, identity, basis, createComposition(2));
    expect(row.norms[0]).toBeGreaterThan(1);
    expect(row.norms[1]).toBe(1);
    expect(row.offsets[0].x).toBeLessThan(row.offsets[1].x);
    expect(row.offsets[0].x + row.offsets[1].x).not.toBe(0);

    const kit = compose([small, long], false, identity, basis, createComposition(2));
    expect(kit.offsets[1].x - kit.offsets[0].x).toBeCloseTo(2, 9);
    expect(kit.extR).toBeCloseTo(2.55, 9);
  });

  test("the float phase is stable per slug", () => {
    expect(hashUnit("turbina")).toBe(hashUnit("turbina"));
    expect(hashUnit("turbina")).not.toBe(hashUnit("alternator"));
    for (const c of CATEGORIES) {
      expect(hashUnit(c.slug)).toBeGreaterThanOrEqual(0);
      expect(hashUnit(c.slug)).toBeLessThanOrEqual(1);
    }
  });
});

// ---------------------------------------------------------------- pose evaluator

type ManifestPart = {
  node: string;
  category: string;
  explode: { dir: number[]; distance: number; stage: number; order: number };
  pivot: number[];
  bbox: { min: number[]; max: number[] };
  labelAnchor: number[];
};

function fakeCar(): CarScene {
  const categories = new Map<string, CategoryEntry>();
  for (const category of manifest.categories as { slug: string; hasMesh: boolean }[]) {
    if (!category.hasMesh) continue;
    const parts: PartEntry[] = (manifest.parts as ManifestPart[])
      .filter((p) => p.category === category.slug)
      .map((p) => {
        const pivot = new Vector3(...(p.pivot as [number, number, number]));
        const node = new Object3D();
        node.position.copy(pivot);
        return {
          name: p.node,
          category: category.slug,
          instance: p.node.split("__")[2] ?? "",
          node,
          pivot,
          dir: new Vector3(...(p.explode.dir as [number, number, number])).normalize(),
          distance: p.explode.distance,
          stage: p.explode.stage,
          order: p.explode.order,
          labelAnchor: new Vector3(...(p.labelAnchor as [number, number, number])),
          localBox: new Box3(
            new Vector3(...(p.bbox.min as [number, number, number])).sub(pivot),
            new Vector3(...(p.bbox.max as [number, number, number])).sub(pivot),
          ),
          meshes: [],
          xray: false,
        };
      });
    categories.set(category.slug, {
      slug: category.slug,
      parts,
      focusParts: parts.slice(0, 1),
      focus: { dir: [0, 1, 0], minDistance: 1, fov: 30 },
      highlight: { hover: { value: 0 }, select: { value: 0 }, dim: { value: 0 }, dock: { value: 0 } },
    });
  }
  return { categories } as unknown as CarScene;
}

/** What the scene would draw: every visible node's transform (a hidden node draws nothing). */
function snapshot(car: CarScene): string {
  const out: string[] = [];
  for (const category of car.categories.values()) {
    for (const part of category.parts) {
      const n = part.node;
      out.push(
        n.visible
          ? [...n.position.toArray(), ...n.quaternion.toArray(), n.scale.x].map((v) => v.toFixed(6)).join(",")
          : "hidden",
      );
    }
  }
  return out.join("|");
}

function setup() {
  const car = fakeCar();
  const camera = heroCamera("desktop");
  const forward = camera.getWorldDirection(new Vector3());
  const poses = new DockPoses(car, camera);
  poses.setCanvas(1440, 824);
  for (const page of HERO_PAGES) {
    poses.setRects(
      page.categories.map((c, index) => ({
        slug: c.slug,
        rect: { x: 640 + (index % 5) * 150, y: 80 + Math.floor(index / 5) * 170, w: 124, h: 124 },
      })),
    );
    poses.setChip(page.page, 700 + page.page * 90, 800);
  }
  return { car, poses, forward, camera };
}

describe("pose evaluator (HERO-V2 §4.2)", () => {
  test("assembled at 0: every part at its pivot, unturned, full size", () => {
    const { car, poses, forward } = setup();
    poses.update(0, 0, 0, forward);
    for (const category of car.categories.values()) {
      expect(category.highlight.dock.value).toBe(0);
      for (const part of category.parts) {
        expect(part.node.visible).toBe(true);
        expect(part.node.position.distanceTo(part.pivot)).toBe(0);
        expect(part.node.scale.x).toBe(1);
      }
    }
  });

  test("a page at rest: its compositions are docked, the rest of each category is tucked away, earlier pages are gone", () => {
    const { car, poses, forward } = setup();
    for (const page of HERO_PAGES) {
      poses.update(pageRest(page.page), 0, 0, forward);
      for (const c of page.categories) {
        const category = car.categories.get(c.slug);
        if (!category) continue; // the two categories without a mesh
        expect(category.highlight.dock.value, c.slug).toBe(1);
        const visible = category.parts.filter((p) => p.node.visible);
        expect(visible.length, c.slug).toBe(SLOT_VIEWS[c.slug]?.nodes?.length ?? 1);
        for (const part of visible) expect(part.node.position.distanceTo(part.pivot)).toBeGreaterThan(1);
      }
      for (const earlier of HERO_PAGES.slice(0, page.page - 1)) {
        for (const c of earlier.categories) {
          for (const part of car.categories.get(c.slug)?.parts ?? []) expect(part.node.visible).toBe(false);
        }
      }
      for (const later of HERO_PAGES.slice(page.page)) {
        for (const c of later.categories) {
          for (const part of car.categories.get(c.slug)?.parts ?? []) {
            expect(part.node.position.distanceTo(part.pivot)).toBe(0);
          }
        }
      }
    }
  });

  test("a reveal point leaves the page's parts on the car", () => {
    const { car, poses, forward } = setup();
    poses.update(pageReveal(3), 0, 0, forward);
    for (const c of HERO_PAGES[2].categories) {
      for (const part of car.categories.get(c.slug)?.parts ?? []) {
        expect(part.node.visible).toBe(true);
        expect(part.node.position.distanceTo(part.pivot)).toBe(0);
      }
    }
    expect(poses.dockOf("kocioni-diskovi")).toBe(1);
    expect(poses.dockOf("amortizeri-opruge")).toBe(0);
  });

  test("scrolling back plays the same frames: the pose depends on the progress only", () => {
    const { car, poses, forward } = setup();
    const steps = Array.from({ length: 81 }, (_, i) => i / 80);
    const forwardRun = new Map<number, string>();
    for (const p of steps) {
      poses.update(p, 0, 0, forward);
      forwardRun.set(p, snapshot(car));
    }
    for (const p of [...steps].reverse()) {
      poses.update(p, 0, 0, forward);
      expect(snapshot(car), `p=${p}`).toBe(forwardRun.get(p));
    }
    // …and after any jump
    for (const p of [0.9, 0.1, 0.55, 0.3, 1, 0]) {
      poses.update(p, 0, 0, forward);
      expect(snapshot(car), `jump to ${p}`).toBe(forwardRun.get(steps.find((s) => Math.abs(s - p) < 1e-9)!));
    }
  });

  test("in flight a part's size on screen goes from the car's to the slot's, never past either", () => {
    const { car, poses, forward, camera } = setup();
    // scale over view depth is the size on screen; large panels shrink into a slot, small parts grow
    for (const slug of ["hauba", "vrata", "branici", "egr-ventil", "kocione-plocice", "auspuh"]) {
      const address = slotOf(slug)!;
      const sizes: number[] = [];
      poses.update(pageRest(address.page), 0, 0, forward);
      const shown = car.categories.get(slug)!.parts.find((part) => part.node.visible);
      expect(shown, slug).toBeDefined();
      for (let i = 0; i <= 200; i += 1) {
        poses.update(pageStart(address.page) + (i / 200) * 0.8 * PAGE_LENGTH, 0, 0, forward);
        const node = shown!.node;
        const depth = node.position.clone().sub(camera.position).dot(forward);
        sizes.push(node.scale.x / depth);
      }
      const start = sizes[0];
      const end = sizes[sizes.length - 1];
      // 6 %: the lift along the part's own direction (≤ 0.3 m at 5 m and more) changes its
      // distance, at full size
      const low = Math.min(start, end) * 0.94;
      const high = Math.max(start, end) * 1.06;
      for (const size of sizes) {
        expect(size, slug).toBeGreaterThanOrEqual(low);
        expect(size, slug).toBeLessThanOrEqual(high);
      }
    }
  });

  test("the flight's arc is a share of the path on screen, however far the slot is in depth", () => {
    const { car, poses, forward, camera } = setup();
    const screenY = (v: Vector3) => ((1 - v.clone().project(camera).y) / 2) * 824;
    const screenX = (v: Vector3) => ((v.clone().project(camera).x + 1) / 2) * 1440;
    for (const slug of ["hauba", "vrata", "kocioni-diskovi", "auspuh"]) {
      const address = slotOf(slug)!;
      poses.update(pageRest(address.page), 0, 0, forward);
      const shown = car.categories.get(slug)!.parts.find((part) => part.node.visible)!;
      const end = shown.node.position.clone();
      const start = shown.pivot;
      const path = Math.hypot(screenX(end) - screenX(start), screenY(end) - screenY(start));
      let top = Infinity;
      for (let i = 0; i <= 200; i += 1) {
        poses.update(pageStart(address.page) + (i / 200) * 0.8 * PAGE_LENGTH, 0, 0, forward);
        top = Math.min(top, screenY(shown.node.position));
      }
      // never higher than the higher end by more than the arc's share (and the lift, ≤ 0.3 m)
      const highest = Math.min(screenY(start), screenY(end));
      expect(highest - top, slug).toBeLessThan(SLOT.arc * path * 1.3 + 40);
    }
  });

  test("where the grid is under the car a part takes the straight way and a shorter lift", () => {
    const { car, poses, forward } = setup();
    const address = slotOf("hauba")!;
    const mid = pageStart(address.page) + 0.3 * PAGE_LENGTH;
    poses.update(mid, 0, 0, forward);
    const arched = car.categories.get("hauba")!.parts[0].node.position.clone();
    poses.touch = true;
    poses.update(mid, 0, 0, forward);
    const straight = car.categories.get("hauba")!.parts[0].node.position.clone();
    expect(arched.distanceTo(straight)).toBeGreaterThan(1e-3);
    expect(SLOT.hopTouch).toBeLessThan(SLOT.hop);
    expect(SLOT.arcTouch).toBe(0);
  });

  test("the float is zero-mean: it moves a seated part and leaves the car alone", () => {
    const { car, poses, forward } = setup();
    const p = pageRest(2);
    poses.update(p, 0, 0, forward);
    const still = snapshot(car);
    expect(poses.anySeated).toBe(true);
    poses.update(p, 1.7, 1, forward);
    expect(snapshot(car)).not.toBe(still);
    poses.update(p, 1.7, 0, forward);
    expect(snapshot(car)).toBe(still);
    poses.update(0, 1.7, 1, forward);
    expect(poses.anySeated).toBe(false);
  });

  test("reduced motion: no flight — a part is on the car or gone", () => {
    const { car, poses, forward } = setup();
    poses.reduced = true;
    const address = slotOf("kocioni-diskovi")!;
    for (let i = 0; i <= 60; i += 1) {
      poses.update(i / 60, 0, 0, forward);
      for (const part of car.categories.get("kocioni-diskovi")!.parts) {
        const atPivot = part.node.position.distanceTo(part.pivot) === 0;
        expect(part.node.visible ? atPivot : true).toBe(true);
      }
    }
    expect(address.page).toBe(2);
  });
});
