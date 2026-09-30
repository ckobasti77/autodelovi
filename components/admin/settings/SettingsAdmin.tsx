"use client";

/**
 * `/admin/podesavanja?tab=` — owner-editable settings, one section per save (audited,
 * `settings.changed`): Firma, Radno vreme, Prodaja (commerce, delivery, payment, couriers),
 * Obaveštenja (+ own preferences for every staff member), SEO, Praćenje (GA4, Google Ads,
 * Meta), Pravni tekstovi (Markdown with a live preview), Funkcije (flags), Opasna zona
 * (demo data removal with a typed confirmation). Staff see everything read-only.
 */
import { useMutation, useQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { useState, type ReactNode } from "react";
import { PlusIcon, TrashIcon, WarningIcon } from "@phosphor-icons/react/dist/ssr";

import { api } from "@/convex/_generated/api";
import { fillPlaceholders } from "@/lib/content/placeholders";
import { Markdown } from "@/lib/content/markdown";
import { moneyInputValue, parseMoneyInput, parsePercent } from "@/lib/admin/format";
import { formatDate } from "@/lib/format/date";
import { normalizePhone } from "@/lib/format/phone";
import { ADMIN_COPY, WEEKDAY_LABEL } from "@/lib/i18n/sr/admin";
import { convexErrorMessage } from "@/lib/i18n/sr/shop";
import { placeholderValues } from "@/lib/settings/public";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Field } from "@/components/ui/Field";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { Tabs } from "@/components/ui/Tabs";
import { Textarea } from "@/components/ui/Textarea";
import { toast } from "@/components/ui/Toast";

import { ConfirmDialog, useConfirm } from "../ConfirmDialog";
import { useAdminShell } from "../shell/context";
import { PageHeader, SaveBar, Section } from "../ui";
import { useUrlFilters } from "../useUrlFilters";

type Settings = FunctionReturnType<typeof api.settings.getAdmin>;
type Update = FunctionArgs<typeof api.settings.updateSection>["update"];
type SectionName = Update["section"];

/** Draft of one settings section + dirty flag + owner-only save. */
function useSection<T>(section: SectionName, value: T) {
  const updateSection = useMutation(api.settings.updateSection);
  const [draft, setDraft] = useState<T>(value);
  const [base, setBase] = useState(value);
  const [saving, setSaving] = useState(false);
  if (JSON.stringify(base) !== JSON.stringify(value)) {
    // Saved elsewhere (or by us): follow the server when there are no local edits.
    if (JSON.stringify(draft) === JSON.stringify(base)) setDraft(value);
    setBase(value);
  }
  const dirty = JSON.stringify(draft) !== JSON.stringify(base);
  const save = async (next: T = draft) => {
    setSaving(true);
    try {
      await updateSection({ update: { section, value: next } as Update });
      toast.success(ADMIN_COPY.saved);
    } catch (err) {
      toast.error(convexErrorMessage(err, ADMIN_COPY.genericError));
    } finally {
      setSaving(false);
    }
  };
  return { draft, setDraft, dirty, saving, save, reset: () => setDraft(base) };
}

function Group({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Section title={title}>
      {description ? <p className="mb-4 type-body-s text-ink-3">{description}</p> : null}
      {children}
    </Section>
  );
}

const opt = (s: string) => (s.trim() ? s.trim() : undefined);

export function SettingsAdmin() {
  const settings = useQuery(api.settings.getAdmin, {});
  const { viewer } = useAdminShell();
  const [f, setF] = useUrlFilters(["tab"] as const);
  const tab = f.tab || "firma";
  if (!settings) return <Skeleton className="h-[640px] w-full" />;
  const can = viewer.isOwner;
  const tabs = [
    { value: "firma", label: "Firma", content: <CompanyTab s={settings} can={can} /> },
    { value: "radno-vreme", label: "Radno vreme", content: <HoursTab s={settings} can={can} /> },
    {
      value: "prodaja",
      label: "Dostava i plaćanje",
      content: <CommerceTab s={settings} can={can} />,
    },
    {
      value: "obavestenja",
      label: "Obaveštenja",
      content: <NotificationsTab s={settings} can={can} />,
    },
    { value: "seo", label: "SEO", content: <SeoTab s={settings} can={can} /> },
    { value: "pracenje", label: "Praćenje", content: <TrackingTab s={settings} can={can} /> },
    {
      value: "pravni-tekstovi",
      label: "Pravni tekstovi",
      content: <LegalTab s={settings} can={can} />,
    },
    { value: "funkcije", label: "Funkcije", content: <FlagsTab s={settings} can={can} /> },
    ...(can ? [{ value: "opasna-zona", label: "Opasna zona", content: <DangerTab /> }] : []),
  ];
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Podešavanja"
        description={`Poslednja izmena: ${settings.updatedAt ? formatDate(settings.updatedAt) : "još nema."}${can ? "" : ` ${ADMIN_COPY.ownerOnly}`}`}
      />
      <Tabs
        label="Podešavanja"
        value={tab}
        onValueChange={(v) => setF({ tab: v })}
        items={tabs.map((t) => ({
          ...t,
          content: <div className="mt-5 flex flex-col gap-6">{t.content}</div>,
        }))}
      />
    </div>
  );
}

