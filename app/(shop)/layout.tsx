import { companyFromSettings, contactFromSettings } from "@/lib/settings/public";
import { getSettingsPublic } from "@/lib/server/catalog-cache";
import { SiteShell } from "@/components/shell/SiteShell";
import { ConsentRoot } from "@/components/consent/ConsentRoot";
import { ShopChrome } from "@/components/shell/ShopChrome";
import { HeaderVehicleChip } from "@/components/vehicle/VehicleBindings";
import { VehiclePickerLazy } from "@/components/vehicle/VehiclePickerLazy";

/**
 * Storefront route group: header (shared vehicle chip, contact from settings) + footer
 * (company data from settings) around every page, plus the cart drawer and client chrome.
 */
export default async function ShopLayout({ children }: LayoutProps<"/">) {
  const settings = await getSettingsPublic();
  const courier = settings.deliveryMethods.find((d) => d.code === "courier");
  const pickup = settings.deliveryMethods.some((d) => d.code === "pickup");
  return (
    <>
      {/* Early in the DOM so keyboard users reach the consent choice first; fixed, so no shift. */}
      <ConsentRoot />
      <SiteShell
        vehicleSlot={<HeaderVehicleChip />}
        contact={contactFromSettings(settings)}
        company={companyFromSettings(settings)}
      >
        {children}
        <VehiclePickerLazy />
        <ShopChrome
          delivery={{
            courierPricePara: courier?.pricePara ?? null,
            freeOverPara: courier?.freeOverPara ?? settings.commerce.freeShippingOverPara ?? null,
            pickup,
            vatRateBp: settings.commerce.vatRateBp,
          }}
        />
      </SiteShell>
    </>
  );
}
