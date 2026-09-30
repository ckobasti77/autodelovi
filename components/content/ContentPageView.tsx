import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { fillPlaceholders } from "@/lib/content/placeholders";
import { Markdown, markdownToText } from "@/lib/content/markdown";
import { formatDate } from "@/lib/format/date";
import { breadcrumbJsonLd } from "@/lib/seo/jsonld";
import { buildMetadata, clampText } from "@/lib/seo/metadata";
import { placeholderValues } from "@/lib/settings/public";
import { getContentPage, getSettingsPublic } from "@/lib/server/catalog-cache";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { RevealText } from "@/components/text-reveal/RevealText";
import { JsonLd } from "@/components/seo/JsonLd";
import { ROUTES } from "@/constants/routes";

/** Metadata for a content page (legal pages are indexable at low priority, ROUTES §B1). */
export async function contentMetadata(slug: string, path: string): Promise<Metadata> {
  const [page, settings] = await Promise.all([getContentPage(slug), getSettingsPublic()]);
  if (!page) return {};
  const body = markdownToText(fillPlaceholders(page.bodyMd, placeholderValues(settings)));
  return buildMetadata({
    title: page.title,
    description: clampText(body, 155),
    path,
    titleSuffix: settings.seo.titleSuffix,
  });
}

/**
 * Static & legal pages (§B1): Markdown from `contentPages`, placeholders filled from settings
 * (empty company data hides the line), reading measure 720 px. `before` renders structured
 * blocks (contact, delivery table) above the text.
 */
export async function ContentPageView({
  slug,
  path,
  before,
}: {
  slug: string;
  path: string;
  before?: ReactNode;
}) {
  const [page, settings] = await Promise.all([getContentPage(slug), getSettingsPublic()]);
  if (!page) notFound();
  const body = fillPlaceholders(page.bodyMd, placeholderValues(settings));
  const crumbs = [{ label: "Početna", href: ROUTES.home }, { label: page.title, href: path }];
  return (
    <div className="px-page pb-(--space-section) pt-6 lg:pt-8">
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={[crumbs[0], { label: page.title }]} />
      <div className="mt-4 max-w-(--container-reading)">
        <RevealText as="h1" className="type-display-l uppercase text-ink-1">
          {page.title}
        </RevealText>
        <p className="mt-3 type-caption font-normal text-ink-3" data-reveal="off">
          Poslednja izmena: {formatDate(page.updatedAt)}
        </p>
        {before ? <div className="mt-8">{before}</div> : null}
        <Markdown source={body} className="mt-8" />
      </div>
    </div>
  );
}
