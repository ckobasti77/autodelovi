import { RouteLink as NextLink } from "@/components/ui/RouteLink";
import {
  ChatCircleTextIcon,
  ClockIcon,
  EnvelopeIcon,
  MapPinIcon,
  PhoneIcon,
  WhatsappLogoIcon,
} from "@phosphor-icons/react/dist/ssr";

import {
  contactLinkList,
  resolveCompany,
  resolveContact,
  site,
  type Company,
  type Contact,
  type ContactLink,
} from "@/config/site";
import { ROUTES } from "@/constants/routes";
import { TEST_IDS } from "@/constants/testIds";
import { LogoLockupResponsive } from "@/components/brand/Logo";
import { ConsentSettingsButton } from "@/components/consent/ConsentSettingsButton";

const CHANNEL = {
  phone: { label: "Telefon", Icon: PhoneIcon },
  viber: { label: "Viber", Icon: ChatCircleTextIcon },
  whatsapp: { label: "WhatsApp", Icon: WhatsappLogoIcon },
  email: { label: "E-pošta", Icon: EnvelopeIcon },
} as const;

const linkClass =
  "inline-flex min-h-8 items-center text-ink-2 underline decoration-transparent underline-offset-4 transition-control hover:text-ink-1 hover:decoration-line-strong";

const COLUMNS = [
  {
    title: "Delovi",
    links: [
      { href: ROUTES.parts, label: "Svi delovi" },
      { href: ROUTES.vehicles, label: "Delovi po vozilu" },
      { href: ROUTES.search, label: "Pretraga po broju dela" },
      { href: ROUTES.inquiry, label: "Upit po broju šasije" },
    ],
  },
  {
    title: "Kupovina",
    links: [
      { href: ROUTES.delivery, label: "Dostava i plaćanje" },
      { href: ROUTES.returns, label: "Reklamacije i povrat" },
      { href: ROUTES.mechanics, label: "Za majstore" },
      { href: ROUTES.about, label: "O nama" },
      { href: ROUTES.contact, label: "Kontakt" },
    ],
  },
] as const;

const LEGAL = [
  { href: ROUTES.terms, label: "Uslovi korišćenja" },
  { href: ROUTES.privacy, label: "Politika privatnosti" },
  { href: ROUTES.cookies, label: "Kolačići" },
] as const;

function ContactItem({ link }: { link: ContactLink }) {
  const { label, Icon } = CHANNEL[link.channel];
  return (
    <li>
      <a href={link.href} className="group inline-flex min-h-11 items-center gap-3 text-ink-1">
        <Icon size={20} aria-hidden="true" className="shrink-0 text-ink-3" />
        <span className="flex flex-col">
          <span className="type-caption font-normal text-ink-3">{label}</span>
          <span className="underline decoration-transparent underline-offset-4 transition-control group-hover:decoration-accent">
            {link.display}
          </span>
        </span>
      </a>
    </li>
  );
}

export type FooterProps = {
  contact?: Partial<Contact> | null;
  company?: Partial<Company> | null;
};

/**
 * Site footer: navigation columns, contact (only channels that exist — otherwise the
 * inquiry is the way in), company data required by the e-commerce law (shown as soon as it
 * is entered in settings), legal links and the nominative-use disclaimer for vehicle makes.
 */
