/**
 * Poster framing inside the stage box — shared by the SSR poster (CSS) and the canvas camera
 * (`setViewOffset`), so the crossfade never moves the car (DESIGN-SYSTEM §7.8).
 *
 * - < 768 px: the 4:5 portrait poster (mobile cameras), contained, bottom-centred.
 * - 768–1023 px: the 16:9 poster (desktop cameras), contained, bottom-centred (stacked).
 * - ≥ 1024 px: the 16:9 poster contained in the box minus an 8 % left inset, anchored bottom
 *   right — the copy column overlays the left of the stage, the car stays clear of it.
 * The free space always ends up above the car, where the caption and title block live.
 *
 * `components/three/HeroPicture.tsx` mirrors this in CSS: `object-fit: contain`,
 * `object-position: 50% 100%`, and from `lg` `left: 8%` + `object-position: 100% 100%`.
 */
import { containFrame, type ContainFrame } from "@/lib/three/camera";

export const MEDIA_CROP_MOBILE = "(max-width: 47.999rem)";
export const MEDIA_STAGE_OVERLAY = "(min-width: 64rem)";
export const OVERLAY_INSET_LEFT = 0.08;

export type Framing = {
  crop: "desktop" | "mobile";
  anchorX: number;
  anchorY: number;
  /** Left inset of the poster box as a fraction of the stage width. */
  insetLeft: number;
};

export function framingFor(cropMobile: boolean, overlay: boolean): Framing {
  return overlay
    ? { crop: "desktop", anchorX: 1, anchorY: 1, insetLeft: OVERLAY_INSET_LEFT }
    : { crop: cropMobile ? "mobile" : "desktop", anchorX: 0.5, anchorY: 1, insetLeft: 0 };
}

/** Current framing from the viewport (client only). */
export function currentFraming(): Framing {
  if (typeof window === "undefined") return framingFor(false, true);
  return framingFor(
    window.matchMedia(MEDIA_CROP_MOBILE).matches,
    window.matchMedia(MEDIA_STAGE_OVERLAY).matches,
  );
}

/** Where the poster image sits inside a `width × height` stage for a framing. */
export function posterFrame(
  aspect: number,
  width: number,
  height: number,
  framing: Pick<Framing, "anchorX" | "anchorY" | "insetLeft">,
): ContainFrame {
  const inset = framing.insetLeft * width;
  const frame = containFrame(aspect, width - inset, height, framing.anchorX, framing.anchorY);
  return { ...frame, offsetX: frame.offsetX + inset };
}
