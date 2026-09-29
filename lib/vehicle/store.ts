"use client";

/**
 * The visitor's selected vehicle (ARCHITECTURE §G2): one Zustand store persisted as
 * `sk.vehicle.v1`, shared by the header chip, the hero field, the 3D part panel and (later)
 * catalog filters. Slugs are stored, not Convex ids — ids are resolved on use through
 * `catalog.vehicles.resolve`, so a reseeded database never leaves a stale id in the browser.
 *
 * Hydration: `skipHydration` keeps the first client render identical to the server HTML (no
 * vehicle); `useSelectedVehicle` rehydrates from localStorage after mount.
 */
import { useEffect } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type VehiclePart = { slug: string; name: string };

export type SelectedVehicle = {
  brand: VehiclePart;
  model: VehiclePart;
  generation: (VehiclePart & { yearFrom: number; yearTo: number | null }) | null;
  engine: (VehiclePart & { codes: string[] }) | null;
};

type VehicleState = {
  vehicle: SelectedVehicle | null;
  hydrated: boolean;
  setVehicle: (vehicle: SelectedVehicle) => void;
  clear: () => void;
};

export const useVehicleStore = create<VehicleState>()(
  persist(
    (set) => ({
      vehicle: null,
      hydrated: false,
      setVehicle: (vehicle) => set({ vehicle }),
      clear: () => set({ vehicle: null }),
    }),
    {
      name: "sk.vehicle.v1",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (state) => ({ vehicle: state.vehicle }),
      onRehydrateStorage: () => () => useVehicleStore.setState({ hydrated: true }),
    },
  ),
);

let rehydrating = false;

/** Selected vehicle after hydration (null on the server and in the first client render). */
export function useSelectedVehicle(): SelectedVehicle | null {
  const vehicle = useVehicleStore((s) => s.vehicle);
  const hydrated = useVehicleStore((s) => s.hydrated);
  useEffect(() => {
    if (hydrated || rehydrating) return;
    rehydrating = true;
    void useVehicleStore.persist.rehydrate();
  }, [hydrated]);
  return hydrated ? vehicle : null;
}

const BRAND_SHORT: Readonly<Record<string, string>> = { volkswagen: "VW" };

/** Chip label, e.g. „Golf VII · 2.0 TDI 110 kW“. */
export function vehicleLabel(v: SelectedVehicle): string {
  const base = v.generation?.name ?? v.model.name;
  return v.engine ? `${base} · ${v.engine.name}` : base;
}

/** Field label, e.g. „VW Golf VII 2.0 TDI 110 kW (CRLB)“. */
export function vehicleFullLabel(v: SelectedVehicle): string {
  const brand = BRAND_SHORT[v.brand.slug] ?? v.brand.name;
  const base = v.generation?.name ?? v.model.name;
  const engine = v.engine
    ? ` ${v.engine.name}${v.engine.codes[0] ? ` (${v.engine.codes[0]})` : ""}`
    : "";
  return `${brand} ${base}${engine}`;
}

/** Short name for sentences („za Golf VII“). */
export function vehicleShortName(v: SelectedVehicle): string {
  return v.generation?.name ?? `${BRAND_SHORT[v.brand.slug] ?? v.brand.name} ${v.model.name}`;
}
