import type { Metadata } from "next";
import {
  ArrowRightIcon,
  BarcodeIcon,
  CarIcon,
  ChatCircleTextIcon,
  GearSixIcon,
  PhoneIcon,
  SquaresFourIcon,
} from "@phosphor-icons/react/dist/ssr";

import { contactLinks } from "@/config/site";
import { classifyQuery } from "@/lib/domain/search";
import { formatNumber } from "@/lib/format/number";
import { pluralSr } from "@/lib/format/plural";
import { buildMetadata, privateMetadata } from "@/lib/seo/metadata";
import { isCuratedSearch, normalizeCuratedQuery } from "@/lib/seo/templates";
import { TERMS } from "@/lib/i18n/sr/shop";
import { contactFromSettings } from "@/lib/settings/public";
import { getSearchResults, getSettingsPublic } from "@/lib/server/catalog-cache";
import type { ProductCardData } from "@/lib/catalog/types";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Link } from "@/components/ui/Link";
import { RevealText } from "@/components/text-reveal/RevealText";
import { SearchBox } from "@/components/shell/SearchBox";
import { ProductGrid } from "@/components/catalog/ProductGrid";
import { TrackViewList } from "@/components/catalog/TrackViewList";
import { SearchLogger } from "@/components/search/SearchLogger";
import { SearchVehicleScope } from "@/components/search/SearchVehicleScope";
import { Reveal } from "@/components/reveal/Reveal";
import { ROUTES } from "@/constants/routes";

export async function generateMetadata({
  searchParams,
}: PageProps<"/pretraga">): Promise<Metadata> {
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : (raw ?? "")).trim();
  const settings = await getSettingsPublic();
  // Search results are noindex, except the owner's curated queries (Podešavanja → SEO).
  if (q && isCuratedSearch(q, settings.seo.curatedSearches)) {
    return buildMetadata({
      title: `${q} — delovi za VAG vozila`,
      description: `Rezultati za „${q}“: delovi po OEM i zamenskom broju, sa cenama sa PDV-om i stanjem. Pouzeće ili preuzimanje u radnji.`,
      path: ROUTES.searchFor(normalizeCuratedQuery(q)),
      titleSuffix: settings.seo.titleSuffix,
    });
  }
  return privateMetadata(q ? `Pretraga: ${q}` : "Pretraga delova");
}

type Group = { key: string; title: string; note?: string; items: ProductCardData[] };

const ECHO_MAX = 80;
const VEHICLE_PARAM = /^[a-z0-9-]{1,40}(\/[a-z0-9-]{1,60}){0,2}$/;

function firstParam(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : (value ?? "")).trim();
}

/** `/pretraga` URL with the narrowing parameters (`kategorija`, `vozilo`). */
function searchHref(q: string, params: { kategorija?: string | null; vozilo?: string | null }) {
  const search = new URLSearchParams({ q });
  if (params.kategorija) search.set("kategorija", params.kategorija);
  if (params.vozilo) search.set("vozilo", params.vozilo);
  return `${ROUTES.search}?${search.toString()}`;
}

const chipClass = "chip-link";

/** Zero results: what to try next, each row one tap (PRODUCT principle 3 — never a dead end). */
const HELP_ROW =
  "group flex min-h-16 items-center gap-3 px-4 py-3 transition-control hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus";

/**
 * Search results (§10.4): exact OEM matches first, then cross numbers, partial codes and
 * text hits; the normalised query is echoed in mono; zero results end in the inquiry. A vehicle
 * named in the query or selected in the header narrows the results to parts that fit it
 * (`vozilo`, „prikaži sve“ = `vozilo=sva`); category chips narrow further (`kategorija`).
 */
