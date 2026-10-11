"use client";

/**
 * `/admin/cenovni-razredi` — mechanic tiers (default rabat, per-category and per-manufacturer
 * exceptions, minimum margin, public description, default for new approvals). The example
 * on the right runs the same pure pricing function as the server (`resolveUnitPrice`), live
 * while you type, for the tier being edited and every other tier. Editing is owner-only.
 */
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useMemo, useState } from "react";
import { PlusIcon, TrashIcon } from "@phosphor-icons/react/dist/ssr";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatBp, moneyInputValue, parseMoneyInput, parsePercent } from "@/lib/admin/format";
import { resolveUnitPrice } from "@/lib/domain/pricing";
import { formatRSD } from "@/lib/format/money";
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

import { useAdminShell } from "../shell/context";
import { PageHeader, SaveBar, Section } from "../ui";

type Tier = FunctionReturnType<typeof api.pricing.listTiers>[number];
type Rule = { id: string; percent: string };
type TierForm = {
  name: string;
  percent: string;
  minMargin: string;
  description: string;
  sortOrder: string;
  isDefault: boolean;
  categoryRules: Rule[];
  manufacturerRules: Rule[];
};

const pct = (bp: number | null | undefined) =>
  bp === null || bp === undefined ? "" : String(bp / 100).replace(".", ",");

function toForm(t: Tier | null, nextSort: number): TierForm {
  return {
    name: t?.name ?? "",
    percent: pct(t?.defaultDiscountBp ?? 1_000),
    minMargin: pct(t?.minMarginBp),
    description: t?.publicDescription ?? "",
    sortOrder: String(t?.sortOrder ?? nextSort),
    isDefault: t?.isDefault ?? false,
    categoryRules: (t?.categoryRules ?? []).map((r) => ({
      id: r.categoryId,
      percent: pct(r.discountBp),
    })),
    manufacturerRules: (t?.manufacturerRules ?? []).map((r) => ({
      id: r.manufacturerId,
      percent: pct(r.discountBp),
    })),
  };
}

const bp = (text: string) => {
  const p = parsePercent(text);
  return p === undefined || Number.isNaN(p) ? null : Math.round(p * 100);
};

function RulesEditor({
  label,
  add,
  options,
  rows,
  onChange,
  disabled,
}: {
  label: string;
  add: string;
  options: { value: string; label: string }[];
  rows: Rule[];
  onChange: (rows: Rule[]) => void;
  disabled: boolean;
}) {
  return (
    <fieldset className="flex flex-col gap-2" disabled={disabled}>
      <legend className="mb-1 type-body-s font-semibold">{label}</legend>
      {rows.length === 0 ? (
        <p className="type-caption text-ink-3">Nema izuzetaka — važi osnovni rabat.</p>
      ) : null}
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-[minmax(0,1fr)_6.5rem_auto] items-center gap-2">
          <Select
            size="sm"
            aria-label={`${label} ${i + 1}`}
            placeholder="Izaberite"
            value={r.id}
            onChange={(e) =>
              onChange(rows.map((x, j) => (j === i ? { ...x, id: e.target.value } : x)))
            }
            options={options}
          />
          <Input
            aria-label={`Rabat, ${label.toLowerCase()} ${i + 1}`}
            value={r.percent}
            onChange={(e) =>
              onChange(rows.map((x, j) => (j === i ? { ...x, percent: e.target.value } : x)))
            }
            suffix="%"
            inputMode="decimal"
            className="h-9"
            inputClassName="text-right tabular-nums"
          />
          <IconButton
            label={`Ukloni izuzetak ${i + 1}`}
            icon={<TrashIcon size={16} />}
            size="sm"
            onClick={() => onChange(rows.filter((_, j) => j !== i))}
          />
        </div>
      ))}
      {!disabled ? (
        <Button
          variant="ghost"
          size="sm"
          icon={<PlusIcon size={16} />}
          className="self-start"
          onClick={() => onChange([...rows, { id: "", percent: "" }])}
        >
          {add}
        </Button>
      ) : null}
    </fieldset>
  );
}

