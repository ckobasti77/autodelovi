import type { Metadata } from "next";

import { SiteShell } from "@/components/shell/SiteShell";
import { NotFoundContent } from "@/components/shell/NotFoundContent";
import { HeaderVehicleChip } from "@/components/vehicle/VehicleBindings";
import { VehiclePickerLazy } from "@/components/vehicle/VehiclePickerLazy";

export const metadata: Metadata = {
  title: "Stranica nije pronađena",
  robots: { index: false, follow: true },
};

/** Global 404 for URLs outside any route (the shop group has its own inside its layout). */
export default function NotFound() {
  return (
    <SiteShell vehicleSlot={<HeaderVehicleChip />}>
      <NotFoundContent />
      <VehiclePickerLazy />
    </SiteShell>
  );
}
