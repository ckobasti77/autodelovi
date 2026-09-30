import type { Draggable as DraggableClass } from "gsap/Draggable";
import type { InertiaPlugin as InertiaPluginClass } from "gsap/InertiaPlugin";

import { gsap } from "@/lib/gsap/client";

/** A Draggable instance (the type, for callers that may not import GSAP plugins directly). */
export type DraggableInstance = DraggableClass;

export type DragPlugins = {
  Draggable: typeof DraggableClass;
  InertiaPlugin: typeof InertiaPluginClass;
};

let plugins: Promise<DragPlugins> | null = null;

/**
 * Draggable + InertiaPlugin, loaded and registered on first use. Only the bottom sheet drags,
 * so the ~20 KB (gzip) stay out of every page's first-load JS and hydration (D113).
 */
export function loadDragPlugins(): Promise<DragPlugins> {
  plugins ??= Promise.all([import("gsap/Draggable"), import("gsap/InertiaPlugin")]).then(
    ([draggable, inertia]) => {
      gsap.registerPlugin(draggable.Draggable, inertia.InertiaPlugin);
      return { Draggable: draggable.Draggable, InertiaPlugin: inertia.InertiaPlugin };
    },
  );
  return plugins;
}