export function Footer({ contact, company }: FooterProps) {
  const resolvedContact = resolveContact(contact);
  const resolvedCompany = resolveCompany(company);
  const channels = contactLinkList(resolvedContact);
  const address = resolvedContact.address;
  const hasAddress = Boolean(address.street && address.city);
  const companyLines = [
    resolvedCompany.legalName,
    resolvedCompany.seat,
    resolvedCompany.pib ? `PIB ${resolvedCompany.pib}` : "",
    resolvedCompany.mb ? `MB ${resolvedCompany.mb}` : "",
    resolvedCompany.registry,
  ].filter(Boolean);
  const year = new Date().getFullYear();
  const makes = site.brand.makes;
  const makesList = `${makes.slice(0, -1).join(", ")} i ${makes[makes.length - 1]}`;

  return (
    <footer
      data-testid={TEST_IDS.footer}
      className="cv-auto border-t border-line bg-bg-raised print:hidden [contain-intrinsic-size:auto_1040px] md:[contain-intrinsic-size:auto_700px] lg:[contain-intrinsic-size:auto_440px]"
    >
      <div className="grid gap-10 px-page py-14 md:grid-cols-2 lg:grid-cols-[1fr_1fr_1.3fr] lg:gap-8">
        {/* The lockup with the signature needs 56 px of height (445 px wide): its own row. */}
        <div className="flex flex-col gap-5 md:col-span-2 lg:col-span-3 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
          <NextLink
            href={ROUTES.home}
            aria-label={`${site.brand.lockupName} — početna`}
            className="inline-flex self-start rounded-xs"
          >
            <LogoLockupResponsive
              label={null}
              stackedClassName="h-auto w-[min(100%,343px)]"
              horizontalClassName="h-14 w-auto"
              className="max-sm:w-full"
            />
          </NextLink>
          <p className="max-w-[44ch] type-body-s text-ink-2 lg:text-right">
            {site.brand.description}
          </p>
        </div>

        {COLUMNS.map((column) => (
          <nav key={column.title} aria-label={column.title} className="flex flex-col gap-3">
            <h2 className="type-label text-ink-3">{column.title}</h2>
            <ul className="flex flex-col gap-1 type-body-s">
              {column.links.map((link) => (
                <li key={link.href}>
                  <NextLink href={link.href} className={linkClass}>
                    {link.label}
                  </NextLink>
                </li>
              ))}
            </ul>
          </nav>
        ))}

        <div className="flex flex-col gap-3">
          <h2 className="type-label text-ink-3">Kontakt</h2>
          <ul className="flex flex-col gap-1 type-body-s">
            {channels.map((link) => (
              <ContactItem key={link.channel} link={link} />
            ))}
            {hasAddress ? (
              <li className="flex items-start gap-3 py-1.5 text-ink-1">
                <MapPinIcon size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-3" />
                <span className="flex flex-col">
                  <span>{address.street}</span>
                  <span>
                    {address.postalCode} {address.city}
                  </span>
                  {address.mapUrl ? (
                    <a
                      href={address.mapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={linkClass}
                    >
                      Prikaži na mapi<span className="sr-only"> (otvara se u novom prozoru)</span>
                    </a>
                  ) : null}
                </span>
              </li>
            ) : null}
            {resolvedContact.hours ? (
              <li className="flex items-start gap-3 py-1.5 text-ink-2">
                <ClockIcon size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-3" />
                <span>{resolvedContact.hours}</span>
              </li>
            ) : null}
            <li>
              <NextLink
                href={ROUTES.inquiry}
                className={`${linkClass} min-h-11 font-semibold text-ink-1`}
              >
                Pošaljite upit&nbsp;— javljamo se u toku radnog dana
              </NextLink>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-line">
        <div className="flex flex-col gap-4 px-page py-6 type-caption font-normal text-ink-3 lg:flex-row lg:items-start lg:justify-between lg:gap-10">
          <div className="flex flex-col gap-2">
            <p>
              © {year} {resolvedCompany.legalName || site.brand.name}
            </p>
            {companyLines.length > 1 ? (
              <p className="text-ink-3">{companyLines.slice(1).join(" · ")}</p>
            ) : null}
            <p className="max-w-[80ch]">
              {makesList} su registrovani žigovi svojih vlasnika. Nazive marki koristimo samo da
              bismo označili vozila kojima su delovi namenjeni; {site.brand.name} nije povezan sa
              proizvođačima vozila niti je njihov ovlašćeni zastupnik.
            </p>
          </div>
          <nav aria-label="Pravne informacije">
            <ul className="flex flex-wrap gap-x-5 gap-y-1">
              {LEGAL.map((link) => (
                <li key={link.href}>
                  <NextLink href={link.href} className={linkClass}>
                    {link.label}
                  </NextLink>
                </li>
              ))}
              <li>
                <ConsentSettingsButton className={`${linkClass} cursor-pointer`} />
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}