function CompanyTab({ s, can }: { s: Settings; can: boolean }) {
  const company = useSection("company", s.company);
  const brand = useSection("brand", s.brand);
  const facts = useSection("trustFacts", s.trustFacts);
  const c = company.draft;
  const setC = (patch: Partial<typeof c>) => company.setDraft({ ...c, ...patch });
  const phoneErrors = c.phones.map((p) =>
    p.e164 && !normalizePhone(p.e164) ? "Neispravan broj" : undefined,
  );
  return (
    <fieldset disabled={!can} className="flex flex-col gap-6">
      <Group
        title="Podaci o firmi"
        description="Prikazuju se u podnožju, na predračunu, otpremnici i u pravnim tekstovima. Prazno polje se ne prikazuje."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Pun naziv (iz APR-a)">
            <Input
              value={c.legalName}
              onChange={(e) => setC({ legalName: e.target.value })}
              data-testid="admin-settings-legal-name"
            />
          </Field>
          <Field label="Kratak naziv">
            <Input
              value={c.displayName ?? ""}
              onChange={(e) => setC({ displayName: opt(e.target.value) })}
            />
          </Field>
          <Field label="PIB">
            <Input
              value={c.pib ?? ""}
              onChange={(e) => setC({ pib: opt(e.target.value) })}
              inputMode="numeric"
              inputClassName="font-mono"
            />
          </Field>
          <Field label="Matični broj">
            <Input
              value={c.mb ?? ""}
              onChange={(e) => setC({ mb: opt(e.target.value) })}
              inputMode="numeric"
              inputClassName="font-mono"
            />
          </Field>
          <Field label="Ulica i broj">
            <Input
              value={c.address.street}
              onChange={(e) => setC({ address: { ...c.address, street: e.target.value } })}
            />
          </Field>
          <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3">
            <Field label="Poštanski broj">
              <Input
                value={c.address.postalCode}
                onChange={(e) => setC({ address: { ...c.address, postalCode: e.target.value } })}
                inputMode="numeric"
              />
            </Field>
            <Field label="Mesto">
              <Input
                value={c.address.city}
                onChange={(e) => setC({ address: { ...c.address, city: e.target.value } })}
              />
            </Field>
          </div>
          <Field label="E-pošta">
            <Input
              type="email"
              value={c.email ?? ""}
              onChange={(e) => setC({ email: opt(e.target.value) })}
            />
          </Field>
          <Field label="Link ka mapi" help="Google Maps link radnje.">
            <Input value={c.mapUrl ?? ""} onChange={(e) => setC({ mapUrl: opt(e.target.value) })} />
          </Field>
          <Field label="Viber broj">
            <Input
              value={c.viber ?? ""}
              onChange={(e) => setC({ viber: opt(e.target.value) })}
              inputMode="tel"
            />
          </Field>
          <Field label="WhatsApp broj">
            <Input
              value={c.whatsapp ?? ""}
              onChange={(e) => setC({ whatsapp: opt(e.target.value) })}
              inputMode="tel"
            />
          </Field>
          <Field
            label="Napomena o registraciji"
            help="npr. „Registrovano u APR, BD 12345/2020“"
            className="md:col-span-2"
          >
            <Input
              value={c.registryNote ?? ""}
              onChange={(e) => setC({ registryNote: opt(e.target.value) })}
            />
          </Field>
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 type-body-s font-semibold">Telefoni</legend>
            {c.phones.map((p, i) => (
              <div
                key={i}
                className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)_auto] items-start gap-2"
              >
                <Input
                  aria-label={`Oznaka telefona ${i + 1}`}
                  value={p.label}
                  placeholder="Prodaja"
                  onChange={(e) =>
                    setC({
                      phones: c.phones.map((x, j) =>
                        j === i ? { ...x, label: e.target.value } : x,
                      ),
                    })
                  }
                  className="h-9"
                />
                <Field label={`Broj ${i + 1}`} hideLabel error={phoneErrors[i]}>
                  <Input
                    value={p.e164}
                    placeholder="064 123 4567"
                    onChange={(e) =>
                      setC({
                        phones: c.phones.map((x, j) =>
                          j === i ? { ...x, e164: e.target.value } : x,
                        ),
                      })
                    }
                    onBlur={() => {
                      const n = normalizePhone(p.e164);
                      if (n)
                        setC({ phones: c.phones.map((x, j) => (j === i ? { ...x, e164: n } : x)) });
                    }}
                    inputMode="tel"
                    className="h-9"
                  />
                </Field>
                <IconButton
                  label={`Ukloni telefon ${i + 1}`}
                  icon={<TrashIcon size={16} />}
                  size="sm"
                  onClick={() => setC({ phones: c.phones.filter((_, j) => j !== i) })}
                />
              </div>
            ))}
            <Button
              variant="ghost"
              size="sm"
              icon={<PlusIcon size={16} />}
              className="self-start"
              onClick={() => setC({ phones: [...c.phones, { label: "Prodaja", e164: "" }] })}
            >
              Dodaj telefon
            </Button>
          </fieldset>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 type-body-s font-semibold">Tekući računi</legend>
            {c.bankAccounts.map((a, i) => (
              <div
                key={i}
                className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_auto] items-center gap-2"
              >
                <Input
                  aria-label={`Banka ${i + 1}`}
                  value={a.bank}
                  placeholder="Banka"
                  onChange={(e) =>
                    setC({
                      bankAccounts: c.bankAccounts.map((x, j) =>
                        j === i ? { ...x, bank: e.target.value } : x,
                      ),
                    })
                  }
                  className="h-9"
                />
                <Input
                  aria-label={`Račun ${i + 1}`}
                  value={a.account}
                  placeholder="160-0000000000000-00"
                  onChange={(e) =>
                    setC({
                      bankAccounts: c.bankAccounts.map((x, j) =>
                        j === i ? { ...x, account: e.target.value } : x,
                      ),
                    })
                  }
                  className="h-9"
                  inputClassName="font-mono"
                />
                <IconButton
                  label={`Ukloni račun ${i + 1}`}
                  icon={<TrashIcon size={16} />}
                  size="sm"
                  onClick={() => setC({ bankAccounts: c.bankAccounts.filter((_, j) => j !== i) })}
                />
              </div>
            ))}
            <Button
              variant="ghost"
              size="sm"
              icon={<PlusIcon size={16} />}
              className="self-start"
              onClick={() => setC({ bankAccounts: [...c.bankAccounts, { bank: "", account: "" }] })}
            >
              Dodaj račun
            </Button>
          </fieldset>
        </div>
        {can ? (
          <SaveBar
            dirty={company.dirty}
            saving={company.saving}
            onSave={() => {
              if (phoneErrors.some(Boolean)) return toast.error("Proverite brojeve telefona.");
              void company.save({
                ...c,
                phones: c.phones
                  .filter((p) => p.e164.trim())
                  .map((p) => ({ ...p, e164: normalizePhone(p.e164) ?? p.e164 })),
              });
            }}
            onDiscard={company.reset}
            message="Podaci o firmi nisu sačuvani."
          />
        ) : null}
      </Group>

      <Group
        title="Brend i brojevi dokumenata"
        description="Naziv i slogan važe svuda na sajtu. Prefiksi određuju izgled brojeva porudžbina (SK-2026-000123) i upita."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Naziv prodavnice">
            <Input
              value={brand.draft.name}
              onChange={(e) => brand.setDraft({ ...brand.draft, name: e.target.value })}
            />
          </Field>
          <Field label="Slogan">
            <Input
              value={brand.draft.tagline}
              onChange={(e) => brand.setDraft({ ...brand.draft, tagline: e.target.value })}
            />
          </Field>
          <Field label="Prefiks porudžbine" help="1–4 velika slova">
            <Input
              value={brand.draft.orderPrefix}
              onChange={(e) =>
                brand.setDraft({ ...brand.draft, orderPrefix: e.target.value.toUpperCase() })
              }
              maxLength={4}
              inputClassName="font-mono"
            />
          </Field>
          <Field label="Prefiks upita" help="1–4 velika slova">
            <Input
              value={brand.draft.inquiryPrefix}
              onChange={(e) =>
                brand.setDraft({ ...brand.draft, inquiryPrefix: e.target.value.toUpperCase() })
              }
              maxLength={4}
              inputClassName="font-mono"
            />
          </Field>
        </div>
        {can ? (
          <SaveBar
            dirty={brand.dirty}
            saving={brand.saving}
            onSave={() => void brand.save()}
            onDiscard={brand.reset}
            message="Brend nije sačuvan."
          />
        ) : null}
      </Group>

      <Group
        title="Činjenice o radnji"
        description="Kratke proverljive činjenice za početnu stranu (npr. „Godina osnivanja — 2009“). Ne upisujte ništa što ne možete dokazati."
      >
        <div className="flex flex-col gap-2">
          {facts.draft.map((fact, i) => (
            <div
              key={i}
              className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2"
            >
              <Input
                aria-label={`Činjenica ${i + 1}, oznaka`}
                value={fact.label}
                placeholder="Oznaka"
                onChange={(e) =>
                  facts.setDraft(
                    facts.draft.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)),
                  )
                }
                className="h-9"
              />
              <Input
                aria-label={`Činjenica ${i + 1}, vrednost`}
                value={fact.value}
                placeholder="Vrednost"
                onChange={(e) =>
                  facts.setDraft(
                    facts.draft.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)),
                  )
                }
                className="h-9"
              />
              <IconButton
                label={`Ukloni činjenicu ${i + 1}`}
                icon={<TrashIcon size={16} />}
                size="sm"
                onClick={() => facts.setDraft(facts.draft.filter((_, j) => j !== i))}
              />
            </div>
          ))}
          {facts.draft.length < 6 ? (
            <Button
              variant="ghost"
              size="sm"
              icon={<PlusIcon size={16} />}
              className="self-start"
              onClick={() => facts.setDraft([...facts.draft, { label: "", value: "" }])}
            >
              Dodaj činjenicu
            </Button>
          ) : null}
        </div>
        {can ? (
          <SaveBar
            dirty={facts.dirty}
            saving={facts.saving}
            onSave={() =>
              void facts.save(facts.draft.filter((x) => x.label.trim() && x.value.trim()))
            }
            onDiscard={facts.reset}
            message="Činjenice nisu sačuvane."
          />
        ) : null}
      </Group>
    </fieldset>
  );
}

