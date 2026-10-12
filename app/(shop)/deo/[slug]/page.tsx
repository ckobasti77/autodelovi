import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import {
  ChatCircleTextIcon,
  StorefrontIcon,
  TruckIcon,
  ArrowRightIcon,
} from "@phosphor-icons/react/dist/ssr";

import { contactLinkList } from "@/config/site";
import { formatRSD } from "@/lib/format/money";
import { typographer } from "@/lib/format/nbsp";
import { countSr } from "@/lib/format/plural";
import { QUALITY_LABEL } from "@/lib/i18n/sr/catalog";
import { breadcrumbJsonLd, productJsonLd } from "@/lib/seo/jsonld";
import { productImageAlt } from "@/lib/seo/images";
import { landingHref, landingLabel } from "@/lib/seo/landingLinks";
import { buildMetadata } from "@/lib/seo/metadata";
import { productMeta } from "@/lib/seo/templates";
import { contactFromSettings } from "@/lib/settings/public";
import {
  getProductBySlug,
  getProductLandings,
  getRedirect,
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
import { Reveal } from "@/components/reveal/Reveal";
import { JsonLd } from "@/components/seo/JsonLd";
import { AddToCartButton } from "@/components/catalog/AddToCartButton";
import { FavoriteButton } from "@/components/mechanic/FavoriteButton";
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

function productMetaText(
  p: NonNullable<Awaited<ReturnType<typeof getProductBySlug>>>,
  titleSuffix?: string,
) {
  const c = p.product;
  return productMeta({
    ...(titleSuffix !== undefined ? { titleSuffix } : {}),
    name: c.name,
    manufacturer: c.manufacturerName,
    qualityLabel: QUALITY_LABEL[c.quality],
    code: c.oemPrimary ?? p.mpn,
    fitmentSummary: c.fitmentSummary,
    pricePara: c.retailPricePara,
    stockState: c.stockState,
  });
}

/**
 * No current product under this slug: a renamed product answers with a 308 to its new URL
 * (SEO-06), a retired one renders „više nije u ponudi“, anything else is a 404. Called from
 * generateMetadata too, so the redirect and the 404 are decided before the page streams.
 */
async function resolveMissing(slug: string) {
  const moved = await getRedirect(ROUTES.product(slug));
  if (moved) permanentRedirect(moved.toPath);
  const retired = await getRetiredProduct(slug);
  if (!retired) notFound();
  return retired;
}

export async function generateMetadata({ params }: PageProps<"/deo/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const [data, settings] = await Promise.all([getProductBySlug(slug), getSettingsPublic()]);
  if (!data) {
    const retired = await resolveMissing(slug);
    return buildMetadata({
      title: `${retired.name} — više nije u ponudi`,
      description: `${retired.name} (${retired.manufacturerName}) više nije u ponudi. Pogledajte zamenu u kategoriji ili pošaljite upit.`,
      path: ROUTES.product(slug),
      noindex: true,
      titleSuffix: settings.seo.titleSuffix,
      ogFile: true,
    });
  }
  const c = data.product;
  const text = productMetaText(data, settings.seo.titleSuffix);
  return buildMetadata({
    title: data.seoTitle ?? text.title,
    titleIsFinal: !data.seoTitle,
    ogFile: true,
    description: data.seoDescription ?? text.description,
    path: ROUTES.product(c.slug),
    titleSuffix: settings.seo.titleSuffix,
  });
}

const FACTS_CLASS = "flex items-start gap-3 py-2 type-body-s text-ink-2";

/*
 * The detail groups below the buy box skip style and layout until they approach the viewport,
 * each on its own (PERF-01). One `cv-auto` wrapper around all of them did not: Chromium renders
 * content-visibility:auto content up to about 1.5 viewport heights below the fold, the wrapper
 * starts inside that margin on every width, so the whole block (~330 layout objects on a phone)
 * was laid out again with every streamed HTML chunk and font swap right after the first paint.
 * Per group, the first one (compatibility) still renders on load and the rest wait for the
 * scroll. Intrinsic sizes = measured heights per breakpoint (360–1920 px, three products), so
 * the scrollbar stays put; `auto` keeps the real height once a group has rendered.
 */
const CV_CODES =
  "cv-auto [contain-intrinsic-size:auto_720px] sm:[contain-intrinsic-size:auto_580px] lg:[contain-intrinsic-size:auto_400px]";
const CV_PRODUCTS =
  "cv-auto [contain-intrinsic-size:auto_1110px] sm:[contain-intrinsic-size:auto_1000px] xl:[contain-intrinsic-size:auto_520px]";
const CV_LINKS =
  "cv-auto [contain-intrinsic-size:auto_300px] sm:[contain-intrinsic-size:auto_170px] lg:[contain-intrinsic-size:auto_120px]";

export default async function ProductPage({ params }: PageProps<"/deo/[slug]">) {
  const { slug } = await params;
  const [data, settings] = await Promise.all([getProductBySlug(slug), getSettingsPublic()]);
  if (!data) return <RetiredProduct retired={await resolveMissing(slug)} />;
  const c = data.product;
  const [related, sameOem, landings] = await Promise.all([
    getRelatedProducts(c._id),
    c.oemPrimary ? getSameOemProducts(c.oemPrimary) : Promise.resolve(null),
    getProductLandings(c._id),
  ]);
  const alternatives = (sameOem?.results ?? [])
    .filter((r) => r.card._id !== c._id && (r.match === "exact_code" || r.match === "cross_code"))
    .map((r) => r.card)
    .slice(0, 6);
  const relatedCards = related
    .filter((r) => !alternatives.some((a) => a._id === r._id))
    .slice(0, 4);

  const crumbs: Crumb[] = [
    { label: "Početna", href: ROUTES.home },
    { label: "Delovi", href: ROUTES.parts },
    { label: data.category.name, href: ROUTES.category(data.category.slug) },
    { label: c.name },
  ];
  const contacts = contactLinkList(
    contactFromSettings(settings),
    `${c.name}${c.oemPrimary ? ` (OEM ${c.oemPrimary})` : ""}`,
  ).filter((l) => l.channel !== "email");
  const courier = settings.deliveryMethods.find((d) => d.code === "courier");
  const pickup = settings.deliveryMethods.find((d) => d.code === "pickup");
  const disc = discDimensions(data.specs);
  const orderable = isOrderable(c.stockState, c.allowBackorder);
  const images = data.images
    .filter((i) => i.url)
    .map((img, i) => ({
      ...img,
      alt: productImageAlt({
        alt: img.alt,
        name: c.name,
        manufacturer: c.manufacturerName,
        oem: c.oemPrimary,
        index: i + 1,
      }),
    }));

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
            description: data.description ?? productMetaText(data).description,
            images: images.length
              ? images.map((i) => i.path)
              : [`/images/parts/${c.categorySlug}.webp`],
            pricePara: c.retailPricePara,
            stockState: c.stockState,
            shippingPara: courier?.pricePara ?? null,
            freeOverPara: courier?.freeOverPara ?? settings.commerce.freeShippingOverPara ?? null,
            sellerName: settings.brand.name || undefined,
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
        <Breadcrumbs
          items={crumbs.map((crumb) => ({ ...crumb, label: typographer(crumb.label) }))}
        />
        {/*
          Order, for every width (PRODUCT principle 2 — fits, in stock, how much): picture, what
          it is (maker, name, the OEM number), whether it fits, then the buy box with the price,
          stock and the action; the secondary codes follow. On a phone the picture is held to
          3:2, so all of that is on the first screen and the buy bar carries the action until
          the inline button is in view (UI-BOOST §7.1).
        */}
        <div className="mt-4 grid gap-5 sm:mt-5 sm:gap-8 lg:grid-cols-12 lg:grid-rows-[auto_1fr] lg:gap-x-(--gutter)">
          {/* Gallery */}
          <Reveal eager className="flex flex-col gap-4 lg:col-span-7">
            <figure>
              <div className="relative overflow-hidden rounded-lg border border-line shadow-rest">
                <ProductThumb
                  imageUrl={images[0]?.path ?? null}
                  categorySlug={c.categorySlug}
                  alt={
                    images[0]?.alt ??
                    `${c.name} — ilustracija kategorije ${data.category.name.toLowerCase()}`
                  }
                  sizes="(min-width: 1024px) 56vw, 100vw"
                  preload
                  className="aspect-[3/2] sm:aspect-[4/3]"
                />
              </div>
              {!images.length ? (
                <figcaption className="mt-2 type-caption text-ink-3">
                  Ilustracija kategorije — izgled dela može se razlikovati.
                </figcaption>
              ) : null}
            </figure>
            {images.length > 1 ? (
              <ul className="grid grid-cols-4 gap-3 sm:grid-cols-6" aria-label="Fotografije">
                {images.slice(1, 7).map((img, i) => (
                  <li key={i}>
                    <ProductThumb
                      imageUrl={img.path}
                      categorySlug={c.categorySlug}
                      alt={img.alt}
                      sizes="120px"
                      className="aspect-square rounded-sm border border-line"
                    />
                  </li>
                ))}
              </ul>
            ) : null}
          </Reveal>

          {/* Identity + buy box (spans both rows from lg, so the drawing sits under the gallery) */}
          <div className="lg:col-span-5 lg:row-span-2">
            <div className="flex flex-col gap-4 lg:sticky lg:top-[calc(var(--header-h)+1.5rem)]">
              <div className="flex flex-col gap-2">
                <p className="type-body-s text-ink-3">
                  {c.manufacturerName} · {QUALITY_LABEL[c.quality]}
                </p>
                <RevealText as="h1" className="type-h1 text-ink-1">
                  {typographer(c.name)}
                </RevealText>
                {c.oemPrimary ? (
                  <dl className="type-body-s" data-reveal="off">
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
                  </dl>
                ) : null}
              </div>
              <FitmentBadge fitments={data.fitments} universal={c.universal} productSlug={c.slug} />
              <Reveal
                eager
                index={1}
                id="buy-box"
                className="flex flex-col gap-4 panel-raised p-4 sm:p-5"
              >
                <ProductPrice
                  productId={c._id}
                  retailPricePara={c.retailPricePara}
                  size="l"
                  showDiscount
                />
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <ProductStock
                    productId={c._id}
                    stockState={c.stockState}
                    stockQty={c.stockQty}
                    leadTimeDays={c.leadTimeDays}
                  />
                  {c.stockState === "in_stock" || c.stockState === "low_stock" ? (
                    <span className="type-caption font-normal text-ink-3">
                      · {settings.commerce.etaText}
                    </span>
                  ) : null}
                </div>
                {orderable ? (
                  <AddToCartButton product={c} variant="product" />
                ) : (
                  <BackInStockForm productId={c._id} productName={c.name} />
                )}
                <div className="flex flex-col gap-3 border-t border-line pt-4">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <Button asChild variant="secondary" icon={<ChatCircleTextIcon size={20} />}>
                      <Link href={ROUTES.inquiryWith({ proizvod: c.slug })} variant="unstyled">
                        Pošaljite upit
                      </Link>
                    </Button>
                    <FavoriteButton productId={c._id} productName={c.name} />
                  </div>
                  <ContactActions links={contacts} location="product" />
                </div>
                <ul className="flex flex-col border-t border-line pt-2" data-reveal="off">
                  {courier ? (
                    <li className={FACTS_CLASS}>
                      <TruckIcon
                        size={20}
                        aria-hidden="true"
                        className="mt-0.5 shrink-0 text-ink-3"
                      />
                      <span>
                        Kurir {formatRSD(courier.pricePara)}
                        {courier.freeOverPara
                          ? `, besplatno iznad ${formatRSD(courier.freeOverPara)}`
                          : ""}{" "}
                        · pouzećem ili virmanom
                      </span>
                    </li>
                  ) : null}
                  {pickup ? (
                    <li className={FACTS_CLASS}>
                      <StorefrontIcon
                        size={20}
                        aria-hidden="true"
                        className="mt-0.5 shrink-0 text-ink-3"
                      />
                      <span>Lično preuzimanje bez troška · plaćanje gotovinom ili karticom</span>
                    </li>
                  ) : null}
                  <li className={FACTS_CLASS}>
                    <ArrowRightIcon
                      size={20}
                      aria-hidden="true"
                      className="mt-0.5 shrink-0 text-ink-3"
                    />
                    <span>
                      Bez plaćanja na sajtu.{" "}
                      <Link href={ROUTES.delivery} variant="inline">
                        Dostava i plaćanje
                      </Link>
                    </span>
                  </li>
                </ul>
              </Reveal>
              <dl className="flex flex-wrap gap-x-6 gap-y-1 type-body-s" data-reveal="off">
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
            </div>
          </div>

          {/* Spec drawing: after the buy box on phones and tablets, under the gallery from lg */}
          {disc ? (
            <Reveal
              as="figure"
              eager
              index={2}
              className="hidden self-start rounded-lg border border-line p-4 corner-ticks sm:block lg:col-span-7"
            >
              <SpecDrawing diameter={disc.diameter} thickness={disc.thickness} />
              <figcaption className="mt-2 type-caption font-normal text-ink-3">
                Mere diska: prečnik {disc.diameter} mm, debljina {disc.thickness} mm.
              </figcaption>
            </Reveal>
          ) : null}
        </div>

        {/* Details (content-visibility per group: see CV_CODES) */}
        <div className="mt-16 flex flex-col gap-14">
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
                <p className="type-body text-ink-2">
                  Univerzalni deo — odgovara za sva vozila po specifikaciji.
                </p>
              ) : (
                <p className="type-body text-ink-2">
                  Kompatibilnost nije uneta. Proverite po OEM broju ili pošaljite upit.
                </p>
              )}
            </div>
          </section>

          <div className={`${CV_CODES} grid gap-14 lg:grid-cols-12 lg:gap-x-(--gutter)`}>
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
              <Reveal
                as="dl"
                className="mt-5 flex flex-col divide-y divide-line panel px-4 type-body-s"
              >
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
                    <dd className="text-ink-1">
                      {countSr(data.warrantyMonths, ["mesec", "meseca", "meseci"])}
                    </dd>
                  </div>
                ) : null}
              </Reveal>
              {data.description ? (
                <p className="mt-5 max-w-[65ch] type-body text-ink-2">{data.description}</p>
              ) : null}
              {data.notes ? (
                <p className="mt-3 max-w-[65ch] type-body-s text-ink-3">Napomena: {data.notes}</p>
              ) : null}
            </section>
          </div>

          {alternatives.length > 0 ? (
            <section aria-labelledby="same-oem-title" className={CV_PRODUCTS}>
              <h2 id="same-oem-title" className="type-h2 text-ink-1">
                Isti deo, drugi proizvođači
              </h2>
              <p className="mt-2 type-body-s text-ink-3">
                Artikli sa istim OEM brojem{" "}
                <span className="type-code text-ink-2">{c.oemPrimary}</span>.
              </p>
              <div className="mt-5">
                <ProductGrid items={alternatives} headingLevel="h3" />
              </div>
            </section>
          ) : null}

          {relatedCards.length > 0 ? (
            <section aria-labelledby="related-title" className={CV_PRODUCTS}>
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

          {landings.length > 0 ? (
            <nav aria-labelledby="landings-title" className={CV_LINKS}>
              <h2 id="landings-title" className="type-h2 text-ink-1">
                {data.category.name} po vozilu
              </h2>
              <ul className="mt-4 flex flex-wrap gap-2">
                {landings.map((l) => (
                  <li key={landingHref(l)}>
                    <Link href={landingHref(l)} variant="unstyled" className="chip-link">
                      {landingLabel(l)}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
        </div>
      </div>
      {orderable ? <StickyBuyBar product={c} targetId="buy-box" /> : null}
    </LiveOverlayProvider>
  );
}
