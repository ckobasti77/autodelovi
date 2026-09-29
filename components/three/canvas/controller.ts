/**
 * Imperative core of the 3D hero — everything that changes per frame lives here, outside
 * React (refs-not-state, 3d-scrollytelling rules):
 *
 * - explode: one GSAP timeline built from the manifest (a `power2.inOut` tween per part node
 *   at its stage slot, contract F3/F6); its progress follows the scroll progress;
 * - camera: the poster cameras with contain framing (`setViewOffset`), dolly + orbit across
 *   0.08–0.92, and a focus glide (0.9 s power3.inOut) to the selected category;
 * - X-ray: shell alpha 0.22 → 0.10 in stage 1, edge opacity, contact-shadow crossfade;
 * - highlight: hover / selected / dimmed uniforms per category (§7.5);
 * - picking: BVH raycasts, opaque parts win over an assembled X-ray panel in front of them.
 */
import {
  Box3,
  Raycaster,
  Vector2,
  Vector3,
  type Mesh,
  type PerspectiveCamera,
} from "three";

import { gsap } from "@/lib/gsap/client";
import {
  clonePose,
  containFrame,
  lerpPose,
  orbitBlend,
  poseFrom,
  viewOffsetFor,
  type CameraPose,
  type ContainFrame,
} from "@/lib/three/camera";
import {
  cameraBlend,
  partFactor,
  partSlot,
  shellFade,
  stageWindows,
  type StageWindow,
  type Timeline,
} from "@/lib/three/explode";
import { posterFrame } from "@/lib/three/framing";
import { DUR, EASE } from "@/constants/motion";
import { XRAY, XRAY_RUNTIME } from "@/constants/xray";
import type { CarScene, CategoryEntry } from "@/components/three/canvas/loadCar";
import type { EdgeMaterials } from "@/components/three/canvas/enhance";

export type Crop = "desktop" | "mobile";

/** Poster framing per crop (object-fit: contain in the stage box; anchors mirror the CSS). */
export const POSTER_ASPECT: Readonly<Record<Crop, number>> = { desktop: 16 / 9, mobile: 4 / 5 };

export type Layout = {
  width: number;
  height: number;
  crop: Crop;
  anchorX: number;
  anchorY: number;
  insetLeft: number;
};

/** Free area of the canvas for a focused part (CSS px, canvas coordinates): centre + height. */
export type FreeArea = { x: number; y: number; h: number };

/** Share of the free area's height a focused category may take (bounding-sphere diameter). */
const FOCUS_FILL = { desktop: 0.42, mobile: 0.5 } as const;
/** How far the focus glide dollies toward the part (the rest is a lens zoom). */
const FOCUS_DOLLY = 0.2;
const FOCUS_MIN_FOV = 5;

/**
 * Layer of the selected category's on-top pass: after the normal frame the depth buffer is
 * cleared and only this layer (plus the lights) renders again, so the selected part reads
 * through anything the explode left in front of it — the X-ray idea applied to one part.
 */
export const OVERLAY_LAYER = 1;

/** Width of the desktop poster master the Freestyle lines were drawn on. */
const POSTER_MASTER_WIDTH = 2560;
/** Hidden (behind the near shell surface) edges keep this share of the line strength. */
const HIDDEN_EDGE_SHARE = 0.3;

export type Anchor = { x: number; y: number; visible: boolean };

const tmpBox = new Box3();
const tmpVec = new Vector3();
const tmpVec2 = new Vector3();
const ndc = new Vector2();

export class HeroScene3D {
  readonly car: CarScene;
  readonly camera: PerspectiveCamera;
  private invalidate: () => void;
  private reduced: boolean;

  private timeline: Timeline = "desktop";
  private windows: Map<number, StageWindow> = stageWindows("desktop");
  private explode: gsap.core.Timeline | null = null;
  private progress = 0;

  private layout: Layout = {
    width: 1,
    height: 1,
    crop: "desktop",
    anchorX: 1,
    anchorY: 1,
    insetLeft: 0,
  };
  private frame: ContainFrame = containFrame(16 / 9, 1, 1, 1, 1);
  private hero: CameraPose;
  private exploded: CameraPose;
  private base: CameraPose;
  private focus: CameraPose;
  private pose: CameraPose;
  /** 0 = scroll camera, 1 = focus camera (tweened). */
  private focusMix = { value: 0, shiftX: 0, shiftY: 0 };
  private focusShift = { x: 0, y: 0 };
  private freeArea: FreeArea | null = null;

