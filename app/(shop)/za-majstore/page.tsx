import type { Metadata } from "next";

import { contactLinkList } from "@/config/site";
import { formatPercent } from "@/lib/format/number";
import { breadcrumbJsonLd } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";
import { contactFromSettings } from "@/lib/settings/public";
import { getPublicTiers, getSettingsPublic } from "@/lib/server/catalog-cache";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Button } from "@/components/ui/Button";
import { Link } from "@/components/ui/Link";
import { RevealText } from "@/components/text-reveal/RevealText";
import { JsonLd } from "@/components/seo/JsonLd";
import { ContactActions } from "@/components/shell/ContactActions";
import { ROUTES } from "@/constants/routes";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettingsPublic();
  return buildMetadata({
    title: "Delovi za auto servise — rabat i brza porudžbina",
    description:
      "Za majstore i auto servise: rabat po nivou saradnje, brza porudžbina po OEM brojevima, istorija porudžbina i odloženo plaćanje po dogovoru. VW, Audi, Škoda, SEAT, Cupra.",
    path: ROUTES.mechanics,
    titleSuffix: settings.seo.titleSuffix,
  });
}

const STEPS = [
  { title: "Javite se", body: "Pošaljite naziv servisa, PIB, matični broj, adresu i marke koje servisirate." },
  { title: "Proverimo podatke", body: "U toku radnog dana proverimo firmu i odredimo nivo rabata." },
  { title: "Poručujete po svojoj ceni", body: "Posle prijave na nalog vidite svoju cenu na svakom artiklu i u korpi." },
];

/**
 * `/za-majstore` (§10.8) — the B2B landing: tiers from Convex, benefits, how approval works,
 * contact. The mechanics portal (registration form, quick order, price list) is step 14.
 */
export default async function MechanicsPage() {
  const [settings, tiers] = await Promise.all([getSettingsPublic(), getPublicTiers()]);
  const links = contactLinkList(contactFromSettings(settings));
  const crumbs = [{ label: "Početna", href: ROUTES.home }, { label: "Za majstore" }];
  return (
    <div className="px-page pb-section pt-6 lg:pt-8">
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={crumbs} />
      <div className="mt-6 grid gap-10 lg:grid-cols-12 lg:gap-x-(--gutter)">
        <div className="flex flex-col gap-5 lg:col-span-6">
          <RevealText as="h1" className="type-display-xl uppercase text-ink-1">
            Za majstore
          </RevealText>
          <RevealText as="p" className="max-w-[46ch] type-lead text-ink-2">
            Servisi za VAG vozila kod nas poručuju po svojoj ceni, po OEM broju i bez čekanja na telefonu.
          </RevealText>
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild variant="primary" size="lg">
              <Link href={ROUTES.inquiryWith({ q: "Majstorski nalog" })} variant="unstyled">
                Pošaljite podatke servisa
              </Link>
            </Button>
          </div>
          <ContactActions links={links} location="mechanics" />
        </div>
        {tiers.length ? (
          <div className="lg:col-span-5 lg:col-start-8">
            <table className="w-full border-collapse" data-reveal="off">
              <caption className="mb-3 text-left type-label uppercase text-ink-3">Nivoi rabata</caption>
              <tbody>
                {tiers.map((t) => (
                  <tr key={t.name} className="border-t border-line last:border-b">
                    <th scope="row" className="py-4 text-left align-top">
                      <span className="block type-h3 text-ink-1">{t.name}</span>
                      {t.publicDescription ? (
                        <span className="block type-body-s font-normal text-ink-3">{t.publicDescription}</span>
                      ) : null}
                    </th>
                    <td className="py-4 text-right align-top type-numeral-l tabular-nums text-accent">
                      {formatPercent(t.defaultDiscountBp / 10_000)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 type-caption font-normal text-ink-3">
              Rabat se računa od maloprodajne cene sa PDV-om; za pojedine proizvođače i kategorije može se razlikovati.
            </p>
          </div>
        ) : null}
      </div>

      <section aria-labelledby="benefits-title" className="mt-(--space-section) grid gap-10 lg:grid-cols-12 lg:gap-x-(--gutter)">
        <h2 id="benefits-title" className="type-display-l uppercase text-ink-1 lg:col-span-4">
          Šta dobijate
        </h2>
        <dl className="grid gap-x-(--gutter) gap-y-8 sm:grid-cols-2 lg:col-span-8">
          {[
            ["Vaša cena svuda", "Katalog, pretraga, 3D prikaz i korpa pokazuju cenu sa vašim rabatom."],
            ["Brza porudžbina", "Nalepite listu OEM brojeva sa količinama; nepronađene brojeve šaljete kao upit jednim klikom."],
            ["Istorija i ponovna porudžbina", "Sve porudžbine na jednom mestu, „Poruči ponovo“ za iste radove."],
            ["Odloženo plaćanje", "Po dogovoru, za servise sa kojima redovno radimo."],
          ].map(([title, body]) => (
            <div key={title} className="border-t border-line pt-4">
              <dt className="type-h3 text-ink-1">{title}</dt>
              <dd className="mt-2 type-body text-ink-2">{body}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="steps-title" className="mt-(--space-section) grid gap-10 lg:grid-cols-12 lg:gap-x-(--gutter)">
        <h2 id="steps-title" className="type-display-l uppercase text-ink-1 lg:col-span-4">
          Kako do naloga
        </h2>
        <ol className="flex flex-col lg:col-span-8">
          {STEPS.map((s, i) => (
            <li
              key={s.title}
              className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-5 border-t border-line py-6 last:border-b sm:grid-cols-[5rem_minmax(0,1fr)_minmax(0,1.4fr)] sm:items-baseline"
            >
              <span aria-hidden="true" className="type-numeral-xl tabular-nums text-ink-4">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="type-h3 text-ink-1">{s.title}</h3>
              <p className="col-start-2 mt-1 type-body text-ink-2 sm:col-start-3 sm:mt-0">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
