/**
 * Pose evaluator of the hero v2 grid (docs/3d/HERO-V2.md §4.2, §6): where every part node is at
 * scroll progress `p`. A part lifts out along its explode direction, is carried on an arc to
 * its category's slot while it scales and turns to the thumbnail's angle, seats, and floats;
 * when the next page starts it shrinks toward its navigator chip and is hidden.
 *
 * The pose is a pure function of (p, camera, slot rectangles) — no stored motion state — so
 * scrolling back plays the same frames in reverse. The float is time-based, zero-mean and
 * multiplied by the dock factor, so it never disturbs that clock. Nothing here allocates per
 * frame: every vector the hot path needs is created once.
 */
import { Quaternion, Vector3, type PerspectiveCamera } from "three";

import { SLOT, SLOT_PREFERRED, SLOT_VIEWS, SLOT_VIEW_DEFAULT } from "@/constants/heroSlots";
import { clamp01, power2InOut } from "@/lib/three/explode";
import { PAGE_COUNT, flightOf, leaveOf, pageAt, slotOf, type SlotAddress } from "@/lib/three/pages";
import {
  compose,
  createBasis,
  createComposition,
  fitScale,
  hashUnit,
  offAxisDeg,
  slotBasis,
  slotRotation,
  unprojectAtDepth,
  viewDirection,
  type Composition,
  type Rect,
  type SlotBasis,
} from "@/lib/three/slots";
import type { CarScene, CategoryEntry, PartEntry } from "@/components/three/canvas/loadCar";

type SlotPart = {
  part: PartEntry;
  /** Centre of the assembled box relative to the pivot. */
  boxCentre: Vector3;
};

type Slot = {
  slug: string;
  address: SlotAddress;
  category: CategoryEntry;
  shown: SlotPart[];
  /** The shown parts as `compose()` reads them (same order). */
  shownParts: PartEntry[];
  tucked: SlotPart[];
  row: boolean;
  view: Vector3;
  comp: Composition;
  basis: SlotBasis;
  centre: Vector3;
  rot: Quaternion;
  scale: number;
  /** World units per CSS pixel at the slot. */
  perPx: number;
  rect: Rect;
  hasRect: boolean;
  laidOut: boolean;
  bobOmega: number;
  yawOmega: number;
  bobPhase: number;
  yawPhase: number;
  /** Last dock factor written (0 on the car … 1 seated). */
  dock: number;
  /** 0 on the car · 1 in flight or seated · 2 gone. */
  state: 0 | 1 | 2;
};

const TAU = Math.PI * 2;
const IDENTITY = new Quaternion();
const from = new Vector3();
const to = new Vector3();
const tmp = new Vector3();
const rotW = new Quaternion();
const qYaw = new Quaternion();
const camUp = new Vector3();
const chip = new Vector3();

function rankOf(part: PartEntry): number {
  const index = SLOT_PREFERRED.indexOf(part.instance);
  return index < 0 ? SLOT_PREFERRED.length : index;
}

export type SlotReport = { slug: string; w: number; h: number; dx: number; dy: number; angle: number };

export class DockPoses {
  private readonly slots: Slot[] = [];
  private readonly bySlug = new Map<string, Slot>();
  private readonly camera: PerspectiveCamera;
  private readonly cameraKey = new Float64Array(32);
  private readonly chips: { x: number; y: number }[] = [];
  private width = 1;
  private height = 1;
  private dirty = true;
  /** Reduced motion: no flight — a part is on the car or gone. */
  reduced = false;
  /** Touch layout: a smaller bob. */
  touch = false;
  /** True while at least one slot is seated and visible (the float needs frames). */
  anySeated = false;

