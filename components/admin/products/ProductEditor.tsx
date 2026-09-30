"use client";

/**
 * Product editor (`/admin/proizvodi/novi`, `/admin/proizvodi/[id]`, DESIGN-SYSTEM §10.12):
 * Osnovno · Brojevi (normalisation preview) · Kompatibilnost (vehicle tree) · Opis i
 * tehnički podaci · Slike · SEO (SERP preview) · Istorija; side column: price and cost with
 * the margin against the minimum, stock with reasons, internal data, status. Sticky save
 * bar while dirty, Ctrl/⌘ + S saves, leaving with unsaved changes asks first.
 */
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeftIcon,
  CopyIcon,
  PlusIcon,
  TrashIcon,
  WarningIcon,
} from "@phosphor-icons/react/dist/ssr";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { marginBp, moneyInputValue, parseMoneyInput } from "@/lib/admin/format";
import { slugifySr } from "@/lib/domain/slug";
import { formatRSD } from "@/lib/format/money";
import { STOCK_STATE_LABEL, STOCK_STATE_TONE } from "@/lib/i18n/sr/admin";
import { QUALITY_LABEL } from "@/lib/i18n/sr/catalog";
import { convexErrorField, convexErrorMessage } from "@/lib/i18n/sr/shop";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { RouteLink } from "@/components/ui/RouteLink";
import { Select } from "@/components/ui/Select";
import { Skeleton, SkeletonRegion } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { Textarea } from "@/components/ui/Textarea";
import { toast } from "@/components/ui/Toast";
import { ADMIN, ROUTES } from "@/constants/routes";

import { useNowMinute } from "../hooks";
import { useAdminCrumb } from "../shell/context";
import { DemoTag, PageHeader, SaveBar, Section } from "../ui";
import { CodesEditor, type CrossRow, type OemRow } from "./CodesEditor";
import { FitmentEditor, type FitmentRow } from "./FitmentEditor";
import { ImagesEditor } from "./ImagesEditor";
import { ProductHistory } from "./ProductHistory";
import { SeoFields } from "./SeoFields";
import { StockDialog } from "./StockDialog";

type Full = NonNullable<FunctionReturnType<typeof api.catalog.productsAdmin.getFull>>;
type Quality = "original" | "oem" | "aftermarket";
type Spec = { label: string; value: string; unit: string };

type Form = {
  sku: string;
  name: string;
  slug: string;
  categoryId: string;
  manufacturerId: string;
  quality: "" | Quality;
  mpn: string;
  ean: string;
  oem: OemRow[];
  cross: CrossRow[];
  price: string;
  cost: string;
  stockQty: string;
  lowStockThreshold: string;
  leadTimeDays: string;
  allowBackorder: boolean;
  universal: boolean;
  active: boolean;
  fitments: FitmentRow[];
  description: string;
  specs: Spec[];
  notes: string;
  seoTitle: string;
  seoDescription: string;
  weightGrams: string;
  warrantyMonths: string;
  supplierName: string;
  supplierSku: string;
  internalNote: string;
};

const EMPTY: Form = {
  sku: "",
  name: "",
  slug: "",
  categoryId: "",
  manufacturerId: "",
  quality: "",
  mpn: "",
  ean: "",
  oem: [{ raw: "", brand: "" }],
  cross: [],
  price: "",
  cost: "",
  stockQty: "0",
  lowStockThreshold: "",
  leadTimeDays: "",
  allowBackorder: false,
  universal: false,
  active: true,
  fitments: [],
  description: "",
  specs: [],
  notes: "",
  seoTitle: "",
  seoDescription: "",
  weightGrams: "",
  warrantyMonths: "",
  supplierName: "",
  supplierSku: "",
  internalNote: "",
};

const num = (v: number | null) => (v === null ? "" : String(v));

