"use client";

/**
 * „Izaberi ovo vozilo“ on vehicle pages: stores the generation (and engine) as the visitor's
 * vehicle, so category pages, search and the 3D panel filter for it.
 */
import { CarIcon, CheckIcon } from "@phosphor-icons/react/dist/ssr";

import { useSelectedVehicle, useVehicleStore, type SelectedVehicle } from "@/lib/vehicle/store";
import { Button } from "@/components/ui/Button";

export function UseVehicleButton({ vehicle }: { vehicle: SelectedVehicle }) {
  const current = useSelectedVehicle();
  const setVehicle = useVehicleStore((s) => s.setVehicle);
  const active =
    current?.generation?.slug === vehicle.generation?.slug &&
    (current?.engine?.slug ?? null) === (vehicle.engine?.slug ?? null);
  return (
    <Button
      variant={active ? "secondary" : "primary"}
      icon={active ? <CheckIcon size={20} /> : <CarIcon size={20} />}
      onClick={() => setVehicle(vehicle)}
      aria-pressed={active}
    >
      {active ? "Ovo je vaše vozilo" : "Izaberi ovo vozilo"}
    </Button>
  );
}
