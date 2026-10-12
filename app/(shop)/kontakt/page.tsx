import type { Metadata } from "next";
import { ChatCircleTextIcon, ClockIcon, MapPinIcon } from "@phosphor-icons/react/dist/ssr";

import { contactLinkList } from "@/config/site";
import { storeJsonLd } from "@/lib/seo/jsonld";
import { storeInfoFromSettings } from "@/lib/seo/store";
import { contactFromSettings } from "@/lib/settings/public";
import { getSettingsPublic } from "@/lib/server/catalog-cache";
import { Button } from "@/components/ui/Button";
import { Link } from "@/components/ui/Link";
import { Reveal } from "@/components/reveal/Reveal";
import { JsonLd } from "@/components/seo/JsonLd";
import { ContactChannels } from "@/components/content/ContactChannels";
import { ContentPageView, contentMetadata } from "@/components/content/ContentPageView";
import { InquirySteps } from "@/components/inquiry/InquirySteps";
import { ROUTES } from "@/constants/routes";

export function generateMetadata(): Promise<Metadata> {
  return contentMetadata("kontakt", ROUTES.contact);
}

/** „Pon–pet 8–17, sub 8–14“ → [["Pon–pet", "8–17"], ["Sub", "8–14"]]. */
function hoursRows(hours: string): [string, string][] {
  return hours
    .split(", ")
    .map((group): [string, string] => {
      const at = group.lastIndexOf(" ");
      const days = at === -1 ? group : group.slice(0, at);
      return [days.charAt(0).toUpperCase() + days.slice(1), at === -1 ? "" : group.slice(at + 1)];
    })
    .filter(([days]) => days !== "");
}

/**
 * `/kontakt`: two columns — the channels as one-tap rows and the inquiry on the left, hours
 * and address with the map link on the right. Every block depends on settings and is left out
 * while its data is missing; the inquiry is always there, so the page is never a dead end.
 */
export default async function ContactPage() {
  const settings = await getSettingsPublic();
  const contact = contactFromSettings(settings);
  const links = contactLinkList(contact);
  const hasAddress = Boolean(contact.address.street && contact.address.city);
  const hours = contact.hours ? hoursRows(contact.hours) : [];

  const channels = (
    <div className="flex flex-col gap-4">
      <JsonLd data={storeJsonLd(storeInfoFromSettings(settings))} />
      {links.length ? (
        <Reveal
          as="section"
          eager
          aria-labelledby="contact-channels"
          className="overflow-hidden panel"
        >
          <h2 id="contact-channels" className="px-4 pt-4 pb-3 type-h4 text-ink-1 sm:px-5">
            Pozovite ili pišite
          </h2>
          <ContactChannels links={links} location="contact_page" />
        </Reveal>
      ) : null}
      <Reveal
        as="section"
        eager
        index={links.length ? 1 : 0}
        aria-labelledby="contact-inquiry"
        className="panel"
      >
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5">
          <span
            aria-hidden="true"
            className="flex size-10 shrink-0 items-center justify-center panel-inset text-ink-2 max-sm:hidden"
          >
            <ChatCircleTextIcon size={20} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h2 id="contact-inquiry" className="type-h4 text-ink-1">
              Upit po broju šasije
            </h2>
            <p className="type-body-s text-ink-2">
              Broj šasije i šta vam treba — javljamo se sa ponudom u toku radnog dana.
            </p>
          </div>
          <Button asChild variant="primary" className="w-full shrink-0 sm:w-auto">
            <Link href={ROUTES.inquiry} variant="unstyled">
              Pošaljite upit
            </Link>
          </Button>
        </div>
        {/* Without a phone or an address in settings the inquiry is the way in: say how it goes. */}
        {links.length === 0 ? (
          <div className="border-t border-line p-4 sm:p-5">
            <InquirySteps />
          </div>
        ) : null}
      </Reveal>
    </div>
  );

  const place =
    hours.length || hasAddress ? (
      <aside aria-label="Radnja" className="flex flex-col gap-4">
        {hours.length ? (
          <Reveal
            as="section"
            eager
            index={1}
            aria-labelledby="contact-hours"
            className="panel p-5"
          >
            <h2 id="contact-hours" className="flex items-center gap-2.5 type-h4 text-ink-1">
              <ClockIcon size={20} aria-hidden="true" className="shrink-0 text-ink-3" />
              Radno vreme
            </h2>
            <dl className="mt-3 flex flex-col">
              {hours.map(([days, time]) => (
                <div
                  key={days}
                  className="flex items-baseline justify-between gap-4 border-t border-line-faint py-2.5 first:border-t-0"
                >
                  <dt className="type-body text-ink-2">{days}</dt>
                  <dd className="type-body tabular-nums text-ink-1">{time}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        ) : null}
        {hasAddress ? (
          <Reveal
            as="section"
            eager
            index={2}
            aria-labelledby="contact-address"
            className="panel p-5"
          >
            <h2 id="contact-address" className="flex items-center gap-2.5 type-h4 text-ink-1">
              <MapPinIcon size={20} aria-hidden="true" className="shrink-0 text-ink-3" />
              Adresa
            </h2>
            <p className="mt-3 type-body text-ink-1">
              {contact.address.street}, {contact.address.postalCode} {contact.address.city}
            </p>
            {contact.address.mapUrl ? (
              <p className="mt-3">
                <Link href={contact.address.mapUrl} variant="standalone">
                  Prikaži na mapi
                </Link>
              </p>
            ) : null}
          </Reveal>
        ) : null}
      </aside>
    ) : null;

  return (
    <ContentPageView
      slug="kontakt"
      path={ROUTES.contact}
      kind="place"
      before={channels}
      aside={place}
    />
  );
}
