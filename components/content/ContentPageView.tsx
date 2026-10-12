import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { fillPlaceholders } from "@/lib/content/placeholders";
import { markdownDescription } from "@/lib/content/markdown";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format/date";
import { breadcrumbJsonLd } from "@/lib/seo/jsonld";
import { buildMetadata, DESCRIPTION_MAX } from "@/lib/seo/metadata";
import { placeholderValues } from "@/lib/settings/public";
import { getContentPage, getSettingsPublic } from "@/lib/server/catalog-cache";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { RevealText } from "@/components/text-reveal/RevealText";
import { JsonLd } from "@/components/seo/JsonLd";
import { ContentAside } from "@/components/content/ContentAside";
import { ContentBody, splitContent } from "@/components/content/ContentBody";
import { ROUTES } from "@/constants/routes";

/** Metadata for a content page (legal pages are indexable at low priority, ROUTES §B1). */
export async function contentMetadata(slug: string, path: string): Promise<Metadata> {
  const [page, settings] = await Promise.all([getContentPage(slug), getSettingsPublic()]);
  // Resolved before the page streams, so a missing page is a real 404 (FLOW-05).
  if (!page) notFound();
  const body = fillPlaceholders(page.bodyMd, placeholderValues(settings));
  return buildMetadata({
    title: page.title,
    description: markdownDescription(body, DESCRIPTION_MAX),
    path,
    titleSuffix: settings.seo.titleSuffix,
  });
}

/**
 * Static & legal pages (§B1): Markdown from `contentPages`, placeholders filled from settings
 * (empty company data hides the line). Two columns from `lg`: the text at the reading measure,
 * and beside it what the reader does next.
 *
 * - `kind`: a *place* (contact, about, delivery) has the display-caps H1 and its intro set as
 *   a lead; a *document* (complaints, terms, privacy, cookies) is a record — sans H1 with the
 *   date of the last change under it (H1 rule, UI-BOOST §8).
 * - `before`: a structured block (delivery table, contact channels) between the intro and the
 *   sections.
 * - `aside`: replaces the default next-step column; `null` leaves the column out.
 */
export async function ContentPageView({
  slug,
  path,
  kind = "document",
  step,
  before,
  aside,
}: {
  slug: string;
  path: string;
  kind?: "place" | "document";
  /** Next step offered by the default aside. */
  step?: "inquiry" | "contact";
  before?: ReactNode;
  aside?: ReactNode;
}) {
  const [page, settings] = await Promise.all([getContentPage(slug), getSettingsPublic()]);
  if (!page) notFound();
  const body = fillPlaceholders(page.bodyMd, placeholderValues(settings));
  const { intro, sections } = splitContent(body);
  const crumbs = [{ label: "Početna", href: ROUTES.home }, { label: page.title, href: path }];
  const place = kind === "place";
  const updated = (
    <p className="type-caption font-normal text-ink-3" data-reveal="off">
      Poslednja izmena: {formatDate(page.updatedAt)}
    </p>
  );
  const side =
    aside === undefined ? (
      <ContentAside current={path} step={step ?? (place ? "inquiry" : "contact")} />
    ) : (
      aside
    );
  return (
    <div className="px-page pb-(--space-section) pt-6 lg:pt-8">
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={[crumbs[0], { label: page.title }]} />
      <div className="mt-4 flex max-w-[48rem] flex-col gap-3">
        <RevealText
          as="h1"
          className={place ? "type-display-l uppercase text-ink-1" : "type-h1 text-ink-1"}
        >
          {page.title}
        </RevealText>
        {place ? null : updated}
      </div>
      <div className="mt-block grid gap-y-12 lg:grid-cols-12 lg:gap-x-(--gutter)">
        <div className="min-w-0 lg:col-span-8">
          <ContentBody blocks={intro} lead={place} />
          {before ? <div className={cn(intro.length > 0 && "mt-8")}>{before}</div> : null}
          <ContentBody
            blocks={sections}
            offset={intro.length}
            className={cn((intro.length > 0 || Boolean(before)) && "mt-12")}
          />
        </div>
        {side ? <div className="min-w-0 lg:col-span-4">{side}</div> : null}
      </div>
      {/* On a place page the date closes the page (after the aside on phones), not the title. */}
      {place ? <div className="mt-10">{updated}</div> : null}
    </div>
  );
}
