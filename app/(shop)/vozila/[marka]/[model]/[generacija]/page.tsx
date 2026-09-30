import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChatCircleTextIcon, ListMagnifyingGlassIcon } from "@phosphor-icons/react/dist/ssr";

import { catalogQuery, emptyFilters } from "@/lib/catalog/filters";
import { formatNumber } from "@/lib/format/number";
import { pluralSr } from "@/lib/format/plural";
import { breadcrumbJsonLd } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";
import {
  getSettingsPublic,
  getVehicleEngines,
  getVehicleParts,
  getVehicleTree,
} from "@/lib/server/catalog-cache";
import { findBrand, findGeneration, findModel, shortBrand, yearsLabel } from "@/lib/vehicle/hub";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Link } from "@/components/ui/Link";
import { RouteLink } from "@/components/ui/RouteLink";
import { RevealText } from "@/components/text-reveal/RevealText";
import { JsonLd } from "@/components/seo/JsonLd";
import { CategoryTile } from "@/components/catalog/CategoryTile";
import { ProductGrid } from "@/components/catalog/ProductGrid";
import { UseVehicleButton } from "@/components/vehicle/UseVehicleButton";
import { ROUTES } from "@/constants/routes";

const MIN_INDEXABLE = 10;

async function load(marka: string, model: string, generacija: string, motor: string | undefined) {
  const brand = findBrand(await getVehicleTree(), marka);
  const m = brand ? findModel(brand, model) : null;
  const g = m ? findGeneration(m, generacija) : null;
  if (!brand || !m || !g) return null;
  const engines = await getVehicleEngines(g._id);
  const engine = motor ? (engines.find((e) => e.slug === motor) ?? null) : null;
  const parts = await getVehicleParts({
    generationId: g._id,
    ...(engine ? { engineId: engine._id } : {}),
    topLimit: 8,
  });
  return { brand, model: m, generation: g, engines, engine, parts };
}

function motorParam(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return v && /^[a-z0-9-]{1,80}$/.test(v) ? v : undefined;
}

export async function generateMetadata({
  params,
  searchParams,
}: PageProps<"/vozila/[marka]/[model]/[generacija]">): Promise<Metadata> {
  const { marka, model, generacija } = await params;
  const motor = motorParam((await searchParams).motor);
  const [data, settings] = await Promise.all([
    load(marka, model, generacija, undefined),
    getSettingsPublic(),
  ]);
  if (!data) return {};
  const name = `${shortBrand(data.brand.brand)} ${data.generation.name}`;
  return buildMetadata({
    title: `Delovi za ${name} (${yearsLabel(data.generation)})`,
    description: `Delovi za ${name}: ${data.parts.total} artikala u ${data.parts.categories.length} kategorija — ${data.parts.categories
      .slice(0, 4)
      .map((c) => c.category.name.toLowerCase())
      .join(", ")}. Motori: ${data.engines
      .slice(0, 3)
      .map((e) => e.name)
      .join(", ")}.`,
    path: ROUTES.vehicleGeneration(marka, model, generacija),
    noindex: Boolean(motor) || data.parts.total < MIN_INDEXABLE,
    titleSuffix: settings.seo.titleSuffix,
  });
}

