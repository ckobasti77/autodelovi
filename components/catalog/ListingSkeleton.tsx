import { Skeleton, SkeletonRegion } from "@/components/ui/Skeleton";

/** Category / search loading state: same geometry as the listing (no layout shift). */
export function ListingSkeleton({ rail = true }: { rail?: boolean }) {
  return (
    <SkeletonRegion
      label="Učitavaju se artikli"
      className="px-page pb-(--space-section) pt-6 lg:pt-8"
    >
      <Skeleton className="h-3.5 w-64" />
      <Skeleton className="mt-5 h-10 w-[min(28rem,80%)]" />
      <Skeleton className="mt-4 h-5 w-[min(40rem,90%)]" />
      <div className={`mt-10 grid gap-8 ${rail ? "lg:grid-cols-[17.5rem_minmax(0,1fr)]" : ""}`}>
        {rail ? (
          <div className="hidden flex-col gap-4 lg:flex">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : null}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-(--gutter) lg:grid-cols-3 xl:grid-cols-4">
          {/* The card's own geometry: an 88 px thumbnail beside the facts and a footer across
              the card on phones, picture over facts over footer from 480 px. */}
          {Array.from({ length: 8 }, (_, i) => (
            <div
              key={i}
              className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3 panel p-3 sm:grid-cols-1 sm:p-4"
            >
              <Skeleton className="size-22 sm:aspect-[4/3] sm:size-auto sm:w-full" />
              <div className="flex flex-col gap-2">
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-4 w-3/5" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <div className="col-span-2 flex items-end justify-between gap-3 border-t border-line pt-3 sm:col-span-1">
                <Skeleton className="h-7 w-24" />
                <Skeleton className="h-11 w-28" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </SkeletonRegion>
  );
}
