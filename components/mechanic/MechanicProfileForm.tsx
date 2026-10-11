"use client";

/**
 * `/majstor/profil`: company identity is read-only (PIB/MB changes go through staff); the
 * mechanic edits contact person, phone, workshop address, service types and makes.
 */
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState, type FormEvent } from "react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/cn";
import { formatPercent } from "@/lib/format/number";
import { formatPhone, normalizePhone } from "@/lib/format/phone";
import { SERVICE_TYPES, type ServiceType } from "@/lib/i18n/sr/mechanic";
import { convexErrorMessage, ERRORS } from "@/lib/i18n/sr/shop";
import { Button } from "@/components/ui/Button";
import { CheckboxBox } from "@/components/ui/Checkbox";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Skeleton, SkeletonRegion } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/Toast";

type Values = {
  contactPerson: string;
  phone: string;
  city: string;
  address: string;
  serviceTypes: ServiceType[];
  brandsServiced: string[];
};

function Chip({
  on,
  onChange,
  children,
}: {
  on: boolean;
  onChange: (on: boolean) => void;
  children: string;
}) {
  return (
    <label
      className={cn(
        "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-sm border px-3 type-body-s transition-control",
        on ? "border-accent bg-accent-subtle text-ink-1" : "border-line-strong text-ink-2 hover:border-ink-3",
      )}
    >
      <CheckboxBox aria-label={children} checked={on} onCheckedChange={(c) => onChange(c === true)} />
      {children}
    </label>
  );
}

type Overview = NonNullable<FunctionReturnType<typeof api.mechanicPortal.overview>>;

export function MechanicProfileForm({
  brands,
  accountEmail,
}: {
  brands: { id: string; name: string }[];
  accountEmail: string;
}) {
  const profile = useQuery(api.mechanicPortal.overview, {});
  if (profile === undefined) {
    return (
      <SkeletonRegion>
        <Skeleton className="h-96 w-full max-w-[48rem]" />
      </SkeletonRegion>
    );
  }
  if (!profile) return null;
  return <ProfileEditor profile={profile} brands={brands} accountEmail={accountEmail} />;
}