  constructor(car: CarScene, camera: PerspectiveCamera) {
    this.camera = camera;
    for (let page = 0; page <= PAGE_COUNT; page += 1) this.chips.push({ x: 0, y: 0 });
    for (const category of car.categories.values()) {
      const address = slotOf(category.slug);
      if (!address || category.parts.length === 0) continue;
      const view = SLOT_VIEWS[category.slug] ?? {};
      const sorted = [...category.parts].sort(
        (a, b) => rankOf(a) - rankOf(b) || a.name.localeCompare(b.name),
      );
      const wanted = view.nodes ?? [sorted[0].instance];
      const wrap = (part: PartEntry): SlotPart => ({
        part,
        boxCentre: part.localBox.getCenter(new Vector3()),
      });
      const shown = wanted
        .map((instance) => sorted.find((p) => p.instance === instance))
        .filter((p): p is PartEntry => Boolean(p))
        .map(wrap);
      if (shown.length === 0) shown.push(wrap(sorted[0]));
      const tucked = sorted.filter((p) => !shown.some((s) => s.part === p)).map(wrap);
      const seed = hashUnit(category.slug);
      const slot: Slot = {
        slug: category.slug,
        address,
        category,
        shown,
        shownParts: shown.map((entry) => entry.part),
        tucked,
        row: view.row === true,
        view: viewDirection(
          (view.az ?? SLOT_VIEW_DEFAULT.az) + (view.yaw ?? 0),
          view.el ?? SLOT_VIEW_DEFAULT.el,
          new Vector3(),
        ),
        comp: createComposition(shown.length),
        basis: createBasis(),
        centre: new Vector3(),
        rot: new Quaternion(),
        scale: 1,
        perPx: 0,
        rect: { x: 0, y: 0, w: 0, h: 0 },
        hasRect: false,
        laidOut: false,
        bobOmega: TAU / (SLOT.bobPeriod[0] + seed * (SLOT.bobPeriod[1] - SLOT.bobPeriod[0])),
        yawOmega: TAU / (SLOT.yawPeriod[0] + hashUnit(category.slug + "y") * (SLOT.yawPeriod[1] - SLOT.yawPeriod[0])),
        bobPhase: seed * TAU,
        yawPhase: hashUnit(category.slug + "p") * TAU,
        dock: 0,
        state: 0,
      };
      this.slots.push(slot);
      this.bySlug.set(slot.slug, slot);
    }
  }

  setCanvas(width: number, height: number): void {
    if (width === this.width && height === this.height) return;
    this.width = width;
    this.height = height;
    this.dirty = true;
  }

  /** Cell rectangles of one page (canvas px). Rectangles of other pages stay as they were. */
  setRects(rects: ReadonlyArray<{ slug: string; rect: Rect }>): void {
    for (const entry of rects) {
      const slot = this.bySlug.get(entry.slug);
      if (!slot) continue;
      const r = slot.rect;
      if (slot.hasRect && r.x === entry.rect.x && r.y === entry.rect.y && r.w === entry.rect.w && r.h === entry.rect.h) continue;
      r.x = entry.rect.x;
      r.y = entry.rect.y;
      r.w = entry.rect.w;
      r.h = entry.rect.h;
      slot.hasRect = entry.rect.w > 0 && entry.rect.h > 0;
      this.dirty = true;
    }
  }

  /** Where a page's parts shrink to when it leaves (canvas px; the navigator chip). */
  setChip(page: number, x: number, y: number): void {
    const target = this.chips[page];
    if (target) {
      target.x = x;
      target.y = y;
    }
  }

  /** Dock factor of a category as last written (0 on the car … 1 seated). */
  dockOf(slug: string): number {
    return this.bySlug.get(slug)?.dock ?? 0;
  }

  private cameraChanged(): boolean {
    const key = this.cameraKey;
    const world = this.camera.matrixWorld.elements;
    const proj = this.camera.projectionMatrix.elements;
    let changed = false;
    for (let i = 0; i < 16; i += 1) {
      if (key[i] !== world[i]) {
        key[i] = world[i];
        changed = true;
      }
      if (key[16 + i] !== proj[i]) {
        key[16 + i] = proj[i];
        changed = true;
      }
    }
    return changed;
  }