export default async function VehicleGenerationPage({
  params,
  searchParams,
}: PageProps<"/vozila/[marka]/[model]/[generacija]">) {
  const { marka, model, generacija } = await params;
  const motor = motorParam((await searchParams).motor);
  const data = await load(marka, model, generacija, motor);
  if (!data) notFound();
  const { brand, generation, engines, engine, parts } = data;
  const base = ROUTES.vehicleGeneration(marka, model, generacija);
  const name = `${shortBrand(brand.brand)} ${generation.name}`;
  const crumbs = [
    { label: "Početna", href: ROUTES.home },
    { label: "Vozila", href: ROUTES.vehicles },
    { label: brand.brand.name, href: ROUTES.vehicleBrand(marka) },
    { label: data.model.model.name, href: ROUTES.vehicleModel(marka, model) },
    { label: generation.name },
  ];
  const vehicleFilters = {
    ...emptyFilters(),
    vehicle: {
      brand: marka,
      model,
      generation: generacija,
      ...(engine ? { engine: engine.slug } : {}),
    },
  };
  const fitFor = () =>
    engine
      ? { kind: "fits" as const, vehicle: `${generation.name} ${engine.name}` }
      : { kind: "generation_only" as const, vehicle: generation.name };

  return (
    <div className="px-page pb-(--space-section) pt-6 lg:pt-8">
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={crumbs} />
      <div className="mt-4 grid gap-6 lg:grid-cols-12 lg:items-end lg:gap-x-(--gutter)">
        <div className="flex flex-col gap-3 lg:col-span-8">
          <RevealText as="h1" className="type-display-l uppercase text-ink-1">
            {`Delovi za ${name}`}
          </RevealText>
          <p className="type-body text-ink-2" data-reveal="off">
            <span className="tabular-nums">{yearsLabel(generation)}</span>
            {generation.platform ? ` · platforma ${generation.platform}` : ""}
            {generation.vinModelCodes.length ? (
              <>
                {" · VIN kod "}
                <span className="type-code text-ink-1">{generation.vinModelCodes.join(", ")}</span>
              </>
            ) : null}
            {" · "}
            <span className="tabular-nums">{formatNumber(parts.total)}</span>{" "}
            {pluralSr(parts.total, ["artikal", "artikla", "artikala"])}
          </p>
        </div>
        <div className="lg:col-span-4 lg:justify-self-end">
          <UseVehicleButton
            vehicle={{
              brand: { slug: brand.brand.slug, name: brand.brand.name },
              model: { slug: data.model.model.slug, name: data.model.model.name },
              generation: {
                slug: generation.slug,
                name: generation.name,
                yearFrom: generation.yearFrom,
                yearTo: generation.yearTo,
              },
              engine: engine ? { slug: engine.slug, name: engine.name, codes: engine.codes } : null,
            }}
          />
        </div>
      </div>

      {engines.length > 0 ? (
        <nav aria-label="Motor" className="mt-8">
          <h2 className="type-label uppercase text-ink-3">Motor</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            <li>
              <RouteLink
                href={base}
                aria-current={!engine ? "true" : undefined}
                className="inline-flex h-10 items-center rounded-xs border border-line-strong px-3 type-body-s text-ink-1 transition-control hover:border-ink-3 aria-[current]:border-accent aria-[current]:bg-accent-subtle"
              >
                Svi motori
              </RouteLink>
            </li>
            {engines.map((e) => (
              <li key={e.slug}>
                <RouteLink
                  href={`${base}?motor=${e.slug}`}
                  aria-current={engine?.slug === e.slug ? "true" : undefined}
                  className="inline-flex h-10 items-center gap-2 rounded-xs border border-line-strong px-3 type-body-s text-ink-1 transition-control hover:border-ink-3 aria-[current]:border-accent aria-[current]:bg-accent-subtle"
                >
                  {e.name}
                  {e.codes.length ? (
                    <span className="type-code-s text-ink-3">{e.codes.slice(0, 2).join(", ")}</span>
                  ) : null}
                </RouteLink>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      {parts.categories.length === 0 ? (
        <EmptyState
          className="mt-10"
          icon={<ListMagnifyingGlassIcon size={44} />}
          as="h2"
          title="Još nemamo delove sa unetom kompatibilnošću"
          action={
            <Button asChild variant="primary" icon={<ChatCircleTextIcon size={20} />}>
              <Link href={ROUTES.inquiry} variant="unstyled">
                Pošaljite upit
              </Link>
            </Button>
          }
        >
          Za {name} pošaljite broj šasije i šta vam treba — proverićemo kod dobavljača.
        </EmptyState>
      ) : (
        <>
          <section aria-labelledby="cats-title" className="mt-12">
            <h2 id="cats-title" className="type-h2 text-ink-1">
              Delovi po kategorijama
            </h2>
            <ul className="mt-5 grid grid-cols-2 gap-3 sm:gap-(--gutter) md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 3xl:grid-cols-6">
              {parts.categories.map(({ category, count }) => (
                <li key={category.slug}>
                  <CategoryTile
                    category={category}
                    count={count}
                    size="s"
                    href={`${ROUTES.category(category.slug)}${catalogQuery(vehicleFilters)}`}
                  />
                </li>
              ))}
            </ul>
          </section>
          {parts.top.length > 0 ? (
            <section aria-labelledby="top-title" className="mt-14">
              <h2 id="top-title" className="type-h2 text-ink-1">
                Izbor delova za {generation.name}
              </h2>
              <div className="mt-5">
                <ProductGrid items={parts.top} fitFor={fitFor} />
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
