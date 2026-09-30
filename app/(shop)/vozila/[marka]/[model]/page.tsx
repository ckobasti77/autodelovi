import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { breadcrumbJsonLd } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";
import { getSettingsPublic, getVehicleTree } from "@/lib/server/catalog-cache";
import { findBrand, findModel, shortBrand, yearsLabel } from "@/lib/vehicle/hub";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { RouteLink } from "@/components/ui/RouteLink";
import { RevealText } from "@/components/text-reveal/RevealText";
import { JsonLd } from "@/components/seo/JsonLd";
import { ROUTES } from "@/constants/routes";

async function load(marka: string, model: string) {
  const brand = findBrand(await getVehicleTree(), marka);
  const m = brand ? findModel(brand, model) : null;
  return brand && m ? { brand, model: m } : null;
}

export async function generateMetadata({
  params,
}: PageProps<"/vozila/[marka]/[model]">): Promise<Metadata> {
  const { marka, model } = await params;
  const [data, settings] = await Promise.all([load(marka, model), getSettingsPublic()]);
  if (!data) return {};
  const name = `${shortBrand(data.brand.brand)} ${data.model.model.name}`;
  return buildMetadata({
    title: `Delovi za ${name} — sve generacije`,
    description: `Delovi za ${name}: ${data.model.generations
      .map((g) => `${g.name} (${yearsLabel(g)})`)
      .join(", ")}. Izaberite generaciju i pogledajte delove po kategorijama.`,
    path: ROUTES.vehicleModel(marka, model),
    titleSuffix: settings.seo.titleSuffix,
  });
}

export default async function VehicleModelPage({ params }: PageProps<"/vozila/[marka]/[model]">) {
  const { marka, model } = await params;
  const data = await load(marka, model);
  if (!data) notFound();
  const name = `${data.brand.brand.name} ${data.model.model.name}`;
  const crumbs = [
    { label: "Početna", href: ROUTES.home },
    { label: "Vozila", href: ROUTES.vehicles },
    { label: data.brand.brand.name, href: ROUTES.vehicleBrand(marka) },
    { label: data.model.model.name },
  ];
  return (
    <div className="px-page pb-(--space-section) pt-6 lg:pt-8">
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={crumbs} />
      <RevealText as="h1" className="mt-4 type-display-l uppercase text-ink-1">
        {`Delovi za ${name}`}
      </RevealText>
      <RevealText as="p" className="mt-4 max-w-[60ch] type-lead text-ink-2">
        Izaberite generaciju. Godine su okvirne; kad niste sigurni, pogledajte oznaku u saobraćajnoj ili pošaljite broj šasije.
      </RevealText>
      <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {data.model.generations.map((g) => (
          <li key={g.slug}>
            <RouteLink
              href={ROUTES.vehicleGeneration(marka, model, g.slug)}
              className="flex h-full flex-col gap-2 rounded-sm border border-line bg-surface-1 p-4 transition-control hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <span className="type-h3 text-ink-1">{g.name}</span>
              <span className="type-body-s tabular-nums text-ink-2">{yearsLabel(g)}</span>
              {g.vinModelCodes.length || g.platform ? (
                <span className="type-caption font-normal text-ink-3">
                  {g.platform ? `Platforma ${g.platform}` : ""}
                  {g.platform && g.vinModelCodes.length ? " · " : ""}
                  {g.vinModelCodes.length ? (
                    <>
                      VIN kod <span className="type-code text-ink-2">{g.vinModelCodes.join(", ")}</span>
                    </>
                  ) : null}
                </span>
              ) : null}
            </RouteLink>
          </li>
        ))}
      </ul>
    </div>
  );
}