function fromFull(p: Full): Form {
  return {
    sku: p.sku,
    name: p.name,
    slug: p.slug,
    categoryId: p.categoryId,
    manufacturerId: p.manufacturerId,
    quality: p.quality,
    mpn: p.mpn ?? "",
    ean: p.ean ?? "",
    oem: p.oemNumbers.map((o) => ({ raw: o.raw, brand: o.brand ?? "" })),
    cross: p.crossNumbers.map((c) => ({ manufacturer: c.manufacturer, raw: c.raw })),
    price: moneyInputValue(p.retailPricePara),
    cost: moneyInputValue(p.costNetPara),
    stockQty: String(p.stockQty),
    lowStockThreshold: num(p.lowStockThreshold),
    leadTimeDays: num(p.leadTimeDays),
    allowBackorder: p.allowBackorder,
    universal: p.universal,
    active: p.active,
    fitments: p.fitments.map((f) => ({ ...f, note: f.note ?? "" })),
    description: p.description ?? "",
    specs: p.specs.map((s) => ({ label: s.label, value: s.value, unit: s.unit ?? "" })),
    notes: p.notes ?? "",
    seoTitle: p.seoTitle ?? "",
    seoDescription: p.seoDescription ?? "",
    weightGrams: num(p.weightGrams),
    warrantyMonths: num(p.warrantyMonths),
    supplierName: p.supplierName ?? "",
    supplierSku: p.supplierSku ?? "",
    internalNote: p.internalNote ?? "",
  };
}

type Errors = Partial<Record<keyof Form, string>>;

const optInt = (
  text: string,
  field: keyof Form,
  label: string,
  errors: Errors,
  max = 1_000_000,
) => {
  if (!text.trim()) return undefined;
  const n = Number(text);
  if (!Number.isInteger(n) || n < 0 || n > max)
    errors[field] = `${label}: ceo broj od 0 do ${max.toLocaleString("sr-Latn-RS")}.`;
  return n;
};

/** Validated values in the Convex shape (undefined = empty optional). */
function toValues(f: Form) {
  const errors: Errors = {};
  if (!f.sku.trim()) errors.sku = "Upišite šifru artikla.";
  if (!f.name.trim()) errors.name = "Upišite naziv.";
  if (!f.categoryId) errors.categoryId = "Izaberite kategoriju.";
  if (!f.manufacturerId) errors.manufacturerId = "Izaberite proizvođača.";
  const price = parseMoneyInput(f.price);
  if (price === undefined || Number.isNaN(price) || price < 0)
    errors.price = "Upišite cenu sa PDV-om.";
  const cost = parseMoneyInput(f.cost);
  if (cost !== undefined && (Number.isNaN(cost) || cost < 0))
    errors.cost = "Nabavna cena nije ispravna.";
  const values = {
    sku: f.sku.trim(),
    name: f.name.trim(),
    slug: f.slug.trim() ? slugifySr(f.slug) : undefined,
    categoryId: f.categoryId as Id<"categories">,
    manufacturerId: f.manufacturerId as Id<"manufacturers">,
    quality: f.quality || undefined,
    mpn: f.mpn.trim() || undefined,
    ean: f.ean.trim() || undefined,
    oemNumbers: f.oem
      .filter((o) => o.raw.trim())
      .map((o) => ({ raw: o.raw.trim(), ...(o.brand.trim() ? { brand: o.brand.trim() } : {}) })),
    crossNumbers: f.cross
      .filter((c) => c.raw.trim())
      .map((c) => ({ manufacturer: c.manufacturer.trim() || "—", raw: c.raw.trim() })),
    retailPricePara: price ?? 0,
    costNetPara: cost,
    stockQty: optInt(f.stockQty, "stockQty", "Stanje", errors) ?? 0,
    lowStockThreshold: optInt(f.lowStockThreshold, "lowStockThreshold", "Prag", errors, 10_000),
    leadTimeDays: optInt(f.leadTimeDays, "leadTimeDays", "Rok isporuke", errors, 365),
    allowBackorder: f.allowBackorder,
    universal: f.universal,
    active: f.active,
    fitments: f.fitments.map((r) => ({
      brandId: r.brandId,
      modelId: r.modelId,
      generationId: r.generationId,
      ...(r.engineId ? { engineId: r.engineId } : {}),
      ...(r.yearFrom !== null ? { yearFrom: r.yearFrom } : {}),
      ...(r.yearTo !== null ? { yearTo: r.yearTo } : {}),
      ...(r.note ? { note: r.note } : {}),
    })),
    description: f.description.trim() || undefined,
    specs: f.specs
      .filter((s) => s.label.trim() && s.value.trim())
      .map((s) => ({
        label: s.label.trim(),
        value: s.value.trim(),
        ...(s.unit.trim() ? { unit: s.unit.trim() } : {}),
      })),
    notes: f.notes.trim() || undefined,
    seoTitle: f.seoTitle.trim() || undefined,
    seoDescription: f.seoDescription.trim() || undefined,
    weightGrams: optInt(f.weightGrams, "weightGrams", "Masa", errors, 500_000),
    warrantyMonths: optInt(f.warrantyMonths, "warrantyMonths", "Garancija", errors, 120),
    supplierName: f.supplierName.trim() || undefined,
    supplierSku: f.supplierSku.trim() || undefined,
    internalNote: f.internalNote.trim() || undefined,
  };
  return { values, errors };
}

