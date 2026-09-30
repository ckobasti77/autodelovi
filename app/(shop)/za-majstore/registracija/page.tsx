import type { Metadata } from "next";

import { contactLinkList } from "@/config/site";
import { contactFromSettings } from "@/lib/settings/public";
import { breadcrumbJsonLd } from "@/lib/seo/jsonld";
import { privateMetadata } from "@/lib/seo/metadata";
import { getViewer, viewerNames } from "@/lib/server/auth";
import { getSettingsPublic, getVehicleTree } from "@/lib/server/catalog-cache";
import { formatPhone } from "@/lib/format/phone";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Button } from "@/components/ui/Button";
import { Link } from "@/components/ui/Link";
import { RevealText } from "@/components/text-reveal/RevealText";
import { JsonLd } from "@/components/seo/JsonLd";
import { ContactActions } from "@/components/shell/ContactActions";
import { MechanicRegistrationForm } from "@/components/mechanic/MechanicRegistrationForm";
import { ROUTES } from "@/constants/routes";

export const metadata: Metadata = privateMetadata("Registracija servisa");

const NEXT_STEPS = [
  "Proverimo firmu u registru i odredimo nivo rabata.",
  "Stiže vam e-mail o odobrenju; posle prijave vidite svoju cenu na svakom artiklu.",
  "Brza porudžbina, cenovnik i istorija su u portalu „Majstor“.",
];

/** `/za-majstore/registracija` (ARCHITECTURE §A3): account + company form → pending profile. */
export default async function MechanicRegistrationPage() {
  const [settings, tree, viewer] = await Promise.all([getSettingsPublic(), getVehicleTree(), getViewer()]);
  const contacts = contactLinkList(contactFromSettings(settings)).filter((l) => l.channel !== "email");
  const crumbs = [
    { label: "Početna", href: ROUTES.home },
    { label: "Za majstore", href: ROUTES.mechanics },
    { label: "Registracija" },
  ];
  const already = viewer && viewer.mechanicStatus !== "none";
  const disabled = !settings.flags.mechanicRegistration;
  const names = viewer ? viewerNames(viewer) : null;

  return (
    <div className="px-page pb-(--space-section) pt-6 lg:pt-8">
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={crumbs} />
      <div className="mt-6 flex max-w-[48rem] flex-col gap-4">
        <RevealText as="h1" className="type-display-l uppercase text-ink-1">
          Registrujte servis
        </RevealText>
        <RevealText as="p" className="type-lead text-ink-2">
          Pet minuta posla: podaci firme i kontakt. Posle odobrenja poručujete po svojoj ceni.
        </RevealText>
      </div>
      <div className="mt-10 grid gap-12 lg:grid-cols-12 lg:gap-x-(--gutter)">
        <div className="lg:col-span-8">
          {already ? (
            <div className="flex flex-col items-start gap-4 rounded-sm border border-line bg-surface-1 p-6">
              <p className="type-body text-ink-1">Ovaj nalog već ima registrovan servis.</p>
              <Button asChild>
                <Link href={ROUTES.mechanicPortal} variant="unstyled">
                  Majstorski portal
                </Link>
              </Button>
            </div>
          ) : disabled ? (
            <div className="flex flex-col items-start gap-4 rounded-sm border border-line bg-surface-1 p-6">
              <p className="type-body text-ink-1">
                Registracija preko sajta je trenutno isključena. Pozovite nas ili pišite na Viber — otvorićemo nalog.
              </p>
              <ContactActions links={contacts} location="mechanic_registration_disabled" />
            </div>
          ) : (
            <MechanicRegistrationForm
              config={{
                brands: tree.map((b) => ({ id: b.brand._id, name: b.brand.name })),
                legal: { terms: settings.legalVersions.terms, privacy: settings.legalVersions.privacy },
                viewer: viewer
                  ? {
                      email: viewer.email ?? "",
                      name: [names?.firstName, names?.lastName].filter(Boolean).join(" "),
                      phone: viewer.phone ? formatPhone(viewer.phone) : "",
                    }
                  : null,
              }}
            />
          )}
        </div>
        <aside className="flex flex-col gap-6 self-start lg:sticky lg:top-[calc(var(--header-h)+2rem)] lg:col-span-4" aria-label="Posle registracije">
          <h2 className="type-h3 text-ink-1">Šta sledi</h2>
          <ol className="flex flex-col border-t border-line">
            {NEXT_STEPS.map((step, i) => (
              <li key={step} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3 border-b border-line py-4">
                <span aria-hidden="true" className="type-numeral-s tabular-nums text-ink-3">
                  {i + 1}
                </span>
                <span className="type-body-s text-ink-2">{step}</span>
              </li>
            ))}
          </ol>
          {contacts.length ? (
            <>
              <p className="type-body-s text-ink-3">Pitanja pre registracije?</p>
              <ContactActions links={contacts} location="mechanic_registration" />
            </>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
