import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ChatCircleTextIcon,
  PackageIcon,
  StorefrontIcon,
  TruckIcon,
} from "@phosphor-icons/react/dist/ssr";

import { contactLinkList } from "@/config/site";
import { Markdown } from "@/lib/content/markdown";
import { formatNumber } from "@/lib/format/number";
import { formatRSD } from "@/lib/format/money";
import { pluralSr } from "@/lib/format/plural";
import { isAvailableNow } from "@/lib/domain/stock";
import { itemListJsonLd } from "@/lib/seo/jsonld";
import { landingPath } from "@/lib/seo/landingLinks";
import { buildMetadata } from "@/lib/seo/metadata";
import { contactFromSettings } from "@/lib/settings/public";
import {
  getAdLanding,
  getCategoryListing,
  getSettingsPublic,
  resolveVehicle,
} from "@/lib/server/catalog-cache";
import type { ProductCardData } from "@/lib/catalog/types";
import { Button } from "@/components/ui/Button";
import { Link } from "@/components/ui/Link";
import { RevealText } from "@/components/text-reveal/RevealText";
import { JsonLd } from "@/components/seo/JsonLd";
import { ContactActions } from "@/components/shell/ContactActions";
import { ProductGrid } from "@/components/catalog/ProductGrid";
import { TrackViewList } from "@/components/catalog/TrackViewList";
import { HeaderVehicleChip } from "@/components/vehicle/VehicleBindings";
import { ROUTES } from "@/constants/routes";

export async function generateMetadata({ params }: PageProps<"/ponuda/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const [data, settings] = await Promise.all([getAdLanding(slug), getSettingsPublic()]);
  // Resolved before the page streams, so an unknown landing is a real 404 (FLOW-05).
  if (!data) notFound();
  return buildMetadata({
    title: data.title,
    description: data.subhead ?? data.headline,
    path: `/ponuda/${data.slug}`,
    // Ads landings are noindex unless the owner marks one indexable (SEO-ADS §J10).
    noindex: !data.indexable,
    titleSuffix: settings.seo.titleSuffix,
  });
}

/** Curated products, or the category listing filtered by the landing's vehicle. */
async function productsFor(data: NonNullable<Awaited<ReturnType<typeof getAdLanding>>>) {
  if (data.products.length > 0 || !data.category) return data.products;
  const vehicle = data.vehicle
    ? await resolveVehicle({
        brandSlug: data.vehicle.brandSlug,
        ...(data.vehicle.modelSlug ? { modelSlug: data.vehicle.modelSlug } : {}),
        ...(data.vehicle.generationSlug ? { generationSlug: data.vehicle.generationSlug } : {}),
      })
    : null;
  const listing = await getCategoryListing({
    categorySlug: data.category.slug,
    ...(vehicle
      ? {
          vehicle: {
            brandId: vehicle.brand._id,
            ...(vehicle.model ? { modelId: vehicle.model._id } : {}),
            ...(vehicle.generation ? { generationId: vehicle.generation._id } : {}),
          },
        }
      : {}),
    sort: "popular",
    page: 1,
    pageSize: 24,
  });
  return listing?.items ?? [];
}

/**
 * Ads landing (SEO-ADS §J10): the ad's promise as H1, three proof points from real data and
 * settings (stock, delivery, payment on delivery), up to 24 parts, a vehicle picker, call /
 * Viber / WhatsApp and the inquiry. No 3D, minimal navigation.
 */
