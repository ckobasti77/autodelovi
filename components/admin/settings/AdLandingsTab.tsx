"use client";

/**
 * Podešavanja → Oglasne strane (SEO-ADS §J10): the `/ponuda/[slug]` list for Google/Meta ads.
 * Each page repeats the ad's promise (H1), shows curated parts or the category filtered by the
 * vehicle, and is `noindex` unless marked otherwise. Staff can edit; every change is audited.
 */
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState } from "react";
import { ArrowSquareOutIcon, PlusIcon, TrashIcon, XIcon } from "@phosphor-icons/react/dist/ssr";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ADMIN_COPY } from "@/lib/i18n/sr/admin";
import { convexErrorMessage } from "@/lib/i18n/sr/shop";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { Textarea } from "@/components/ui/Textarea";
import { toast } from "@/components/ui/Toast";

import { ConfirmDialog, useConfirm } from "../ConfirmDialog";
import { ProductPicker } from "../ProductPicker";
import { Section } from "../ui";

type Row = FunctionReturnType<typeof api.seoAdmin.adLandings>[number];

type Draft = {
  id?: Id<"adLandings">;
  slug: string;
  title: string;
  headline: string;
  subhead: string;
  bodyMd: string;
  categoryId: string;
  brandId: string;
  modelId: string;
  generationId: string;
  products: { _id: Id<"products">; sku: string; name: string }[];
  indexable: boolean;
  active: boolean;
};

const EMPTY: Draft = {
  slug: "",
  title: "",
  headline: "",
  subhead: "",
  bodyMd: "",
  categoryId: "",
  brandId: "",
  modelId: "",
  generationId: "",
  products: [],
  indexable: false,
  active: true,
};

const fromRow = (r: Row): Draft => ({
  id: r._id,
  slug: r.slug,
  title: r.title,
  headline: r.headline,
  subhead: r.subhead ?? "",
  bodyMd: r.bodyMd ?? "",
  categoryId: r.categoryId ?? "",
  brandId: r.brandId ?? "",
  modelId: r.modelId ?? "",
  generationId: r.generationId ?? "",
  products: r.products,
  indexable: r.indexable,
  active: r.active,
});

