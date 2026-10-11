import { ChatCircleTextIcon, PhoneIcon } from "@phosphor-icons/react/dist/ssr";

import { contactLinks } from "@/config/site";
import { companyFromSettings, contactFromSettings } from "@/lib/settings/public";
import { getSettingsPublic } from "@/lib/server/catalog-cache";
import { ConsentRoot } from "@/components/consent/ConsentRoot";
import { ConsentSettingsButton } from "@/components/consent/ConsentSettingsButton";
import { BrandLink } from "@/components/brand/BrandLink";
import { CartButtonLive } from "@/components/shell/CartButtonLive";
import { ShopChrome } from "@/components/shell/ShopChrome";
import { MAIN_ID } from "@/components/shell/SkipLink";
import { RouteLink } from "@/components/ui/RouteLink";
import { VehiclePickerLazy } from "@/components/vehicle/VehiclePickerLazy";
import { ROUTES } from "@/constants/routes";

const linkClass =
  "inline-flex min-h-11 items-center text-ink-2 underline decoration-transparent underline-offset-4 transition-control hover:text-ink-1 hover:decoration-line-strong";

/**
 * Ads landings (`/ponuda/[slug]`, SEO-ADS §J10): minimal navigation for message match — the
 * logo, call/Viber and the cart; a short legal footer. Same consent, cart drawer and
 * attribution capture as the shop.
 */
export default async function LandingLayout({ children }: LayoutProps<"/">) {
  const settings = await getSettingsPublic();
  const contact = contactFromSettings(settings);
  const company = companyFromSettings(settings);
  const phone = contactLinks.tel(contact.phone);
  const viber = contactLinks.viber(contact.viber);
  const courier = settings.deliveryMethods.find((d) => d.code === "courier");
  return (
    <>
      <ConsentRoot />
      <div className="flex min-h-dvh flex-col">
        <header
          data-reveal="off"
          className="sticky top-0 z-header border-b border-line bg-bg/88 backdrop-blur-header print:hidden reduced-transparency:bg-bg-raised reduced-transparency:backdrop-blur-none"
        >
          <div className="flex h-header items-center gap-2 px-page">
            <BrandLink compact="phone" className="mr-auto" />
            {phone ? (
              <a
                href={phone.href}
                data-contact-location="ponuda_header"
                className="inline-flex h-11 items-center gap-2 rounded-sm px-3 type-button text-ink-1 transition-control hover:bg-surface-2"
              >
                <PhoneIcon size={20} aria-hidden="true" />
                <span className="hidden sm:inline">{phone.display}</span>
                <span className="sm:hidden">Pozovite</span>
              </a>
            ) : null}
            {viber ? (
              <a
                href={viber.href}
                data-contact-location="ponuda_header"
                aria-label={`Viber ${viber.display}`}
                className="hidden size-11 items-center justify-center rounded-sm text-ink-2 transition-control hover:bg-surface-2 hover:text-ink-1 sm:inline-flex"
              >
                <ChatCircleTextIcon size={24} aria-hidden="true" />
              </a>
            ) : null}
            <CartButtonLive />
          </div>
        </header>
        <main id={MAIN_ID} tabIndex={-1} className="flex-1 outline-none">
          {children}
        </main>
        <footer className="border-t border-line bg-bg-raised print:hidden">
          <div className="flex flex-col gap-4 px-page py-8 type-body-s lg:flex-row lg:items-center lg:justify-between">
            <p className="text-ink-3">
              {company.legalName || settings.brand.name}
              {company.pib ? ` · PIB ${company.pib}` : ""}
            </p>
            <ul className="flex flex-wrap gap-x-5">
              <li>
                <RouteLink href={ROUTES.parts} className={linkClass}>
                  Svi delovi
                </RouteLink>
              </li>
              <li>
                <RouteLink href={ROUTES.delivery} className={linkClass}>
                  Dostava i plaćanje
                </RouteLink>
              </li>
              <li>
                <RouteLink href={ROUTES.returns} className={linkClass}>
                  Reklamacije i povrat
                </RouteLink>
              </li>
              <li>
                <RouteLink href={ROUTES.privacy} className={linkClass}>
                  Privatnost
                </RouteLink>
              </li>
              <li>
                <RouteLink href={ROUTES.cookies} className={linkClass}>
                  Kolačići
                </RouteLink>
              </li>
              <li>
                <ConsentSettingsButton className={`${linkClass} cursor-pointer`} />
              </li>
            </ul>
          </div>
        </footer>
      </div>
      <VehiclePickerLazy />
      <ShopChrome
        delivery={{
          courierPricePara: courier?.pricePara ?? null,
          freeOverPara: courier?.freeOverPara ?? settings.commerce.freeShippingOverPara ?? null,
          pickup: settings.deliveryMethods.some((d) => d.code === "pickup"),
          vatRateBp: settings.commerce.vatRateBp,
        }}
      />
    </>
  );
}