function HoursTab({ s, can }: { s: Settings; can: boolean }) {
  const hours = useSection("hours", s.hours);
  const holidays = useSection("holidays", s.holidays);
  const ordered = [1, 2, 3, 4, 5, 6, 0].map(
    (day) =>
      hours.draft.find((h) => h.day === day) ?? {
        day,
        open: "08:00",
        close: "16:00",
        closed: true,
      },
  );
  const setDay = (day: number, patch: Partial<(typeof ordered)[number]>) =>
    hours.setDraft(ordered.map((h) => (h.day === day ? { ...h, ...patch } : h)));
  return (
    <fieldset disabled={!can} className="flex flex-col gap-6">
      <Group
        title="Radno vreme"
        description="Prikazuje se kupcima i računa rokove odgovora na upite (SLA) i podsetnike."
      >
        <table className="w-full max-w-xl border-collapse type-body-s">
          <caption className="sr-only">Radno vreme po danima</caption>
          <tbody>
            {ordered.map((h) => (
              <tr key={h.day} className="border-b border-line-faint">
                <th scope="row" className="w-32 py-2 text-left font-medium">
                  {WEEKDAY_LABEL[h.day]}
                </th>
                <td className="py-2 pr-2">
                  <Checkbox
                    label="Zatvoreno"
                    checked={h.closed}
                    onCheckedChange={(v) => setDay(h.day, { closed: v === true })}
                  />
                </td>
                <td className="py-2">
                  <span className="flex items-center gap-2">
                    <input
                      type="time"
                      aria-label={`${WEEKDAY_LABEL[h.day]}, otvara se`}
                      disabled={h.closed || !can}
                      value={h.open}
                      onChange={(e) => setDay(h.day, { open: e.target.value })}
                      className="h-9 rounded-xs border border-control bg-surface-1 px-2 tabular-nums disabled:opacity-50"
                    />
                    <span aria-hidden="true">–</span>
                    <input
                      type="time"
                      aria-label={`${WEEKDAY_LABEL[h.day]}, zatvara se`}
                      disabled={h.closed || !can}
                      value={h.close}
                      onChange={(e) => setDay(h.day, { close: e.target.value })}
                      className="h-9 rounded-xs border border-control bg-surface-1 px-2 tabular-nums disabled:opacity-50"
                    />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {can ? (
          <SaveBar
            dirty={hours.dirty}
            saving={hours.saving}
            onSave={() => void hours.save(ordered)}
            onDiscard={hours.reset}
            message="Radno vreme nije sačuvano."
          />
        ) : null}
      </Group>
      <Group
        title="Neradni dani"
        description="Praznici i kolektivni odmor (ne računaju se u rokove)."
      >
        <div className="flex flex-col gap-2">
          {holidays.draft.map((h, i) => (
            <div
              key={i}
              className="grid max-w-xl grid-cols-[11rem_minmax(0,1fr)_auto] items-center gap-2"
            >
              <Input
                aria-label={`Datum ${i + 1}`}
                type="date"
                value={h.date}
                onChange={(e) =>
                  holidays.setDraft(
                    holidays.draft.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)),
                  )
                }
                className="h-9"
              />
              <Input
                aria-label={`Opis ${i + 1}`}
                value={h.note}
                placeholder="npr. Nova godina"
                onChange={(e) =>
                  holidays.setDraft(
                    holidays.draft.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)),
                  )
                }
                className="h-9"
              />
              <IconButton
                label={`Ukloni neradni dan ${i + 1}`}
                icon={<TrashIcon size={16} />}
                size="sm"
                onClick={() => holidays.setDraft(holidays.draft.filter((_, j) => j !== i))}
              />
            </div>
          ))}
          <Button
            variant="ghost"
            size="sm"
            icon={<PlusIcon size={16} />}
            className="self-start"
            onClick={() => holidays.setDraft([...holidays.draft, { date: "", note: "" }])}
          >
            Dodaj neradni dan
          </Button>
        </div>
        {can ? (
          <SaveBar
            dirty={holidays.dirty}
            saving={holidays.saving}
            onSave={() =>
              void holidays.save(holidays.draft.filter((h) => /^\d{4}-\d{2}-\d{2}$/.test(h.date)))
            }
            onDiscard={holidays.reset}
            message="Neradni dani nisu sačuvani."
          />
        ) : null}
      </Group>
    </fieldset>
  );
}

