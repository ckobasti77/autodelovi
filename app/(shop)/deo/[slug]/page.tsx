import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ChatCircleTextIcon,
  StorefrontIcon,
  TruckIcon,
  ArrowRightIcon,
} from "@phosphor-icons/react/dist/ssr";

import { contactLinkList } from "@/config/site";
import { formatRSD } from "@/lib/format/money";
import { QUALITY_LABEL } from "@/lib/i18n/sr/catalog";
import { breadcrumbJsonLd, productJsonLd } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";
import { contactFromSettings } from "@/lib/settings/public";
import {
  getProductBySlug,
  getRelatedProducts,
  getRetiredProduct,
  getSameOemProducts,
  getSettingsPublic,
} from "@/lib/server/catalog-cache";
import { Breadcrumbs, type Crumb } from "@/components/ui/Breadcrumbs";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { Link } from "@/components/ui/Link";
import { RevealText } from "@/components/text-reveal/RevealText";
import { JsonLd } from "@/components/seo/JsonLd";
import { AddToCartButton } from "@/components/catalog/AddToCartButton";
import { isOrderable } from "@/lib/catalog/orderable";
import { LiveOverlayProvider } from "@/components/catalog/LiveOverlay";
import { ProductGrid } from "@/components/catalog/ProductGrid";
import { ProductPrice } from "@/components/catalog/ProductPrice";
import { ProductStock } from "@/components/catalog/ProductStock";
import { ProductThumb } from "@/components/catalog/ProductThumb";
import { BackInStockForm } from "@/components/product/BackInStockForm";
import { CodeList } from "@/components/product/CodeList";
import { FitmentBadge } from "@/components/product/FitmentBadge";
import { FitmentTable } from "@/components/product/FitmentTable";
import { ProductViewTracker } from "@/components/product/ProductViewTracker";
import { SpecDrawing, discDimensions } from "@/components/product/SpecDrawing";
import { StickyBuyBar } from "@/components/product/StickyBuyBar";
import { ContactActions } from "@/components/shell/ContactActions";
import { RetiredProduct } from "@/components/product/RetiredProduct";
import { ROUTES } from "@/constants/routes";

function productDescription(p: NonNullable<Awaited<ReturnType<typeof getProductBySlug>>>) {
  const c = p.product;
  const vehicles = c.fitmentSummary ? ` za ${c.fitmentSummary}` : "";
  const price = c.retailPricePara !== null ? ` Cena ${formatRSD(c.retailPricePara)} sa PDV-om.` : "";
  const stock =
    c.stockState === "in_stock" || c.stockState === "low_stock"
      ? " Na stanju."
      : c.stockState === "on_order"
        ? " Po porudžbini."
        : " Trenutno nije na stanju.";
  const oem = c.oemPrimary ? ` Kat. br. ${c.oemPrimary}.` : "";
  return `${c.name} (${c.manufacturerName}, ${QUALITY_LABEL[c.quality]})${vehicles}.${price}${stock}${oem}`;
}

export async function generateMetadata({ params }: PageProps<"/deo/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const [data, settings] = await Promise.all([getProductBySlug(slug), getSettingsPublic()]);
  if (!data) {
    const retired = await getRetiredProduct(slug);
    return retired
      ? buildMetadata({
          title: `${retired.name} — više nije u ponudi`,
          description: `${retired.name} (${retired.manufacturerName}) više nije u ponudi. Pogledajte zamenu u kategoriji ili pošaljite upit.`,
          path: ROUTES.product(slug),
          noindex: true,
          titleSuffix: settings.seo.titleSuffix,
        })
      : {};
  }
  const c = data.product;
  const code = c.oemPrimary ?? data.mpn ?? "";
  return buildMetadata({
    title: data.seoTitle ?? `${c.name} ${c.manufacturerName}${code ? ` ${code}` : ""}`,
    description: data.seoDescription ?? productDescription(data),
    path: ROUTES.product(c.slug),
    titleSuffix: settings.seo.titleSuffix,
  });
}

const FACTS_CLASS = "flex items-start gap-3 py-3 type-body-s text-ink-2";

