/**
 * Imperative core of the 3D hero — everything that changes per frame lives here, outside
 * React (refs-not-state, 3d-scrollytelling rules; docs/3d/HERO-V2.md §4, §6):
 *
 * - parts: `DockPoses` writes every part node from the scroll progress — lift, carry to the
 *   grid slot, seat, float, leave (a pure function of progress, camera and slot rectangles);
 * - camera: the poster camera with contain framing (`setViewOffset`); from progress 0.01 it
 *   backs away along its view line into the car's band (a dolly and a longer lens — never a
 *   smaller projection frame), plus a focus glide (0.9 s power3.inOut) to a selected category
 *   that is still on the car;
 * - X-ray: shell alpha 0.22 → 0.10 while page 1 leaves, edge opacity, contact shadow fading
 *   with the share of parts gone;
 * - highlight: hover / selected / dimmed uniforms per category (§7.5), and a ghost of a docked
 *   category at its origin on the car;
 * - picking: BVH raycasts; parts that are docked or gone never answer (their slot is a link),
 *   opaque parts win over an assembled X-ray panel in front of them.
 */
import {
  Box3,
  Color,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Raycaster,
  Vector2,
  Vector3,
  type PerspectiveCamera,
} from "three";

import { gsap } from "@/lib/gsap/client";
import {
  clonePose,
  lerpPose,
  poseFrom,
  viewOffsetFor,
  type CameraPose,
  type ContainFrame,
} from "@/lib/three/camera";
import { clamp01, power2InOut } from "@/lib/three/explode";
import { POSTER_ASPECT, posterFrame, type Crop } from "@/lib/three/framing";
import { PAGE_FIRST, PAGE_LAST, dockBlend, pageLocal } from "@/lib/three/pages";
import { solveDock, type DockSolution, type Rect } from "@/lib/three/slots";
import { SLOT } from "@/constants/heroSlots";
import { DUR, EASE } from "@/constants/motion";
import { XRAY, XRAY_RUNTIME } from "@/constants/xray";
import type { CarScene, CategoryEntry } from "@/components/three/canvas/loadCar";
import type { EdgeMaterials } from "@/components/three/canvas/enhance";
import { DockPoses, type SlotReport } from "@/components/three/canvas/poses";

export type { Crop };

/** Canvas size, the poster framing and the poster (stage) box inside the canvas. */
export type Layout = {
  width: number;
  height: number;
  crop: Crop;
  anchorX: number;
  anchorY: number;
  insetLeft: number;
  maxWidth: number;
  /** The stage box the poster is framed in (CSS px, canvas coordinates). */
  stage: Rect;
};

/** Free area of the canvas for a focused part (CSS px, canvas coordinates): centre + height. */
export type FreeArea = { x: number; y: number; h: number };

/** Share of the free area's height a focused category may take (bounding-sphere diameter). */
const FOCUS_FILL: Readonly<Record<Crop, number>> = { desktop: 0.42, tablet: 0.46, mobile: 0.5 };
/** How far the focus glide dollies toward the part (the rest is a lens zoom). */
const FOCUS_DOLLY = 0.2;
const FOCUS_MIN_FOV = 5;
/** A category docked past this is a grid slot: no camera glide, no picking. */
const DOCKED_FOCUS = 0.5;
const DOCKED_PICK = 0.1;

/**
 * Layer of the on-top pass: after the normal frame the depth buffer is cleared and only this
 * layer (plus the lights) renders again, so the selected part — and the ghost of a docked
 * category at its origin — reads through anything in front of it.
 */
export const OVERLAY_LAYER = 1;

/** Width of the desktop poster master the Freestyle lines were drawn on. */
const POSTER_MASTER_WIDTH = 2560;
/** Hidden (behind the near shell surface) edges keep this share of the line strength. */
const HIDDEN_EDGE_SHARE = 0.3;
/** The contact shadow keeps this much with the car stripped. */
const SHADOW_FLOOR = 0.15;
const GHOST_OPACITY = 0.42;

export type Anchor = { x: number; y: number; visible: boolean };

const tmpBox = new Box3();
const tmpVec = new Vector3();
const tmpVec2 = new Vector3();
const forward = new Vector3();
const ghostInverse = new Matrix4();
const ndc = new Vector2();