type Values = ReturnType<typeof toValues>["values"];
const CLEARABLE = [
  "mpn",
  "ean",
  "lowStockThreshold",
  "leadTimeDays",
  "description",
  "notes",
  "seoTitle",
  "seoDescription",
  "weightGrams",
  "warrantyMonths",
  "costNetPara",
  "supplierName",
  "supplierSku",
  "internalNote",
] as const;

function strip<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

export function ProductEditor({ productId }: { productId: Id<"products"> | null }) {
  const full = useQuery(api.catalog.productsAdmin.getFull, productId ? { productId } : "skip");
  useAdminCrumb(productId ? (full?.name ?? null) : null);
  if (productId && full === undefined)
    return (
      <SkeletonRegion>
        <Skeleton className="mb-4 h-10 w-96" />
        <Skeleton className="h-[640px] w-full" />
      </SkeletonRegion>
    );
  if (productId && full === null)
    return (
      <div className="flex flex-col items-start gap-3">
        <h1 className="type-h2">Artikal ne postoji</h1>
        <RouteLink href={ADMIN.products} className="type-body-s text-accent-text underline">
          Nazad na proizvode
        </RouteLink>
      </div>
    );
  return <EditorForm key={full ? `${full._id}` : "new"} full={full ?? null} />;
}

