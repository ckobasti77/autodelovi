import type { Metadata } from "next";
import {
  ChatCircleTextIcon,
  ClockCounterClockwiseIcon,
  ListNumbersIcon,
  PercentIcon,
  ReceiptIcon,
  TruckIcon,
} from "@phosphor-icons/react/dist/ssr";

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
import { Reveal, RevealGroup, RevealItem } from "@/components/reveal/Reveal";
import { RevealText } from "@/components/text-reveal/RevealText";
import { JsonLd } from "@/components/seo/JsonLd";
import { ContactActions } from "@/components/shell/ContactActions";
import { ContactStrip, HomeFaq } from "@/components/home/HomeSections";
import { MechanicCta, MechanicCtaBand } from "@/components/mechanic/MechanicCta";
import { QuickOrderDemo } from "@/components/mechanic/QuickOrderDemo";
import { ROUTES } from "@/constants/routes";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettingsPublic();
  return buildMetadata({
    title: "Delovi za auto servise — rabat i brza porudžbina",
    description:
      "Za auto servise: rabat po nivou saradnje, brza porudžbina po OEM brojevima, dostava u servis i odloženo plaćanje po dogovoru. VW, Audi, Škoda, SEAT.",
    path: ROUTES.mechanics,
    titleSuffix: settings.seo.titleSuffix,
  });
}

/** Example retail price for the tier comparison (a round number, not a product). */
const EXAMPLE_PARA = 1_000_000;

const BENEFITS = [
  {
    Icon: PercentIcon,
    title: "Vaša cena svuda",
    body: "Katalog, pretraga, 3D prikaz, korpa i porudžbina računaju cenu sa vašim rabatom. Maloprodajna cena stoji precrtana pored.",
  },
  {
    Icon: ListNumbersIcon,
    title: "Brza porudžbina",
    body: "Nalepite listu OEM brojeva sa količinama ili učitajte CSV fajl. Tačni brojevi idu u korpu jednim klikom, nepronađeni kao upit.",
  },
  {
    Icon: TruckIcon,
    title: "Dostava u servis",
    body: "Kurir donosi na adresu servisa iz profila; po potrebi je promenite u porudžbini. Lično preuzimanje je bez troška.",
  },
  {
    Icon: ChatCircleTextIcon,
    title: "Prioritetni upiti",
    body: "Upiti servisa su kod nas označeni i idu prvi na red — i oni poslati iz brze porudžbine, bez popunjavanja forme.",
  },
  {
    Icon: ReceiptIcon,
    title: "Odloženo plaćanje",
    body: "Po dogovoru, za servise sa kojima redovno radimo: rok i limit vidite u portalu, a način plaćanja birate u porudžbini.",
  },
  {
    Icon: ClockCounterClockwiseIcon,
    title: "Istorija, omiljeno, vozila mušterija",
    body: "„Poruči ponovo“ za iste radove, delovi koje stalno poručujete i vozila mušterija sa brojem šasije i tablicama.",
  },
] as const;

const STEPS = [
  {
    title: "Registrujte servis",
    body: "Naziv servisa, PIB, matični broj, adresa i marke koje servisirate — pet minuta posla.",
  },
  {
    title: "Proverimo podatke",
    body: "U toku radnog dana proverimo firmu i odredimo nivo rabata. Odgovor stiže e-poštom.",
  },
  {
    title: "Poručujete po svojoj ceni",
    body: "Posle prijave vidite svoju cenu na svakom artiklu, u korpi i u cenovniku koji preuzimate u Excelu.",
  },
];

/** Benefit cards that are on the first screen at 1440 px (the first row of two). */
const EAGER_BENEFITS = 2;

const SECTION = "mt-(--space-section) grid gap-8 lg:grid-cols-12 lg:gap-x-(--gutter)";

