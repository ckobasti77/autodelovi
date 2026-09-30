import type { Metadata } from "next";

import { contactLinkList } from "@/config/site";
import { fillPlaceholders } from "@/lib/content/placeholders";
import { markdownToText } from "@/lib/content/markdown";
import { formatRSD } from "@/lib/format/money";
import { formatPercent } from "@/lib/format/number";
import { breadcrumbJsonLd, faqJsonLd } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";
import { contactFromSettings, placeholderValues } from "@/lib/settings/public";
import { getFaqs, getPublicTiers, getSettingsPublic } from "@/lib/server/catalog-cache";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { RevealText } from "@/components/text-reveal/RevealText";
import { JsonLd } from "@/components/seo/JsonLd";
import { ContactActions } from "@/components/shell/ContactActions";
import { ContactStrip, HomeFaq } from "@/components/home/HomeSections";
import { MechanicCta } from "@/components/mechanic/MechanicCta";
import { QuickOrderDemo } from "@/components/mechanic/QuickOrderDemo";
import { ROUTES } from "@/constants/routes";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettingsPublic();
  return buildMetadata({
    title: "Delovi za auto servise — rabat i brza porudžbina",
    description:
      "Za majstore i auto servise: rabat po nivou saradnje, brza porudžbina po OEM brojevima, dostava u servis, istorija porudžbina i odloženo plaćanje po dogovoru. VW, Audi, Škoda, SEAT, Cupra.",
    path: ROUTES.mechanics,
    titleSuffix: settings.seo.titleSuffix,
  });
}

/** Example retail price for the tier comparison (a round number, not a product). */
const EXAMPLE_PARA = 1_000_000;

const BENEFITS: [string, string][] = [
  ["Vaša cena svuda", "Katalog, pretraga, 3D prikaz, korpa i porudžbina računaju cenu sa vašim rabatom. Maloprodajna cena stoji precrtana pored."],
  ["Brza porudžbina", "Nalepite listu OEM brojeva sa količinama ili otpremite CSV. Tačni brojevi idu u korpu jednim klikom, nepronađeni kao upit."],
  ["Dostava u servis", "Kurir donosi na adresu servisa iz profila; adresu menjate pri svakoj porudžbini. Lično preuzimanje je bez troška."],
  ["Prioritetni upiti", "Upiti servisa su kod nas označeni i idu prvi na red — i oni poslati iz brze porudžbine, bez popunjavanja forme."],
  ["Odloženo plaćanje", "Po dogovoru, za servise sa kojima redovno radimo: rok i limit vidite u portalu, a način plaćanja birate u porudžbini."],
  ["Istorija, omiljeno, vozila mušterija", "„Poruči ponovo“ za iste radove, delovi koje stalno poručujete i vozila mušterija sa brojem šasije i tablicama."],
];

const STEPS = [
  { title: "Registrujte servis", body: "Naziv servisa, PIB, matični broj, adresa i marke koje servisirate — pet minuta posla." },
  { title: "Proverimo podatke", body: "U toku radnog dana proverimo firmu i odredimo nivo rabata. Odgovor stiže e-poštom." },
  { title: "Poručujete po svojoj ceni", body: "Posle prijave vidite svoju cenu na svakom artiklu, u korpi i u cenovniku koji preuzimate u Excelu." },
];

/**
 * `/za-majstore` (§10.8): hero with the tier comparison, benefits, live quick-order demo,
 * how approval works, FAQ and contact. Cached server HTML; the CTA reads the viewer on the
 * client.
 */
