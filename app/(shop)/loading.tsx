import { Skeleton, SkeletonRegion, SkeletonText } from "@/components/ui/Skeleton";

/** Generic storefront loading state: title, intro and a card grid in final geometry (no CLS). */
export default function Loading() {
  return (
    <SkeletonRegion className="px-page py-10 lg:py-14">
      <Skeleton className="mb-3 h-3.5 w-56" />
      <Skeleton className="h-9 w-[min(28rem,80%)]" />
      <SkeletonText lines={2} className="mt-5 max-w-[60ch]" />
      <div className="mt-10 grid grid-cols-1 gap-(--gutter) sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div
            key={i}
            className="flex flex-col gap-3 rounded-sm border border-line bg-surface-1 p-4"
          >
            <Skeleton className="aspect-[4/3] w-full" />
            <Skeleton className="h-3 w-24" />
            <SkeletonText lines={2} />
            <Skeleton className="mt-2 h-6 w-28" />
          </div>
        ))}
      </div>
    </SkeletonRegion>
  );
}
