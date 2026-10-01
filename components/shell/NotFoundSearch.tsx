"use client";

import dynamic from "next/dynamic";

/**
 * Live search and vehicle field of the storefront 404. Next lists `(shop)/not-found.tsx` in the
 * client manifest of every shop route, so static imports would ship the hero SearchBox and the
 * vehicle field with every page; here they are separate chunks, still server-rendered, loaded
 * only when a 404 is shown (PERF-13, D266).
 */
const SearchBox = dynamic(() => import("@/components/shell/SearchBox").then((m) => m.SearchBox));
const HeroVehicleField = dynamic(() =>
  import("@/components/vehicle/VehicleBindings").then((m) => m.HeroVehicleField),
);

export function NotFoundSearch() {
  return (
    <>
      <SearchBox variant="hero" className="mt-2" />
      <HeroVehicleField />
    </>
  );
}
