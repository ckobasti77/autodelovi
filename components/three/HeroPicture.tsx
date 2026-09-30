/**
 * Hero poster `<picture>` (contract F7.1, DESIGN-SYSTEM §7.8): the pipeline's pre-encoded
 * AVIF/WebP renders at their true widths — 16:9 from 768 px (1080/1440/1920/2560) and the 4:5
 * portrait crop below (640/828/1080). Served as static files: no optimizer round trip, so a
 * cold cache never delays the LCP (D98). Framing mirrors the canvas (`lib/three/framing.ts`):
 * `object-fit: contain`, bottom-centred; from 1024 px an 8 % left inset, bottom-right.
 *
 * No hooks — renders on the server (assembled poster, LCP) and on the client (exploded poster
 * for the low tier and the context-loss fallback).
 *
 * Priority is split by viewport: from 768 px the poster is the LCP element and gets a
 * media-scoped high-priority preload; on phones the headline is the LCP and the poster sits
 * below it, so it loads eagerly at normal priority instead of competing with CSS and fonts.
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
const MOBILE = [
  ["-m-640", 640],
  ["-m-828", 828],
  ["-m-1080", 1080],
] as const;

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
  const mobileQuery = "(max-width: 47.999rem)";
  if (priority) {
    preload(`/images/hero/car-${state}-1440.avif`, {
      as: "image",
      type: "image/avif",
      imageSrcSet: srcSet(state, DESKTOP, "avif"),
      imageSizes: "100vw",
      media: "(min-width: 48rem)",
      fetchPriority: "high",
    });
  }
  return (
    <picture
      className={cn("absolute inset-y-0 left-0 right-0 block lg:left-[8%]", className)}
      data-testid={testId}
    >
      <source media={mobileQuery} type="image/avif" srcSet={srcSet(state, MOBILE, "avif")} sizes="100vw" />
      <source media={mobileQuery} type="image/webp" srcSet={srcSet(state, MOBILE, "webp")} sizes="100vw" />
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
        className="absolute inset-0 h-full w-full select-none object-contain object-[50%_100%] lg:object-[100%_100%]"
      />
    </picture>
  );
}
