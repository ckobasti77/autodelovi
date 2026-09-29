"use client";

/**
 * Pointer interaction on the canvas (contract F8): hover (fine pointers only) raycasts once
 * per animation frame at most; a click or tap (≤ 6 px travel, ≤ 600 ms) selects the category
 * under the pointer, or clears the selection on empty space. Vertical page scrolling stays
 * native (`touch-action: pan-y` on the canvas), so a scroll gesture never selects.
 */
import { useThree } from "@react-three/fiber";
import { useEffect, type RefObject } from "react";

import {
  clearSelection,
  heroStore,
  selectCategory,
  setHovered,
} from "@/components/three/heroStore";
import type { HeroScene3D } from "@/components/three/canvas/controller";

const CLICK_SLOP_PX = 6;
const CLICK_MAX_MS = 600;

export function usePointerPicking(controller: RefObject<HeroScene3D | null>, enabled: boolean) {
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    if (!enabled) return;
    const canvas = gl.domElement;
    let frame = 0;
    let last: { x: number; y: number } | null = null;
    let down: { x: number; y: number; t: number; id: number } | null = null;

    const local = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    const hoverNow = () => {
      frame = 0;
      const c = controller.current;
      if (!c || !last) return;
      const slug = c.pick(last.x, last.y);
      setHovered(slug);
      canvas.style.cursor = slug ? "pointer" : "";
    };

    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
      if (!heroStore.getState().finePointer) return;
      last = local(event);
      if (!frame) frame = requestAnimationFrame(hoverNow);
    };

    const onLeave = () => {
      last = null;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      setHovered(null);
      canvas.style.cursor = "";
    };

    const onDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const p = local(event);
      down = { x: p.x, y: p.y, t: performance.now(), id: event.pointerId };
    };

    const onUp = (event: PointerEvent) => {
      const start = down;
      down = null;
      if (!start || start.id !== event.pointerId) return;
      const p = local(event);
      const moved = Math.hypot(p.x - start.x, p.y - start.y);
      if (moved > CLICK_SLOP_PX || performance.now() - start.t > CLICK_MAX_MS) return;
      const c = controller.current;
      if (!c) return;
      const slug = c.pick(p.x, p.y);
      if (slug) selectCategory(slug, "canvas");
      else if (heroStore.getState().selected) clearSelection();
    };

    const onCancel = () => {
      down = null;
    };

    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onCancel);
    return () => {
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onCancel);
      if (frame) cancelAnimationFrame(frame);
      canvas.style.cursor = "";
    };
  }, [gl, controller, enabled]);
}
