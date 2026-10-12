import { getImageProps } from "next/image";
import { preload as preloadResource } from "react-dom";

import { cn } from "@/lib/cn";
import { categoryImage } from "@/lib/catalog/types";

/**
 * Product image on the graphite radial ground (§6.3, §9.7): the client's photo when it exists,
 * otherwise the category render. Renders are transparent WebP, so the ground is CSS.
 *
 * A plain `<img>` with the attributes `next/image` would render (`getImageProps`: same optimized
 * srcset, sizes, lazy loading, fill styles), not the `next/image` client component: the thumb
 * uses none of its client features (placeholder, onLoad), and every card in a listing would
 * otherwise hydrate two components with a dozen hooks each (PERF-01). `preload` emits the same
 * `<link rel="preload" imagesrcset>` the component does.
 */
export function ProductThumb({
  imageUrl,
  categorySlug,
  alt,
  sizes,
  preload = false,
  bleed = false,
  className,
  imageClassName,
}: {
  imageUrl: string | null;
  categorySlug: string;
  alt: string;
  sizes: string;
  preload?: boolean;
  /** Category render without the 4 % air around it (small frames: cards, rows). */
  bleed?: boolean;
  className?: string;
  imageClassName?: string;
}) {
  const { props } = getImageProps({
    src: imageUrl ?? categoryImage(categorySlug),
    alt,
    fill: true,
    sizes,
    preload,
    quality: 75,
    className: cn(
      "rounded-[inherit] object-contain transition-transform duration-[600ms] ease-sk-out",
      imageUrl || bleed ? "p-0" : "p-[4%]",
      imageClassName,
    ),
  });
  if (preload) {
    preloadResource(props.src, {
      as: "image",
      imageSrcSet: props.srcSet,
      imageSizes: props.sizes,
      fetchPriority: props.fetchPriority,
    });
  }
  // Same attribute order as next/image: `src` last, after `sizes` and `srcSet`.
  const { className: imgClassName, style, sizes: imgSizes, srcSet, src, ...rest } = props;
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-[radial-gradient(circle_at_50%_42%,var(--color-surface-3),var(--color-surface-1)_72%)]",
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- next/image's own attributes (getImageProps) */}
      <img
        {...rest}
        alt={alt}
        data-nimg="fill"
        className={imgClassName}
        style={style}
        sizes={imgSizes}
        srcSet={srcSet}
        src={src}
      />
    </div>
  );
}