  private layOut(slot: Slot, forward: Vector3): void {
    const { rect } = slot;
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    unprojectAtDepth(this.camera, forward, cx, cy, this.width, this.height, SLOT.depth, slot.centre);
    slot.perPx = unprojectAtDepth(
      this.camera,
      forward,
      cx + 1,
      cy,
      this.width,
      this.height,
      SLOT.depth,
      tmp,
    ).distanceTo(slot.centre);
    slotBasis(this.camera, slot.centre, slot.basis);
    slotRotation(slot.view, slot.basis, slot.rot);
    compose(slot.shownParts, slot.row, slot.rot, slot.basis, slot.comp);
    slot.scale = fitScale(slot.comp, rect.w * slot.perPx, rect.h * slot.perPx, SLOT.fit);
    slot.laidOut = true;
  }

  /**
   * Writes every part node for progress `p` at time `time` (seconds). `floatGain` (0 … 1) is
   * the idle envelope of the float. The camera's matrices must be current.
   */
  update(p: number, time: number, floatGain: number, forward: Vector3): void {
    const current = pageAt(p);
    const relayout = this.cameraChanged() || this.dirty;
    this.dirty = false;
    camUp.setFromMatrixColumn(this.camera.matrixWorld, 1);
    const bobPx = this.touch ? SLOT.bobPxTouch : SLOT.bobPx;
    const yawMax = (SLOT.yawDeg * Math.PI) / 180;
    let anySeated = false;

    for (let s = 0; s < this.slots.length; s += 1) {
      const slot = this.slots[s];
      const page = slot.address.page;
      const flight = page > current ? 0 : page < current ? 1 : flightOf(p, slot.address);
      const leave = page < current - 1 ? 1 : page === current ? 0 : page > current ? 0 : leaveOf(p, page);
      const highlight = slot.category.highlight;

      // on the car
      if (flight <= 0) {
        if (slot.state !== 0) {
          this.rest(slot);
          slot.state = 0;
        }
        slot.dock = 0;
        highlight.dock.value = 0;
        continue;
      }
      // gone: left the grid, or (reduced motion) taken off without a flight
      if (leave >= 1 || this.reduced) {
        if (slot.state !== 2) {
          this.hide(slot);
          slot.state = 2;
        }
        slot.dock = 1;
        highlight.dock.value = 1;
        continue;
      }

      if (slot.hasRect && (relayout || !slot.laidOut)) this.layOut(slot, forward);
      const ready = slot.laidOut;
      const lift = power2InOut(clamp01(flight / SLOT.liftSpan));
      const carry = ready ? power2InOut(clamp01((flight - SLOT.carryFrom) / (1 - SLOT.carryFrom))) : 0;
      const settle = clamp01((flight - SLOT.settleFrom) / (1 - SLOT.settleFrom)) * (1 - leave) * floatGain;
      const bob = settle > 0 ? Math.sin(time * slot.bobOmega + slot.bobPhase) * bobPx * slot.perPx * settle : 0;
      const yaw = settle > 0 ? Math.sin(time * slot.yawOmega + slot.yawPhase) * yawMax * settle : 0;
      if (yaw !== 0) rotW.copy(slot.rot).premultiply(qYaw.setFromAxisAngle(slot.basis.up, yaw));
      else rotW.copy(slot.rot);
      if (leave > 0) {
        const target = this.chips[page];
        unprojectAtDepth(this.camera, forward, target.x, target.y, this.width, this.height, SLOT.depth, chip);
      }
      const { right, up, toCamera } = slot.basis;
      const scale = slot.scale;

      for (let i = 0; i < slot.shown.length; i += 1) {
        const { part, boxCentre } = slot.shown[i];
        const node = part.node;
        node.visible = true;
        from.copy(part.pivot).addScaledVector(part.dir, Math.min(part.distance, SLOT.hop) * lift);
        if (carry <= 0) {
          node.position.copy(from);
          node.quaternion.copy(IDENTITY);
          node.scale.setScalar(1);
          continue;
        }
        const offset = slot.comp.offsets[i];
        const own = scale * slot.comp.norms[i];
        tmp.copy(boxCentre).applyQuaternion(rotW).multiplyScalar(own);
        to.copy(slot.centre)
          .addScaledVector(right, offset.x * scale)
          .addScaledVector(up, offset.y * scale + bob)
          .addScaledVector(toCamera, offset.z * scale)
          .sub(tmp);
        const arc = from.distanceTo(to) * SLOT.arc * Math.sin(Math.PI * carry);
        node.position.lerpVectors(from, to, carry).addScaledVector(camUp, arc);
        node.quaternion.copy(IDENTITY).slerp(rotW, carry);
        let size = 1 + (own - 1) * carry;
        if (leave > 0) {
          node.position.lerp(chip, leave);
          size *= 1 - leave;
        }
        node.scale.setScalar(Math.max(size, 1e-4));
      }

      // the other instances arrive with the composition and tuck behind it
      const tuck = 1 - clamp01((carry - SLOT.tuckFrom) / (1 - SLOT.tuckFrom));
      for (let i = 0; i < slot.tucked.length; i += 1) {
        const { part, boxCentre } = slot.tucked[i];
        const node = part.node;
        if (tuck <= 0 || leave > 0) {
          node.visible = false;
          continue;
        }
        node.visible = true;
        from.copy(part.pivot).addScaledVector(part.dir, Math.min(part.distance, SLOT.hop) * lift);
        if (carry <= 0) {
          node.position.copy(from);
          node.quaternion.copy(IDENTITY);
          node.scale.setScalar(1);
          continue;
        }
        tmp.copy(boxCentre).applyQuaternion(rotW).multiplyScalar(scale);
        to.copy(slot.centre).addScaledVector(toCamera, -0.02).sub(tmp);
        const arc = from.distanceTo(to) * SLOT.arc * Math.sin(Math.PI * carry);
        node.position.lerpVectors(from, to, carry).addScaledVector(camUp, arc);
        node.quaternion.copy(IDENTITY).slerp(rotW, carry);
        node.scale.setScalar(Math.max((1 + (scale - 1) * carry) * tuck, 1e-4));
      }

      slot.state = 1;
      slot.dock = carry;
      highlight.dock.value = carry;
      if (flight >= 1 && leave <= 0) anySeated = true;
    }
    this.anySeated = anySeated;
  }

