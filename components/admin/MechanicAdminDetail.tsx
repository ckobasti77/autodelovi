"use client";

/**
 * `/admin/majstori/[id]`: registration data on the left, the decision on the right —
 * approve with a tier (+ optional personal rabat and per-category / per-manufacturer
 * exceptions, credit flag, limit, payment terms), reject with a reason, suspend, reactivate,
 * reopen. Every action is a staff mutation that emits `mechanic.*` (e-mails in step 18) and
 * is audited.
 */
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState } from "react";
import { ArrowLeftIcon, PlusIcon, TrashIcon, WarningCircleIcon } from "@phosphor-icons/react/dist/ssr";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { formatRSD } from "@/lib/format/money";
import { formatPhone } from "@/lib/format/phone";
import { MECHANIC_STATUS_LABEL, MECHANIC_STATUS_TONE, SERVICE_TYPE_LABEL } from "@/lib/i18n/sr/mechanic";
import { convexErrorMessage } from "@/lib/i18n/sr/shop";
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
import { MECHANIC_STATUS_ICON } from "@/components/admin/MechanicsAdminList";
import { ROUTES } from "@/constants/routes";
import { TEST_IDS } from "@/constants/testIds";

type Option = { id: string; name: string };

type RuleRow = { id: string; percent: string };

type Terms = {
  tierId: string;
  personalPercent: string;
  categoryRules: RuleRow[];
  manufacturerRules: RuleRow[];
  creditEnabled: boolean;
  creditLimit: string;
  paymentTermsDays: string;
};

const toPercent = (bp: number | undefined | null) => (bp === undefined || bp === null ? "" : String(bp / 100).replace(".", ","));

/** „12,5“ → 1250 bp; empty → undefined; invalid → NaN (caught by validation). */
function toBp(text: string): number | undefined {
  const t = text.trim().replace(",", ".");
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n * 100) : Number.NaN;
}

function RulesEditor({
  label,
  addLabel,
  options,
  rows,
  onChange,
}: {
  label: string;
  addLabel: string;
  options: Option[];
  rows: RuleRow[];
  onChange: (rows: RuleRow[]) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-2">
      <span className="type-caption text-ink-2">{label}</span>
      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-[minmax(0,1fr)_6rem_auto] items-center gap-2">
          <Select
            aria-label={`${label}: izbor ${i + 1}`}
            size="sm"
            placeholder="Izaberite"
            value={row.id}
            options={options.map((o) => ({ value: o.id, label: o.name }))}
            onChange={(e) => onChange(rows.map((r, j) => (j === i ? { ...r, id: e.target.value } : r)))}
          />
          <Input
            aria-label={`${label}: rabat ${i + 1}`}
            inputMode="decimal"
            suffix="%"
            value={row.percent}
            onChange={(e) => onChange(rows.map((r, j) => (j === i ? { ...r, percent: e.target.value } : r)))}
            className="h-9"
          />
          <IconButton
            label={`Ukloni izuzetak ${i + 1}`}
            icon={<TrashIcon size={16} />}
            variant="ghost"
            onClick={() => onChange(rows.filter((_, j) => j !== i))}
          />
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        icon={<PlusIcon size={16} />}
        className="self-start"
        onClick={() => onChange([...rows, { id: "", percent: "" }])}
      >
        {addLabel}
      </Button>
    </div>
  );
}

type Detail = NonNullable<FunctionReturnType<typeof api.mechanicsAdmin.get>>;
type Tier = FunctionReturnType<typeof api.pricing.listTiers>[number];