export default async function ProductPage({ params }: PageProps<"/deo/[slug]">) {
  const { slug } = await params;
  const [data, settings] = await Promise.all([getProductBySlug(slug), getSettingsPublic()]);
  if (!data) {
    const retired = await getRetiredProduct(slug);
    if (!retired) notFound();
    return <RetiredProduct retired={retired} />;
  }
  const c = data.product;
  const [related, sameOem] = await Promise.all([
    getRelatedProducts(c._id),
    c.oemPrimary ? getSameOemProducts(c.oemPrimary) : Promise.resolve(null),
  ]);
  const alternatives = (sameOem?.results ?? [])
    .filter((r) => r.card._id !== c._id && (r.match === "exact_code" || r.match === "cross_code"))
    .map((r) => r.card)
    .slice(0, 6);
  const relatedCards = related.filter((r) => !alternatives.some((a) => a._id === r._id)).slice(0, 4);

  const crumbs: Crumb[] = [
    { label: "Početna", href: ROUTES.home },
    { label: "Delovi", href: ROUTES.parts },
    { label: data.category.name, href: ROUTES.category(data.category.slug) },
    { label: c.name },
  ];
  const contacts = contactLinkList(contactFromSettings(settings)).filter((l) => l.channel !== "email");
  const courier = settings.deliveryMethods.find((d) => d.code === "courier");
  const pickup = settings.deliveryMethods.find((d) => d.code === "pickup");
  const disc = discDimensions(data.specs);
  const orderable = isOrderable(c.stockState, c.allowBackorder);
  const images = data.images.filter((i) => i.url);

  return (
    <LiveOverlayProvider productIds={[c._id]}>
      <JsonLd
        data={[
          breadcrumbJsonLd(crumbs),
          productJsonLd({
            name: c.name,
            slug: c.slug,
            sku: c.sku,
            mpn: data.mpn ?? c.oemPrimary,
            ean: data.ean,
            manufacturer: c.manufacturerName,
            category: data.category.name,
            description: data.description ?? productDescription(data),
            images: images.length ? images.map((i) => i.url!) : [`/images/parts/${c.categorySlug}.webp`],
            pricePara: c.retailPricePara,
            stockState: c.stockState,
            shippingPara: courier?.pricePara ?? null,
          }),
        ]}
      />
      <ProductViewTracker
        sku={c.sku}
        name={c.name}
        manufacturerName={c.manufacturerName}
        systemSlug={c.systemSlug}
        categorySlug={c.categorySlug}
        pricePara={c.retailPricePara}
      />
      <div className="px-page pb-(--space-section) pt-6 lg:pt-8">
        <Breadcrumbs items={crumbs} />
        <div className="mt-5 grid gap-8 lg:grid-cols-12 lg:gap-x-(--gutter)">
          {/* Gallery */}
          <div className="flex flex-col gap-4 lg:col-span-7">
            <div className="relative overflow-hidden rounded-sm border border-line">
              <ProductThumb
                imageUrl={images[0]?.url ?? null}
                categorySlug={c.categorySlug}
                alt={`${c.name} ${c.manufacturerName}${c.oemPrimary ? ` ${c.oemPrimary}` : ""}`}
                sizes="(min-width: 1024px) 56vw, 100vw"
                preload
                className="aspect-[4/3]"
              />
              {!images.length ? (
                <p className="absolute bottom-3 left-3 rounded-xs bg-bg/80 px-2 py-1 type-caption-s text-ink-3">
                  Ilustracija kategorije — izgled dela može se razlikovati
                </p>
              ) : null}
            </div>
            {images.length > 1 ? (
              <ul className="grid grid-cols-4 gap-3 sm:grid-cols-6" aria-label="Fotografije">
                {images.slice(1, 7).map((img, i) => (
                  <li key={i}>
                    <ProductThumb
                      imageUrl={img.url}
                      categorySlug={c.categorySlug}
                      alt={img.alt}
                      sizes="120px"
                      className="aspect-square rounded-xs border border-line"
                    />
                  </li>
                ))}
              </ul>
            ) : null}
            {disc ? (
              <figure className="hidden rounded-sm border border-line p-4 corner-ticks sm:block">
                <SpecDrawing diameter={disc.diameter} thickness={disc.thickness} />
                <figcaption className="mt-2 type-caption font-normal text-ink-3">
                  Mere diska: prečnik {disc.diameter} mm, debljina {disc.thickness} mm.
                </figcaption>
              </figure>
            ) : null}
          </div>

          {/* Buy box */}
          <div className="lg:col-span-5">
            <div className="flex flex-col gap-4 lg:sticky lg:top-[calc(var(--header-h)+1.5rem)]">
              <p className="type-body-s text-ink-3">
                {c.manufacturerName} · {QUALITY_LABEL[c.quality]}
              </p>
              <RevealText as="h1" className="type-h1 text-ink-1">
                {c.name}
              </RevealText>
              <dl className="flex flex-col gap-1 type-body-s" data-reveal="off">
                {c.oemPrimary ? (
                  <div className="flex items-center gap-1.5">
                    <dt className="text-ink-3">OEM</dt>
                    <dd className="flex items-center gap-1">
                      <span className="type-code-l text-ink-1">{c.oemPrimary}</span>
                      <CopyButton
                        value={c.oemPrimary}
                        label={`Kopiraj OEM broj ${c.oemPrimary}`}
                        toastMessage="OEM broj kopiran."
                      />
                    </dd>
                  </div>
                ) : null}
                <div className="flex items-center gap-1.5">
                  <dt className="text-ink-3">Šifra</dt>
                  <dd className="type-code text-ink-2">{c.sku}</dd>
                </div>
                {data.mpn ? (
                  <div className="flex items-center gap-1.5">
                    <dt className="text-ink-3">Kat. br. proizvođača</dt>
                    <dd className="type-code text-ink-2">{data.mpn}</dd>
                  </div>
                ) : null}
              </dl>
              <FitmentBadge fitments={data.fitments} universal={c.universal} productSlug={c.slug} />
              <div id="buy-box" className="flex flex-col gap-4 border-y border-line py-5">
                <ProductPrice productId={c._id} retailPricePara={c.retailPricePara} size="l" showDiscount />
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <ProductStock
                    productId={c._id}
                    stockState={c.stockState}
                    stockQty={c.stockQty}
                    leadTimeDays={c.leadTimeDays}
                  />
                  {c.stockState === "in_stock" || c.stockState === "low_stock" ? (
                    <span className="type-caption font-normal text-ink-3">· {settings.commerce.etaText}</span>
                  ) : null}
                </div>
                {orderable ? (
                  <AddToCartButton product={c} variant="product" />
                ) : (
                  <BackInStockForm productId={c._id} productName={c.name} />
                )}
                <div className="flex flex-col gap-3">
                  <Button asChild variant="secondary" icon={<ChatCircleTextIcon size={20} />} className="self-start">
                    <Link href={ROUTES.inquiryWith({ proizvod: c.slug })} variant="unstyled">
                      Pošaljite upit
                    </Link>
                  </Button>
                  <ContactActions links={contacts} location="product" />
                </div>
              </div>
              <ul className="flex flex-col divide-y divide-line" data-reveal="off">
                {courier ? (
                  <li className={FACTS_CLASS}>
                    <TruckIcon size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-3" />
                    <span>
                      Kurir {formatRSD(courier.pricePara)}
                      {courier.freeOverPara ? `, besplatno iznad ${formatRSD(courier.freeOverPara)}` : ""} ·
                      pouzećem ili virmanom
                    </span>
                  </li>
                ) : null}
                {pickup ? (
                  <li className={FACTS_CLASS}>
                    <StorefrontIcon size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-3" />
                    <span>Lično preuzimanje bez troška · plaćanje gotovinom ili karticom</span>
                  </li>
                ) : null}
                <li className={FACTS_CLASS}>
                  <ArrowRightIcon size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-3" />
                  <span>
                    Bez plaćanja na sajtu.{" "}
                    <Link href={ROUTES.delivery} variant="inline">
                      Dostava i plaćanje
                    </Link>
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="cv-auto mt-16 flex flex-col gap-14">
          <section aria-labelledby="fitment-title">
            <h2 id="fitment-title" className="type-h2 text-ink-1">
              Kompatibilnost
            </h2>
            <p className="mt-2 max-w-[72ch] type-body-s text-ink-3">
              Pre ugradnje uporedite OEM broj sa starim delom. Kad niste sigurni,{" "}
              <Link href={ROUTES.inquiryWith({ proizvod: c.slug })} variant="inline">
                pošaljite broj šasije
              </Link>
              .
            </p>
            <div className="mt-5">
              {data.fitments.length ? (
                <FitmentTable rows={data.fitments} />
              ) : c.universal ? (
                <p className="type-body text-ink-2">Univerzalni deo — odgovara za sva vozila po specifikaciji.</p>
              ) : (
                <p className="type-body text-ink-2">Kompatibilnost nije uneta. Proverite po OEM broju ili pošaljite upit.</p>
              )}
            </div>
          </section>

          <div className="grid gap-14 lg:grid-cols-12 lg:gap-x-(--gutter)">
            <section aria-labelledby="codes-title" className="lg:col-span-7">
              <h2 id="codes-title" className="type-h2 text-ink-1">
                Brojevi
              </h2>
              <div className="mt-5">
                <CodeList oem={data.oemNumbers} cross={data.crossNumbers} />
              </div>
            </section>
            <section aria-labelledby="specs-title" className="lg:col-span-5">
              <h2 id="specs-title" className="type-h2 text-ink-1">
                Specifikacije
              </h2>
              <dl className="mt-5 flex flex-col divide-y divide-line border-y border-line type-body-s">
                {data.specs.map((s) => (
                  <div key={s.label} className="grid grid-cols-2 gap-4 py-2.5">
                    <dt className="text-ink-3">{s.label}</dt>
                    <dd className={s.unit ? "type-code text-ink-1" : "text-ink-1"}>
                      {s.value}
                      {s.unit ? ` ${s.unit}` : ""}
                    </dd>
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-4 py-2.5">
                  <dt className="text-ink-3">Proizvođač</dt>
                  <dd className="text-ink-1">{c.manufacturerName}</dd>
                </div>
                <div className="grid grid-cols-2 gap-4 py-2.5">
                  <dt className="text-ink-3">Kvalitet</dt>
                  <dd className="text-ink-1">{QUALITY_LABEL[c.quality]}</dd>
                </div>
                {data.warrantyMonths ? (
                  <div className="grid grid-cols-2 gap-4 py-2.5">
                    <dt className="text-ink-3">Garancija</dt>
                    <dd className="text-ink-1">{data.warrantyMonths} meseci</dd>
                  </div>
                ) : null}
              </dl>
              {data.description ? (
                <p className="mt-5 max-w-[65ch] type-body text-ink-2">{data.description}</p>
              ) : null}
              {data.notes ? (
                <p className="mt-3 max-w-[65ch] type-body-s text-ink-3">Napomena: {data.notes}</p>
              ) : null}
            </section>
          </div>

          {alternatives.length > 0 ? (
            <section aria-labelledby="same-oem-title">
              <h2 id="same-oem-title" className="type-h2 text-ink-1">
                Isti deo, drugi proizvođači
              </h2>
              <p className="mt-2 type-body-s text-ink-3">
                Artikli sa istim OEM brojem <span className="type-code text-ink-2">{c.oemPrimary}</span>.
              </p>
              <div className="mt-5">
                <ProductGrid items={alternatives} headingLevel="h3" />
              </div>
            </section>
          ) : null}

          {relatedCards.length > 0 ? (
            <section aria-labelledby="related-title">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 id="related-title" className="type-h2 text-ink-1">
                  Povezani delovi
                </h2>
                <Link href={ROUTES.category(data.category.slug)} variant="standalone">
                  Svi: {data.category.name}
                </Link>
              </div>
              <div className="mt-5">
                <ProductGrid items={relatedCards} headingLevel="h3" />
              </div>
            </section>
          ) : null}
        </div>
      </div>
      {orderable ? <StickyBuyBar product={c} targetId="buy-box" /> : null}
    </LiveOverlayProvider>
  );
}