export default async function AdLandingPage({ params }: PageProps<"/ponuda/[slug]">) {
  const { slug } = await params;
  const [data, settings] = await Promise.all([getAdLanding(slug), getSettingsPublic()]);
  if (!data) notFound();
  const products: ProductCardData[] = await productsFor(data);
  const inStock = products.filter((p) => isAvailableNow(p.stockState)).length;
  const courier = settings.deliveryMethods.find((d) => d.code === "courier");
  const pickup = settings.deliveryMethods.find((d) => d.code === "pickup");
  const cod = settings.paymentMethods.some((p) => p.code === "cod");
  const contacts = contactLinkList(contactFromSettings(settings), data.headline).filter(
    (l) => l.channel !== "email",
  );
  const moreHref = data.category
    ? data.vehicle
      ? landingPath(data.category.slug, data.vehicle.brandSlug, data.vehicle.modelSlug)
      : ROUTES.category(data.category.slug)
    : ROUTES.parts;
  const proofs = [
    inStock > 0
      ? {
          Icon: PackageIcon,
          title: `${formatNumber(inStock)} ${pluralSr(inStock, ["artikal", "artikla", "artikala"])} na stanju`,
          text: settings.commerce.etaText,
        }
      : null,
    courier
      ? {
          Icon: TruckIcon,
          title: `Kurir ${formatRSD(courier.pricePara)}`,
          text: courier.freeOverPara
            ? `Besplatno iznad ${formatRSD(courier.freeOverPara)}.`
            : courier.etaText,
        }
      : null,
    cod || pickup
      ? {
          Icon: StorefrontIcon,
          title: cod ? "Plaćanje pouzećem" : "Plaćanje pri preuzimanju",
          text: pickup ? "Ili lično preuzimanje u radnji, bez troška." : "Bez plaćanja na sajtu.",
        }
      : null,
  ].filter(Boolean) as { Icon: typeof PackageIcon; title: string; text: string }[];

  return (
    <div className="px-page pb-(--space-section) pt-8 lg:pt-12">
      {products.length ? (
        <JsonLd
          data={itemListJsonLd(
            products.map((p) => ({ name: p.name, slug: p.slug })),
            data.title,
          )}
        />
      ) : null}
      <section className="grid gap-8 lg:grid-cols-12 lg:gap-x-(--gutter)">
        <div className="flex flex-col gap-5 lg:col-span-7">
          <RevealText as="h1" className="type-display-l uppercase text-ink-1">
            {data.headline}
          </RevealText>
          {data.subhead ? (
            <RevealText as="p" className="max-w-[60ch] type-lead text-ink-2">
              {data.subhead}
            </RevealText>
          ) : null}
          {/* What the offer is about, as tags under the statement (a label above a heading
              competes with it). */}
          {data.vehicle || data.category ? (
            <ul className="flex flex-wrap gap-2" data-reveal="off">
              {[data.category?.name, data.vehicle?.label].filter(Boolean).map((tag) => (
                <li
                  key={tag}
                  className="inline-flex min-h-7 items-center rounded-xs border border-line-strong px-2 type-caption text-ink-2"
                >
                  {tag}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild size="lg" icon={<ChatCircleTextIcon size={20} />}>
              <Link
                href={ROUTES.inquiryWith({ ...(data.category ? { deo: data.category.slug } : {}) })}
                variant="unstyled"
              >
                Pošaljite upit
              </Link>
            </Button>
            <HeaderVehicleChip />
          </div>
          <ContactActions links={contacts} location="ponuda" variant="buttons" showValue />
        </div>
        {proofs.length ? (
          <ul
            className="flex flex-col divide-y divide-line panel px-5 lg:col-span-5 lg:self-end"
            data-reveal="block"
            data-reveal-eager=""
          >
            {proofs.map(({ Icon, title, text }) => (
              <li key={title} className="flex items-start gap-4 py-4">
                <Icon size={24} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-3" />
                <div className="flex flex-col gap-1">
                  <p className="type-body font-semibold text-ink-1">{title}</p>
                  <p className="type-body-s text-ink-2">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {products.length > 0 ? (
        <section aria-labelledby="ponuda-products" className="mt-14">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="ponuda-products" className="type-h2 text-ink-1">
              {data.category ? data.category.name : "Izdvojeni delovi"}
              {data.vehicle ? ` za ${data.vehicle.label}` : ""}
            </h2>
            <Link href={moreHref} variant="standalone">
              Svi artikli
            </Link>
          </div>
          <TrackViewList listId={`ponuda:${data.slug}`} listName={data.title} items={products} />
          <div className="mt-5">
            {/* No image preload: on a phone the cards sit below the hero, and a preload would take
              slow-4G bandwidth from the render-blocking stylesheet (PERF-03). */}
            <ProductGrid items={products} headingLevel="h3" />
          </div>
        </section>
      ) : (
        <section className="mt-14 max-w-[60ch]">
          <h2 className="type-h2 text-ink-1">Proverićemo za vas</h2>
          <p className="mt-3 type-body text-ink-2">
            Trenutno nemamo izdvojene artikle za ovu ponudu. Pošaljite broj šasije ili OEM broj —
            javljamo se u toku radnog dana.
          </p>
        </section>
      )}

      {data.bodyMd ? (
        <section className="mt-14 max-w-[72ch] type-body text-ink-2">
          <Markdown source={data.bodyMd} />
        </section>
      ) : null}
    </div>
  );
}
