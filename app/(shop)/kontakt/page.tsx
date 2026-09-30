import type { Metadata } from "next";
import { ClockIcon, MapPinIcon } from "@phosphor-icons/react/dist/ssr";

import { contactLinkList } from "@/config/site";
import { storeJsonLd } from "@/lib/seo/jsonld";
import { storeInfoFromSettings } from "@/lib/seo/store";
import { contactFromSettings } from "@/lib/settings/public";
import { getSettingsPublic } from "@/lib/server/catalog-cache";
import { Button } from "@/components/ui/Button";
import { Link } from "@/components/ui/Link";
import { JsonLd } from "@/components/seo/JsonLd";
import { ContactActions } from "@/components/shell/ContactActions";
import { ContentPageView, contentMetadata } from "@/components/content/ContentPageView";
import { ROUTES } from "@/constants/routes";

export function generateMetadata(): Promise<Metadata> {
  return contentMetadata("kontakt", ROUTES.contact);
}

/** `/kontakt`: every configured channel, address with map link, hours; inquiry always. */
export default async function ContactPage() {
  const settings = await getSettingsPublic();
  const contact = contactFromSettings(settings);
  const links = contactLinkList(contact);
  const hasAddress = Boolean(contact.address.street && contact.address.city);
  const block = (
    <div
      className="flex flex-col gap-6 rounded-sm border border-line bg-surface-1 p-5"
      data-reveal="off"
    >
      <JsonLd data={storeJsonLd(storeInfoFromSettings(settings))} />
      {links.length ? (
        <ContactActions links={links} location="contact_page" variant="buttons" showValue />
      ) : null}
      {hasAddress ? (
        <p className="flex items-start gap-3 type-body text-ink-1">
          <MapPinIcon size={20} aria-hidden="true" className="mt-1 shrink-0 text-ink-3" />
          <span>
            {contact.address.street}, {contact.address.postalCode} {contact.address.city}
            {contact.address.mapUrl ? (
              <span className="block">
                <Link href={contact.address.mapUrl} variant="inline">
                  Prikaži na mapi
                </Link>
              </span>
            ) : null}
          </span>
        </p>
      ) : null}
      {contact.hours ? (
        <p className="flex items-start gap-3 type-body text-ink-2">
          <ClockIcon size={20} aria-hidden="true" className="mt-1 shrink-0 text-ink-3" />
          Radno vreme: {contact.hours}
        </p>
      ) : null}
      <div>
        <Button asChild variant="primary">
          <Link href={ROUTES.inquiry} variant="unstyled">
            Pošaljite upit
          </Link>
        </Button>
      </div>
    </div>
  );
  return <ContentPageView slug="kontakt" path={ROUTES.contact} before={block} />;
}
