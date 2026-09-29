"use client";

import { useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { SelectedVehicle } from "@/lib/vehicle/store";

export type VehicleFilter = {
  brandId?: Id<"vehicleBrands">;
  modelId?: Id<"vehicleModels">;
  generationId?: Id<"vehicleGenerations">;
  engineId?: Id<"engines">;
};

/**
 * Convex ids for the stored vehicle slugs (`catalog.vehicles.resolve`). `pending` is true while
 * the ids load; `filter` is undefined when no vehicle is selected or the slugs no longer exist.
 */
export function useVehicleFilter(vehicle: SelectedVehicle | null): {
  filter: VehicleFilter | undefined;
  pending: boolean;
} {
  const resolved = useQuery(
    api.catalog.vehicles.resolve,
    vehicle
      ? {
          brandSlug: vehicle.brand.slug,
          modelSlug: vehicle.model.slug,
          ...(vehicle.generation ? { generationSlug: vehicle.generation.slug } : {}),
          ...(vehicle.engine ? { engineSlug: vehicle.engine.slug } : {}),
        }
      : "skip",
  );
  if (!vehicle) return { filter: undefined, pending: false };
  if (resolved === undefined) return { filter: undefined, pending: true };
  if (resolved === null) return { filter: undefined, pending: false };
  return {
    pending: false,
    filter: {
      brandId: resolved.brand._id,
      ...(resolved.model ? { modelId: resolved.model._id } : {}),
      ...(resolved.generation ? { generationId: resolved.generation._id } : {}),
      ...(resolved.engine ? { engineId: resolved.engine._id } : {}),
    },
  };
}
