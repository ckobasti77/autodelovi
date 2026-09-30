import { ArrowRightIcon, ClockIcon, MapPinIcon, PlusIcon } from "@phosphor-icons/react/dist/ssr";

import { contactLinkList, type Contact } from "@/config/site";
import { Markdown } from "@/lib/content/markdown";
import { formatNumber, formatPercent } from "@/lib/format/number";
import { pluralSr } from "@/lib/format/plural";
import type { CategorySummary, CategoryTree, VehicleTree } from "@/lib/catalog/types";
import { Button } from "@/components/ui/Button";
import { Link } from "@/components/ui/Link";
import { RouteLink } from "@/components/ui/RouteLink";
import { CategoryTile } from "@/components/catalog/CategoryTile";
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
    <section aria-labelledby="how-title" className="border-t border-line px-page py-section">
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
  const featured = FEATURED.map((s) => bySlug.get(s)).filter((c): c is CategorySummary => Boolean(c));
  const total = tree.categories.reduce((n, c) => n + c.productCount, 0);
  return (
    <section aria-labelledby="cats-title" className="border-t border-line px-page py-section">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 id="cats-title" className="type-display-l uppercase text-ink-1">
          Najtraženije kategorije
        </h2>
        <Link href={ROUTES.parts} variant="standalone">
          Svih {tree.categories.length} kategorija
          {total > 0 ? ` · ${formatNumber(total)} ${pluralSr(total, ["artikal", "artikla", "artikala"])}` : ""}
        </Link>
      </div>
      <ul className="mt-10 grid grid-cols-2 gap-3 sm:gap-(--gutter) md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
        {featured.map((c) => (
          <li key={c.slug}>
            <CategoryTile category={c} size="s" />
          </li>
        ))}
      </ul>
    </section>
  );
}

// ------------------------------------------------------------------ mechanics band

export function MechanicsBand({
  tiers,
}: {
  tiers: { name: string; defaultDiscountBp: number }[];
}) {
  const points = [
    "Vaša cena sa rabatom na celom sajtu, odmah posle odobrenja naloga.",
    "Brza porudžbina: nalepite listu OEM brojeva sa količinama, mi pronađemo artikle.",
    "Istorija porudžbina i „Poruči ponovo“ za servise koji rade iste modele.",
    "Odloženo plaćanje po dogovoru, za servise sa kojima sarađujemo.",
  ];
  return (
    <section
      aria-labelledby="mech-title"
      className="border-t border-line bg-bg-raised px-page py-section"
    >
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-x-(--gutter)">
        <div className="flex flex-col gap-5 lg:col-span-6">
          <h2 id="mech-title" className="type-display-l uppercase text-ink-1">
            Za majstore i servise
          </h2>
          <ul className="flex flex-col gap-3">
            {points.map((p) => (
              <li key={p} className="flex gap-3 type-body text-ink-2">
                <span aria-hidden="true" className="mt-2.5 h-px w-4 shrink-0 bg-accent" />
                {p}
              </li>
            ))}
          </ul>
          <Button asChild variant="primary" size="lg" trailingIcon={<ArrowRightIcon size={16} />} className="self-start">
            <Link href={ROUTES.mechanics} variant="unstyled">
              Uslovi za servise
            </Link>
          </Button>
        </div>
        {tiers.length ? (
          <div className="lg:col-span-5 lg:col-start-8">
            <table className="w-full border-collapse" data-reveal="off">
              <caption className="mb-3 text-left type-label uppercase text-ink-3">Nivoi rabata</caption>
              <tbody>
                {tiers.map((t) => (
                  <tr key={t.name} className="border-t border-line last:border-b">
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
            <p className="mt-3 type-caption font-normal text-ink-3">
              Nivo određujemo pri odobrenju naloga. Rabat se računa od maloprodajne cene sa PDV-om.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ makes

export function MakesCovered({ tree }: { tree: VehicleTree }) {
  return (
    <section aria-labelledby="makes-title" className="border-t border-line px-page py-section">
      <div className="grid gap-8 lg:grid-cols-12 lg:gap-x-(--gutter)">
        <h2 id="makes-title" className="type-display-l uppercase text-ink-1 lg:col-span-4">
          Vozila koja pokrivamo
        </h2>
        <ul className="grid gap-x-(--gutter) sm:grid-cols-2 lg:col-span-8 xl:grid-cols-3">
          {tree.map(({ brand, models }) => (
            <li key={brand.slug} className="border-t border-line">
              <RouteLink
                href={ROUTES.vehicleBrand(brand.slug)}
                className="group flex min-h-16 items-center justify-between gap-3 py-3"
              >
                <span className="type-display-m uppercase text-ink-1 transition-control group-hover:text-accent">
                  {brand.name}
                </span>
                <span className="type-caption font-normal text-ink-3">
                  {models.length} {pluralSr(models.length, ["model", "modela", "modela"])}
                </span>
              </RouteLink>
            </li>
          ))}
        </ul>
      </div>
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
    <section aria-label="Činjenice" className="border-t border-line px-page py-12">
      <dl className="grid grid-cols-2 gap-x-(--gutter) gap-y-8 md:grid-cols-4">
        {all.slice(0, 8).map((f) => (
          <div key={f.label} className="flex flex-col gap-1 border-l border-line-strong pl-4">
            <dt className="order-2 type-body-s text-ink-3">{f.label}</dt>
            <dd className="order-1 type-numeral-l tabular-nums text-ink-1">{f.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

// ------------------------------------------------------------------ FAQ

export function HomeFaq({ items }: { items: { question: string; answer: string }[] }) {
  if (!items.length) return null;
  return (
    <section aria-labelledby="faq-title" className="border-t border-line px-page py-section">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-x-(--gutter)">
        <h2 id="faq-title" className="type-display-l uppercase text-ink-1 lg:col-span-4">
          Česta pitanja
        </h2>
        <div className="flex flex-col lg:col-span-8">
          {items.map((f) => (
            <details key={f.question} className="group border-t border-line last:border-b">
              <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 py-4 type-h4 text-ink-1 transition-control hover:text-accent [&::-webkit-details-marker]:hidden">
                {f.question}
                <PlusIcon
                  size={20}
                  aria-hidden="true"
                  className="shrink-0 text-ink-3 transition-transform duration-200 group-open:rotate-45"
                />
              </summary>
              <Markdown source={f.answer} className="max-w-[65ch] pb-6 [&>p]:my-0" />
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ contact strip

export function ContactStrip({ contact }: { contact: Contact }) {
  const links = contactLinkList(contact);
  const hasAddress = Boolean(contact.address.street && contact.address.city);
  return (
    <section aria-labelledby="contact-title" className="border-t border-line bg-bg-raised px-page py-12">
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
          {links.length ? <ContactActions links={links} location="home_strip" variant="buttons" showValue /> : null}
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
