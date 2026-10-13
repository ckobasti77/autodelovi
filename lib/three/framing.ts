/**
 * Poster framing inside the stage box — shared by the SSR poster (CSS) and the canvas camera
 * (`setViewOffset`), so the crossfade never moves the car (DESIGN-SYSTEM §7.8).
 *
 * - < 768 px (`mobile`): the 4:5 portrait poster, contained and centred in the stage. The
 *   phone stage is taller than 4:5, so the spare height splits evenly above and below the
 *   poster and the car sits in the middle of the stage, under the caption (MOT-01, D240).
 * - 768–1023 px (`tablet`): the 1:1 poster from its own centred camera, contained and centred
 *   — there is no copy column beside the stage at these widths.
 * - ≥ 1024 px (`desktop`): the 16:9 poster contained in the box minus an 8 % left inset,
 *   anchored bottom right — the copy column overlays the left of the stage, the car stays
 *   clear of it.
 *
 * The box the poster is framed in never grows past `STAGE_FRAME_MAX` px and stays centred, so
 * on wide monitors the car keeps inside the corner-tick drawing frame, which lives in the
 * 1440 px content container (VIS-06, D242).
 *
 * `components/three/HeroPicture.tsx` mirrors this in CSS: the `<picture>` is capped at
 * `STAGE_FRAME_MAX` and centred; the `<img>` uses `object-fit: contain` with
 * `object-position: 50% 50%`, and from `lg` `left: 8%; width: 92%` +
 * `object-position: 100% 100%`.
 */
import { containFrame, type ContainFrame } from "@/lib/three/contain";

export const MEDIA_CROP_MOBILE = "(max-width: 47.999rem)";
export const MEDIA_STAGE_OVERLAY = "(min-width: 64rem)";
export const OVERLAY_INSET_LEFT = 0.08;
/** Widest box the poster/canvas framing may use (CSS px): the 1440 content plus 120 px a side. */
export const STAGE_FRAME_MAX = 1680;

export type Crop = "desktop" | "tablet" | "mobile";

/** Aspect ratio of the poster (and of the matching manifest camera) per crop. */
export const POSTER_ASPECT: Readonly<Record<Crop, number>> = {
  desktop: 16 / 9,
  tablet: 1,
  mobile: 4 / 5,
};

export type Framing = {
  crop: Crop;
  anchorX: number;
  anchorY: number;
  /** Left inset of the poster box as a fraction of the (capped) box width. */
  insetLeft: number;
  /** The poster box is at most this wide (CSS px) and centred in the stage. */
  maxWidth: number;
};

export function framingFor(cropMobile: boolean, overlay: boolean): Framing {
  if (overlay) {
    return {
      crop: "desktop",
      anchorX: 1,
      anchorY: 1,
      insetLeft: OVERLAY_INSET_LEFT,
      maxWidth: STAGE_FRAME_MAX,
    };
  }
  return {
    crop: cropMobile ? "mobile" : "tablet",
    anchorX: 0.5,
    anchorY: 0.5,
    insetLeft: 0,
    maxWidth: STAGE_FRAME_MAX,
  };
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
  framing: Pick<Framing, "anchorX" | "anchorY" | "insetLeft" | "maxWidth">,
): ContainFrame {
  const boxWidth = Math.min(width, framing.maxWidth);
  const boxLeft = (width - boxWidth) / 2;
  const inset = framing.insetLeft * boxWidth;
  const frame = containFrame(aspect, boxWidth - inset, height, framing.anchorX, framing.anchorY);
  return { ...frame, offsetX: frame.offsetX + boxLeft + inset };
}

/**
 * Where the assembled car's bounding box sits inside each poster (fractions of the image; the
 * far corners of the box fall outside the portrait crops). Projected from the manifest's hero
 * cameras — `tests/unit/three/slots.test.ts` recomputes it.
 */
export const CAR_IN_POSTER: Readonly<
  Record<Crop, { left: number; right: number; top: number; bottom: number }>
> = {
  desktop: { left: 0.3292, right: 0.9597, top: 0.1943, bottom: 0.9294 },
  tablet: { left: -0.073, right: 1.0384, top: 0.1888, bottom: 1.0084 },
  mobile: { left: -0.1395, right: 1.0757, top: 0.1759, bottom: 1.0311 },
};

/**
 * The part of the band the car is fitted into: the band less the room it leaves free (`inset`
 * in shares of the band's height). Shared by the camera's solve and the poster's stand-in; it
 * lives here, not with the slot maths, because the stage imports it and this module has no
 * three.js in it (the stage is first-load JS).
 */
export function carBand(
  band: { x: number; y: number; w: number; h: number },
  inset: { top: number; bottom: number },
): { x: number; y: number; w: number; h: number } {
  const h = Math.max(band.h * (1 - inset.top - inset.bottom), 1);
  return { x: band.x, y: band.y + band.h * inset.top, w: band.w, h };
}

export type PosterDock = { scale: number; x: number; y: number };

/**
 * Transform (origin top left) that moves the poster so its car fills `band` the way the docked
 * camera shows it — the poster's stand-in for the dolly while there is no canvas (low tier,
 * model still downloading, context lost). `frame` is the poster image inside the stage box and
 * `band` is in the same coordinates; `k` is the dock blend 0 … 1.
 */
export function posterDock(
  crop: Crop,
  frame: ContainFrame,
  band: { x: number; y: number; w: number; h: number },
  fill: { width: number; height: number },
  k: number,
): PosterDock {
  const car = CAR_IN_POSTER[crop];
  const carW = (car.right - car.left) * frame.imageWidth;
  const carH = (car.bottom - car.top) * frame.imageHeight;
  const scale = Math.min((band.w * fill.width) / carW, (band.h * fill.height) / carH);
  const cx = frame.offsetX + ((car.left + car.right) / 2) * frame.imageWidth;
  const cy = frame.offsetY + ((car.top + car.bottom) / 2) * frame.imageHeight;
  const s = 1 + (scale - 1) * k;
  return {
    scale: s,
    x: (band.x + band.w / 2 - scale * cx) * k,
    y: (band.y + band.h / 2 - scale * cy) * k,
  };
}
