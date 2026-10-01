"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { Link } from "@/components/ui/Link";
import { useSelectedVehicle, vehicleShortName, type SelectedVehicle } from "@/lib/vehicle/store";

/** `brand/model/generation` slugs, the `vozilo` parameter of `/pretraga` (D231). */
export function vehicleSearchParam(v: SelectedVehicle): string {
  return [v.brand.slug, v.model.slug, v.generation?.slug].filter(Boolean).join("/");
}

/**
 * Carries the visitor's selected vehicle (localStorage, client only) into the server-rendered
 * search (FLOW-03): without a `vozilo` parameter it replaces the URL with one, so the results
 * are narrowed to parts that fit. With `vozilo=sva` („prikaži sve“) it offers the way back.
 * A query that names a vehicle itself („pločice golf 7“) is left alone — that vehicle wins.
 */
export function SearchVehicleScope({ queryNamesVehicle }: { queryNamesVehicle: boolean }) {
  const vehicle = useSelectedVehicle();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get("vozilo");

  useEffect(() => {
    if (!vehicle || queryNamesVehicle || current) return;
    const next = new URLSearchParams(params.toString());
    next.set("vozilo", vehicleSearchParam(vehicle));
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }, [vehicle, queryNamesVehicle, current, params, pathname, router]);

  if (!vehicle || queryNamesVehicle || current !== "sva") return null;
  const back = new URLSearchParams(params.toString());
  back.set("vozilo", vehicleSearchParam(vehicle));
  return (
    <p className="type-body-s text-ink-2">
      Prikazani su delovi za sva vozila.{" "}
      <Link href={`${pathname}?${back.toString()}`} variant="inline">
        Samo za {vehicleShortName(vehicle)}
      </Link>
    </p>
  );
}