function EditorForm({ full }: { full: Full | null }) {
  const router = useRouter();
  const nowMinute = useNowMinute();
  const categories = useQuery(api.catalog.categoriesAdmin.options, {});
  const manufacturers = useQuery(api.catalog.manufacturersAdmin.list, {});
  const settings = useQuery(api.settings.getAdmin, {});
  const create = useMutation(api.catalog.productsAdmin.create);
  const update = useMutation(api.catalog.productsAdmin.update);
  const duplicate = useMutation(api.catalog.productsAdmin.duplicate);
  const setActive = useMutation(api.catalog.productsAdmin.setActive);
  const initial = useMemo(() => (full ? fromFull(full) : EMPTY), [full]);
  const [form, setForm] = useState<Form>(initial);
  const [baseline, setBaseline] = useState<Form>(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [stockOpen, setStockOpen] = useState(false);
  const set = <K extends keyof Form>(key: K, value: Form[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const isNew = full === null;

  // Server-side changes to stock / active (another tab, a bulk action) refresh the baseline.
  const [seen, setSeen] = useState(full?.updatedAt ?? 0);
  if (full && full.updatedAt !== seen) {
    setSeen(full.updatedAt);
    const fresh = fromFull(full);
    setBaseline(fresh);
    setForm((f) =>
      JSON.stringify(f) === JSON.stringify(baseline) ? fresh : { ...f, stockQty: fresh.stockQty },
    );
  }

  const dirty = JSON.stringify(form) !== JSON.stringify(baseline);

  const save = useCallback(async () => {
    const { values, errors: errs } = toValues(form);
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error("Proverite označena polja.");
      return;
    }
    setSaving(true);
    try {
      if (!full) {
        const id = await create(
          strip(values) as Values & { sku: string } as Parameters<typeof create>[0],
        );
        toast.success("Artikal je napravljen. Dodajte slike.");
        setBaseline(form);
        router.replace(ADMIN.product(id));
        return;
      }
      const { values: before } = toValues(baseline);
      const patch: Record<string, unknown> = {};
      const clear: (typeof CLEARABLE)[number][] = [];
      for (const key of Object.keys(values) as (keyof Values)[]) {
        if (key === "stockQty") continue; // stock changes go through the stock dialog (with a reason)
        if (JSON.stringify(values[key]) === JSON.stringify(before[key])) continue;
        if (values[key] === undefined) {
          if ((CLEARABLE as readonly string[]).includes(key))
            clear.push(key as (typeof CLEARABLE)[number]);
        } else patch[key] = values[key];
      }
      if (Object.keys(patch).length === 0 && clear.length === 0) {
        setBaseline(form);
        return;
      }
      const changed = await update({
        productId: full._id,
        patch: patch as Parameters<typeof update>[0]["patch"],
        ...(clear.length ? { clear } : {}),
      });
      setBaseline(form);
      toast.success(changed.length ? "Sačuvano." : "Nema izmena za čuvanje.");
    } catch (err) {
      const field = convexErrorField(err);
      if (field) setErrors({ [field]: convexErrorMessage(err, "Neispravna vrednost.") });
      toast.error(convexErrorMessage(err, "Artikal nije sačuvan."));
    } finally {
      setSaving(false);
    }
  }, [baseline, create, form, full, router, update]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if ((dirty || isNew) && !saving) void save();
      }
    };
    const onUnload = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [dirty, isNew, save, saving]);

  const price = parseMoneyInput(form.price);
  const cost = parseMoneyInput(form.cost);
  const vat = settings?.commerce.vatRateBp ?? 2_000;
  const minMargin = settings?.commerce.minMarginBp ?? 0;
  const margin =
    price !== undefined && !Number.isNaN(price) && cost !== undefined && !Number.isNaN(cost)
      ? marginBp(price, cost, vat)
      : null;
  const marginTone =
    margin === null
      ? "neutral"
      : margin < 0
        ? "danger"
        : margin < minMargin
          ? "warning"
          : "success";
  const manufacturer = manufacturers?.find((m) => m._id === form.manufacturerId);
  const category = categories?.find((c) => c._id === form.categoryId);
  const errorCount = Object.keys(errors).length;

  return (
    <div className="flex flex-col gap-6">
      <RouteLink
        href={ADMIN.products}
        className="inline-flex min-h-9 items-center gap-2 self-start type-body-s text-ink-2 hover:text-ink-1"
      >
        <ArrowLeftIcon size={16} aria-hidden="true" /> Proizvodi
      </RouteLink>
      <PageHeader
        title={isNew ? "Novi artikal" : full.name}
        description={
          isNew
            ? "Obavezno: šifra, naziv, kategorija, proizvođač i cena. Slike se dodaju posle prvog čuvanja."
            : undefined
        }
        meta={
          full ? (
            <>
              <Badge tone={full.active ? "success" : "neutral"}>
                {full.active ? "Aktivan" : "Neaktivan"}
              </Badge>
              <Badge tone={STOCK_STATE_TONE[full.stockState]}>
                {STOCK_STATE_LABEL[full.stockState]}
              </Badge>
              {full.isDemo ? <DemoTag /> : null}
            </>
          ) : null
        }
        actions={
          full ? (
            <>
              {full.active ? (
                <Button asChild variant="secondary" size="sm">
                  <a href={ROUTES.product(full.slug)} target="_blank" rel="noopener">
                    Pogledaj na sajtu
                  </a>
                </Button>
              ) : null}
              <Button
                variant="secondary"
                size="sm"
                icon={<CopyIcon size={16} />}
                onClick={async () => {
                  try {
                    const id = await duplicate({ productId: full._id });
                    toast.success("Kopija je napravljena (neaktivna, stanje 0).");
                    router.push(ADMIN.product(id));
                  } catch (err) {
                    toast.error(convexErrorMessage(err, "Kopija nije napravljena."));
                  }
                }}
              >
                Dupliraj
              </Button>
              <Button
                variant={full.active ? "danger" : "secondary"}
                size="sm"
                onClick={async () => {
                  const next = !full.active;
                  try {
                    await setActive({ productId: full._id, active: next });
                    toast.success(
                      next
                        ? "Artikal je aktiviran."
                        : "Artikal je deaktiviran — više se ne vidi na sajtu.",
                      {
                        action: {
                          label: "Poništi",
                          onClick: () => void setActive({ productId: full._id, active: !next }),
                        },
                      },
                    );
                  } catch (err) {
                    toast.error(convexErrorMessage(err, "Nije sačuvano."));
                  }
                }}
              >
                {full.active ? "Deaktiviraj" : "Aktiviraj"}
              </Button>
            </>
          ) : null
        }
      />
      {errorCount > 0 ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-sm border border-danger bg-danger-subtle px-4 py-3 type-body-s text-danger"
        >
          <WarningIcon size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          <ul>
            {Object.values(errors).map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Section title="Osnovno" id="osnovno">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Naziv" required error={errors.name} className="md:col-span-2">
                <Input
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  maxLength={160}
                  data-testid="admin-product-name"
                />
              </Field>
              <Field
                label="Šifra artikla"
                required
                error={errors.sku}
                help="Interna šifra; mora biti jedinstvena."
              >
                <Input
                  value={form.sku}
                  onChange={(e) => set("sku", e.target.value)}
                  maxLength={64}
                  inputClassName="font-mono"
                  data-testid="admin-product-sku"
                />
              </Field>
              <Field
                label="Adresa na sajtu (slug)"
                optional
                help={
                  isNew
                    ? "Prazno: pravi se iz naziva."
                    : "Promena pravi preusmerenje sa stare adrese."
                }
              >
                <Input
                  value={form.slug}
                  onChange={(e) => set("slug", e.target.value)}
                  placeholder={slugifySr(form.name)}
                  inputClassName="font-mono"
                />
              </Field>
              <Field label="Kategorija" required error={errors.categoryId}>
                <Select
                  placeholder="Izaberite"
                  value={form.categoryId}
                  onChange={(e) => set("categoryId", e.target.value)}
                  options={(categories ?? []).map((c) => ({ value: c._id, label: c.label }))}
                  data-testid="admin-product-category"
                />
              </Field>
              <Field label="Proizvođač" required error={errors.manufacturerId}>
                <Select
                  placeholder="Izaberite"
                  value={form.manufacturerId}
                  onChange={(e) => set("manufacturerId", e.target.value)}
                  options={(manufacturers ?? [])
                    .filter((m) => m.active || m._id === form.manufacturerId)
                    .map((m) => ({ value: m._id, label: m.name }))}
                  data-testid="admin-product-manufacturer"
                />
              </Field>
              <Field
                label="Kvalitet"
                optional
                help={
                  manufacturer
                    ? `Prazno: ${QUALITY_LABEL[manufacturer.defaultQuality]} (podrazumevano za proizvođača).`
                    : undefined
                }
              >
                <Select
                  placeholder="Kao proizvođač"
                  value={form.quality}
                  onChange={(e) => set("quality", e.target.value as Form["quality"])}
                  options={Object.entries(QUALITY_LABEL).map(([value, label]) => ({
                    value,
                    label,
                  }))}
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Kataloški broj (MPN)" optional>
                  <Input
                    value={form.mpn}
                    onChange={(e) => set("mpn", e.target.value)}
                    inputClassName="font-mono"
                  />
                </Field>
                <Field label="EAN" optional>
                  <Input
                    value={form.ean}
                    onChange={(e) => set("ean", e.target.value)}
                    inputMode="numeric"
                    inputClassName="font-mono"
                  />
                </Field>
              </div>
            </div>
          </Section>

          <Section title="Brojevi" id="brojevi">
            <CodesEditor
              oem={form.oem}
              cross={form.cross}
              onOem={(v) => set("oem", v)}
              onCross={(v) => set("cross", v)}
            />
          </Section>

          <Section
            title="Kompatibilnost"
            id="kompatibilnost"
            actions={
              <Switch
                label="Univerzalno (sva vozila)"
                checked={form.universal}
                onCheckedChange={(v) => set("universal", v)}
              />
            }
          >
            {form.universal ? (
              <p className="mb-4 type-body-s text-ink-2">
                Univerzalan artikal se prikazuje uz svako izabrano vozilo (npr. ulja, sijalice,
                alat).
              </p>
            ) : null}
            <FitmentEditor rows={form.fitments} onChange={(v) => set("fitments", v)} />
          </Section>

          <Section title="Opis i tehnički podaci" id="opis">
            <div className="flex flex-col gap-4">
              <Field
                label="Opis"
                optional
                help="Kratko: šta je deo, na šta treba paziti pri ugradnji."
              >
                <Textarea
                  rows={5}
                  maxLength={5000}
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                />
              </Field>
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 type-body-s font-semibold">Tehnički podaci</legend>
                {form.specs.map((s, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_6rem_auto] items-center gap-2"
                  >
                    <Input
                      aria-label={`Podatak ${i + 1}`}
                      placeholder="npr. Prečnik"
                      value={s.label}
                      onChange={(e) =>
                        set(
                          "specs",
                          form.specs.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)),
                        )
                      }
                      className="h-9"
                    />
                    <Input
                      aria-label={`Vrednost ${i + 1}`}
                      placeholder="288"
                      value={s.value}
                      onChange={(e) =>
                        set(
                          "specs",
                          form.specs.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)),
                        )
                      }
                      className="h-9"
                    />
                    <Input
                      aria-label={`Jedinica ${i + 1}`}
                      placeholder="mm"
                      value={s.unit}
                      onChange={(e) =>
                        set(
                          "specs",
                          form.specs.map((x, j) => (j === i ? { ...x, unit: e.target.value } : x)),
                        )
                      }
                      className="h-9"
                    />
                    <IconButton
                      label={`Ukloni podatak ${i + 1}`}
                      icon={<TrashIcon size={16} />}
                      size="sm"
                      onClick={() =>
                        set(
                          "specs",
                          form.specs.filter((_, j) => j !== i),
                        )
                      }
                    />
                  </div>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<PlusIcon size={16} />}
                  className="self-start"
                  onClick={() => set("specs", [...form.specs, { label: "", value: "", unit: "" }])}
                >
                  Dodaj podatak
                </Button>
              </fieldset>
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Masa" optional error={errors.weightGrams}>
                  <Input
                    value={form.weightGrams}
                    onChange={(e) => set("weightGrams", e.target.value)}
                    inputMode="numeric"
                    suffix="g"
                  />
                </Field>
                <Field label="Garancija" optional error={errors.warrantyMonths}>
                  <Input
                    value={form.warrantyMonths}
                    onChange={(e) => set("warrantyMonths", e.target.value)}
                    inputMode="numeric"
                    suffix="mes."
                  />
                </Field>
                <Field label="Napomena za kupce" optional>
                  <Input
                    value={form.notes}
                    onChange={(e) => set("notes", e.target.value)}
                    placeholder="npr. prodaje se u paru"
                  />
                </Field>
              </div>
            </div>
          </Section>

          <Section title="Slike" id="slike">
            {full ? (
              <ImagesEditor productId={full._id} productName={full.name} images={full.images} />
            ) : (
              <p className="type-body-s text-ink-2">
                Sačuvajte artikal, pa dodajte slike. Dok nema fotografija, sajt prikazuje render
                kategorije.
              </p>
            )}
          </Section>

          <Section title="SEO" id="seo">
            <SeoFields
              title={form.seoTitle}
              description={form.seoDescription}
              onTitle={(v) => set("seoTitle", v)}
              onDescription={(v) => set("seoDescription", v)}
              fallbackTitle={[form.name || "Naziv artikla", manufacturer?.name]
                .filter(Boolean)
                .join(" — ")}
              fallbackDescription={
                form.description.split(/(?<=\.)\s/)[0] ||
                `${form.name || "Deo"}${manufacturer ? `, ${manufacturer.name}` : ""}${category ? ` — ${category.label.split(" › ").pop()}` : ""}. Cena sa PDV-om, stanje i dostava.`
              }
              slug={form.slug || slugifySr(form.name)}
              titleSuffix={settings?.seo.titleSuffix ?? ""}
            />
          </Section>

          {full ? (
            <Section title="Istorija" id="istorija">
              <ProductHistory productId={full._id} nowMinute={nowMinute} />
            </Section>
          ) : null}
        </div>

        <aside className="flex flex-col gap-6" aria-label="Cena, stanje i status">
          <Section title="Cena">
            <div className="flex flex-col gap-4">
              <Field label="Maloprodajna cena sa PDV-om" required error={errors.price}>
                <Input
                  value={form.price}
                  onChange={(e) => set("price", e.target.value)}
                  inputMode="decimal"
                  suffix="RSD"
                  inputClassName="text-right tabular-nums"
                  data-testid="admin-product-price"
                />
              </Field>
              <Field
                label="Nabavna cena bez PDV-a"
                optional
                error={errors.cost}
                help="Vidi je samo osoblje; čuva minimalnu maržu kod rabata majstora."
              >
                <Input
                  value={form.cost}
                  onChange={(e) => set("cost", e.target.value)}
                  inputMode="decimal"
                  suffix="RSD"
                  inputClassName="text-right tabular-nums"
                />
              </Field>
              <div className="flex items-center justify-between gap-3 rounded-xs bg-surface-2 px-3 py-2 type-body-s">
                <span className="text-ink-2">Marža</span>
                {margin === null ? (
                  <span className="text-ink-3">upišite nabavnu cenu</span>
                ) : (
                  <Badge tone={marginTone} size="text">
                    {String(Math.round(margin) / 100).replace(".", ",")} %
                    {marginTone === "warning"
                      ? " — ispod minimuma"
                      : marginTone === "danger"
                        ? " — gubitak"
                        : ""}
                  </Badge>
                )}
              </div>
              {price !== undefined && !Number.isNaN(price) ? (
                <p className="type-caption text-ink-3">
                  Bez PDV-a {formatRSD(Math.round((price * 10_000) / (10_000 + vat)))} · minimalna
                  marža {String(minMargin / 100).replace(".", ",")} %
                </p>
              ) : null}
            </div>
          </Section>

          <Section
            title="Stanje"
            actions={
              full ? (
                <Button variant="secondary" size="sm" onClick={() => setStockOpen(true)}>
                  Promeni stanje
                </Button>
              ) : null
            }
          >
            <div className="flex flex-col gap-4">
              {full ? (
                <p className="type-body-s text-ink-2">
                  Na stanju:{" "}
                  <span className="font-condensed text-[1.75rem] font-semibold tabular-nums text-ink-1">
                    {full.stockQty}
                  </span>{" "}
                  kom.
                </p>
              ) : (
                <Field label="Početno stanje" error={errors.stockQty}>
                  <Input
                    value={form.stockQty}
                    onChange={(e) => set("stockQty", e.target.value)}
                    inputMode="numeric"
                    suffix="kom."
                    inputClassName="text-right tabular-nums"
                  />
                </Field>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Prag „malo“"
                  optional
                  error={errors.lowStockThreshold}
                  help={`Prazno: ${settings?.commerce.lowStockDefault ?? 3}`}
                >
                  <Input
                    value={form.lowStockThreshold}
                    onChange={(e) => set("lowStockThreshold", e.target.value)}
                    inputMode="numeric"
                    inputClassName="text-right tabular-nums"
                  />
                </Field>
                <Field label="Rok nabavke" optional error={errors.leadTimeDays}>
                  <Input
                    value={form.leadTimeDays}
                    onChange={(e) => set("leadTimeDays", e.target.value)}
                    inputMode="numeric"
                    suffix="dana"
                    inputClassName="text-right tabular-nums"
                  />
                </Field>
              </div>
              <Switch
                label="Prima porudžbine bez stanja"
                description="Kad nema na stanju, kupac i dalje poručuje (po porudžbini, uz rok nabavke)."
                checked={form.allowBackorder}
                onCheckedChange={(v) => set("allowBackorder", v)}
              />
            </div>
          </Section>

          <Section title="Interno">
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Dobavljač" optional>
                  <Input
                    value={form.supplierName}
                    onChange={(e) => set("supplierName", e.target.value)}
                  />
                </Field>
                <Field label="Šifra kod dobavljača" optional>
                  <Input
                    value={form.supplierSku}
                    onChange={(e) => set("supplierSku", e.target.value)}
                    inputClassName="font-mono"
                  />
                </Field>
              </div>
              <Field label="Interna beleška" optional>
                <Textarea
                  rows={3}
                  maxLength={1000}
                  value={form.internalNote}
                  onChange={(e) => set("internalNote", e.target.value)}
                />
              </Field>
              {isNew ? (
                <Switch
                  label="Aktivan (vidi se na sajtu)"
                  checked={form.active}
                  onCheckedChange={(v) => set("active", v)}
                />
              ) : null}
            </div>
          </Section>
        </aside>
      </div>

      <SaveBar
        dirty={dirty || isNew}
        saving={saving}
        onSave={() => void save()}
        onDiscard={() => (isNew ? router.push(ADMIN.products) : (setForm(baseline), setErrors({})))}
        message={isNew ? "Novi artikal još nije sačuvan." : "Imate nesačuvane izmene."}
        saveLabel={isNew ? "Sačuvaj artikal" : "Sačuvaj"}
      />
      {full ? (
        <StockDialog
          open={stockOpen}
          onOpenChange={setStockOpen}
          productId={full._id}
          sku={full.sku}
          current={full.stockQty}
        />
      ) : null}
    </div>
  );
}
