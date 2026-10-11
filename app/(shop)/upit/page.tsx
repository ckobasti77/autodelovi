import type { Metadata } from "next";

import { contactLinkList } from "@/config/site";
import { parsePastedOemList } from "@/lib/domain/codes";
import { breadcrumbJsonLd } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";
import { contactFromSettings } from "@/lib/settings/public";
import {
  getCategory,
  getCategoryTree,
  getProductBySlug,
  getSettingsPublic,
  getVehicleTree,
} from "@/lib/server/catalog-cache";
import { getViewer } from "@/lib/server/auth";
import { RevealText } from "@/components/text-reveal/RevealText";
import { JsonLd } from "@/components/seo/JsonLd";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ContactActions } from "@/components/shell/ContactActions";
import {
  InquiryForm,
  type InquiryPrefill,
  type InquiryVehicleTree,
} from "@/components/inquiry/InquiryForm";
import { VinLocator } from "@/components/inquiry/VinLocator";
import { ROUTES } from "@/constants/routes";
import type { VehicleTree } from "@/lib/catalog/types";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettingsPublic();
  return buildMetadata({
    title: "Upit za deo po broju šasije (VIN)",
    description:
      "Ne nalazite deo? Pošaljite broj šasije, opis i fotografiju starog dela. Proverimo kod dobavljača i javimo ponudu u toku radnog dana.",
    path: ROUTES.inquiry,
    titleSuffix: settings.seo.titleSuffix,
  });
}

const crumbs = [{ label: "Početna", href: ROUTES.home }, { label: "Upit po broju šasije" }];

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() ?? "";

/** Only what the form reads goes into the RSC payload (aliases, WMI lists, platforms stay out). */
function inquiryTree(tree: VehicleTree): InquiryVehicleTree {
  return tree.map(({ brand, models }) => ({
    brand: { _id: brand._id, name: brand.name, slug: brand.slug },
    models: models.map(({ model, generations }) => ({
      model: { _id: model._id, name: model.name, slug: model.slug },
      generations: generations.map((g) => ({
        _id: g._id,
        name: g.name,
        slug: g.slug,
        yearFrom: g.yearFrom,
        yearTo: g.yearTo,
        vinModelCodes: g.vinModelCodes,
      })),
    })),
  }));
}

/** VIN / part inquiry `/upit` (§10.7) with `?q=`, `?proizvod=`, `?deo=`, `?kodovi=` prefills. */
export default async function InquiryPage({ searchParams }: PageProps<"/upit">) {
  const sp = await searchParams;
  const [settings, tree, categoryTree, viewer] = await Promise.all([
    getSettingsPublic(),
    getVehicleTree(),
    getCategoryTree(),
    getViewer(),
  ]);
  const q = one(sp.q).slice(0, 200);
  const productSlug = one(sp.proizvod).slice(0, 120);
  const categorySlug = one(sp.deo).slice(0, 80);
  const codes = parsePastedOemList(one(sp.kodovi).replace(/,/g, "\n")).slice(0, 50);

  const [product, category] = await Promise.all([
    productSlug ? getProductBySlug(productSlug) : Promise.resolve(null),
    categorySlug ? getCategory(categorySlug) : Promise.resolve(null),
  ]);

  const prefill: InquiryPrefill = {
    kind: product ? "product_question" : q || codes.length ? "not_found" : "part",
    message: codes.length
      ? `Tražim delove po brojevima: ${codes.join(", ")}.`
      : q
        ? `Tražim: ${q}`
        : "",
    categories:
      category && category.category.kind !== "system"
        ? [{ slug: category.category.slug, name: category.category.name }]
        : [],
    productId: product?.product._id ?? null,
    productName: product ? `${product.product.name} (${product.product.manufacturerName})` : null,
    searchQuery: q || null,
    requestedCodes: codes,
  };

  const name = [viewer?.firstName, viewer?.lastName].filter(Boolean).join(" ");
  const contacts = contactLinkList(contactFromSettings(settings)).filter(
    (l) => l.channel !== "email",
  );

  return (
    <div className="px-page pb-(--space-section) pt-6 lg:pt-8">
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={crumbs} />
      <div className="mt-4 flex max-w-[48rem] flex-col gap-4">
        <RevealText as="h1" className="type-display-l uppercase text-ink-1">
          Ne nalazite deo?
        </RevealText>
        <RevealText as="p" className="type-lead text-ink-2">
          Pošaljite broj šasije i šta vam treba — javljamo se sa ponudom u toku radnog dana.
        </RevealText>
      </div>
      <div className="mt-10 grid gap-12 lg:grid-cols-12 lg:gap-x-(--gutter)">
        <div className="lg:col-span-8">
          <InquiryForm
            config={{
              tree: inquiryTree(tree),
              categories: [...categoryTree.categories, ...categoryTree.subcategories]
                .filter((c) => c.kind !== "system")
                .sort((a, b) => a.name.localeCompare(b.name, "sr"))
                .map((c) => ({ slug: c.slug, name: c.name })),
              legal: {
                terms: settings.legalVersions.terms,
                privacy: settings.legalVersions.privacy,
              },
              viewer: viewer
                ? { name, email: viewer.email ?? "", phone: viewer.phone ?? "" }
                : null,
              prefill,
            }}
          />
        </div>
        <aside className="flex flex-col gap-8 lg:col-span-4" aria-label="Pomoć">
          <section className="panel p-5">
            <h2 className="mb-4 type-h4 text-ink-1">Gde je broj šasije?</h2>
            <VinLocator />
          </section>
          {contacts.length ? (
            <section className="flex flex-col gap-3">
              <h2 className="type-h4 text-ink-1">Brže je telefonom?</h2>
              <ContactActions links={contacts} location="inquiry" variant="buttons" />
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