export class HeroScene3D {
  readonly car: CarScene;
  readonly camera: PerspectiveCamera;
  private readonly poses: DockPoses;
  private invalidate: () => void;
  private reduced: boolean;
  private progress = 0;

  private layout: Layout = {
    width: 1,
    height: 1,
    crop: "desktop",
    anchorX: 1,
    anchorY: 1,
    insetLeft: 0,
    maxWidth: Infinity,
    stage: { x: 0, y: 0, w: 1, h: 1 },
  };
  /** Poster frame at progress 0 and the live frame (same size, offset blended to the dock). */
  private frame: ContainFrame = { imageWidth: 1, imageHeight: 1, offsetX: 0, offsetY: 0 };
  private live: ContainFrame = { imageWidth: 1, imageHeight: 1, offsetX: 0, offsetY: 0 };
  private band: Rect | null = null;
  private dock: DockSolution | null = null;
  private readonly solution: DockSolution = { distance: 1, fov: 28, offsetX: 0, offsetY: 0 };
  private hero: CameraPose;
  private base: CameraPose;
  private focus: CameraPose;
  private pose: CameraPose;
  /** 0 = scroll camera, 1 = focus camera (tweened). */
  private focusMix = { value: 0 };
  private focusShift = { x: 0, y: 0 };
  private readonly focusBox = new Box3();
  private freeArea: FreeArea | null = null;

