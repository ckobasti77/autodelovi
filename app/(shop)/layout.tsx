import { SiteShell } from "@/components/shell/SiteShell";
import { HeaderVehicleChip } from "@/components/vehicle/VehicleBindings";
import { VehiclePickerDialog } from "@/components/vehicle/VehiclePickerDialog";

/** Storefront route group: header (with the shared vehicle chip) + footer around every page. */
export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <SiteShell vehicleSlot={<HeaderVehicleChip />}>
      {children}
      <VehiclePickerDialog />
    </SiteShell>
  );
}
