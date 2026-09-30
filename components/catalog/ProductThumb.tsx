import Image from "next/image";

import { cn } from "@/lib/cn";
import { categoryImage } from "@/lib/catalog/types";

/**
 * Product image on the graphite radial ground (§6.3, §9.7): the client's photo when it exists,
 * otherwise the category render. Renders are transparent WebP, so the ground is CSS.
 */
export function ProductThumb({
  imageUrl,
  categorySlug,
  alt,
  sizes,
  preload = false,
  className,
  imageClassName,
}: {
  imageUrl: string | null;
  categorySlug: string;
  alt: string;
  sizes: string;
  preload?: boolean;
  className?: string;
  imageClassName?: string;
}) {
  const src = imageUrl ?? categoryImage(categorySlug);
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-[radial-gradient(circle_at_50%_42%,var(--color-surface-3),var(--color-surface-1)_72%)]",
        className,
      )}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        preload={preload}
        quality={75}
        className={cn(
          "object-contain transition-transform duration-[600ms] ease-sk-out",
          imageUrl ? "p-0" : "p-[4%]",
          imageClassName,
        )}
      />
    </div>
  );
}