  /** Back on the car: pivot, no rotation, full size. */
  private rest(slot: Slot): void {
    for (const list of [slot.shown, slot.tucked]) {
      for (const { part } of list) {
        part.node.visible = true;
        part.node.position.copy(part.pivot);
        part.node.quaternion.copy(IDENTITY);
        part.node.scale.setScalar(1);
      }
    }
  }

  private hide(slot: Slot): void {
    for (const list of [slot.shown, slot.tucked]) {
      for (const { part } of list) part.node.visible = false;
    }
  }

  /** Slots that are docked right now: projected size and distance from their cell (QA hook). */
  report(forward: Vector3): SlotReport[] {
    const out: SlotReport[] = [];
    const v = new Vector3();
    for (const slot of this.slots) {
      if (slot.state !== 1 || slot.dock < 1 || !slot.hasRect) continue;
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const { part } of slot.shown) {
        part.node.updateMatrixWorld(true);
        const { min, max } = part.localBox;
        for (let i = 0; i < 8; i += 1) {
          v.set(i & 1 ? max.x : min.x, i & 2 ? max.y : min.y, i & 4 ? max.z : min.z)
            .applyMatrix4(part.node.matrixWorld)
            .project(this.camera);
          const x = ((v.x + 1) / 2) * this.width;
          const y = ((1 - v.y) / 2) * this.height;
          x0 = Math.min(x0, x);
          x1 = Math.max(x1, x);
          y0 = Math.min(y0, y);
          y1 = Math.max(y1, y);
        }
      }
      out.push({
        slug: slot.slug,
        w: Math.round(x1 - x0),
        h: Math.round(y1 - y0),
        dx: Math.round((x0 + x1) / 2 - (slot.rect.x + slot.rect.w / 2)),
        dy: Math.round((y0 + y1) / 2 - (slot.rect.y + slot.rect.h / 2)),
        angle: Math.round(offAxisDeg(forward, slot.basis) * 10) / 10,
      });
    }
    return out;
  }
}