function CommerceTab({ s, can }: { s: Settings; can: boolean }) {
  const commerce = useSection("commerce", s.commerce);
  const delivery = useSection("deliveryMethods", s.deliveryMethods);
  const payment = useSection("paymentMethods", s.paymentMethods);
  const couriers = useSection("couriers", s.couriers);
  const c = commerce.draft;
  const [vat, setVat] = useState(String(c.vatRateBp / 100));
  const [minMargin, setMinMargin] = useState(String(c.minMarginBp / 100).replace(".", ","));
  const [freeOver, setFreeOver] = useState(moneyInputValue(c.freeShippingOverPara));
  return (
    <fieldset disabled={!can} className="flex flex-col gap-6">
      <Group title="Prodaja" description="Pravila koja važe za sve porudžbine.">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="PDV">
            <Input
              value={vat}
              onChange={(e) => setVat(e.target.value)}
              suffix="%"
              inputMode="decimal"
            />
          </Field>
          <Field
            label="Minimalna marža"
            help="Rabat majstora nikad ne spušta cenu ispod nabavne + ove marže."
          >
            <Input
              value={minMargin}
              onChange={(e) => setMinMargin(e.target.value)}
              suffix="%"
              inputMode="decimal"
            />
          </Field>
          <Field label="Besplatna dostava preko">
            <Input
              value={freeOver}
              onChange={(e) => setFreeOver(e.target.value)}
              suffix="RSD"
              inputMode="decimal"
            />
          </Field>
          <Field label="Prag „malo na stanju“">
            <Input
              value={String(c.lowStockDefault)}
              onChange={(e) =>
                commerce.setDraft({ ...c, lowStockDefault: Number(e.target.value) || 0 })
              }
              inputMode="numeric"
              suffix="kom."
            />
          </Field>
          <Field label="Ponuda važi">
            <Input
              value={String(c.quoteValidityDays)}
              onChange={(e) =>
                commerce.setDraft({ ...c, quoteValidityDays: Number(e.target.value) || 1 })
              }
              inputMode="numeric"
              suffix="dana"
            />
          </Field>
          <Field
            label="Automatsko završavanje"
            help="Isporučene i preuzete porudžbine se zatvaraju posle roka za odustanak."
          >
            <Input
              value={String(c.autoCompleteDays)}
              onChange={(e) =>
                commerce.setDraft({ ...c, autoCompleteDays: Number(e.target.value) || 1 })
              }
              inputMode="numeric"
              suffix="dana"
            />
          </Field>
          <Field label="Stanje se umanjuje">
            <Select
              value={c.stockDecrementOn}
              onChange={(e) =>
                commerce.setDraft({
                  ...c,
                  stockDecrementOn: e.target.value as typeof c.stockDecrementOn,
                })
              }
              options={[
                { value: "confirmed", label: "Kad potvrdimo porudžbinu" },
                { value: "created", label: "Čim kupac poruči" },
              ]}
            />
          </Field>
          <Field label="Rok za slanje istog dana">
            <Input
              type="time"
              value={c.shipCutoff}
              onChange={(e) => commerce.setDraft({ ...c, shipCutoff: e.target.value })}
            />
          </Field>
          <Field label="Tekst o roku isporuke">
            <Input
              value={c.etaText}
              onChange={(e) => commerce.setDraft({ ...c, etaText: e.target.value })}
            />
          </Field>
        </div>
        <Switch
          className="mt-4 max-w-xl"
          label="Vrati stanje kad se porudžbina otkaže"
          checked={c.restockOnCancel}
          onCheckedChange={(v) => commerce.setDraft({ ...c, restockOnCancel: v })}
        />
        {can ? (
          <SaveBar
            dirty={
              commerce.dirty ||
              vat !== String(s.commerce.vatRateBp / 100) ||
              minMargin !== String(s.commerce.minMarginBp / 100).replace(".", ",") ||
              freeOver !== moneyInputValue(s.commerce.freeShippingOverPara)
            }
            saving={commerce.saving}
            onSave={() => {
              const v = parsePercent(vat);
              const m = parsePercent(minMargin);
              const fo = parseMoneyInput(freeOver);
              if (
                v === undefined ||
                Number.isNaN(v) ||
                m === undefined ||
                Number.isNaN(m) ||
                fo === undefined ||
                Number.isNaN(fo)
              )
                return toast.error("Proverite PDV, maržu i iznos za besplatnu dostavu.");
              void commerce.save({
                ...c,
                vatRateBp: Math.round(v * 100),
                minMarginBp: Math.round(m * 100),
                freeShippingOverPara: fo,
              });
            }}
            onDiscard={() => {
              commerce.reset();
              setVat(String(s.commerce.vatRateBp / 100));
              setMinMargin(String(s.commerce.minMarginBp / 100).replace(".", ","));
              setFreeOver(moneyInputValue(s.commerce.freeShippingOverPara));
            }}
            message="Pravila prodaje nisu sačuvana."
          />
        ) : null}
      </Group>

      <Group title="Načini dostave">
        <div className="flex flex-col gap-4">
          {delivery.draft.map((d, i) => {
            const set = (patch: Partial<typeof d>) =>
              delivery.setDraft(delivery.draft.map((x, j) => (j === i ? { ...x, ...patch } : x)));
            return (
              <div
                key={d.code}
                className="grid gap-3 rounded-sm border border-line p-3 md:grid-cols-[minmax(0,1fr)_9rem_9rem_auto]"
              >
                <Field label="Naziv">
                  <Input
                    value={d.label}
                    onChange={(e) => set({ label: e.target.value })}
                    className="h-9"
                  />
                </Field>
                <Field label="Cena">
                  <Input
                    value={moneyInputValue(d.pricePara)}
                    onChange={(e) => set({ pricePara: parseMoneyInput(e.target.value) ?? 0 })}
                    suffix="RSD"
                    inputMode="decimal"
                    className="h-9"
                  />
                </Field>
                <Field label="Besplatno preko">
                  <Input
                    value={moneyInputValue(d.freeOverPara ?? null)}
                    onChange={(e) => {
                      const v = parseMoneyInput(e.target.value);
                      set({ freeOverPara: v === undefined || Number.isNaN(v) ? undefined : v });
                    }}
                    suffix="RSD"
                    inputMode="decimal"
                    className="h-9"
                  />
                </Field>
                <div className="flex items-end pb-1">
                  <Switch
                    label="Aktivno"
                    checked={d.active}
                    onCheckedChange={(v) => set({ active: v })}
                  />
                </div>
                <Field label="Opis" className="md:col-span-2">
                  <Input
                    value={d.description}
                    onChange={(e) => set({ description: e.target.value })}
                    className="h-9"
                  />
                </Field>
                <Field label="Rok" className="md:col-span-2">
                  <Input
                    value={d.etaText}
                    onChange={(e) => set({ etaText: e.target.value })}
                    className="h-9"
                  />
                </Field>
              </div>
            );
          })}
        </div>
        {can ? (
          <SaveBar
            dirty={delivery.dirty}
            saving={delivery.saving}
            onSave={() => void delivery.save()}
            onDiscard={delivery.reset}
            message="Načini dostave nisu sačuvani."
          />
        ) : null}
      </Group>

      <Group
        title="Načini plaćanja"
        description="Plaćanje virmanom traži podatke firme; odloženo plaćanje samo odobreni majstori sa tom opcijom."
      >
        <div className="flex flex-col gap-3">
          {payment.draft.map((p, i) => {
            const set = (patch: Partial<typeof p>) =>
              payment.setDraft(payment.draft.map((x, j) => (j === i ? { ...x, ...patch } : x)));
            return (
              <div
                key={p.code}
                className="grid gap-3 rounded-sm border border-line p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto]"
              >
                <Field label="Naziv">
                  <Input
                    value={p.label}
                    onChange={(e) => set({ label: e.target.value })}
                    className="h-9"
                  />
                </Field>
                <Field label="Uputstvo kupcu">
                  <Input
                    value={p.instructions}
                    onChange={(e) => set({ instructions: e.target.value })}
                    className="h-9"
                  />
                </Field>
                <div className="flex items-end pb-1">
                  <Switch
                    label="Aktivno"
                    checked={p.active}
                    onCheckedChange={(v) => set({ active: v })}
                  />
                </div>
              </div>
            );
          })}
        </div>
        {can ? (
          <SaveBar
            dirty={payment.dirty}
            saving={payment.saving}
            onSave={() => void payment.save()}
            onDiscard={payment.reset}
            message="Načini plaćanja nisu sačuvani."
          />
        ) : null}
      </Group>

      <Group
        title="Kurirske službe"
        description="Link za praćenje sa {broj} na mestu broja pošiljke, npr. https://…/pracenje?broj={broj}"
      >
        <div className="flex flex-col gap-2">
          {couriers.draft.map((k, i) => (
            <div
              key={k.code}
              className="grid grid-cols-[minmax(0,0.6fr)_minmax(0,1.4fr)] items-center gap-2"
            >
              <Input
                aria-label={`Naziv kurira ${i + 1}`}
                value={k.name}
                onChange={(e) =>
                  couriers.setDraft(
                    couriers.draft.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)),
                  )
                }
                className="h-9"
              />
              <Input
                aria-label={`Link za praćenje, ${k.name}`}
                value={k.trackingUrlTemplate}
                placeholder="https://…{broj}"
                onChange={(e) =>
                  couriers.setDraft(
                    couriers.draft.map((x, j) =>
                      j === i ? { ...x, trackingUrlTemplate: e.target.value } : x,
                    ),
                  )
                }
                className="h-9"
                inputClassName="font-mono"
              />
            </div>
          ))}
        </div>
        {can ? (
          <SaveBar
            dirty={couriers.dirty}
            saving={couriers.saving}
            onSave={() => void couriers.save()}
            onDiscard={couriers.reset}
            message="Kurirske službe nisu sačuvane."
          />
        ) : null}
      </Group>
    </fieldset>
  );
}