  private hovered: string | null = null;
  private selected: string | null = null;
  private edges: EdgeMaterials | null = null;
  /** Renderer pixel ratio (edge opacity follows the poster's line weight, D99). */
  private pixelRatio = 1;
  private raycaster = new Raycaster();

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
    this.exploded = poseFrom(this.car.manifest.cameras.exploded.desktop);
    this.base = clonePose(this.hero);
    this.focus = clonePose(this.hero);
    this.pose = clonePose(this.hero);
    (this.raycaster as Raycaster & { firstHitOnly?: boolean }).firstHitOnly = true;
    this.camera.near = 0.05;
    this.camera.far = 60;
    this.buildExplode("desktop");
  }

  setReducedMotion(reduced: boolean): void {
    this.reduced = reduced;
  }

  setEdgeMaterials(materials: EdgeMaterials): void {
    this.edges = materials;
    this.applyProgressUniforms();
  }

  setPixelRatio(ratio: number): void {
    this.pixelRatio = ratio;
    this.applyProgressUniforms();
  }

  // ------------------------------------------------------------------ explode

  /** (Re)builds the explode timeline for a stage timeline (desktop or grouped mobile). */
  buildExplode(timeline: Timeline): void {
    if (this.explode && this.timeline === timeline) return;
    this.explode?.kill();
    this.timeline = timeline;
    this.windows = stageWindows(timeline);
    const tl = gsap.timeline({ paused: true, defaults: { ease: EASE.explode } });
    for (const part of this.car.parts.values()) {
      const window = this.windows.get(part.stage);
      if (!window) continue;
      const { start, duration } = partSlot(window, part.order);
      const to = tmpVec.copy(part.pivot).addScaledVector(part.dir, part.distance);
      tl.fromTo(
        part.node.position,
        { x: part.pivot.x, y: part.pivot.y, z: part.pivot.z },
        { x: to.x, y: to.y, z: to.z, duration, immediateRender: false },
        start,
      );
    }
    tl.set({}, {}, 1);
    this.explode = tl;
    tl.progress(this.progress);
    this.applyProgressUniforms();
  }

  setProgress(p: number): void {
    const next = Math.min(Math.max(p, 0), 1);
    if (Math.abs(next - this.progress) < 1e-5) return;
    this.progress = next;
    this.explode?.progress(next);
    this.applyProgressUniforms();
    this.invalidate();
  }

  private applyProgressUniforms(): void {
    const fade = shellFade(this.progress, this.windows);
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
    this.car.floor.uniforms.uShadowMix.value = cameraBlend(this.progress);
  }

  /** Current eased explode factor of a part (0 assembled … 1 exploded). */
  private factorOf(nodeName: string): number {
    const part = this.car.parts.get(nodeName);
    if (!part) return 0;
    const window = this.windows.get(part.stage);
    return window ? partFactor(this.progress, window, part.order) : 0;
  }

  // ------------------------------------------------------------------ camera

  setLayout(layout: Layout): void {
    const cropChanged = layout.crop !== this.layout.crop;
    this.layout = layout;
    this.frame = posterFrame(POSTER_ASPECT[layout.crop], layout.width, layout.height, layout);
    if (cropChanged || !this.hero) {
      const cams = this.car.manifest.cameras;
      this.hero = poseFrom(cams.hero[layout.crop]);
      this.exploded = poseFrom(cams.exploded[layout.crop]);
    }
    if (this.selected) this.updateFocusShift();
    this.applyProgressUniforms();
    this.invalidate();
  }

  /** Called every rendered frame before the render. */
  updateCamera(): void {
    orbitBlend(this.hero, this.exploded, cameraBlend(this.progress), this.base);
    let pose = this.base;
    let shiftX = 0;
    let shiftY = 0;
    if (this.focusMix.value > 0 && this.selected) {
      this.computeFocus(this.selected);
      lerpPose(this.base, this.focus, this.focusMix.value, this.pose);
      pose = this.pose;
      shiftX = this.focusShift.x * this.focusMix.value;
      shiftY = this.focusShift.y * this.focusMix.value;
    } else if (this.focusMix.value > 0) {
      // returning from a cleared selection: glide from the last focus back to the base
      lerpPose(this.base, this.focus, this.focusMix.value, this.pose);
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
      ...viewOffsetFor(this.frame, this.layout.width, this.layout.height, shiftX, shiftY),
    );
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
  }

  /** World bbox of a category's focus nodes at the current explode state. */
  private categoryBox(category: CategoryEntry, target: Box3): Box3 {
    target.makeEmpty();
    for (const part of category.focusParts) {
      tmpBox.copy(part.localBox).translate(part.node.getWorldPosition(tmpVec2));
      target.union(tmpBox);
    }
    return target;
  }

  /**
   * Focus preset (contract F8, D101): a telephoto glide from the current viewpoint. The target
   * moves to the category's current bbox centre, the camera dollies only FOCUS_DOLLY of the
   * way in and the FOV narrows until the part's bounding sphere fills FOCUS_FILL of the free
   * area. The viewpoint the part was picked from (or the exploded camera, whose visibility the
   * Blender audit guarantees) keeps it unobstructed — a free-flying preset along the manifest
   * `focus.dir` ended behind other exploded parts. `focus.minDistance` stays a floor.
   */
  private computeFocus(slug: string): void {
    const category = this.car.categories.get(slug);
    if (!category || category.parts.length === 0) return;
    const box = this.categoryBox(category, new Box3());
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
    // The target projects to the poster centre; shift the view so it lands on the free area.
    this.focusShift.x = this.frame.offsetX + this.frame.imageWidth / 2 - this.freeArea.x;
    this.focusShift.y = this.frame.offsetY + this.frame.imageHeight / 2 - this.freeArea.y;
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

    // camera glide (0.9 s power3.inOut, contract F8); cuts under reduced motion
    if (this.selected) {
      this.computeFocus(this.selected);
      this.updateFocusShift();
    }
    const target = this.selected ? 1 : 0;
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

  /** True while a selected category needs the on-top pass. */
  get hasOverlay(): boolean {
    return this.selected !== null;
  }

  get isAnimatingCamera(): boolean {
    return gsap.isTweening(this.focusMix);
  }

  // ------------------------------------------------------------------ picking

  /** Category under a canvas point (CSS px), or null. */
  pick(x: number, y: number): string | null {
    ndc.set((x / this.layout.width) * 2 - 1, -(y / this.layout.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.car.pickables, false);
    if (hits.length === 0) return null;
    const first = hits[0].object as Mesh;
    const firstCategory = first.userData.category as string | undefined;
    if (!first.userData.xray) return firstCategory ?? null;
    // An X-ray panel still on the car is glass to the eye: prefer the opaque part behind it.
    if (this.factorOf(first.userData.partNode as string) < 0.25) {
      const opaque = hits.find((h) => !(h.object as Mesh).userData.xray);
      if (opaque) return ((opaque.object as Mesh).userData.category as string) ?? null;
    }
    return firstCategory ?? null;
  }

  // ------------------------------------------------------------------ callout anchor

  /** Screen position (canvas px) of a category's label anchor. */
  anchorOf(slug: string, out: Anchor): Anchor {
    const category = this.car.categories.get(slug);
    const part = category?.focusParts[0];
    if (!part) {
      out.visible = false;
      return out;
    }
    part.node.getWorldPosition(tmpVec).add(part.labelAnchor);
    tmpVec.project(this.camera);
    out.x = ((tmpVec.x + 1) / 2) * this.layout.width;
    out.y = ((1 - tmpVec.y) / 2) * this.layout.height;
    out.visible = tmpVec.z < 1 && Math.abs(tmpVec.x) <= 1.05 && Math.abs(tmpVec.y) <= 1.05;
    return out;
  }

  dispose(): void {
    this.explode?.kill();
    gsap.killTweensOf(this.focusMix);
    for (const c of this.car.categories.values()) {
      gsap.killTweensOf([c.highlight.hover, c.highlight.select, c.highlight.dim]);
    }
    gsap.killTweensOf([this.car.staticHighlight.dim, this.car.shared.selectFade]);
  }
}
