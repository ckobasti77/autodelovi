import { ArrowRightIcon, ClockIcon, MapPinIcon } from "@phosphor-icons/react/dist/ssr";

import { contactLinkList, type Contact } from "@/config/site";
import { Markdown } from "@/lib/content/markdown";
import { formatNumber, formatPercent } from "@/lib/format/number";
import { pluralSr } from "@/lib/format/plural";
import {
  catalogProductCount,
  categoryProductCount,
  type CategorySummary,
  type CategoryTree,
  type ProductCardData,
  type VehicleTree,
} from "@/lib/catalog/types";
import { Button } from "@/components/ui/Button";
import { Disclosure, DisclosureCaret } from "@/components/ui/Disclosure";
import { Link } from "@/components/ui/Link";
import { RouteLink } from "@/components/ui/RouteLink";
import { CategoryTile } from "@/components/catalog/CategoryTile";
import { ProductGrid } from "@/components/catalog/ProductGrid";
import { Reveal, RevealGroup, RevealItem } from "@/components/reveal/Reveal";
import { ContactActions } from "@/components/shell/ContactActions";
import { ROUTES } from "@/constants/routes";

// ------------------------------------------------------------------ how ordering works

const STEPS = [
  {
    title: "Pronađite deo",
    body: "Upišite OEM broj kako god ga imate, izaberite vozilo i motor ili kliknite na deo na 3D prikazu.",
  },
  {
    title: "Pošaljite porudžbinu",
    body: "Bez plaćanja na sajtu. Proverimo stanje i kompatibilnost i potvrdimo porudžbinu telefonom ili e-poštom.",
  },
  {
    title: "Platite pri preuzimanju",
    body: "Pouzećem kuriru, gotovinom ili karticom u radnji, a firme virmanom uz predračun.",
  },
] as const;