function NotificationsTab({ s, can }: { s: Settings; can: boolean }) {
  const n = useSection("notifications", s.notifications);
  const prefs = useQuery(api.notifications.preferences, {});
  const setPrefs = useMutation(api.notifications.setPreferences);
  const [emails, setEmails] = useState(s.notifications.staffEmails.join(", "));
  const d = n.draft;
  const prefRows = [
    ["orderNew", "Nova porudžbina"],
    ["inquiryNew", "Novi upit"],
    ["mechanicNew", "Nova registracija majstora"],
    ["lowStock", "Malo na stanju"],
    ["reminders", "Podsetnici za neodgovorene"],
  ] as const;
  return (
    <div className="flex flex-col gap-6">
      <fieldset disabled={!can}>
        <Group
          title="Obaveštenja osoblju"
          description="E-poruke stižu na ove adrese. Dok slanje e-pošte nije podešeno, sve poruke su u delu E-pošta."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Adrese osoblja" help="Razdvojite zarezom." className="md:col-span-2">
              <Input value={emails} onChange={(e) => setEmails(e.target.value)} />
            </Field>
            <Field
              label="Podsetnik posle"
              help="Radnog vremena bez odgovora na upit ili potvrde porudžbine."
            >
              <Input
                value={String(d.reminderAfterWorkingMinutes)}
                onChange={(e) =>
                  n.setDraft({ ...d, reminderAfterWorkingMinutes: Number(e.target.value) || 30 })
                }
                inputMode="numeric"
                suffix="min"
              />
            </Field>
            <Field label="Dnevni pregled u">
              <Select
                value={String(d.digestHour)}
                onChange={(e) => n.setDraft({ ...d, digestHour: Number(e.target.value) })}
                options={Array.from({ length: 24 }, (_, h) => ({
                  value: String(h),
                  label: `${String(h).padStart(2, "0")}:00`,
                }))}
              />
            </Field>
          </div>
          <div className="mt-4 flex max-w-xl flex-col">
            <Switch
              label="Dnevni pregled e-poštom"
              checked={d.digestEnabled}
              onCheckedChange={(v) => n.setDraft({ ...d, digestEnabled: v })}
            />
            <Switch
              label="E-pošta kad artikla ima malo na stanju"
              checked={d.lowStockEmail}
              onCheckedChange={(v) => n.setDraft({ ...d, lowStockEmail: v })}
            />
          </div>
          {can ? (
            <SaveBar
              dirty={n.dirty || emails !== s.notifications.staffEmails.join(", ")}
              saving={n.saving}
              onSave={() =>
                void n.save({
                  ...d,
                  staffEmails: emails
                    .split(/[,;\s]+/)
                    .map((e) => e.trim())
                    .filter(Boolean),
                })
              }
              onDiscard={() => (n.reset(), setEmails(s.notifications.staffEmails.join(", ")))}
              message="Obaveštenja nisu sačuvana."
            />
          ) : null}
        </Group>
      </fieldset>
      <Group title="Moja obaveštenja" description="Šta vi dobijate — važi samo za vaš nalog.">
        {!prefs ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <table className="w-full max-w-xl border-collapse type-body-s">
            <thead>
              <tr className="border-b border-line text-left type-label uppercase text-ink-3">
                <th scope="col" className="py-2">
                  Događaj
                </th>
                <th scope="col" className="py-2 text-center">
                  U aplikaciji
                </th>
                <th scope="col" className="py-2 text-center">
                  E-pošta
                </th>
              </tr>
            </thead>
            <tbody>
              {prefRows.map(([key, label]) => (
                <tr key={key} className="border-b border-line-faint">
                  <th scope="row" className="py-1 text-left font-normal">
                    {label}
                  </th>
                  {(["inApp", "email"] as const).map((ch) => (
                    <td key={ch} className="py-1 text-center">
                      <span className="inline-flex">
                        <Checkbox
                          label={
                            <span className="sr-only">{`${label}, ${ch === "inApp" ? "u aplikaciji" : "e-pošta"}`}</span>
                          }
                          checked={prefs[ch][key]}
                          onCheckedChange={(v) =>
                            void setPrefs({
                              ...prefs,
                              [ch]: { ...prefs[ch], [key]: v === true },
                            }).then(() => toast.success(ADMIN_COPY.saved))
                          }
                        />
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <th scope="row" className="py-1 text-left font-normal">
                  Dnevni pregled
                </th>
                <td />
                <td className="py-1 text-center">
                  <span className="inline-flex">
                    <Checkbox
                      label={<span className="sr-only">Dnevni pregled, e-pošta</span>}
                      checked={prefs.email.digest}
                      onCheckedChange={(v) =>
                        void setPrefs({ ...prefs, email: { ...prefs.email, digest: v === true } })
                      }
                    />
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </Group>
    </div>
  );
}

function SeoTab({ s, can }: { s: Settings; can: boolean }) {
  const seo = useSection("seo", s.seo);
  const d = seo.draft;
  return (
    <fieldset disabled={!can}>
      <Group
        title="SEO podrazumevano"
        description="Važi za stranice bez sopstvenog naslova i opisa."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="Dodatak naslovu"
            help="Dodaje se iza naslova svake stranice, npr. „ | SKLOP“."
          >
            <Input
              value={d.titleSuffix}
              onChange={(e) => seo.setDraft({ ...d, titleSuffix: e.target.value })}
            />
          </Field>
          <Field label="Najviše indeksiranih odredišnih strana">
            <Input
              value={String(d.maxIndexableLandings)}
              onChange={(e) =>
                seo.setDraft({ ...d, maxIndexableLandings: Number(e.target.value) || 0 })
              }
              inputMode="numeric"
            />
          </Field>
          <Field
            label="Podrazumevani opis"
            help={`${d.defaultDescription.length}/155`}
            className="md:col-span-2"
          >
            <Textarea
              rows={2}
              maxLength={170}
              value={d.defaultDescription}
              onChange={(e) => seo.setDraft({ ...d, defaultDescription: e.target.value })}
            />
          </Field>
          <fieldset className="md:col-span-2">
            <legend className="mb-2 type-body-s font-semibold">
              Najmanje artikala za indeksiranu odredišnu stranu
            </legend>
            <div className="grid grid-cols-3 gap-3">
              {(["brand", "model", "generationPage"] as const).map((k) => (
                <Field
                  key={k}
                  label={
                    {
                      brand: "Kategorija × marka",
                      model: "Kategorija × model",
                      generationPage: "Stranica generacije",
                    }[k]
                  }
                >
                  <Input
                    value={String(d.landingMin[k])}
                    onChange={(e) =>
                      seo.setDraft({
                        ...d,
                        landingMin: { ...d.landingMin, [k]: Number(e.target.value) || 0 },
                      })
                    }
                    inputMode="numeric"
                  />
                </Field>
              ))}
            </div>
          </fieldset>
        </div>
        {can ? (
          <SaveBar
            dirty={seo.dirty}
            saving={seo.saving}
            onSave={() => void seo.save()}
            onDiscard={seo.reset}
            message="SEO podešavanja nisu sačuvana."
          />
        ) : null}
      </Group>
    </fieldset>
  );
}

function TrackingTab({ s, can }: { s: Settings; can: boolean }) {
  const t = useSection("tracking", s.tracking);
  const d = t.draft;
  const errors = {
    ga4Id: d.ga4Id && !/^G-[A-Z0-9]{4,}$/.test(d.ga4Id) ? "Oblik: G-XXXXXXXXXX" : undefined,
    gadsId: d.gadsId && !/^AW-\d{6,}$/.test(d.gadsId) ? "Oblik: AW-123456789" : undefined,
    metaPixelId:
      d.metaPixelId && !/^\d{8,20}$/.test(d.metaPixelId) ? "Samo cifre (15–16)" : undefined,
  };
  return (
    <fieldset disabled={!can}>
      <Group
        title="Praćenje i oglasi"
        description="Sve je isključeno dok je polje prazno. Kodovi se učitavaju tek kad posetilac pristane na kolačiće."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Google Analytics 4 (Measurement ID)" error={errors.ga4Id}>
            <Input
              value={d.ga4Id ?? ""}
              onChange={(e) => t.setDraft({ ...d, ga4Id: opt(e.target.value) })}
              placeholder="G-XXXXXXXXXX"
              inputClassName="font-mono"
              data-testid="admin-settings-ga4"
            />
          </Field>
          <Field label="Google Ads (Conversion ID)" error={errors.gadsId}>
            <Input
              value={d.gadsId ?? ""}
              onChange={(e) => t.setDraft({ ...d, gadsId: opt(e.target.value) })}
              placeholder="AW-123456789"
              inputClassName="font-mono"
            />
          </Field>
          {(["purchase", "lead", "mechanicSignup"] as const).map((k) => (
            <Field
              key={k}
              label={`Google Ads oznaka: ${{ purchase: "porudžbina", lead: "upit", mechanicSignup: "registracija majstora" }[k]}`}
            >
              <Input
                value={d.gadsLabels[k] ?? ""}
                onChange={(e) =>
                  t.setDraft({ ...d, gadsLabels: { ...d.gadsLabels, [k]: opt(e.target.value) } })
                }
                inputClassName="font-mono"
              />
            </Field>
          ))}
          <Field label="Naziv konverzije za offline uvoz">
            <Input
              value={d.gadsOfflineConversionName ?? ""}
              onChange={(e) => t.setDraft({ ...d, gadsOfflineConversionName: opt(e.target.value) })}
            />
          </Field>
          <Field label="Meta Pixel ID" error={errors.metaPixelId}>
            <Input
              value={d.metaPixelId ?? ""}
              onChange={(e) => t.setDraft({ ...d, metaPixelId: opt(e.target.value) })}
              inputMode="numeric"
              inputClassName="font-mono"
            />
          </Field>
          <Field
            label="Meta test event kod"
            help="Samo za proveru u Events Manageru; obrišite posle testa."
          >
            <Input
              value={d.metaTestEventCode ?? ""}
              onChange={(e) => t.setDraft({ ...d, metaTestEventCode: opt(e.target.value) })}
              inputClassName="font-mono"
            />
          </Field>
        </div>
        <Switch
          className="mt-4 max-w-xl"
          label="Meta Conversions API (sa servera)"
          description="Traži pristupni token u podešavanjima servera (vidi uputstvo za pokretanje)."
          checked={d.metaCapiEnabled}
          onCheckedChange={(v) => t.setDraft({ ...d, metaCapiEnabled: v })}
        />
        {can ? (
          <SaveBar
            dirty={t.dirty}
            saving={t.saving}
            onSave={() =>
              Object.values(errors).some(Boolean)
                ? toast.error("Proverite oblik oznaka.")
                : void t.save()
            }
            onDiscard={t.reset}
            message="Praćenje nije sačuvano."
          />
        ) : null}
      </Group>
    </fieldset>
  );
}

function FlagsTab({ s, can }: { s: Settings; can: boolean }) {
  const flags = useSection("flags", s.flags);
  const rows: [keyof Settings["flags"], string, string][] = [
    [
      "publicPrices",
      "Cene vidljive svima",
      "Isključeno: cene vide samo prijavljeni kupci i majstori.",
    ],
    ["guestCheckout", "Poručivanje bez naloga", "Kupac može da poruči bez registracije."],
    ["backInStock", "„Javi mi kad stigne“", "Prijava za obaveštenje kad artikal stigne."],
    ["mechanicRegistration", "Registracija majstora", "Forma na /za-majstore prima nove servise."],
    ["quickOrder", "Brza porudžbina majstora", "Unos liste OEM brojeva u portalu."],
    [
      "threeDHero",
      "3D automobil na početnoj",
      "Isključeno: samo statična slika (brže na slabim uređajima).",
    ],
    [
      "generationLandings",
      "Odredišne strane po generaciji",
      "Dodatne stranice kategorija × generacija (kad ima dovoljno artikala).",
    ],
  ];
  return (
    <fieldset disabled={!can}>
      <Group
        title="Funkcije"
        description="Uključivanje i isključivanje delova sajta bez izmene koda."
      >
        <div className="flex max-w-2xl flex-col divide-y divide-line-faint">
          {rows.map(([key, label, description]) => (
            <Switch
              key={key}
              label={label}
              description={description}
              checked={flags.draft[key]}
              onCheckedChange={(v) => flags.setDraft({ ...flags.draft, [key]: v })}
              className="py-1"
            />
          ))}
        </div>
        {can ? (
          <SaveBar
            dirty={flags.dirty}
            saving={flags.saving}
            onSave={() => void flags.save()}
            onDiscard={flags.reset}
            message="Funkcije nisu sačuvane."
          />
        ) : null}
      </Group>
    </fieldset>
  );
}

function LegalTab({ s, can }: { s: Settings; can: boolean }) {
  const pages = useQuery(api.content.adminPages, {});
  const versions = useSection("legalVersions", s.legalVersions);
  const [slug, setSlug] = useState<string | null>(null);
  const page = pages?.find((p) => p.slug === slug) ?? pages?.[0];
  return (
    <div className="flex flex-col gap-6">
      {!pages ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[240px_minmax(0,1fr)]">
          <Section title="Stranice">
            <ul className="-mx-4 -my-2">
              {pages.map((p) => (
                <li key={p._id}>
                  <button
                    type="button"
                    onClick={() => setSlug(p.slug)}
                    aria-current={page?._id === p._id ? "true" : undefined}
                    className={`flex min-h-11 w-full cursor-pointer flex-col justify-center border-b border-line-faint px-4 text-left type-body-s focus-ring-inset ${page?._id === p._id ? "bg-selected" : "hover:bg-surface-2"}`}
                  >
                    <span>{p.title}</span>
                    <span className="type-caption text-ink-3">
                      v{p.version} {p.needsLegalReview ? "· čeka pravnika" : "· pregledano"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Section>
          {page ? (
            <PageEditor key={`${page._id}:${page.version}`} page={page} settings={s} can={can} />
          ) : null}
        </div>
      )}
      <fieldset disabled={!can}>
        <Group
          title="Verzije pravnih dokumenata"
          description="Datum verzije se čuva uz svaku saglasnost kupca. Promenite ga kad se tekst suštinski izmeni."
        >
          <div className="grid max-w-2xl gap-4 md:grid-cols-3">
            {(["terms", "privacy", "cookies"] as const).map((k) => (
              <Field
                key={k}
                label={
                  {
                    terms: "Uslovi korišćenja",
                    privacy: "Politika privatnosti",
                    cookies: "Kolačići",
                  }[k]
                }
              >
                <Input
                  type="date"
                  value={versions.draft[k]}
                  onChange={(e) => versions.setDraft({ ...versions.draft, [k]: e.target.value })}
                />
              </Field>
            ))}
          </div>
          {can ? (
            <SaveBar
              dirty={versions.dirty}
              saving={versions.saving}
              onSave={() => void versions.save()}
              onDiscard={versions.reset}
              message="Verzije nisu sačuvane."
            />
          ) : null}
        </Group>
      </fieldset>
    </div>
  );
}

function PageEditor({
  page,
  settings,
  can,
}: {
  page: FunctionReturnType<typeof api.content.adminPages>[number];
  settings: Settings;
  can: boolean;
}) {
  const update = useMutation(api.content.updatePage);
  const initial = {
    title: page.title,
    bodyMd: page.bodyMd,
    published: page.published,
    needsLegalReview: page.needsLegalReview,
  };
  const [f, setF] = useState(initial);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(f) !== JSON.stringify(initial);
  const preview = fillPlaceholders(f.bodyMd, placeholderValues(settings));
  return (
    <Section
      title={page.title}
      actions={
        <Badge tone={f.needsLegalReview ? "warning" : "success"}>
          {f.needsLegalReview ? "Čeka pregled pravnika" : "Pregledano"}
        </Badge>
      }
    >
      <fieldset disabled={!can} className="flex flex-col gap-4">
        <Field label="Naslov">
          <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        </Field>
        <div className="grid gap-4 2xl:grid-cols-2">
          <Field
            label="Tekst (Markdown)"
            help="## naslov, - lista, **podebljano**, [link](/putanja). {{firma.naziv}} i slično se popunjava iz podešavanja."
          >
            <Textarea
              rows={24}
              maxLength={60000}
              showCount={false}
              value={f.bodyMd}
              onChange={(e) => setF({ ...f, bodyMd: e.target.value })}
              className="font-mono [&_textarea]:text-[0.8125rem] [&_textarea]:leading-relaxed"
            />
          </Field>
          <div className="flex flex-col gap-1">
            <p className="type-caption font-medium text-ink-2">Pregled</p>
            <div
              className="max-h-[36rem] overflow-y-auto rounded-sm border border-line bg-surface-1 p-4"
              aria-label="Pregled stranice"
            >
              <Markdown source={preview} />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-8">
          <Switch
            label="Objavljeno"
            checked={f.published}
            onCheckedChange={(v) => setF({ ...f, published: v })}
          />
          <Switch
            label="Pravnik je pregledao ovu verziju"
            checked={!f.needsLegalReview}
            onCheckedChange={(v) => setF({ ...f, needsLegalReview: !v })}
          />
        </div>
      </fieldset>
      {can ? (
        <SaveBar
          dirty={dirty}
          saving={saving}
          onSave={async () => {
            setSaving(true);
            try {
              const { version } = await update({
                pageId: page._id,
                ...f,
                expectedVersion: page.version,
              });
              toast.success(`Sačuvano (verzija ${version}).`);
            } catch (err) {
              toast.error(convexErrorMessage(err, ADMIN_COPY.genericError));
            } finally {
              setSaving(false);
            }
          }}
          onDiscard={() => setF(initial)}
          message="Tekst nije sačuvan."
        />
      ) : null}
    </Section>
  );
}

function DangerTab() {
  const status = useQuery(api.demo.status, {});
  const remove = useMutation(api.demo.remove);
  const confirm = useConfirm();
  const total = status
    ? status.products + status.orders + status.inquiries + status.users + status.mechanics
    : 0;
  return (
    <Section title="Obriši demo podatke">
      <div className="flex flex-col gap-4">
        <p className="flex items-start gap-2 type-body-s text-ink-2">
          <WarningIcon size={18} className="mt-0.5 shrink-0 text-danger" aria-hidden="true" />
          Briše sve probne artikle (šifre DEMO-), porudžbine, upite, naloge i majstore označene kao
          demo. Marke, modeli, kategorije i podešavanja ostaju. Radnja se ne može poništiti.
        </p>
        {status ? (
          <dl className="grid max-w-md grid-cols-2 gap-x-4 gap-y-1 type-body-s">
            {(
              [
                ["Artikli", status.products],
                ["Porudžbine", status.orders],
                ["Upiti", status.inquiries],
                ["Nalozi", status.users],
                ["Majstori", status.mechanics],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-ink-3">{k}</dt>
                <dd className="tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <Skeleton className="h-24 w-72" />
        )}
        <Button
          variant="danger"
          className="self-start"
          disabled={total === 0}
          onClick={() =>
            confirm.ask({
              title: "Obrisati sve demo podatke?",
              description:
                "Brisanje ide u pozadini, u delovima; stanje se osvežava samo. Ne može se poništiti.",
              confirmLabel: "Obriši demo podatke",
              danger: true,
              phrase: "OBRIŠI DEMO",
              onConfirm: async () => {
                await remove({ confirm: "OBRIŠI DEMO" });
                toast.success("Brisanje demo podataka je pokrenuto.");
              },
            })
          }
        >
          {total === 0 ? "Nema demo podataka" : "Obriši demo podatke"}
        </Button>
      </div>
      <ConfirmDialog {...confirm.props} />
    </Section>
  );
}
