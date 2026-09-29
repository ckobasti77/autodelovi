"use client";

/**
 * Store-bound vehicle triggers: the header chip and the hero field open the one picker and
 * clear the one selection (`sk.vehicle.v1`).
 */
import { VehicleChip, VehicleField } from "@/components/shell/VehiclePicker";
import { openVehiclePicker } from "@/lib/vehicle/picker";
import {
  useSelectedVehicle,
  useVehicleStore,
  vehicleFullLabel,
  vehicleLabel,
} from "@/lib/vehicle/store";

export function HeaderVehicleChip({ className }: { className?: string }) {
  const vehicle = useSelectedVehicle();
  const clear = useVehicleStore((s) => s.clear);
  return (
    <VehicleChip
      vehicle={vehicle ? { label: vehicleLabel(vehicle), fullLabel: vehicleFullLabel(vehicle) } : null}
      onOpen={openVehiclePicker}
      onClear={clear}
      className={className}
    />
  );
}

export function HeroVehicleField({ className }: { className?: string }) {
  const vehicle = useSelectedVehicle();
  const clear = useVehicleStore((s) => s.clear);
  return (
    <VehicleField
      vehicle={vehicle ? { label: vehicleLabel(vehicle), fullLabel: vehicleFullLabel(vehicle) } : null}
      onOpen={openVehiclePicker}
      onClear={clear}
      className={className}
    />
  );
}