export default async function MechanicsPage() {
  const [settings, tiers, faqs] = await Promise.all([
    getSettingsPublic(),
    getPublicTiers(),
    getFaqs("za-majstore"),
  ]);
  const contact = contactFromSettings(settings);
  const links = contactLinkList(contact).filter((l) => l.channel !== "email");
  const values = placeholderValues(settings);
  const faqItems = faqs.map((f) => ({ question: f.question, answer: fillPlaceholders(f.answerMd, values) }));
  const crumbs = [{ label: "Početna", href: ROUTES.home }, { label: "Za majstore" }];

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd(crumbs),
          ...(faqItems.length
            ? [faqJsonLd(faqItems.map((f) => ({ question: f.question, answer: markdownToText(f.answer) })))]
            : []),
        ]}
      />
      <div className="px-page pb-(--space-section) pt-6 lg:pt-8">
        <Breadcrumbs items={crumbs} />
        <div className="mt-6 grid gap-12 lg:grid-cols-12 lg:gap-x-(--gutter)">
          <div className="flex flex-col gap-6 lg:col-span-6">
            <RevealText as="h1" className="type-display-xl uppercase text-ink-1">
              Za majstore
            </RevealText>
            <RevealText as="p" className="max-w-[46ch] type-lead text-ink-2">
              Servisi za VAG vozila kod nas poručuju po svojoj ceni, po OEM broju i bez čekanja na telefonu.
            </RevealText>
            <MechanicCta />
            <ContactActions links={links} location="mechanics" />
          </div>
          {tiers.length ? (
            <div className="self-end lg:col-span-5 lg:col-start-8">
              <table className="w-full border-collapse" data-reveal="off">
                <caption className="mb-1 text-left type-label uppercase text-ink-3">Nivoi rabata</caption>
                <thead>
                  <tr className="border-b border-line-strong">
                    <th scope="col" className="py-2 text-left type-caption font-normal text-ink-3">
                      Nivo
                    </th>
                    <th scope="col" className="py-2 text-right type-caption font-normal text-ink-3">
                      Rabat
                    </th>
                    <th scope="col" className="py-2 pl-4 text-right type-caption font-normal text-ink-3">
                      Artikal od {formatRSD(EXAMPLE_PARA)}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tiers.map((t) => (
                    <tr key={t.name} className="border-b border-line">
                      <th scope="row" className="py-4 text-left align-top">
                        <span className="block type-h3 text-ink-1">{t.name}</span>
                        {t.publicDescription ? (
                          <span className="block type-body-s font-normal text-ink-3">{t.publicDescription}</span>
                        ) : null}
                      </th>
                      <td className="py-4 text-right align-top type-numeral-m tabular-nums text-ink-1">
                        {formatPercent(t.defaultDiscountBp / 10_000)}
                      </td>
                      <td className="py-4 pl-4 text-right align-top">
                        <span className="block type-numeral-m tabular-nums text-accent-text">
                          {formatRSD(Math.round((EXAMPLE_PARA * (10_000 - t.defaultDiscountBp)) / 10_000))}
                        </span>
                        <span className="block type-caption-s text-ink-3">sa PDV-om</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 type-caption font-normal text-ink-3">
                Rabat se računa od maloprodajne cene sa PDV-om; za pojedine proizvođače i kategorije može biti drugačiji.
                Nivo određujemo pri odobrenju naloga.
              </p>
            </div>
          ) : null}
        </div>

        <section aria-labelledby="benefits-title" className="mt-(--space-section) grid gap-10 lg:grid-cols-12 lg:gap-x-(--gutter)">
          <h2 id="benefits-title" className="type-display-l uppercase text-ink-1 lg:col-span-4">
            Šta dobijate
          </h2>
          <dl className="grid gap-x-(--gutter) gap-y-8 sm:grid-cols-2 lg:col-span-8">
            {BENEFITS.map(([title, body]) => (
              <div key={title} className="border-t border-line pt-4">
                <dt className="type-h3 text-ink-1">{title}</dt>
                <dd className="mt-2 type-body text-ink-2">{body}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="quick-title" className="mt-(--space-section) grid gap-10 lg:grid-cols-12 lg:gap-x-(--gutter)">
          <div className="flex flex-col gap-3 lg:col-span-4">
            <h2 id="quick-title" className="type-display-l uppercase text-ink-1">
              Brza porudžbina
            </h2>
            <p className="type-body text-ink-2">
              Brojevi iz poruke, sa kutije ili iz Excela — razmaci, tačke, crtice i velika slova ne smetaju. Probajte.
            </p>
          </div>
          <div className="lg:col-span-8">
            <QuickOrderDemo />
          </div>
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
      <HomeFaq items={faqItems} />
      <ContactStrip contact={contact} />
    </>
  );
}