export function AdLandingsTab() {
  const rows = useQuery(api.seoAdmin.adLandings, {});
  const [draft, setDraft] = useState<Draft | null>(null);
  if (!rows) return <Skeleton className="h-64 w-full" />;
  return (
    <div className="flex flex-col gap-6">
      <Section
        title="Oglasne strane (/ponuda/…)"
        actions={
          draft ? null : (
            <Button size="sm" icon={<PlusIcon size={16} />} onClick={() => setDraft(EMPTY)}>
              Nova strana
            </Button>
          )
        }
      >
        <p className="mb-4 max-w-[72ch] type-body-s text-ink-3">
          Odredišne strane za oglase: naslov ponavlja obećanje iz oglasa, ispod su izabrani artikli
          (ili kategorija za izabrano vozilo), telefon, Viber i upit. Po pravilu nisu u Google
          pretrazi, da ne takmiče sa stranama kategorija. Izmena je vidljiva za najviše 5 minuta.
        </p>
        {rows.length === 0 ? (
          <p className="type-body-s text-ink-2">Još nema oglasnih strana.</p>
        ) : (
          <ul
            className="flex flex-col divide-y divide-line border-y border-line"
            data-testid="ad-landings"
          >
            {rows.map((r) => (
              <li key={r._id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium text-ink-1">{r.headline}</span>
                  <span className="type-caption text-ink-3">
                    /ponuda/{r.slug} ·{" "}
                    {r.products.length
                      ? `${r.products.length} artikala`
                      : (r.categoryName ?? "bez artikala")}
                    {r.vehicleLabel ? ` · ${r.vehicleLabel}` : ""}
                  </span>
                </div>
                {r.active ? <Badge tone="success">Aktivna</Badge> : <Badge>Isključena</Badge>}
                {r.indexable ? <Badge tone="info">U pretrazi</Badge> : null}
                <a
                  href={`/ponuda/${r.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 items-center gap-1 rounded-xs px-2 type-body-s text-ink-2 hover:bg-surface-2 hover:text-ink-1"
                >
                  <ArrowSquareOutIcon size={16} aria-hidden="true" />
                  Otvori
                </a>
                <Button size="sm" variant="secondary" onClick={() => setDraft(fromRow(r))}>
                  Izmeni
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Section>
      {draft ? (
        <Editor key={draft.id ?? "new"} initial={draft} onClose={() => setDraft(null)} />
      ) : null}
    </div>
  );
}

function Editor({ initial, onClose }: { initial: Draft; onClose: () => void }) {
  const save = useMutation(api.seoAdmin.saveAdLanding);
  const remove = useMutation(api.seoAdmin.removeAdLanding);
  const categories = useQuery(api.catalog.categories.tree, {});
  const vehicles = useQuery(api.catalog.vehicles.tree, {});
  const confirm = useConfirm();
  const [d, setD] = useState<Draft>(initial);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setD((x) => ({ ...x, [key]: value }));

  const brand = vehicles?.find((b) => b.brand._id === d.brandId);
  const model = brand?.models.find((m) => m.model._id === d.modelId);

  async function submit() {
    setSaving(true);
    setErrors({});
    try {
      await save({
        ...(d.id ? { id: d.id } : {}),
        slug: d.slug,
        title: d.title,
        headline: d.headline,
        ...(d.subhead.trim() ? { subhead: d.subhead } : {}),
        ...(d.bodyMd.trim() ? { bodyMd: d.bodyMd } : {}),
        ...(d.categoryId ? { categoryId: d.categoryId as Id<"categories"> } : {}),
        ...(d.brandId ? { brandId: d.brandId as Id<"vehicleBrands"> } : {}),
        ...(d.modelId ? { modelId: d.modelId as Id<"vehicleModels"> } : {}),
        ...(d.generationId ? { generationId: d.generationId as Id<"vehicleGenerations"> } : {}),
        productIds: d.products.map((p) => p._id),
        indexable: d.indexable,
        active: d.active,
      });
      toast.success(ADMIN_COPY.saved);
      onClose();
    } catch (err) {
      const field = (err as { data?: { field?: string } }).data?.field;
      const message = convexErrorMessage(err, ADMIN_COPY.genericError);
      if (field) setErrors({ [field]: message });
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  function onDelete() {
    const id = d.id;
    if (!id) return;
    confirm.ask({
      title: "Obrisati oglasnu stranu?",
      description: `Adresa /ponuda/${initial.slug} prestaje da radi — proverite da je ne koristi nijedan aktivan oglas.`,
      confirmLabel: "Obriši",
      danger: true,
      onConfirm: async () => {
        await remove({ id });
        toast.success("Oglasna strana je obrisana.");
        onClose();
      },
    });
  }

  const categoryOptions = (categories?.categories ?? [])
    .concat(categories?.subcategories ?? [])
    .map((c) => ({ value: c._id, label: c.name }))
    .sort((a, b) => a.label.localeCompare(b.label, "sr"));

  return (
    <Section title={d.id ? `Izmena: /ponuda/${initial.slug}` : "Nova oglasna strana"}>
      <div className="grid gap-4 md:grid-cols-2" data-testid="ad-landing-editor">
        <Field
          label="Adresa"
          help="/ponuda/… — mala slova, cifre i crtice"
          error={errors.slug}
          required
        >
          <Input value={d.slug} onChange={(e) => set("slug", e.target.value)} prefix="/ponuda/" />
        </Field>
        <Field
          label="Naslov stranice (u pretraživaču)"
          help={`${d.title.length}/70`}
          error={errors.title}
          required
        >
          <Input value={d.title} maxLength={70} onChange={(e) => set("title", e.target.value)} />
        </Field>
        <Field
          label="Glavna poruka (H1) — isto obećanje kao u oglasu"
          help={`${d.headline.length}/90`}
          error={errors.headline}
          required
          className="md:col-span-2"
        >
          <Input
            value={d.headline}
            maxLength={90}
            onChange={(e) => set("headline", e.target.value)}
          />
        </Field>
        <Field
          label="Podnaslov"
         
          error={errors.subhead}
          className="md:col-span-2"
        >
          <Textarea
            rows={2}
            maxLength={220}
            value={d.subhead}
            onChange={(e) => set("subhead", e.target.value)}
          />
        </Field>
        <Field label="Kategorija" error={errors.categoryId}>
          <Select
            value={d.categoryId}
            placeholder="Bez kategorije"
            options={categoryOptions}
            onChange={(e) => set("categoryId", e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Marka" error={errors.brandId}>
            <Select
              value={d.brandId}
              placeholder="Sve"
              options={(vehicles ?? []).map((b) => ({ value: b.brand._id, label: b.brand.name }))}
              onChange={(e) =>
                setD((x) => ({ ...x, brandId: e.target.value, modelId: "", generationId: "" }))
              }
            />
          </Field>
          <Field label="Model" error={errors.modelId}>
            <Select
              value={d.modelId}
              placeholder="Svi"
              disabled={!brand}
              options={(brand?.models ?? []).map((m) => ({
                value: m.model._id,
                label: m.model.name,
              }))}
              onChange={(e) => setD((x) => ({ ...x, modelId: e.target.value, generationId: "" }))}
            />
          </Field>
          <Field label="Generacija">
            <Select
              value={d.generationId}
              placeholder="Sve"
              disabled={!model}
              options={(model?.generations ?? []).map((g) => ({ value: g._id, label: g.name }))}
              onChange={(e) => set("generationId", e.target.value)}
            />
          </Field>
        </div>
        <div className="md:col-span-2">
          <ProductPicker
            label="Izdvojeni artikli (do 24; bez njih se prikazuje kategorija za vozilo)"
            onPick={(p) =>
              setD((x) =>
                x.products.some((y) => y._id === p._id) || x.products.length >= 24
                  ? x
                  : { ...x, products: [...x.products, { _id: p._id, sku: p.sku, name: p.name }] },
              )
            }
          />
          {d.products.length ? (
            <ul className="mt-3 flex flex-col divide-y divide-line border-y border-line">
              {d.products.map((p) => (
                <li key={p._id} className="flex items-center gap-3 py-2 type-body-s">
                  <span className="font-mono text-ink-3">{p.sku}</span>
                  <span className="min-w-0 flex-1 truncate text-ink-1">{p.name}</span>
                  <IconButton
                    label={`Ukloni ${p.name}`}
                    icon={<XIcon size={16} />}
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      set(
                        "products",
                        d.products.filter((x) => x._id !== p._id),
                      )
                    }
                  />
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <Field
          label="Dodatni tekst (Markdown, nije obavezan)"
         
          className="md:col-span-2"
        >
          <Textarea
            rows={4}
            maxLength={3000}
            value={d.bodyMd}
            onChange={(e) => set("bodyMd", e.target.value)}
          />
        </Field>
        <Switch
          label="Aktivna"
          description="Isključena strana vraća „nije pronađeno“."
          checked={d.active}
          onCheckedChange={(v) => set("active", v)}
        />
        <Switch
          label="Prikazati u Google pretrazi"
          description="Uključite samo ako strana ima sopstven, jedinstven sadržaj."
          checked={d.indexable}
          onCheckedChange={(v) => set("indexable", v)}
        />
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button onClick={() => void submit()} loading={saving}>
          Sačuvaj
        </Button>
        <Button variant="secondary" onClick={onClose}>
          Otkaži
        </Button>
        {d.id ? (
          <Button
            variant="danger"
            icon={<TrashIcon size={18} />}
            onClick={onDelete}
            className="ml-auto"
          >
            Obriši
          </Button>
        ) : null}
      </div>
      <ConfirmDialog {...confirm.props} />
    </Section>
  );
}