export function HowOrdering({ courierLine }: { courierLine: string | null }) {
  return (
    <section
      aria-labelledby="how-title"
      className="cv-auto border-t border-line px-page py-section"
    >
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-x-(--gutter)">
        <div className="flex flex-col gap-4 lg:col-span-4">
          <h2 id="how-title" className="type-display-l uppercase text-ink-1">
            Kako se poručuje
          </h2>
          <p className="max-w-[40ch] type-body text-ink-2">
            Tri koraka, bez kartice i bez registracije. {courierLine ?? ""}
          </p>
          <Link href={ROUTES.delivery} variant="standalone" className="mt-2 self-start">
            Dostava i plaćanje
          </Link>
        </div>
        <RevealGroup as="ol" className="flex flex-col lg:col-span-8">
          {STEPS.map((s, i) => (
            <RevealItem
              as="li"
              key={s.title}
              className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-5 border-t border-line py-6 last:border-b sm:grid-cols-[5rem_minmax(0,1fr)_minmax(0,1.4fr)] sm:items-baseline"
            >
              <span aria-hidden="true" className="type-numeral-xl tabular-nums text-ink-4">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="type-h3 text-ink-1">{s.title}</h3>
              <p className="col-start-2 mt-1 type-body text-ink-2 sm:col-start-3 sm:mt-0">
                {s.body}
              </p>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ categories

const FEATURED = [
  "kocione-plocice",
  "kocioni-diskovi",
  "amortizeri-opruge",
  "ramena-selen-blokovi",
  "zupcasti-kais-vodena-pumpa",
  "kvacilo-zamajac",
  "turbina",
  "filteri",
  "akumulator",
  "farovi",
  "hladnjak-ventilator",
  "brizgaljke-pumpa-goriva",
];

export function HomeCategories({ tree }: { tree: CategoryTree }) {
  const all = [...tree.categories];
  const bySlug = new Map(all.map((c) => [c.slug, c]));
  const featured = FEATURED.map((s) => bySlug.get(s)).filter((c): c is CategorySummary =>
    Boolean(c),
  );
  const total = catalogProductCount(tree).all;
  return (
    <section
      aria-labelledby="cats-title"
      // Twelve tiles in 6/4/3/2 rows: the generic 900 px estimate is far too short, so the skipped
      // grid would overflow onto the systems index below it (Lighthouse target-size, scroll jump).
      className="cv-auto border-t border-line px-page py-section [contain-intrinsic-size:auto_1580px] md:[contain-intrinsic-size:auto_1250px] lg:[contain-intrinsic-size:auto_1120px] 2xl:[contain-intrinsic-size:auto_820px]"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 id="cats-title" className="type-display-l uppercase text-ink-1">
          Najtraženije kategorije
        </h2>
        <Link href={ROUTES.parts} variant="standalone">
          {/* Neutral form: agrees with any count („Svih 44 kategorija“ did not, COPY-08). */}
          Sve kategorije ({formatNumber(tree.categories.length)})
          {total > 0
            ? ` · ${formatNumber(total)} ${pluralSr(total, ["artikal", "artikla", "artikala"])}`
            : ""}
        </Link>
      </div>
      <RevealGroup
        as="ul"
        className="mt-block grid grid-cols-2 gap-3 sm:gap-(--gutter) md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6"
      >
        {featured.map((c) => (
          <RevealItem as="li" key={c.slug}>
            <CategoryTile category={c} count={categoryProductCount(tree, c)} size="s" />
          </RevealItem>
        ))}
      </RevealGroup>
    </section>
  );
}

// ------------------------------------------------------------------ featured parts

/**
 * One part per featured category, in stock, the most ordered first: four different kinds of
 * parts instead of four brake pads. Four cards fill one row from 1280 px; between 1024 and
 * 1279 px the row holds three, so the fourth is left out there rather than orphaned.
 */
export function HomeFeatured({ items }: { items: ProductCardData[] }) {
  if (items.length < 3) return null;
  return (
    <section
      aria-labelledby="featured-title"
      className="cv-auto border-t border-line px-page py-section [contain-intrinsic-size:auto_1100px] sm:[contain-intrinsic-size:auto_1200px] lg:[contain-intrinsic-size:auto_760px]"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 id="featured-title" className="type-display-l uppercase text-ink-1">
          Izdvojeno sa stanja
        </h2>
        <Link href={ROUTES.parts} variant="standalone">
          Svi delovi
        </Link>
      </div>
      <ProductGrid
        items={items.slice(0, 4)}
        className="mt-block lg:max-xl:[&>li:nth-child(n+4)]:hidden"
      />
    </section>
  );
}

// ------------------------------------------------------------------ mechanics band

export function MechanicsBand({ tiers }: { tiers: { name: string; defaultDiscountBp: number }[] }) {
  const points = [
    "Vaša cena sa rabatom na celom sajtu, odmah posle odobrenja naloga.",
    "Brza porudžbina: nalepite listu OEM brojeva sa količinama, mi pronađemo artikle.",
    "Istorija porudžbina i „Poruči ponovo“ za servise koji rade iste modele.",
    "Odloženo plaćanje po dogovoru, za servise sa kojima sarađujemo.",
  ];
  return (
    <section
      aria-labelledby="mech-title"
      className="cv-auto border-t border-line bg-bg-raised px-page py-section"
    >
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-x-(--gutter)">
        <div className="flex flex-col gap-5 lg:col-span-6">
          <h2 id="mech-title" className="type-display-l uppercase text-ink-1">
            Za majstore i servise
          </h2>
          <ul className="flex flex-col gap-3">
            {points.map((p) => (
              <li key={p} className="flex gap-3 type-body text-ink-2">
                <span aria-hidden="true" className="mt-3 h-px w-4 shrink-0 bg-ink-3" />
                {p}
              </li>
            ))}
          </ul>
          <Button
            asChild
            variant="primary"
            size="lg"
            trailingIcon={<ArrowRightIcon size={16} />}
            className="self-start"
          >
            <Link href={ROUTES.mechanics} variant="unstyled">
              Uslovi za servise
            </Link>
          </Button>
        </div>
        {tiers.length ? (
          <Reveal className="panel-raised p-5 sm:p-6 lg:col-span-5 lg:col-start-8 lg:self-start">
            <table className="w-full border-collapse" data-reveal="off">
              <caption className="pb-3 text-left type-label uppercase text-ink-3">
                Nivoi rabata
              </caption>
              <tbody>
                {tiers.map((t) => (
                  <tr key={t.name} className="border-t border-line">
                    <th scope="row" className="py-4 text-left type-h3 font-semibold text-ink-1">
                      {t.name}
                    </th>
                    <td className="py-4 text-right type-numeral-l tabular-nums text-accent">
                      {formatPercent(t.defaultDiscountBp / 10_000)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="border-t border-line pt-4 type-caption font-normal text-ink-3">
              Nivo određujemo pri odobrenju naloga. Rabat se računa od maloprodajne cene sa PDV-om.
            </p>
          </Reveal>
        ) : null}
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ makes

export function MakesCovered({ tree }: { tree: VehicleTree }) {
  return (
    <section
      aria-labelledby="makes-title"
      className="cv-auto border-t border-line px-page py-section"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 id="makes-title" className="type-display-l uppercase text-ink-1">
          Vozila koja pokrivamo
        </h2>
        <Link href={ROUTES.vehicles} variant="standalone">
          Sva vozila
        </Link>
      </div>
      {/* Five makes as 3 + 2 from 768 px (a wide tile holds the longest name in display caps at
          every width); one row each on phones. */}
      <RevealGroup
        as="ul"
        className="mt-block grid grid-cols-1 gap-3 md:grid-cols-6 md:gap-(--gutter)"
      >
        {tree.map(({ brand, models }, i) => (
          <RevealItem
            as="li"
            key={brand.slug}
            className={i < 3 ? "md:col-span-2" : "md:col-span-3"}
          >
            <RouteLink
              href={ROUTES.vehicleBrand(brand.slug)}
              className="group flex h-full items-center justify-between gap-4 panel card-interactive p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus md:min-h-28 md:flex-col md:items-stretch md:p-5"
            >
              <span className="type-display-m uppercase text-ink-1">{brand.name}</span>
              <span className="flex shrink-0 items-center justify-between gap-3 type-caption font-normal text-ink-3">
                <span>
                  <span className="tabular-nums">{models.length}</span>{" "}
                  {pluralSr(models.length, ["model", "modela", "modela"])}
                </span>
                <ArrowRightIcon
                  size={16}
                  aria-hidden="true"
                  className="transition-[color,translate] duration-200 ease-sk-out hover-hover:group-hover:translate-x-0.5 hover-hover:group-hover:text-accent"
                />
              </span>
            </RouteLink>
          </RevealItem>
        ))}
      </RevealGroup>
    </section>
  );
}

// ------------------------------------------------------------------ trust facts

export function TrustFacts({
  facts,
  computed,
}: {
  facts: { label: string; value: string }[];
  computed: { label: string; value: string }[];
}) {
  const all = [...computed, ...facts];
  if (!all.length) return null;
  return (
    <section aria-label="Činjenice" className="cv-auto border-t border-line px-page py-12">
      <RevealGroup as="dl" className="grid grid-cols-2 gap-x-(--gutter) gap-y-8 md:grid-cols-4">
        {all.slice(0, 8).map((f) => (
          <RevealItem
            key={f.label}
            className="flex flex-col gap-1 border-l border-line-strong pl-4"
          >
            <dt className="order-2 type-body-s text-ink-3">{f.label}</dt>
            <dd className="order-1 type-numeral-l tabular-nums text-ink-1">{f.value}</dd>
          </RevealItem>
        ))}
      </RevealGroup>
    </section>
  );
}

// ------------------------------------------------------------------ FAQ

export function HomeFaq({ items }: { items: { question: string; answer: string }[] }) {
  if (!items.length) return null;
  return (
    <section
      aria-labelledby="faq-title"
      className="cv-auto border-t border-line px-page py-section"
    >
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-x-(--gutter)">
        <h2 id="faq-title" className="type-display-l uppercase text-ink-1 lg:col-span-4">
          Česta pitanja
        </h2>
        <Reveal className="flex flex-col lg:col-span-8">
          {items.map((f) => (
            <Disclosure
              key={f.question}
              className="border-t border-line last:border-b"
              summaryClassName="flex min-h-16 items-center justify-between gap-4 py-4 type-h4 text-ink-1 transition-control hover:text-accent"
              summary={
                <>
                  {f.question}
                  <DisclosureCaret className="text-ink-3" />
                </>
              }
            >
              <Markdown source={f.answer} className="max-w-[65ch] pb-6 [&>p]:my-0" />
            </Disclosure>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ contact strip

export function ContactStrip({ contact }: { contact: Contact }) {
  const links = contactLinkList(contact);
  const hasAddress = Boolean(contact.address.street && contact.address.city);
  return (
    <section
      aria-labelledby="contact-title"
      className="cv-auto border-t border-line bg-bg-raised px-page py-12"
    >
      <div className="grid gap-8 lg:grid-cols-12 lg:items-center lg:gap-x-(--gutter)">
        <div className="flex flex-col gap-2 lg:col-span-4">
          <h2 id="contact-title" className="type-h2 text-ink-1">
            Pitanje za majstora?
          </h2>
          <p className="type-body text-ink-2">
            Pozovite, pišite na Viber ili pošaljite upit sa brojem šasije.
          </p>
        </div>
        <div className="flex flex-col gap-4 lg:col-span-8">
          {links.length ? (
            <ContactActions links={links} location="home_strip" variant="buttons" showValue />
          ) : null}
          <div className="flex flex-wrap gap-x-8 gap-y-3 type-body-s text-ink-2">
            {contact.hours ? (
              <span className="inline-flex items-center gap-2">
                <ClockIcon size={18} aria-hidden="true" className="text-ink-3" />
                {contact.hours}
              </span>
            ) : null}
            {hasAddress ? (
              <span className="inline-flex items-center gap-2">
                <MapPinIcon size={18} aria-hidden="true" className="text-ink-3" />
                {contact.address.street}, {contact.address.city}
                {contact.address.mapUrl ? (
                  <Link href={contact.address.mapUrl} variant="inline" className="ml-1">
                    Mapa
                  </Link>
                ) : null}
              </span>
            ) : null}
            <Link href={ROUTES.inquiry} variant="standalone">
              Pošaljite upit
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
