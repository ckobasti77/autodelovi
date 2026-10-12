import { Skeleton, SkeletonRegion } from "@/components/ui/Skeleton";

/** Stands in for a list view: one panel of two-line rows (the geometry of the lists). */
export default function Loading() {
  return (
    <SkeletonRegion label="Učitava se nalog">
      <div className="flex flex-col divide-y divide-line panel">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 px-4 py-3.5 sm:px-5"
          >
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-6 w-48 max-w-full" />
          </div>
        ))}
      </div>
    </SkeletonRegion>
  );
}
