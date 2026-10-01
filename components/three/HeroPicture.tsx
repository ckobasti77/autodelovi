/**
 * Hero poster `<picture>` (contract F7.1, DESIGN-SYSTEM §7.8): the pipeline's pre-encoded
 * AVIF/WebP renders at their true widths — 16:9 from 1024 px (1080/1440/1920/2560), the 1:1
 * tablet crop at 768–1023 px (768/1080/1536) and the 4:5 portrait crop below (640/828/1080).
 * Served as static files: no optimizer round trip, so a cold cache never delays the LCP (D98).
 * Framing mirrors the canvas (`lib/three/framing.ts`): the picture is capped at
 * `STAGE_FRAME_MAX` and centred; `object-fit: contain`, centred below 1024 px; from 1024 px an
 * 8 % left inset, bottom-right.
 *
 * No hooks — renders on the server (assembled poster, LCP) and on the client (exploded poster
 * for the low tier and the context-loss fallback).
 *
 * Priority is split by viewport: from 768 px the poster is the LCP element and gets a
 * media-scoped high-priority preload per crop; on phones the headline is the LCP and the
 * poster sits below it, so it loads eagerly at normal priority instead of competing with CSS
 * and fonts.
 */
import { preload } from "react-dom";

import { cn } from "@/lib/cn";

type PosterState = "assembled" | "exploded";

const DESKTOP = [
  ["-1080", 1080],
  ["-1440", 1440],
  ["-1920", 1920],
  ["", 2560],
] as const;
const TABLET = [
  ["-t-768", 768],
  ["-t-1080", 1080],
  ["-t-1536", 1536],
] as const;
const MOBILE = [
  ["-m-640", 640],
  ["-m-828", 828],
  ["-m-1080", 1080],
] as const;

const MEDIA_MOBILE = "(max-width: 47.999rem)";
const MEDIA_TABLET = "(min-width: 48rem) and (max-width: 63.999rem)";
const MEDIA_DESKTOP = "(min-width: 64rem)";

function srcSet(state: PosterState, set: ReadonlyArray<readonly [string, number]>, ext: string) {
  return set.map(([suffix, w]) => `/images/hero/car-${state}${suffix}.${ext} ${w}w`).join(", ");
}

export function HeroPicture({
  state,
  priority = false,
  className,
  testId,
}: {
  state: PosterState;
  priority?: boolean;
  className?: string;
  testId?: string;
}) {
  if (priority) {
    preload(`/images/hero/car-${state}-t-1080.avif`, {
      as: "image",
      type: "image/avif",
      imageSrcSet: srcSet(state, TABLET, "avif"),
      imageSizes: "100vw",
      media: MEDIA_TABLET,
      fetchPriority: "high",
    });
    preload(`/images/hero/car-${state}-1440.avif`, {
      as: "image",
      type: "image/avif",
      imageSrcSet: srcSet(state, DESKTOP, "avif"),
      imageSizes: "100vw",
      media: MEDIA_DESKTOP,
      fetchPriority: "high",
    });
  }
  return (
    <picture
      className={cn("absolute inset-y-0 left-0 right-0 mx-auto block max-w-[1680px]", className)}
      data-testid={testId}
    >
      <source media={MEDIA_MOBILE} type="image/avif" srcSet={srcSet(state, MOBILE, "avif")} sizes="100vw" />
      <source media={MEDIA_MOBILE} type="image/webp" srcSet={srcSet(state, MOBILE, "webp")} sizes="100vw" />
      <source media={MEDIA_TABLET} type="image/avif" srcSet={srcSet(state, TABLET, "avif")} sizes="100vw" />
      <source media={MEDIA_TABLET} type="image/webp" srcSet={srcSet(state, TABLET, "webp")} sizes="100vw" />
      <source type="image/avif" srcSet={srcSet(state, DESKTOP, "avif")} sizes="100vw" />
      <source type="image/webp" srcSet={srcSet(state, DESKTOP, "webp")} sizes="100vw" />
      <img
        src={`/images/hero/car-${state}-1440.webp`}
        alt=""
        width={2560}
        height={1440}
        decoding="async"
        loading={priority ? "eager" : "lazy"}
        draggable={false}
        className="absolute inset-y-0 left-0 h-full w-full select-none object-contain object-[50%_50%] lg:left-[8%] lg:w-[92%] lg:object-[100%_100%]"
      />
    </picture>
  );
}