/**
 * `/za-majstore` (§10.8): a split hero — the statement and the actions beside the price
 * comparison per tier — then the benefits, the live quick-order demo, how approval works with
 * the actions again, FAQ and contact. Cached server HTML; the CTA reads the viewer on the
 * client. Everything below the hero arrives as blocks: the cards as staggered groups.
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
  const faqItems = faqs.map((f) => ({
    question: f.question,
    answer: fillPlaceholders(f.answerMd, values),
  }));
  const crumbs = [{ label: "Početna", href: ROUTES.home }, { label: "Za majstore" }];

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd(crumbs),
          ...(faqItems.length
            ? [
                faqJsonLd(
                  faqItems.map((f) => ({ question: f.question, answer: markdownToText(f.answer) })),
                ),
              ]
            : []),
        ]}
      />
      <div className="px-page pb-(--space-section) pt-6 lg:pt-8">
        <Breadcrumbs items={crumbs} />
        <div className="mt-6 grid gap-10 lg:grid-cols-12 lg:items-center lg:gap-x-(--gutter)">
          <div className="flex flex-col gap-6 lg:col-span-6">
            <RevealText as="h1" className="type-display-xl uppercase text-ink-1">
              Za majstore
            </RevealText>
            <RevealText as="p" className="max-w-[46ch] type-lead text-ink-2">
              Servisi za VAG vozila kod nas poručuju po svojoj ceni, po OEM broju i bez čekanja na
              telefonu.
            </RevealText>
            <MechanicCta />
            <ContactActions links={links} location="mechanics" />
          </div>
          {tiers.length ? (
            <Reveal eager className="panel-raised lg:col-span-6 xl:col-span-5 xl:col-start-8">
              <table className="w-full border-collapse">
                <caption className="border-b border-line px-4 py-4 text-left sm:px-5">
                  <span className="block type-h4 text-ink-1">Nivoi rabata</span>
                  <span className="mt-0.5 block type-body-s text-ink-2">
                    Primer za artikal od {formatRSD(EXAMPLE_PARA)} u maloprodaji.
                  </span>
                </caption>
                <thead>
                  <tr className="border-b border-line">
                    <th
                      scope="col"
                      className="py-2.5 pl-4 text-left type-caption font-normal text-ink-3 sm:pl-5"
                    >
                      Nivo
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2.5 text-right type-caption font-normal text-ink-3"
                    >
                      Rabat
                    </th>
                    <th
                      scope="col"
                      className="py-2.5 pr-4 text-right type-caption font-normal text-ink-3 sm:pr-5"
                    >
                      Vaša cena
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tiers.map((t) => (
                    <tr key={t.name} className="border-b border-line">
                      <th scope="row" className="py-3.5 pl-4 text-left align-top sm:pl-5">
                        <span className="block type-h4 text-ink-1">{t.name}</span>
                        {t.publicDescription ? (
                          <span className="block type-body-s font-normal text-ink-3">
                            {t.publicDescription}
                          </span>
                        ) : null}
                      </th>
                      <td className="px-3 py-3.5 text-right align-top type-numeral-m tabular-nums text-ink-1">
                        {formatPercent(t.defaultDiscountBp / 10_000)}
                      </td>
                      <td className="py-3.5 pr-4 text-right align-top sm:pr-5">
                        <span className="block type-numeral-m tabular-nums text-accent-text">
                          {formatRSD(
                            Math.round((EXAMPLE_PARA * (10_000 - t.defaultDiscountBp)) / 10_000),
                          )}
                        </span>
                        <span className="block type-caption-s text-ink-3">sa PDV-om</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="px-4 py-3.5 type-caption font-normal text-ink-3 sm:px-5">
                Rabat se računa od maloprodajne cene sa PDV-om; za pojedine proizvođače i kategorije
                može biti drugačiji. Nivo određujemo pri odobrenju naloga.
              </p>
            </Reveal>
          ) : null}
        </div>

        <section aria-labelledby="benefits-title" className={SECTION}>
          <RevealText
            as="h2"
            id="benefits-title"
            className="type-display-l uppercase text-ink-1 lg:col-span-4"
          >
            Šta dobijate
          </RevealText>
          <RevealGroup as="ul" className="grid gap-4 sm:grid-cols-2 lg:col-span-8">
            {BENEFITS.map(({ Icon, title, body }, index) => (
              <RevealItem
                as="li"
                key={title}
                eager={index < EAGER_BENEFITS}
                index={index}
                className="flex flex-col gap-3 panel p-5"
              >
                <span
                  aria-hidden="true"
                  className="flex size-10 items-center justify-center panel-inset text-ink-2"
                >
                  <Icon size={22} />
                </span>
                <h3 className="type-h3 text-ink-1">{title}</h3>
                <p className="type-body text-ink-2">{body}</p>
              </RevealItem>
            ))}
          </RevealGroup>
        </section>

        <section aria-labelledby="quick-title" className={SECTION}>
          <div className="flex flex-col gap-3 lg:col-span-4">
            <h2 id="quick-title" className="type-display-l uppercase text-ink-1">
              Brza porudžbina
            </h2>
            <p className="type-body text-ink-2">
              Brojevi iz poruke, sa kutije ili iz Excela — razmaci, tačke, crtice i velika slova ne
              smetaju. Probajte.
            </p>
          </div>
          <Reveal className="panel p-4 sm:p-6 lg:col-span-8">
            <QuickOrderDemo />
          </Reveal>
        </section>

        <section aria-labelledby="steps-title" className={SECTION}>
          <h2 id="steps-title" className="type-display-l uppercase text-ink-1 lg:col-span-4">
            Kako do naloga
          </h2>
          <div className="flex flex-col gap-4 lg:col-span-8">
            <RevealGroup as="ol" className="grid gap-4 md:grid-cols-3">
              {STEPS.map((s, i) => (
                <RevealItem as="li" key={s.title} className="flex flex-col gap-2 panel p-5">
                  <span aria-hidden="true" className="type-numeral-xl tabular-nums text-ink-3">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="type-h3 text-ink-1">{s.title}</h3>
                  <p className="type-body-s text-ink-2">{s.body}</p>
                </RevealItem>
              ))}
            </RevealGroup>
            <Reveal>
              <MechanicCtaBand />
            </Reveal>
          </div>
        </section>
      </div>
      <HomeFaq items={faqItems} />
      <ContactStrip contact={contact} />
    </>
  );
}