export default async function SearchPage({ searchParams }: PageProps<"/pretraga">) {
  const params = await searchParams;
  const q = firstParam(params.q).slice(0, 200);
  const settings = await getSettingsPublic();

  if (!q) {
    return (
      <div className="px-page pb-(--space-section) pt-10">
        <RevealText as="h1" className="type-display-l uppercase text-ink-1">
          Pretraga delova
        </RevealText>
        <div className="mt-6 max-w-[48rem]">
          <SearchBox variant="hero" testId="search-page-input" />
        </div>
      </div>
    );
  }

  const kategorija = firstParam(params.kategorija).slice(0, 80) || null;
  const voziloRaw = firstParam(params.vozilo).slice(0, 160);
  const allVehicles = voziloRaw === "sva";
  const vozilo = allVehicles ? "sva" : VEHICLE_PARAM.test(voziloRaw) ? voziloRaw : null;

  const result = await getSearchResults({
    q,
    ...(kategorija ? { categorySlug: kategorija } : {}),
    ...(vozilo && !allVehicles ? { vehicle: vozilo } : {}),
    ...(allVehicles ? { allVehicles: true } : {}),
  });
  const classified = classifyQuery(q);
  const normalized = classified.codes.length ? classified.codes.join(" ") : null;
  const by = (m: string) => result.results.filter((r) => r.match === m).map((r) => r.card);
  const groups: Group[] = [
    {
      key: "exact",
      title: "Tačno poklapanje",
      note: "Broj se poklapa sa OEM ili kataloškim brojem artikla.",
      items: by("exact_code"),
    },
    {
      key: "cross",
      title: "Zamenski brojevi",
      note: "Isti deo pod brojem drugog proizvođača.",
      items: by("cross_code"),
    },
    { key: "prefix", title: "Brojevi koji počinju tako", items: by("prefix_code") },
    { key: "text", title: TERMS.items, items: by("text") },
  ].filter((g) => g.items.length > 0);
  const total = result.results.length;
  const phone = contactLinks.tel(contactFromSettings(settings).phone);
  const echo = q.length > ECHO_MAX ? `${q.slice(0, ECHO_MAX - 1)}…` : q;
  const vehicle = result.vehicle;

  return (
    <div className="px-page pb-(--space-section) pt-8">
      <SearchLogger query={q} resultsCount={total} exactCodeHit={result.exactCodeHit} />
      <SearchVehicleScope queryNamesVehicle={vehicle?.source === "query"} />
      <div className="max-w-[48rem]">
        <SearchBox variant="hero" defaultQuery={q} testId="search-page-input" />
      </div>
      <div className="mt-8 flex flex-col gap-2">
        <RevealText as="h1" className="type-h1 text-ink-1 [overflow-wrap:anywhere]">
          {total > 0 ? `Rezultati za „${echo}“` : `Nema rezultata za „${echo}“`}
        </RevealText>
        <p className="type-body-s text-ink-3" data-reveal="off" data-testid="search-count">
          {total > 0 ? (
            result.hasMore ? (
              <>
                Prikazano prvih{" "}
                <span className="tabular-nums text-ink-1">{formatNumber(total)}</span>, ima ih još.
                Suzite izborom kategorije ili vozila.
              </>
            ) : (
              <>
                <span className="tabular-nums text-ink-1">{formatNumber(total)}</span>{" "}
                {pluralSr(total, ["artikal", "artikla", "artikala"])}
              </>
            )
          ) : null}
          {normalized ? (
            <>
              {total > 0 ? " · " : ""}Tražili smo broj{" "}
              <span className="type-code text-ink-2 [overflow-wrap:anywhere]">{normalized}</span> u
              OEM, zamenskim i kataloškim brojevima.
            </>
          ) : null}
        </p>
        {vehicle ? (
          <p className="type-body-s text-ink-2" data-testid="search-vehicle">
            {vehicle.applied ? (
              <>
                Samo delovi za <strong className="font-semibold text-ink-1">{vehicle.label}</strong>
                {vehicle.hidden > 0 ? ` (još ${formatNumber(vehicle.hidden)} za druga vozila)` : ""}
                .{" "}
                <Link href={searchHref(q, { kategorija, vozilo: "sva" })} variant="inline">
                  Prikaži sve
                </Link>
              </>
            ) : allVehicles ? (
              <>
                Prikazani su delovi za sva vozila.{" "}
                <Link
                  href={searchHref(q, {
                    kategorija,
                    vozilo: vehicle.source === "selected" ? vehicle.param : null,
                  })}
                  variant="inline"
                >
                  Samo za {vehicle.label}
                </Link>
              </>
            ) : total > 0 ? (
              <>
                Nijedan pronađeni deo nije označen za {vehicle.label}, pa prikazujemo sve. Proverite
                uklapanje po OEM broju ili nam pošaljite broj šasije.
              </>
            ) : null}
          </p>
        ) : null}
      </div>

      {result.category ? (
        <p className="mt-6 type-body-s text-ink-2" data-testid="search-category">
          Kategorija <strong className="font-semibold text-ink-1">{result.category.name}</strong>.{" "}
          <Link href={searchHref(q, { vozilo })} variant="inline">
            Sve kategorije
          </Link>
        </p>
      ) : result.categories.length > 1 ? (
        <nav aria-label="Suzite po kategoriji" className="mt-6">
          <ul className="flex flex-wrap gap-2">
            {result.categories.map((c) => (
              <li key={c.slug}>
                <Link
                  href={searchHref(q, { kategorija: c.slug, vozilo })}
                  variant="unstyled"
                  className={chipClass}
                >
                  {c.name}
                  <span className="tabular-nums text-ink-3">{formatNumber(c.count)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : result.categories.length === 1 ? (
        <nav aria-label="Kategorija" className="mt-6">
          <ul className="flex flex-wrap gap-2">
            <li>
              <Link
                href={ROUTES.category(result.categories[0].slug)}
                variant="unstyled"
                className={chipClass}
              >
                Cela kategorija {result.categories[0].name}
              </Link>
            </li>
          </ul>
        </nav>
      ) : null}

      {total === 0 ? (
        <div className="mt-6 grid gap-8 lg:grid-cols-12 lg:gap-x-(--gutter)">
          <EmptyState
            align="start"
            className="lg:col-span-6"
            icon={<GearSixIcon size={44} />}
            as="h2"
            title={normalized ? "Ovaj broj nije u katalogu" : "Ovaj deo nije u katalogu"}
            action={
              <>
                <Button asChild variant="primary" icon={<ChatCircleTextIcon size={20} />}>
                  <Link
                    href={ROUTES.inquiryWith(
                      classified.codes.length ? { q, kodovi: classified.codes } : { q },
                    )}
                    variant="unstyled"
                  >
                    Pošaljite upit
                  </Link>
                </Button>
                {phone ? (
                  <Button asChild variant="secondary" icon={<PhoneIcon size={20} />}>
                    <a href={phone.href}>Pozovite {phone.display}</a>
                  </Button>
                ) : null}
              </>
            }
          >
            Za „
            <span
              className={
                normalized ? "type-code [overflow-wrap:anywhere]" : "[overflow-wrap:anywhere]"
              }
            >
              {echo}
            </span>
            “ nemamo artikal u katalogu. Pošaljite upit — proverićemo kod dobavljača i javiti vam se
            u toku radnog dana.
          </EmptyState>
          <Reveal
            as="nav"
            eager
            aria-labelledby="search-help-title"
            className="panel lg:col-span-6 lg:self-start"
          >
            <h2
              id="search-help-title"
              className="border-b border-line px-4 py-3 type-h4 text-ink-1"
            >
              Šta još možete
            </h2>
            <ul className="divide-y divide-line">
              <li>
                <Link href={ROUTES.inquiryWith({ q })} variant="unstyled" className={HELP_ROW}>
                  <BarcodeIcon size={24} aria-hidden="true" className="shrink-0 text-ink-3" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="type-body-s font-semibold text-ink-1">
                      Pošaljite broj šasije
                    </span>
                    <span className="type-caption font-normal text-ink-3">
                      Po broju šasije nalazimo tačan deo za vaše vozilo.
                    </span>
                  </span>
                  <ArrowRightIcon
                    size={16}
                    aria-hidden="true"
                    className="shrink-0 text-ink-3 group-hover:text-accent"
                  />
                </Link>
              </li>
              <li>
                <Link href={ROUTES.vehicles} variant="unstyled" className={HELP_ROW}>
                  <CarIcon size={24} aria-hidden="true" className="shrink-0 text-ink-3" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="type-body-s font-semibold text-ink-1">Tražite po vozilu</span>
                    <span className="type-caption font-normal text-ink-3">
                      Marka, model i motor, pa delovi koji odgovaraju.
                    </span>
                  </span>
                  <ArrowRightIcon
                    size={16}
                    aria-hidden="true"
                    className="shrink-0 text-ink-3 group-hover:text-accent"
                  />
                </Link>
              </li>
              <li>
                <Link href={ROUTES.parts} variant="unstyled" className={HELP_ROW}>
                  <SquaresFourIcon size={24} aria-hidden="true" className="shrink-0 text-ink-3" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="type-body-s font-semibold text-ink-1">
                      Pregledajte po sistemima
                    </span>
                    <span className="type-caption font-normal text-ink-3">
                      Kočnice, vešanje, motor i ostalo, kategorija po kategorija.
                    </span>
                  </span>
                  <ArrowRightIcon
                    size={16}
                    aria-hidden="true"
                    className="shrink-0 text-ink-3 group-hover:text-accent"
                  />
                </Link>
              </li>
            </ul>
            <p className="border-t border-line px-4 py-3 type-caption font-normal text-ink-3">
              Broj dela upišite kako god ga imate — razmaci, tačke i crtice ne smetaju. Naziv
              upišite bez marke vozila, na primer „kočione pločice“.
            </p>
          </Reveal>
        </div>
      ) : (
        <div className="mt-10 flex flex-col gap-14">
          <TrackViewList
            listId={`search:${q}`}
            listName="Pretraga"
            items={result.results.map((r) => r.card)}
          />
          {groups.map((g) => (
            <section key={g.key} aria-labelledby={`g-${g.key}`}>
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-line pb-3">
                <h2 id={`g-${g.key}`} className="type-label-l uppercase text-ink-1">
                  {g.title}
                </h2>
                {g.note ? <p className="type-caption font-normal text-ink-3">{g.note}</p> : null}
              </div>
              <div className="mt-5">
                <ProductGrid items={g.items} />
              </div>
            </section>
          ))}
          <p className="type-body-s text-ink-2">
            Ne vidite pravi deo?{" "}
            <Link href={ROUTES.inquiryWith({ q })} variant="inline">
              Pošaljite upit sa brojem šasije
            </Link>
            .
          </p>
        </div>
      )}
    </div>
  );
}