function ProfileEditor({
  profile,
  brands,
  accountEmail,
}: {
  profile: Overview;
  brands: { id: string; name: string }[];
  accountEmail: string;
}) {
  const update = useMutation(api.mechanics.updateMyProfile);
  const [v, setV] = useState<Values>(() => ({
    contactPerson: profile.contactPerson,
    phone: formatPhone(profile.phone),
    city: profile.city,
    address: profile.address,
    serviceTypes: profile.serviceTypes,
    brandsServiced: profile.brandsServiced,
  }));
  const [errors, setErrors] = useState<Partial<Record<keyof Values, string>>>({});
  const [busy, setBusy] = useState(false);

  const set = (patch: Partial<Values>) => setV({ ...v, ...patch });

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const e: Partial<Record<keyof Values, string>> = {};
    if (!v.contactPerson.trim()) e.contactPerson = ERRORS.required("kontakt osobu");
    if (!normalizePhone(v.phone)) e.phone = ERRORS.phone;
    if (!v.city.trim()) e.city = ERRORS.required("mesto");
    if (!v.address.trim()) e.address = ERRORS.required("adresu servisa");
    if (v.serviceTypes.length === 0) e.serviceTypes = "Izaberite bar jednu vrstu servisa.";
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await update({
        contactPerson: v.contactPerson.trim(),
        phone: v.phone.trim(),
        city: v.city.trim(),
        address: v.address.trim(),
        serviceTypes: v.serviceTypes,
        brandsServiced: v.brandsServiced as Id<"vehicleBrands">[],
      });
      toast.success("Profil je sačuvan.");
    } catch (error) {
      toast.error(convexErrorMessage(error, "Izmene nisu sačuvane."));
    } finally {
      setBusy(false);
    }
  };

  const rabat = profile.personalDiscountBp ?? profile.tierDiscountBp;

  return (
    <div className="grid gap-12 lg:grid-cols-12 lg:gap-x-(--gutter)" data-reveal="off">
      <form onSubmit={(e) => void onSubmit(e)} noValidate className="flex flex-col gap-6 lg:col-span-7">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Kontakt osoba" error={errors.contactPerson}>
            <Input autoComplete="name" value={v.contactPerson} onChange={(e) => set({ contactPerson: e.target.value })} />
          </Field>
          <Field label="Telefon" error={errors.phone}>
            <Input type="tel" autoComplete="tel" value={v.phone} onChange={(e) => set({ phone: e.target.value })} />
          </Field>
          <Field label="Mesto" error={errors.city}>
            <Input autoComplete="address-level2" value={v.city} onChange={(e) => set({ city: e.target.value })} />
          </Field>
          <Field label="Adresa servisa" help="Adresa za dostavu kurirom." error={errors.address}>
            <Input autoComplete="street-address" value={v.address} onChange={(e) => set({ address: e.target.value })} />
          </Field>
        </div>
        <div role="group" aria-labelledby="pf-st" className="flex flex-col gap-2">
          <span id="pf-st" className="type-caption text-ink-2">
            Vrsta servisa
          </span>
          <div className="flex flex-wrap gap-2">
            {SERVICE_TYPES.map((s) => (
              <Chip
                key={s.value}
                on={v.serviceTypes.includes(s.value)}
                onChange={(on) =>
                  set({ serviceTypes: on ? [...v.serviceTypes, s.value] : v.serviceTypes.filter((x) => x !== s.value) })
                }
              >
                {s.label}
              </Chip>
            ))}
          </div>
          {errors.serviceTypes ? <p className="type-caption text-danger">{errors.serviceTypes}</p> : null}
        </div>
        <div role="group" aria-labelledby="pf-br" className="flex flex-col gap-2">
          <span id="pf-br" className="type-caption text-ink-2">
            Marke koje servisirate
          </span>
          <div className="flex flex-wrap gap-2">
            {brands.map((b) => (
              <Chip
                key={b.id}
                on={v.brandsServiced.includes(b.id)}
                onChange={(on) =>
                  set({
                    brandsServiced: on ? [...v.brandsServiced, b.id].slice(0, 5) : v.brandsServiced.filter((x) => x !== b.id),
                  })
                }
              >
                {b.name}
              </Chip>
            ))}
          </div>
        </div>
        <Button type="submit" loading={busy} className="self-start">
          Sačuvaj
        </Button>
      </form>
      <aside className="flex flex-col gap-6 self-start lg:col-span-4 lg:col-start-9" aria-label="Podaci firme">
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-3 border-t border-line pt-5">
          <dt className="type-caption text-ink-3">Firma</dt>
          <dd className="type-body-s text-ink-1">{profile.companyName}</dd>
          <dt className="type-caption text-ink-3">PIB</dt>
          <dd className="type-code text-ink-1">{profile.pib}</dd>
          <dt className="type-caption text-ink-3">Matični broj</dt>
          <dd className="type-code text-ink-1">{profile.mb}</dd>
          <dt className="type-caption text-ink-3">Nalog</dt>
          <dd className="break-all type-body-s text-ink-1">{accountEmail}</dd>
          <dt className="type-caption text-ink-3">Nivo</dt>
          <dd className="type-body-s text-ink-1">
            {profile.tierName ?? "—"}
            {rabat !== null ? ` · rabat ${formatPercent(rabat / 10_000)}` : ""}
          </dd>
          <dt className="type-caption text-ink-3">Plaćanje</dt>
          <dd className="type-body-s text-ink-1">
            {profile.credit.enabled
              ? `Odloženo, rok ${profile.credit.paymentTermsDays} dana`
              : "Pouzeće, pri preuzimanju ili virman"}
          </dd>
        </dl>
        <p className="type-caption text-ink-3">
          Naziv firme, PIB i matični broj menjamo mi — pozovite nas ili pošaljite upit sa novim podacima.
        </p>
      </aside>
    </div>
  );
}