  private hovered: string | null = null;
  private selected: string | null = null;
  private origin: string | null = null;
  private readonly ghosts = new Map<string, Group>();
  private readonly ghostMaterial = new MeshBasicMaterial({
    color: new Color(XRAY.body.rim),
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  private edges: EdgeMaterials | null = null;
  /** Renderer pixel ratio (edge opacity follows the poster's line weight, D99). */
  private pixelRatio = 1;
  private raycaster = new Raycaster();
  /** Seconds (performance clock) of the last input: the float idles out after SLOT.floatIdle. */
  private lastInput = 0;

  constructor(options: {
    car: CarScene;
    camera: PerspectiveCamera;
    invalidate: () => void;
    reducedMotion: boolean;
  }) {
    this.car = options.car;
    this.camera = options.camera;
    this.invalidate = options.invalidate;
    this.reduced = options.reducedMotion;
    this.hero = poseFrom(this.car.manifest.cameras.hero.desktop);
    this.base = clonePose(this.hero);
    this.focus = clonePose(this.hero);
    this.pose = clonePose(this.hero);
    this.poses = new DockPoses(this.car, this.camera);
    this.poses.reduced = this.reduced;
    (this.raycaster as Raycaster & { firstHitOnly?: boolean }).firstHitOnly = true;
    this.camera.near = 0.05;
    this.camera.far = 60;
    this.ghostMaterial.name = "sk_origin_ghost";
    this.wake();
  }

  setReducedMotion(reduced: boolean): void {
    this.reduced = reduced;
    this.poses.reduced = reduced;
    this.invalidate();
  }

  setEdgeMaterials(materials: EdgeMaterials): void {
    this.edges = materials;
    this.applyProgressUniforms();
  }

  setPixelRatio(ratio: number): void {
    this.pixelRatio = ratio;
    this.applyProgressUniforms();
  }

  // ------------------------------------------------------------------ progress

  setProgress(p: number): void {
    const next = Math.min(Math.max(p, 0), 1);
    if (Math.abs(next - this.progress) < 1e-5) return;
    this.progress = next;
    this.applyProgressUniforms();
    this.wake();
    this.invalidate();
  }

  private applyProgressUniforms(): void {
    const fade = power2InOut(pageLocal(this.progress, 1));
    const { body } = XRAY;
    this.car.shared.bodyBaseAlpha.value =
      body.baseAlpha + (body.baseAlphaExploded - body.baseAlpha) * fade;
    if (this.edges) {
      // Freestyle drew 1 px lines on the 2560 px master: match the integrated line weight.
      const weight = Math.min(
        1,
        Math.max(0.4, (this.frame.imageWidth * this.pixelRatio) / POSTER_MASTER_WIDTH),
      );
      const total =
        (XRAY_RUNTIME.edgeOpacity +
          (XRAY_RUNTIME.edgeOpacityExploded - XRAY_RUNTIME.edgeOpacity) * fade) *
        weight;
      const hidden = total * HIDDEN_EDGE_SHARE;
      this.edges.hidden.opacity = hidden;
      // Visible edges draw in both passes: 1 - (1 - hidden)(1 - visible) = total.
      this.edges.visible.opacity = 1 - (1 - total) / (1 - hidden);
    }
    // One contact shadow (the assembled one); it thins out as the parts leave the car.
    const gone = clamp01((this.progress - PAGE_FIRST) / (PAGE_LAST - PAGE_FIRST));
    this.car.floor.uniforms.uShadowMix.value = 0;
    this.car.floor.uniforms.uShadowGain.value = 1 - (1 - SHADOW_FLOOR) * gone;
  }

  // ------------------------------------------------------------------ float

  /** Input happened: the idle float runs again. */
  wake(): void {
    this.lastInput = performance.now() / 1000;
  }

  /** Idle envelope of the float at `now` (seconds): 1 while in use, eased out after an idle. */
  floatGain(now: number): number {
    if (this.reduced) return 0;
    const idle = now - this.lastInput;
    return 1 - clamp01((idle - SLOT.floatIdle) / SLOT.floatFade);
  }

  /** True while the float needs another frame (something is seated and the idle is not over). */
  wantsFrames(now: number): boolean {
    return this.poses.anySeated && this.selected === null && this.floatGain(now) > 0;
  }

  /** Called every rendered frame after `updateCamera`: writes the part nodes. */
  updateParts(now: number): void {
    this.camera.getWorldDirection(forward);
    this.poses.update(this.progress, now, this.selected === null ? this.floatGain(now) : 0, forward);
  }

  // ------------------------------------------------------------------ layout

  setLayout(layout: Layout): void {
    const cropChanged = layout.crop !== this.layout.crop;
    this.layout = layout;
    const frame = posterFrame(POSTER_ASPECT[layout.crop], layout.stage.w, layout.stage.h, layout);
    this.frame = {
      ...frame,
      offsetX: frame.offsetX + layout.stage.x,
      offsetY: frame.offsetY + layout.stage.y,
    };
    this.live.imageWidth = this.frame.imageWidth;
    this.live.imageHeight = this.frame.imageHeight;
    if (cropChanged || !this.hero) {
      this.hero = poseFrom(this.car.manifest.cameras.hero[layout.crop]);
    }
    this.poses.setCanvas(layout.width, layout.height);
    this.poses.touch = layout.crop !== "desktop";
    this.solve();
    if (this.selected) this.updateFocusShift();
    this.applyProgressUniforms();
    this.invalidate();
  }

  /** Where the docked car sits (CSS px, canvas coordinates); null keeps the poster framing. */
  setBand(band: Rect | null): void {
    this.band = band && band.w > 8 && band.h > 8 ? band : null;
    this.solve();
    this.invalidate();
  }

  setSlots(rects: ReadonlyArray<{ slug: string; rect: Rect }>): void {
    this.poses.setRects(rects);
    this.invalidate();
  }

  setChips(points: ReadonlyArray<{ x: number; y: number } | null>): void {
    points.forEach((point, page) => {
      if (point) this.poses.setChip(page, point.x, point.y);
    });
  }

  private solve(): void {
    if (!this.band || this.layout.width <= 1) {
      this.dock = null;
      return;
    }
    const { bbox } = this.car.manifest;
    this.dock = solveDock(
      this.camera,
      this.hero,
      POSTER_ASPECT[this.layout.crop],
      SLOT.dockFov[this.layout.crop],
      bbox.min,
      bbox.max,
      this.frame,
      this.band,
      SLOT.bandFill[this.layout.crop],
      this.solution,
    );
  }

  // ------------------------------------------------------------------ camera

  /** Called every rendered frame before the render. */
  updateCamera(): void {
    const dock = this.dock;
    const k = dock ? dockBlend(this.progress) : 0;
    const base = this.base;
    base.target.copy(this.hero.target);
    base.position
      .copy(this.hero.position)
      .sub(this.hero.target)
      .multiplyScalar(dock ? Math.exp(Math.log(dock.distance) * k) : 1)
      .add(this.hero.target);
    base.fov = dock ? this.hero.fov + (dock.fov - this.hero.fov) * k : this.hero.fov;
    this.live.offsetX = dock ? this.frame.offsetX + (dock.offsetX - this.frame.offsetX) * k : this.frame.offsetX;
    this.live.offsetY = dock ? this.frame.offsetY + (dock.offsetY - this.frame.offsetY) * k : this.frame.offsetY;

    let pose = base;
    let shiftX = 0;
    let shiftY = 0;
    if (this.focusMix.value > 0) {
      // with a selection: glide to it; after a cleared one: glide from the last focus back.
      // The frame moves with the dock, so the shift that keeps the part in the free area is
      // taken from the live frame every time.
      if (this.selected) {
        this.computeFocus(this.selected);
        this.updateFocusShift();
      }
      lerpPose(base, this.focus, this.focusMix.value, this.pose);
      pose = this.pose;
      shiftX = this.focusShift.x * this.focusMix.value;
      shiftY = this.focusShift.y * this.focusMix.value;
    }
    const cam = this.camera;
    cam.fov = pose.fov;
    cam.aspect = POSTER_ASPECT[this.layout.crop];
    cam.position.copy(pose.position);
    cam.up.set(0, 1, 0);
    cam.lookAt(pose.target);
    cam.setViewOffset(
      ...viewOffsetFor(this.live, this.layout.width, this.layout.height, shiftX, shiftY),
    );
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
  }

  /** World bbox of a category's focus nodes at their current transforms. */
  private categoryBox(category: CategoryEntry, target: Box3): Box3 {
    target.makeEmpty();
    for (const part of category.focusParts) {
      part.node.updateWorldMatrix(true, false);
      tmpBox.copy(part.localBox).applyMatrix4(part.node.matrixWorld);
      target.union(tmpBox);
    }
    return target;
  }

  /** True while the category sits in (or is on its way into) a grid slot. */
  private isDocked(slug: string, threshold: number): boolean {
    return this.poses.dockOf(slug) > threshold;
  }

  /**
   * Focus preset (contract F8, D101): a telephoto glide from the current viewpoint. The target
   * moves to the category's current bbox centre, the camera dollies only FOCUS_DOLLY of the
   * way in and the FOV narrows until the part's bounding sphere fills FOCUS_FILL of the free
   * area. `focus.minDistance` stays a floor.
   */
  private computeFocus(slug: string): void {
    const category = this.car.categories.get(slug);
    if (!category || category.parts.length === 0) return;
    const box = this.categoryBox(category, this.focusBox);
    const center = box.getCenter(tmpVec);
    const radius = Math.max(box.getSize(tmpVec2).length() / 2, 0.05);
    const focus = this.focus;
    focus.target.copy(center);
    focus.position.copy(this.base.position).lerp(center, FOCUS_DOLLY);
    const floor = Math.max(category.focus.minDistance, radius * 1.2);
    if (focus.position.distanceTo(center) < floor) {
      focus.position.sub(center).setLength(floor).add(center);
    }
    const distance = focus.position.distanceTo(center);
    const fill = FOCUS_FILL[this.layout.crop];
    const share = this.freeArea
      ? (this.freeArea.h * fill) / Math.max(this.frame.imageHeight, 1)
      : fill;
    const fov = (2 * Math.atan(radius / Math.max(distance * share, 1e-3)) * 180) / Math.PI;
    focus.fov = Math.min(Math.max(fov, FOCUS_MIN_FOV), this.base.fov);
  }

  /** Where the focused target should land: centre of the area left free by the panel. */
  setFreeArea(area: FreeArea | null): void {
    this.freeArea = area;
    this.updateFocusShift();
  }

  private updateFocusShift(): void {
    if (!this.freeArea) {
      this.focusShift.x = 0;
      this.focusShift.y = 0;
      return;
    }
    // The target projects to the frame centre; shift the view so it lands on the free area.
    this.focusShift.x = this.live.offsetX + this.live.imageWidth / 2 - this.freeArea.x;
    this.focusShift.y = this.live.offsetY + this.live.imageHeight / 2 - this.freeArea.y;
  }

  // ------------------------------------------------------------------ highlight

  private tweenUniform(u: { value: number }, value: number, duration: number): void {
    if (this.reduced) {
      gsap.killTweensOf(u);
      u.value = value;
      this.invalidate();
      return;
    }
    gsap.to(u, {
      value,
      duration,
      ease: EASE.out,
      overwrite: true,
      onUpdate: this.invalidate,
    });
  }

  setHovered(slug: string | null): void {
    if (slug === this.hovered) return;
    const prev = this.hovered ? this.car.categories.get(this.hovered) : null;
    if (prev) this.tweenUniform(prev.highlight.hover, 0, DUR.quick);
    this.hovered = slug;
    const next = slug ? this.car.categories.get(slug) : null;
    if (next) this.tweenUniform(next.highlight.hover, 1, DUR.quick);
  }

  setSelected(slug: string | null): void {
    if (slug === this.selected) return;
    const selecting = Boolean(slug && this.car.categories.get(slug)?.parts.length);
    this.setOverlay(this.selected, false);
    this.selected = slug && selecting ? slug : null;
    this.setOverlay(this.selected, true);
    for (const category of this.car.categories.values()) {
      const isSel = category.slug === this.selected;
      this.tweenUniform(category.highlight.select, isSel ? 1 : 0, DUR.base + 0.08);
      this.tweenUniform(category.highlight.dim, this.selected && !isSel ? 1 : 0, 0.3);
    }
    this.tweenUniform(this.car.staticHighlight.dim, this.selected ? 1 : 0, 0.3);
    this.tweenUniform(this.car.shared.selectFade, this.selected ? 1 : 0, 0.3);

    // camera glide (0.9 s power3.inOut, contract F8) to a part that is still on the car; a
    // docked one stays in its slot. Cuts under reduced motion.
    const glide = this.selected !== null && !this.isDocked(this.selected, DOCKED_FOCUS);
    if (glide && this.selected) {
      this.computeFocus(this.selected);
      this.updateFocusShift();
    }
    const target = glide ? 1 : 0;
    if (this.reduced) {
      gsap.killTweensOf(this.focusMix);
      this.focusMix.value = target;
      this.invalidate();
    } else {
      gsap.to(this.focusMix, {
        value: target,
        duration: DUR.camera,
        ease: EASE.camera,
        overwrite: true,
        onUpdate: this.invalidate,
      });
    }
    this.wake();
  }

  /** The selected category also renders on OVERLAY_LAYER, drawn on top of everything. */
  private setOverlay(slug: string | null, on: boolean): void {
    if (!slug) return;
    const category = this.car.categories.get(slug);
    if (!category) return;
    for (const part of category.parts) {
      for (const mesh of part.meshes) {
        if (on) mesh.layers.enable(OVERLAY_LAYER);
        else mesh.layers.disable(OVERLAY_LAYER);
      }
    }
  }

  /**
   * Ghost of a category at its place on the car (hover / focus on its grid slot): every
   * instance, shared geometry, one flat rim-tone material on the on-top layer.
   */
  setOrigin(slug: string | null): void {
    const next = slug && this.car.categories.get(slug)?.parts.length ? slug : null;
    if (next === this.origin) return;
    const previous = this.origin ? this.ghosts.get(this.origin) : null;
    if (previous) for (const holder of previous.children) holder.visible = false;
    // The docked part itself takes the hover tint while its slot is pointed at.
    const before = this.origin ? this.car.categories.get(this.origin) : null;
    if (before && this.origin !== this.hovered) this.tweenUniform(before.highlight.hover, 0, DUR.quick);
    const after = next ? this.car.categories.get(next) : null;
    if (after) this.tweenUniform(after.highlight.hover, 1, DUR.quick);
    this.origin = next;
    gsap.killTweensOf(this.ghostMaterial);
    if (!next) {
      this.ghostMaterial.opacity = 0;
      this.invalidate();
      return;
    }
    let ghost = this.ghosts.get(next);
    if (!ghost) {
      ghost = this.buildGhost(next);
      this.ghosts.set(next, ghost);
    }
    for (const holder of ghost.children) holder.visible = true;
    if (this.reduced) {
      this.ghostMaterial.opacity = GHOST_OPACITY;
      this.invalidate();
    } else {
      this.ghostMaterial.opacity = 0;
      gsap.to(this.ghostMaterial, {
        opacity: GHOST_OPACITY,
        duration: DUR.base,
        ease: EASE.out,
        onUpdate: this.invalidate,
      });
    }
  }

  /**
   * One holder per instance, a sibling of the part node at the node's assembled place; every
   * mesh keeps its transform relative to the part node (a multi-material mesh is a group whose
   * own node carries the dequantisation scale, so the mesh's local transform alone is not it).
   */
  private buildGhost(slug: string): Group {
    const group = new Group();
    group.name = `ghost__${slug}`;
    const category = this.car.categories.get(slug);
    for (const part of category?.parts ?? []) {
      const parent = part.node.parent;
      if (!parent) continue;
      const holder = new Group();
      holder.position.copy(part.pivot);
      part.node.updateWorldMatrix(true, true);
      ghostInverse.copy(part.node.matrixWorld).invert();
      for (const mesh of part.meshes) {
        const copy = new Mesh(mesh.geometry, this.ghostMaterial);
        copy.matrixAutoUpdate = false;
        copy.matrix.multiplyMatrices(ghostInverse, mesh.matrixWorld);
        copy.layers.set(OVERLAY_LAYER);
        copy.renderOrder = 20;
        copy.raycast = () => {};
        holder.add(copy);
      }
      parent.add(holder);
      group.children.push(holder);
    }
    return group;
  }

  /** True while something needs the on-top pass. */
  get hasOverlay(): boolean {
    return this.selected !== null || this.origin !== null;
  }

  // ------------------------------------------------------------------ picking

  /** Category under a canvas point (CSS px), or null. Docked and hidden parts never answer. */
  pick(x: number, y: number): string | null {
    ndc.set((x / this.layout.width) * 2 - 1, -(y / this.layout.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.car.pickables, false);
    let glass: string | null = null;
    for (let i = 0; i < hits.length; i += 1) {
      const mesh = hits[i].object as Mesh;
      const slug = mesh.userData.category as string | undefined;
      if (!slug || mesh.parent?.visible === false || this.isDocked(slug, DOCKED_PICK)) continue;
      // An X-ray panel still on the car is glass to the eye: prefer the opaque part behind it.
      if (mesh.userData.xray) {
        glass ??= slug;
        continue;
      }
      return slug;
    }
    return glass;
  }

  // ------------------------------------------------------------------ anchors

  /** Screen position (canvas px) of a category's label anchor at its current place. */
  anchorOf(slug: string, out: Anchor): Anchor {
    const category = this.car.categories.get(slug);
    const part = category?.focusParts[0];
    if (!part || part.node.visible === false) {
      out.visible = false;
      return out;
    }
    part.node.updateWorldMatrix(true, false);
    part.node.localToWorld(tmpVec.copy(part.labelAnchor));
    return this.toCanvas(tmpVec, out);
  }

  /** Screen position (canvas px) of a category's place on the assembled car. */
  originAnchorOf(slug: string, out: Anchor): Anchor {
    const category = this.car.categories.get(slug);
    const part = category?.focusParts[0];
    if (!part) {
      out.visible = false;
      return out;
    }
    return this.toCanvas(tmpVec.copy(part.pivot).add(part.labelAnchor), out);
  }

  private toCanvas(world: Vector3, out: Anchor): Anchor {
    world.project(this.camera);
    out.x = ((world.x + 1) / 2) * this.layout.width;
    out.y = ((1 - world.y) / 2) * this.layout.height;
    out.visible = world.z < 1 && Math.abs(world.x) <= 1.05 && Math.abs(world.y) <= 1.05;
    return out;
  }

  /** Docked slots with their projected size and distance from the cell (QA hook). */
  report(): SlotReport[] {
    this.camera.getWorldDirection(forward);
    return this.poses.report(forward);
  }

  dispose(): void {
    gsap.killTweensOf(this.focusMix);
    gsap.killTweensOf(this.ghostMaterial);
    for (const c of this.car.categories.values()) {
      gsap.killTweensOf([c.highlight.hover, c.highlight.select, c.highlight.dim]);
    }
    gsap.killTweensOf([this.car.staticHighlight.dim, this.car.shared.selectFade]);
    for (const ghost of this.ghosts.values()) {
      for (const holder of ghost.children) holder.removeFromParent();
    }
    this.ghosts.clear();
    this.ghostMaterial.dispose();
  }
}