function initialTerms(data: Detail, tiers: Tier[]): Terms {
  const rules = data.personalRules;
  const defaultTier = tiers.find((t) => t.isDefault && t.active) ?? tiers.find((t) => t.active);
  return {
    tierId: data.profile.tierId ?? defaultTier?._id ?? "",
    personalPercent: toPercent(rules?.defaultDiscountBp),
    categoryRules: (rules?.categoryRules ?? []).map((r) => ({ id: r.categoryId, percent: toPercent(r.discountBp) })),
    manufacturerRules: (rules?.manufacturerRules ?? []).map((r) => ({ id: r.manufacturerId, percent: toPercent(r.discountBp) })),
    creditEnabled: data.profile.creditEnabled,
    creditLimit: data.creditLimitPara !== null ? String(data.creditLimitPara / 100) : "",
    paymentTermsDays: String(data.paymentTermsDays),
  };
}

export function MechanicAdminDetail({
  profileId,
  categories,
  manufacturers,
}: {
  profileId: string;
  categories: Option[];
  manufacturers: Option[];
}) {
  const data = useQuery(api.mechanicsAdmin.get, { profileId: profileId as Id<"mechanicProfiles"> });
  const tiers = useQuery(api.pricing.listTiers, {});
  if (data === undefined || tiers === undefined) {
    return (
      <SkeletonRegion>
        <Skeleton className="h-[32rem] w-full" />
      </SkeletonRegion>
    );
  }
  if (data === null) return <p className="type-body text-ink-2">Registracija ne postoji.</p>;
  return (
    <DetailView
      key={`${data.profile._id}:${data.profile.status}`}
      data={data}
      tiers={tiers}
      categories={categories}
      manufacturers={manufacturers}
    />
  );
}