export function TiersAdmin() {
  const tiers = useQuery(api.pricing.listTiers, {});
  const [selectedId, setSelectedId] = useState<string | "new" | null>(null);
  const selected =
    selectedId === "new" ? null : (tiers?.find((t) => t._id === selectedId) ?? tiers?.[0] ?? null);
  const { viewer } = useAdminShell();
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Cenovni razredi"
        description="Rabat majstora po nivoima. Cena se računa samo na serveru i nikad nije ispod nabavne cene uvećane za minimalnu maržu."
        actions={
          viewer.isOwner ? (
            <Button icon={<PlusIcon size={18} />} onClick={() => setSelectedId("new")}>
              Novi razred
            </Button>
          ) : null
        }
      />
      {!viewer.isOwner ? (
        <p className="type-body-s text-ink-3">
          {ADMIN_COPY.ownerOnly} Vi vidite razrede i primer cena.
        </p>
      ) : null}
      {!tiers ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
          <Section title="Razredi">
            <ul className="-mx-4 -my-2">
              {tiers.map((t) => (
                <li key={t._id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(t._id)}
                    aria-current={
                      selected?._id === t._id && selectedId !== "new" ? "true" : undefined
                    }
                    className={`flex min-h-12 w-full cursor-pointer items-center gap-2 border-b border-line-faint px-4 text-left type-body-s focus-ring-inset ${selected?._id === t._id && selectedId !== "new" ? "bg-selected" : "hover:bg-surface-2"}`}
                  >
                    <span
                      className={t.active ? "flex-1 font-medium" : "flex-1 text-ink-3 line-through"}
                    >
                      {t.name}
                    </span>
                    {t.isDefault ? <Badge tone="info">Podrazumevan</Badge> : null}
                    <span className="tabular-nums">{formatBp(t.defaultDiscountBp)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Section>
          <TierEditor
            key={selectedId === "new" ? "new" : (selected?._id ?? "none")}
            tier={selectedId === "new" ? null : selected}
            tiers={tiers}
            canEdit={viewer.isOwner}
            onCreated={(id) => setSelectedId(id)}
          />
        </div>
      )}
    </div>
  );
}

function TierEditor({
  tier,
  tiers,
  canEdit,
  onCreated,
}: {
  tier: Tier | null;
  tiers: Tier[];
  canEdit: boolean;
  onCreated: (id: string) => void;
}) {
  const categories = useQuery(api.catalog.categoriesAdmin.options, {});
  const manufacturers = useQuery(api.catalog.manufacturersAdmin.list, {});
  const settings = useQuery(api.settings.getAdmin, {});
  const create = useMutation(api.pricing.createTier);
  const update = useMutation(api.pricing.updateTier);
  const setActive = useMutation(api.pricing.setTierActive);
  const initial = useMemo(
    () => toForm(tier, (Math.max(0, ...tiers.map((t) => t.sortOrder)) || 0) + 10),
    [tier, tiers],
  );
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [example, setExample] = useState({
    price: moneyInputValue(1_000_000),
    cost: "",
    categoryId: "",
    manufacturerId: "",
  });
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  const payload = () => {
    const defaultDiscountBp = bp(form.percent);
    if (!form.name.trim()) throw new Error("Upišite naziv razreda.");
    if (defaultDiscountBp === null || defaultDiscountBp < 0 || defaultDiscountBp > 9_000)
      throw new Error("Osnovni rabat: 0–90 %.");
    const minMarginBp = form.minMargin.trim() ? bp(form.minMargin) : undefined;
    if (minMarginBp === null) throw new Error("Minimalna marža nije broj.");
    const rules = <K extends "categoryId" | "manufacturerId">(rows: Rule[], key: K) =>
      rows
        .filter((r) => r.id)
        .map((r) => {
          const d = bp(r.percent);
          if (d === null || d < 0 || d > 9_000) throw new Error("Rabat u izuzecima: 0–90 %.");
          return { [key]: r.id, discountBp: d } as Record<K, string> & { discountBp: number };
        });
    return {
      name: form.name.trim(),
      defaultDiscountBp,
      ...(minMarginBp !== undefined ? { minMarginBp } : {}),
      sortOrder: Number(form.sortOrder) || 0,
      isDefault: form.isDefault,
      ...(form.description.trim() ? { publicDescription: form.description.trim() } : {}),
      categoryRules: rules(form.categoryRules, "categoryId") as {
        categoryId: Id<"categories">;
        discountBp: number;
      }[],
      manufacturerRules: rules(form.manufacturerRules, "manufacturerId") as {
        manufacturerId: Id<"manufacturers">;
        discountBp: number;
      }[],
    };
  };

  const save = async () => {
    let p;
    try {
      p = payload();
    } catch (err) {
      return toast.error((err as Error).message);
    }
    setSaving(true);
    try {
      if (tier) {
        await update({ tierId: tier._id, ...p });
        toast.success("Sačuvano. Nove cene važe odmah za sve majstore u ovom razredu.");
      } else {
        const id = await create(p);
        toast.success("Razred je napravljen.");
        onCreated(id);
      }
    } catch (err) {
      toast.error(convexErrorMessage(err, "Razred nije sačuvan."));
    } finally {
      setSaving(false);
    }
  };

  // Live example with the pure pricing function (same as the server).
  const vat = settings?.commerce.vatRateBp ?? 2_000;
  const globalMin = settings?.commerce.minMarginBp ?? 0;
  const exPrice = parseMoneyInput(example.price);
  const exCost = parseMoneyInput(example.cost);
  const catOptions = (categories ?? []).map((c) => ({ value: c._id, label: c.label }));
  const manOptions = (manufacturers ?? []).map((m) => ({ value: m._id, label: m.name }));
  const priceFor = (rules: {
    defaultDiscountBp: number;
    categoryRules: { categoryId: string; discountBp: number }[];
    manufacturerRules: { manufacturerId: string; discountBp: number }[];
    minMarginBp?: number;
  }) => {
    if (exPrice === undefined || Number.isNaN(exPrice)) return null;
    try {
      return resolveUnitPrice({
        retailPricePara: exPrice,
        categoryPath: example.categoryId ? [example.categoryId] : [],
        manufacturerId: example.manufacturerId,
        ...(exCost !== undefined && !Number.isNaN(exCost) ? { costNetPara: exCost } : {}),
        vatRateBp: vat,
        globalMinMarginBp: globalMin,
        tier: rules,
      });
    } catch {
      return null;
    }
  };
  let editing: ReturnType<typeof priceFor> = null;
  try {
    const p = payload();
    editing = priceFor({
      ...p,
      ...(p.minMarginBp !== undefined ? { minMarginBp: p.minMarginBp } : {}),
    });
  } catch {
    editing = null;
  }

  return (
    <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_380px]">
      <Section
        title={tier ? tier.name : "Novi razred"}
        actions={
          tier && canEdit ? (
            <Button
              variant={tier.active ? "danger" : "secondary"}
              size="sm"
              onClick={() =>
                void setActive({ tierId: tier._id, active: !tier.active }).then(() =>
                  toast.success(
                    tier.active
                      ? "Razred je arhiviran; majstori u njemu dobijaju maloprodajne cene."
                      : "Razred je aktiviran.",
                    {
                      action: {
                        label: "Poništi",
                        onClick: () => void setActive({ tierId: tier._id, active: tier.active }),
                      },
                    },
                  ),
                )
              }
            >
              {tier.active ? "Arhiviraj" : "Aktiviraj"}
            </Button>
          ) : null
        }
      >
        <fieldset disabled={!canEdit} className="flex flex-col gap-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Naziv" className="md:col-span-2">
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                maxLength={40}
              />
            </Field>
            <Field label="Redosled">
              <Input
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                inputMode="numeric"
              />
            </Field>
            <Field label="Osnovni rabat">
              <Input
                value={form.percent}
                onChange={(e) => setForm({ ...form, percent: e.target.value })}
                suffix="%"
                inputMode="decimal"
                inputClassName="text-right tabular-nums"
              />
            </Field>
            <Field label="Minimalna marža" help={`Prazno: ${formatBp(globalMin)} iz podešavanja`}>
              <Input
                value={form.minMargin}
                onChange={(e) => setForm({ ...form, minMargin: e.target.value })}
                suffix="%"
                inputMode="decimal"
                inputClassName="text-right tabular-nums"
              />
            </Field>
            <div className="flex items-end">
              <Switch
                label="Podrazumevan kod odobrenja"
                checked={form.isDefault}
                onCheckedChange={(v) => setForm({ ...form, isDefault: v })}
                className="w-full"
              />
            </div>
          </div>
          <Field label="Opis za stranicu „Za majstore“">
            <Textarea
              rows={2}
              maxLength={200}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>
          <div className="grid gap-6 lg:grid-cols-2">
            <RulesEditor
              label="Izuzeci po kategoriji"
              add="Dodaj kategoriju"
              options={catOptions}
              rows={form.categoryRules}
              onChange={(r) => setForm({ ...form, categoryRules: r })}
              disabled={!canEdit}
            />
            <RulesEditor
              label="Izuzeci po proizvođaču"
              add="Dodaj proizvođača"
              options={manOptions}
              rows={form.manufacturerRules}
              onChange={(r) => setForm({ ...form, manufacturerRules: r })}
              disabled={!canEdit}
            />
          </div>
        </fieldset>
      </Section>
      <Section title="Primer cene">
        <div className="flex flex-col gap-3">
          <Field label="Maloprodajna cena sa PDV-om">
            <Input
              value={example.price}
              onChange={(e) => setExample({ ...example, price: e.target.value })}
              suffix="RSD"
              inputMode="decimal"
              inputClassName="text-right tabular-nums"
              className="h-9"
            />
          </Field>
          <Field label="Nabavna bez PDV-a">
            <Input
              value={example.cost}
              onChange={(e) => setExample({ ...example, cost: e.target.value })}
              suffix="RSD"
              inputMode="decimal"
              inputClassName="text-right tabular-nums"
              className="h-9"
            />
          </Field>
          <Field label="Kategorija">
            <Select
              size="sm"
              placeholder="Bilo koja"
              value={example.categoryId}
              onChange={(e) => setExample({ ...example, categoryId: e.target.value })}
              options={catOptions}
            />
          </Field>
          <Field label="Proizvođač">
            <Select
              size="sm"
              placeholder="Bilo koji"
              value={example.manufacturerId}
              onChange={(e) => setExample({ ...example, manufacturerId: e.target.value })}
              options={manOptions}
            />
          </Field>
          <div className="mt-2 rounded-md bg-surface-2 p-3" aria-live="polite">
            <p className="type-caption text-ink-3">
              {tier ? tier.name : "Novi razred"} (sa izmenama)
            </p>
            {editing ? (
              <p className="flex items-baseline gap-2">
                <span className="type-numeral-l leading-none">
                  {formatRSD(editing.unitPricePara)}
                </span>
                <span className="type-body-s text-ink-2">−{formatBp(editing.discountBp)}</span>
                {editing.marginGuardApplied ? <Badge tone="warning">zaštita marže</Badge> : null}
              </p>
            ) : (
              <p className="type-body-s text-ink-3">Upišite cenu i rabat.</p>
            )}
          </div>
          <table className="w-full border-collapse type-body-s">
            <caption className="sr-only">Cena po razredima za primer</caption>
            <tbody>
              {tiers
                .filter((t) => t.active)
                .map((t) => {
                  const r = priceFor({
                    defaultDiscountBp: t.defaultDiscountBp,
                    categoryRules: t.categoryRules,
                    manufacturerRules: t.manufacturerRules,
                    ...(t.minMarginBp !== null ? { minMarginBp: t.minMarginBp } : {}),
                  });
                  return (
                    <tr key={t._id} className="border-b border-line-faint">
                      <th scope="row" className="py-1.5 text-left font-normal text-ink-2">
                        {t.name}
                      </th>
                      <td className="py-1.5 text-right tabular-nums">
                        {r ? formatRSD(r.unitPricePara) : "—"}
                      </td>
                      <td className="py-1.5 pl-2 text-right type-caption tabular-nums text-ink-3">
                        {r ? `−${formatBp(r.discountBp)}` : ""}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </Section>
      {canEdit ? (
        <SaveBar
          dirty={dirty || !tier}
          saving={saving}
          onSave={() => void save()}
          onDiscard={() => setForm(initial)}
          saveLabel={tier ? "Sačuvaj" : "Napravi razred"}
        />
      ) : null}
    </div>
  );
}
