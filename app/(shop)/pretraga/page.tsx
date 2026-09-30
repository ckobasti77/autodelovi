import type { Metadata } from "next";
import {
  ChatCircleTextIcon,
  MagnifyingGlassIcon,
  PhoneIcon,
} from "@phosphor-icons/react/dist/ssr";

import { api } from "@/convex/_generated/api";
import { contactLinks } from "@/config/site";
import { classifyQuery } from "@/lib/domain/search";
import { formatNumber } from "@/lib/format/number";
import { pluralSr } from "@/lib/format/plural";
import { privateMetadata } from "@/lib/seo/metadata";
import { contactFromSettings } from "@/lib/settings/public";
import { fetchPublic } from "@/lib/server/convex";
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
import { ROUTES } from "@/constants/routes";

export async function generateMetadata({ searchParams }: PageProps<"/pretraga">): Promise<Metadata> {
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : (raw ?? "")).trim();
  return privateMetadata(q ? `Pretraga: ${q}` : "Pretraga delova");
}

type Group = { key: string; title: string; note?: string; items: ProductCardData[] };

/**
 * Search results (§10.4): exact OEM matches first, then cross numbers, partial codes and
 * text hits; the normalised query is echoed in mono; zero results end in the inquiry.
 */
export default async function SearchPage({ searchParams }: PageProps<"/pretraga">) {
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : (raw ?? "")).trim().slice(0, 200);
  const settings = await getSettingsPublic();

  if (!q) {
    return (
      <div className="px-page pb-section pt-10">
        <RevealText as="h1" className="type-display-l uppercase text-ink-1">
          Pretraga delova
        </RevealText>
        <div className="mt-6 max-w-[48rem]">
          <SearchBox variant="hero" testId="search-page-input" />
        </div>
      </div>
    );
  }

  const [result, suggest] = await Promise.all([
    getSearchResults(q),
    fetchPublic(api.search.suggest, { q }),
  ]);
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
    { key: "text", title: "Proizvodi", items: by("text") },
  ].filter((g) => g.items.length > 0);
  const total = result.results.length;
  const phone = contactLinks.tel(contactFromSettings(settings).phone);

  return (
    <div className="px-page pb-section pt-8">
      <SearchLogger query={q} resultsCount={total} exactCodeHit={result.exactCodeHit} />
      <div className="max-w-[48rem]">
        <SearchBox variant="hero" defaultQuery={q} testId="search-page-input" />
      </div>
      <div className="mt-8 flex flex-col gap-2">
        <RevealText as="h1" className="type-h1 text-ink-1">
          {total > 0 ? `Rezultati za „${q}“` : `Nema rezultata za „${q}“`}
        </RevealText>
        <p className="type-body-s text-ink-3" data-reveal="off">
          {total > 0 ? (
            <>
              <span className="tabular-nums text-ink-1">{formatNumber(total)}</span>{" "}
              {pluralSr(total, ["artikal", "artikla", "artikala"])}
            </>
          ) : null}
          {normalized ? (
            <>
              {total > 0 ? " · " : ""}Tražili smo broj{" "}
              <span className="type-code text-ink-2">{normalized}</span> u OEM, zamenskim i
              kataloškim brojevima.
            </>
          ) : null}
        </p>
      </div>

      {suggest.categories.length > 0 ? (
        <nav aria-label="Kategorije" className="mt-6">
          <ul className="flex flex-wrap gap-2">
            {suggest.categories.map((c) => (
              <li key={c.slug}>
                <Link
                  href={ROUTES.category(c.slug)}
                  variant="unstyled"
                  className="inline-flex h-9 items-center gap-2 rounded-xs border border-line-strong bg-surface-1 px-3 type-body-s text-ink-1 transition-control hover:border-accent"
                >
                  {c.name}
                  <span className="tabular-nums text-ink-3">{formatNumber(c.productCount)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      {total === 0 ? (
        <EmptyState
          className="mt-10"
          icon={<MagnifyingGlassIcon size={44} />}
          as="h2"
          title="Proverićemo kod dobavljača"
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
          Za „{q}“ nemamo artikal u katalogu. Pošaljite upit — proverićemo kod dobavljača i javiti
          vam se u toku radnog dana.
        </EmptyState>
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