function DetailView({
  data,
  tiers,
  categories,
  manufacturers,
}: {
  data: Detail;
  tiers: Tier[];
  categories: Option[];
  manufacturers: Option[];
}) {
  const id = data.profile._id;
  const approve = useMutation(api.mechanicsAdmin.approve);
  const update = useMutation(api.mechanicsAdmin.update);
  const reject = useMutation(api.mechanicsAdmin.reject);
  const suspend = useMutation(api.mechanicsAdmin.suspend);
  const reactivate = useMutation(api.mechanicsAdmin.reactivate);
  const reopen = useMutation(api.mechanicsAdmin.reopen);

  const [terms, setTerms] = useState<Terms>(() => initialTerms(data, tiers));
  const [reason, setReason] = useState("");
  const [note, setNote] = useState(data.internalNote ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const p = data.profile;
  const set = (patch: Partial<Terms>) => setTerms({ ...terms, ...patch });

  const buildTerms = () => {
    const personalDefault = toBp(terms.personalPercent);
    const cat = terms.categoryRules.filter((r) => r.id).map((r) => ({ categoryId: r.id as Id<"categories">, discountBp: toBp(r.percent) ?? Number.NaN }));
    const man = terms.manufacturerRules.filter((r) => r.id).map((r) => ({ manufacturerId: r.id as Id<"manufacturers">, discountBp: toBp(r.percent) ?? Number.NaN }));
    const bps = [personalDefault, ...cat.map((c) => c.discountBp), ...man.map((m) => m.discountBp)].filter((b) => b !== undefined);
    if (bps.some((b) => Number.isNaN(b) || b! < 0 || b! > 9_000)) throw new Error("Rabat mora biti broj između 0 i 90 %.");
    const limitText = terms.creditLimit.trim().replace(/\./g, "").replace(",", ".");
    const limit = limitText ? Math.round(Number(limitText) * 100) : undefined;
    if (limit !== undefined && (!Number.isFinite(limit) || limit < 0)) throw new Error("Limit mora biti iznos u dinarima.");
    const days = Number(terms.paymentTermsDays);
    if (!Number.isInteger(days) || days < 0 || days > 90) throw new Error("Rok plaćanja je od 0 do 90 dana.");
    const hasPersonal = personalDefault !== undefined || cat.length > 0 || man.length > 0;
    return {
      personalRules: hasPersonal
        ? {
            ...(personalDefault !== undefined ? { defaultDiscountBp: personalDefault } : {}),
            ...(cat.length ? { categoryRules: cat } : {}),
            ...(man.length ? { manufacturerRules: man } : {}),
          }
        : undefined,
      creditLimitPara: limit,
      paymentTermsDays: days,
    };
  };

  const run = async (key: string, action: () => Promise<unknown>, success: string) => {
    setBusy(key);
    setError(null);
    try {
      await action();
      toast.success(success);
    } catch (err) {
      const message = err instanceof Error && !("data" in err) ? err.message : convexErrorMessage(err, "Radnja nije uspela.");
      setError(message);
    } finally {
      setBusy(null);
    }
  };

  const onApprove = () =>
    run(
      "approve",
      async () => {
        if (!terms.tierId) throw new Error("Izaberite nivo rabata.");
        const t = buildTerms();
        await approve({
          profileId: id,
          tierId: terms.tierId as Id<"priceTiers">,
          ...(t.personalRules ? { personalRules: t.personalRules } : {}),
          creditEnabled: terms.creditEnabled,
          ...(t.creditLimitPara !== undefined ? { creditLimitPara: t.creditLimitPara } : {}),
          paymentTermsDays: t.paymentTermsDays,
        });
      },
      "Nalog je odobren. Majstor vidi svoje cene odmah.",
    );

  const onUpdate = () =>
    run(
      "update",
      async () => {
        const t = buildTerms();
        await update({
          profileId: id,
          ...(terms.tierId ? { tierId: terms.tierId as Id<"priceTiers"> } : {}),
          personalRules: t.personalRules ?? null,
          creditEnabled: terms.creditEnabled,
          creditLimitPara: t.creditLimitPara ?? null,
          paymentTermsDays: t.paymentTermsDays,
        });
      },
      "Uslovi su sačuvani.",
    );

  const tierOptions = tiers.filter((t) => t.active).map((t) => ({ value: t._id, label: `${t.name} · ${t.defaultDiscountBp / 100} %` }));
  const editable = p.status === "pending" || p.status === "approved" || p.status === "suspended";
  const source = data.attribution?.first ?? data.attribution?.last;

  return (
    <div className="flex flex-col gap-6" data-reveal="off">
      <RouteLink href={ROUTES.adminMechanics} className="inline-flex min-h-11 items-center gap-2 self-start type-body-s text-ink-2 hover:text-ink-1">
        <ArrowLeftIcon size={16} aria-hidden="true" />
        Svi majstori
      </RouteLink>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="type-h1 text-ink-1">{p.companyName}</h1>
        <Badge tone={MECHANIC_STATUS_TONE[p.status]} icon={MECHANIC_STATUS_ICON[p.status]} size="text">
          {MECHANIC_STATUS_LABEL[p.status]}
        </Badge>
        {p.isDemo ? <Badge tone="outline">Demo</Badge> : null}
      </div>

      <div className="grid gap-8 lg:grid-cols-12 lg:gap-x-(--gutter)">
        <section aria-labelledby="ad-data" className="flex flex-col gap-6 lg:col-span-6">
          <h2 id="ad-data" className="sr-only">
            Podaci servisa
          </h2>
          <dl className="grid grid-cols-[9rem_minmax(0,1fr)] gap-x-6 gap-y-3 rounded-sm bg-surface-1 p-5 shadow-[0_1px_2px_rgb(18_21_24/.10),0_8px_24px_-6px_rgb(18_21_24/.18)]">
            <dt className="type-caption text-ink-3">PIB</dt>
            <dd className="type-code text-ink-1">{p.pib}</dd>
            <dt className="type-caption text-ink-3">Matični broj</dt>
            <dd className="type-code text-ink-1">{data.mb}</dd>
            <dt className="type-caption text-ink-3">Adresa</dt>
            <dd className="type-body-s text-ink-1">
              {data.address}, {p.city}
            </dd>
            <dt className="type-caption text-ink-3">Kontakt</dt>
            <dd className="type-body-s text-ink-1">
              {p.contactPerson} ·{" "}
              <a href={`tel:${p.phone}`} className="underline decoration-line-strong underline-offset-4">
                {formatPhone(p.phone)}
              </a>
            </dd>
            <dt className="type-caption text-ink-3">E-pošta</dt>
            <dd className="break-all type-body-s text-ink-1">
              <a href={`mailto:${p.email}`} className="underline decoration-line-strong underline-offset-4">
                {p.email}
              </a>
              {data.userEmail && data.userEmail !== p.email ? <span className="text-ink-3"> · nalog {data.userEmail}</span> : null}
            </dd>
            <dt className="type-caption text-ink-3">Vrsta servisa</dt>
            <dd className="type-body-s text-ink-1">{data.serviceTypes.map((s) => SERVICE_TYPE_LABEL[s]).join(", ")}</dd>
            <dt className="type-caption text-ink-3">Marke</dt>
            <dd className="type-body-s text-ink-1">{data.brandNames.length ? data.brandNames.join(", ") : "—"}</dd>
            <dt className="type-caption text-ink-3">Registrovan</dt>
            <dd className="type-body-s tabular-nums text-ink-1">{formatDateTime(p.createdAt)}</dd>
            {p.reviewedAt ? (
              <>
                <dt className="type-caption text-ink-3">Poslednja odluka</dt>
                <dd className="type-body-s tabular-nums text-ink-1">{formatDate(p.reviewedAt)}</dd>
              </>
            ) : null}
            <dt className="type-caption text-ink-3">Porudžbine</dt>
            <dd className="type-body-s tabular-nums text-ink-1">
              {data.orderCount}
              {data.credit.openCount > 0 ? ` · otvoreno odloženo ${formatRSD(data.credit.usedPara)}` : ""}
            </dd>
            {source ? (
              <>
                <dt className="type-caption text-ink-3">Izvor</dt>
                <dd className="break-all type-body-s text-ink-1">
                  {[source.source, source.medium, source.campaign, source.gclid ? "gclid" : null, source.fbclid ? "fbclid" : null, source.landingPath]
                    .filter(Boolean)
                    .join(" · ") || "direktno"}
                </dd>
              </>
            ) : null}
            {data.rejectionReason ? (
              <>
                <dt className="type-caption text-ink-3">Razlog odbijanja</dt>
                <dd className="type-body-s text-ink-1">{data.rejectionReason}</dd>
              </>
            ) : null}
          </dl>
          <div className="flex flex-col gap-2">
            <Field label="Interna beleška" help="Vidi samo osoblje.">
              <Textarea rows={3} maxLength={1_000} value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
            <Button
              variant="secondary"
              size="sm"
              className="self-start"
              loading={busy === "note"}
              onClick={() => void run("note", () => update({ profileId: id, internalNote: note }), "Beleška je sačuvana.")}
            >
              Sačuvaj belešku
            </Button>
          </div>
        </section>

        <section aria-labelledby="ad-decision" className="flex flex-col gap-6 lg:col-span-6">
          <h2 id="ad-decision" className="type-h3 text-ink-1">
            {p.status === "pending" ? "Odluka" : "Uslovi"}
          </h2>
          {error ? (
            <p role="alert" className="flex items-start gap-2 rounded-sm bg-danger-subtle p-3 type-body-s text-danger">
              <WarningCircleIcon size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
              {error}
            </p>
          ) : null}
          {editable ? (
            <div className="flex flex-col gap-5 rounded-sm bg-surface-1 p-5 shadow-[0_1px_2px_rgb(18_21_24/.10),0_8px_24px_-6px_rgb(18_21_24/.18)]">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Nivo rabata">
                  <Select value={terms.tierId} placeholder="Izaberite" options={tierOptions} onChange={(e) => set({ tierId: e.target.value })} />
                </Field>
                <Field label="Lični osnovni rabat" optional help="Menja osnovni rabat nivoa samo za ovaj servis.">
                  <Input inputMode="decimal" suffix="%" value={terms.personalPercent} onChange={(e) => set({ personalPercent: e.target.value })} />
                </Field>
              </div>
              <RulesEditor
                label="Lični izuzeci po kategoriji"
                addLabel="Dodaj kategoriju"
                options={categories}
                rows={terms.categoryRules}
                onChange={(categoryRules) => set({ categoryRules })}
              />
              <RulesEditor
                label="Lični izuzeci po proizvođaču"
                addLabel="Dodaj proizvođača"
                options={manufacturers}
                rows={terms.manufacturerRules}
                onChange={(manufacturerRules) => set({ manufacturerRules })}
              />
              <div className="flex flex-col gap-4 border-t border-line pt-4">
                <Switch
                  label="Odloženo plaćanje"
                  description="Majstor u porudžbini može da izabere plaćanje po roku."
                  checked={terms.creditEnabled}
                  onCheckedChange={(c) => set({ creditEnabled: c })}
                />
                {terms.creditEnabled ? (
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field label="Limit" optional help="Prazno = bez limita.">
                      <Input inputMode="decimal" suffix="RSD" value={terms.creditLimit} onChange={(e) => set({ creditLimit: e.target.value })} />
                    </Field>
                    <Field label="Rok plaćanja">
                      <Input inputMode="numeric" suffix="dana" value={terms.paymentTermsDays} onChange={(e) => set({ paymentTermsDays: e.target.value })} />
                    </Field>
                  </div>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-3 border-t border-line pt-4">
                {p.status === "pending" ? (
                  <Button loading={busy === "approve"} onClick={() => void onApprove()} data-testid={TEST_IDS.adminMechanicApprove}>
                    Odobri nalog
                  </Button>
                ) : (
                  <Button loading={busy === "update"} onClick={() => void onUpdate()}>
                    Sačuvaj uslove
                  </Button>
                )}
                {p.status === "suspended" ? (
                  <Button variant="secondary" loading={busy === "reactivate"} onClick={() => void run("reactivate", () => reactivate({ profileId: id }), "Nalog je ponovo aktivan.")}>
                    Aktiviraj ponovo
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}

          {p.status === "pending" || p.status === "approved" ? (
            <div className="flex flex-col gap-3 rounded-sm border border-line p-5">
              <Field
                label={p.status === "pending" ? "Razlog odbijanja" : "Razlog pauze"}
                help={p.status === "pending" ? "Majstor dobija razlog e-poštom." : "Nije obavezno; majstor vidi maloprodajne cene dok je nalog pauziran."}
              >
                <Textarea rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
              </Field>
              {p.status === "pending" ? (
                <Button
                  variant="danger"
                  className="self-start"
                  loading={busy === "reject"}
                  data-testid={TEST_IDS.adminMechanicReject}
                  onClick={() => void run("reject", () => reject({ profileId: id, reason }), "Registracija je odbijena.")}
                >
                  Odbij registraciju
                </Button>
              ) : (
                <Button
                  variant="danger"
                  className="self-start"
                  loading={busy === "suspend"}
                  onClick={() => void run("suspend", () => suspend({ profileId: id, ...(reason.trim() ? { reason } : {}) }), "Nalog je pauziran.")}
                >
                  Pauziraj nalog
                </Button>
              )}
            </div>
          ) : null}

          {p.status === "rejected" ? (
            <div className="flex flex-col items-start gap-3 rounded-sm border border-line p-5">
              <p className="type-body-s text-ink-2">Registracija je odbijena. Ako su podaci ispravljeni, vratite je na čekanje i odlučite ponovo.</p>
              <Button variant="secondary" loading={busy === "reopen"} onClick={() => void run("reopen", () => reopen({ profileId: id }), "Registracija je vraćena na čekanje.")}>
                Vrati na čekanje
              </Button>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
