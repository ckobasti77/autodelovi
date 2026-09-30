/**
 * Business node input from public settings (SEO-ADS §J2): only what the owner entered —
 * empty values are omitted by the builder, never replaced with invented data.
 */
import type { StoreInfo } from "@/lib/seo/jsonld";
import { contactFromSettings, type PublicSettingsLike } from "@/lib/settings/public";

type StoreSettings = Pick<PublicSettingsLike, "company" | "hours" | "brand"> & {
  hours: StoreInfo["hours"];
};

export function storeInfoFromSettings(settings: StoreSettings): StoreInfo {
  const contact = contactFromSettings(settings);
  const c = settings.company;
  const hasAddress = Boolean(contact.address.street && contact.address.city);
  return {
    name: c.displayName?.trim() || settings.brand.name,
    ...(c.legalName?.trim() ? { legalName: c.legalName.trim() } : {}),
    ...(contact.phone ? { telephone: contact.phone } : {}),
    ...(contact.email ? { email: contact.email } : {}),
    ...(hasAddress
      ? {
          street: contact.address.street,
          city: contact.address.city,
          postalCode: contact.address.postalCode,
        }
      : {}),
    ...(contact.address.mapUrl ? { mapUrl: contact.address.mapUrl } : {}),
    ...(c.pib?.trim() ? { vatId: c.pib.trim() } : {}),
    hours: settings.hours,
  };
}
