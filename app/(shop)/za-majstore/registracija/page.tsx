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
import { Reveal } from "@/components/reveal/Reveal";
import { RevealText } from "@/components/text-reveal/RevealText";
import { JsonLd } from "@/components/seo/JsonLd";
import { ContactActions } from "@/components/shell/ContactActions";
import { ApprovalSteps } from "@/components/mechanic/ApprovalSteps";
import { MechanicRegistrationForm } from "@/components/mechanic/MechanicRegistrationForm";
import { ROUTES } from "@/constants/routes";

export const metadata: Metadata = privateMetadata("Registracija servisa");

/**
 * `/za-majstore/registracija` (ARCHITECTURE §A3): account + company form → pending profile.
 * The form's groups are panels in the wide column; „Šta sledi“ stays beside them (sticky).
 */
export default async function MechanicRegistrationPage() {
  const [settings, tree, viewer] = await Promise.all([
    getSettingsPublic(),
    getVehicleTree(),
    getViewer(),
  ]);
  const contacts = contactLinkList(contactFromSettings(settings)).filter(
    (l) => l.channel !== "email",
  );
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
      <div className="mt-8 grid gap-6 lg:grid-cols-12 lg:gap-x-(--gutter)">
        <div className="lg:col-span-8">
          {already ? (
            <Reveal eager className="flex flex-col items-start gap-4 panel p-5 sm:p-6">
              <p className="type-body text-ink-1">Ovaj nalog već ima registrovan servis.</p>
              <Button asChild>
                <Link href={ROUTES.mechanicPortal} variant="unstyled">
                  Majstorski portal
                </Link>
              </Button>
            </Reveal>
          ) : disabled ? (
            <Reveal eager className="flex flex-col items-start gap-4 panel p-5 sm:p-6">
              <p className="type-body text-ink-1">
                Registracija preko sajta je trenutno isključena. Pozovite nas ili pišite na Viber —
                otvorićemo nalog.
              </p>
              <ContactActions links={contacts} location="mechanic_registration_disabled" />
            </Reveal>
          ) : (
            <MechanicRegistrationForm
              config={{
                brands: tree.map((b) => ({ id: b.brand._id, name: b.brand.name })),
                legal: {
                  terms: settings.legalVersions.terms,
                  privacy: settings.legalVersions.privacy,
                },
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
        <Reveal
          as="aside"
          eager
          index={1}
          aria-label="Posle registracije"
          className="flex flex-col gap-5 self-start panel p-5 lg:sticky lg:top-[calc(var(--header-h)+1.5rem)] lg:col-span-4"
        >
          <h2 className="type-h4 text-ink-1">Šta sledi</h2>
          <ApprovalSteps />
          {contacts.length ? (
            <div className="flex flex-col gap-1 border-t border-line pt-4">
              <p className="type-body-s text-ink-3">Pitanja pre registracije?</p>
              <ContactActions links={contacts} location="mechanic_registration" />
            </div>
          ) : null}
        </Reveal>
      </div>
    </div>
  );
}
