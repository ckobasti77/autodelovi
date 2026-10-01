"use client";

/**
 * Mechanic registration (`/za-majstore/registracija`, ARCHITECTURE §A3): account (e-mail +
 * lozinka, only when signed out) → company → contact → workshop → consent. Signs up first,
 * then `mechanics.register` creates the pending profile for that account; Convex re-validates
 * everything (PIB checksum, MB, duplicate PIB).
 */
import { useAuthActions } from "@convex-dev/auth/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { CheckCircleIcon, WarningCircleIcon } from "@phosphor-icons/react/dist/ssr";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { readAttribution } from "@/lib/analytics/attribution";
import { googleUserData } from "@/lib/analytics/hash";
import { track } from "@/lib/analytics/track";
import {
  isValidMb,
  isValidPib,
  normalizeEmail,
  normalizeMb,
  normalizePib,
} from "@/lib/domain/identifiers";
import { cn } from "@/lib/cn";
import { convexErrorCode, convexErrorMessage } from "@/lib/i18n/sr/shop";
import { SERVICE_TYPES } from "@/lib/i18n/sr/mechanic";
import { buildConsent } from "@/lib/validation/consent";
import {
  mechanicRegistrationSchema,
  REGISTRATION_FIELDS,
  type MechanicRegistrationValues,
} from "@/lib/validation/mechanicRegistration";
import { Button } from "@/components/ui/Button";
import { Checkbox, CheckboxBox } from "@/components/ui/Checkbox";
import {
  Field,
  FormNoScript,
  readPrehydrationValues,
  RequiredUnlessOptional,
  useHydrated,
} from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Link } from "@/components/ui/Link";
import { ROUTES } from "@/constants/routes";
import { TEST_IDS } from "@/constants/testIds";

export type RegistrationConfig = {
  brands: { id: string; name: string }[];
  legal: { terms: string; privacy: string };
  viewer: { email: string; name: string; phone: string } | null;
};

/** Text controls a visitor can type into before hydration → their DOM ids. */
const TEXT_FIELD_IDS = {
  email: "mr-email",
  password: "mr-password",
  companyName: "mr-companyName",
  pib: "mr-pib",
  mb: "mr-mb",
  contactPerson: "mr-contactPerson",
  phone: "mr-phone",
  city: "mr-city",
  address: "mr-address",
} as const;

const PASSWORD_HELP = "Najmanje 10 znakova, bar jedno slovo i jedna cifra.";

function Section({
  id,
  title,
  aside,
  children,
}: {
  id: string;
  title: string;
  aside?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="grid gap-x-(--gutter) gap-y-4 border-t border-line pt-6 lg:grid-cols-[14rem_minmax(0,1fr)]"
    >
      <div>
        <h2 id={id} className="type-h3 text-ink-1">
          {title}
        </h2>
        {aside ? <p className="mt-2 max-w-[34ch] type-body-s text-ink-3">{aside}</p> : null}
      </div>
      <div role="group" aria-labelledby={id} className="flex min-w-0 flex-col gap-5">
        {children}
      </div>
    </section>
  );
}

export function MechanicRegistrationForm({ config }: { config: RegistrationConfig }) {
  const router = useRouter();
  const { signIn } = useAuthActions();
  const register_ = useMutation(api.mechanics.register);
  const needsAccount = config.viewer === null;
  const schema = useMemo(() => mechanicRegistrationSchema({ needsAccount }), [needsAccount]);
  const [serverError, setServerError] = useState<{ message: string; signIn?: boolean } | null>(
    null,
  );
  const [pending, setPending] = useState(false);
  const summary = useRef<HTMLDivElement>(null);
  const hydrated = useHydrated();
  // XB-01: text typed before hydration, read in the hydration render (register()'s ref writes
  // the default values into the DOM at commit) and restored in the layout effect below.
  const [typedBeforeHydration] = useState(() => readPrehydrationValues(TEXT_FIELD_IDS));

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, submitCount },
    setError,
    setValue,
  } = useForm<MechanicRegistrationValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      email: config.viewer?.email ?? "",
      password: "",
      companyName: "",
      pib: "",
      mb: "",
      contactPerson: config.viewer?.name ?? "",
      phone: config.viewer?.phone ?? "",
      city: "",
      address: "",
      serviceTypes: [],
      brandsServiced: [],
      terms: false,
    },
  });
  useLayoutEffect(() => {
    for (const [name, value] of Object.entries(typedBeforeHydration) as [
      keyof typeof TEXT_FIELD_IDS,
      string,
    ][]) {
      setValue(name, value, { shouldDirty: true });
    }
  }, [typedBeforeHydration, setValue]);

  const pib = useWatch({ control, name: "pib" });
  const mb = useWatch({ control, name: "mb" });
  const pibOk = pib && isValidPib(normalizePib(pib));
  const mbOk = mb && isValidMb(normalizeMb(mb));

  // The summary lists problems only after a send attempt; before that, fields speak for themselves.
  const errorList =
    submitCount > 0
      ? REGISTRATION_FIELDS.map((k) => ({ k, message: errors[k]?.message })).filter(
          (e): e is { k: (typeof REGISTRATION_FIELDS)[number]; message: string } =>
            typeof e.message === "string",
        )
      : [];

  const focusSummary = () => requestAnimationFrame(() => summary.current?.focus());

  const onValid = async (values: MechanicRegistrationValues) => {
    setPending(true);
    setServerError(null);
    try {
      if (needsAccount) {
        try {
          await signIn("password", {
            flow: "signUp",
            email: normalizeEmail(values.email),
            password: values.password,
            name: values.contactPerson.trim(),
          });
        } catch {
          setServerError({
            message:
              "Nalog sa ovom adresom e-pošte verovatno već postoji. Prijavite se, pa pošaljite podatke servisa.",
            signIn: true,
          });
          setPending(false);
          focusSummary();
          return;
        }
      }
      const attribution = readAttribution();
      const profileId = await register_({
        companyName: values.companyName.trim(),
        pib: normalizePib(values.pib),
        mb: normalizeMb(values.mb),
        contactPerson: values.contactPerson.trim(),
        phone: values.phone.trim(),
        ...(needsAccount ? { email: normalizeEmail(values.email) } : {}),
        city: values.city.trim(),
        address: values.address.trim(),
        serviceTypes: values.serviceTypes,
        brandsServiced: values.brandsServiced as Id<"vehicleBrands">[],
        consent: buildConsent(config.legal),
        ...(attribution ? { attribution } : {}),
        eventSourceUrl: window.location.href,
      });
      const userData = await googleUserData({
        email: needsAccount ? values.email : null,
        phone: values.phone,
        firstName: values.contactPerson.trim().split(/s+/)[0],
        lastName: values.contactPerson.trim().split(/s+/).slice(1).join(" "),
        city: values.city,
      }).catch(() => null);
      track(
        {
          name: "generate_lead",
          leadType: "mechanic_registration",
          leadId: profileId,
          ...(userData ? { userData } : {}),
        },
        { eventId: `mech-${profileId}` },
      );
      router.replace(ROUTES.mechanicsThanks);
      router.refresh();
    } catch (error) {
      const code = convexErrorCode(error);
      const message = convexErrorMessage(
        error,
        "Registracija nije poslata. Pokušajte ponovo ili nas pozovite.",
      );
      const field = (error as { data?: { field?: string } }).data?.field;
      if (field && REGISTRATION_FIELDS.includes(field as (typeof REGISTRATION_FIELDS)[number])) {
        setError(field as (typeof REGISTRATION_FIELDS)[number], { message });
      }
      // An account created a moment ago stays signed in — the visitor can fix and resend.
      setServerError({ message, signIn: code === "UNAUTHENTICATED" });
      setPending(false);
      focusSummary();
    }
  };

  return (
    // method="post": before hydration (or without JavaScript) a submit must never put the
    // account password into a GET URL; the submit button stays disabled until hydration.
    <form
      method="post"
      noValidate
      onSubmit={(event) => void handleSubmit(onValid, focusSummary)(event)}
      className="flex flex-col gap-8"
      data-reveal="off"
      data-testid={TEST_IDS.mechanicRegistrationForm}
    >
      <RequiredUnlessOptional>
        <div ref={summary} tabIndex={-1} className="outline-none">
          {errorList.length || serverError ? (
            <div role="alert" className="rounded-sm border border-danger bg-danger-subtle p-4">
              <p className="flex items-center gap-2 type-body-s font-semibold text-danger">
                <WarningCircleIcon size={18} aria-hidden="true" />
                {serverError?.message ?? "Proverite označena polja:"}
              </p>
              {serverError?.signIn ? (
                <p className="mt-2 pl-6.5 type-body-s">
                  <Link
                    href={`${ROUTES.signIn}?next=${encodeURIComponent(ROUTES.mechanicsRegister)}`}
                    variant="inline"
                  >
                    Prijavite se
                  </Link>
                </p>
              ) : null}
              {errorList.length ? (
                <ul className="mt-2 flex flex-col gap-1 pl-6.5 type-body-s">
                  {errorList.map((e) => (
                    <li key={e.k}>
                      <a
                        href={`#mr-${e.k}`}
                        className="text-ink-1 underline decoration-line-strong underline-offset-4"
                      >
                        {e.message}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>

        {needsAccount ? (
          <Section
            id="mr-sec-account"
            title="Nalog"
            aside="Ovim podacima se prijavljujete. Ako već imate nalog, prvo se prijavite."
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="mr-email" label="E-pošta" error={errors.email?.message}>
                <Input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  data-testid={TEST_IDS.mechanicRegEmail}
                  {...register("email")}
                />
              </Field>
              <Field
                id="mr-password"
                label="Lozinka"
                help={PASSWORD_HELP}
                error={errors.password?.message}
              >
                <Input
                  type="password"
                  autoComplete="new-password"
                  data-testid={TEST_IDS.mechanicRegPassword}
                  {...register("password")}
                />
              </Field>
            </div>
            <p className="type-body-s text-ink-3">
              Već imate nalog?{" "}
              <Link
                href={`${ROUTES.signIn}?next=${encodeURIComponent(ROUTES.mechanicsRegister)}`}
                variant="inline"
              >
                Prijavite se
              </Link>
              , pa se vratite na ovu stranu.
            </p>
          </Section>
        ) : (
          <p className="flex items-start gap-2 rounded-sm border border-line bg-surface-1 p-4 type-body-s text-ink-2">
            <CheckCircleIcon
              size={18}
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-success"
            />
            Registrujete servis za nalog {config.viewer?.email}.
          </p>
        )}

        <Section
          id="mr-sec-company"
          title="Firma"
          aside="Podatke proveravamo u registru pre odobrenja."
        >
          <Field
            id="mr-companyName"
            label="Naziv servisa ili firme"
            error={errors.companyName?.message}
          >
            <Input
              autoComplete="organization"
              data-testid={TEST_IDS.mechanicRegCompany}
              {...register("companyName")}
            />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              id="mr-pib"
              label="PIB"
              help="9 cifara"
              error={errors.pib?.message}
              success={pibOk && !errors.pib ? "PIB je ispravan." : undefined}
            >
              <Input
                inputMode="numeric"
                autoComplete="off"
                maxLength={11}
                inputClassName="font-mono tracking-wider"
                data-testid={TEST_IDS.mechanicRegPib}
                {...register("pib")}
              />
            </Field>
            <Field
              id="mr-mb"
              label="Matični broj"
              help="8 cifara"
              error={errors.mb?.message}
              success={mbOk && !errors.mb ? "Matični broj je ispravan." : undefined}
            >
              <Input
                inputMode="numeric"
                autoComplete="off"
                maxLength={10}
                inputClassName="font-mono tracking-wider"
                data-testid={TEST_IDS.mechanicRegMb}
                {...register("mb")}
              />
            </Field>
          </div>
        </Section>

        <Section id="mr-sec-contact" title="Kontakt">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              id="mr-contactPerson"
              label="Kontakt osoba"
              error={errors.contactPerson?.message}
            >
              <Input
                autoComplete="name"
                data-testid={TEST_IDS.mechanicRegContact}
                {...register("contactPerson")}
              />
            </Field>
            <Field
              id="mr-phone"
              label="Telefon"
              help="Najčešće zovemo ili pišemo na Viber."
              error={errors.phone?.message}
            >
              <Input
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                data-testid={TEST_IDS.mechanicRegPhone}
                {...register("phone")}
              />
            </Field>
          </div>
        </Section>

        <Section
          id="mr-sec-workshop"
          title="Servis"
          aside="Na ovu adresu šaljemo delove. Adresu možete da promenite u svakoj porudžbini."
        >
          <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <Field id="mr-city" label="Mesto" error={errors.city?.message}>
              <Input
                autoComplete="address-level2"
                data-testid={TEST_IDS.mechanicRegCity}
                {...register("city")}
              />
            </Field>
            <Field id="mr-address" label="Adresa servisa" error={errors.address?.message}>
              <Input
                autoComplete="street-address"
                data-testid={TEST_IDS.mechanicRegAddress}
                {...register("address")}
              />
            </Field>
          </div>
          <Controller
            control={control}
            name="serviceTypes"
            render={({ field }) => (
              <div
                id="mr-serviceTypes"
                className="flex flex-col gap-2"
                role="group"
                aria-labelledby="mr-st-label"
              >
                <span id="mr-st-label" className="type-caption text-ink-2">
                  Vrsta servisa
                </span>
                <div className="flex flex-wrap gap-2">
                  {SERVICE_TYPES.map((s) => {
                    const on = field.value.includes(s.value);
                    return (
                      <label
                        key={s.value}
                        className={cn(
                          "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xs border px-3 type-body-s transition-control",
                          on
                            ? "border-accent bg-accent-subtle text-ink-1"
                            : "border-line-strong text-ink-2 hover:border-ink-3",
                        )}
                      >
                        <CheckboxBox
                          aria-label={s.label}
                          checked={on}
                          onCheckedChange={(c) =>
                            field.onChange(
                              c === true
                                ? [...field.value, s.value]
                                : field.value.filter((x) => x !== s.value),
                            )
                          }
                          onBlur={field.onBlur}
                          data-testid={`${TEST_IDS.mechanicRegService}-${s.value}`}
                        />
                        {s.label}
                      </label>
                    );
                  })}
                </div>
                {errors.serviceTypes?.message ? (
                  <p className="flex items-center gap-1.5 type-caption text-danger">
                    <WarningCircleIcon size={16} aria-hidden="true" />
                    {errors.serviceTypes.message}
                  </p>
                ) : null}
              </div>
            )}
          />
          <Controller
            control={control}
            name="brandsServiced"
            render={({ field }) => (
              <div
                id="mr-brandsServiced"
                className="flex flex-col gap-2"
                role="group"
                aria-labelledby="mr-br-label"
              >
                <span id="mr-br-label" className="type-caption text-ink-2">
                  Marke koje servisirate <span className="text-ink-3">(nije obavezno)</span>
                </span>
                <div className="flex flex-wrap gap-2">
                  {config.brands.map((b) => {
                    const on = field.value.includes(b.id);
                    return (
                      <label
                        key={b.id}
                        className={cn(
                          "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xs border px-3 type-body-s transition-control",
                          on
                            ? "border-accent bg-accent-subtle text-ink-1"
                            : "border-line-strong text-ink-2 hover:border-ink-3",
                        )}
                      >
                        <CheckboxBox
                          aria-label={b.name}
                          checked={on}
                          onCheckedChange={(c) =>
                            field.onChange(
                              c === true
                                ? [...field.value, b.id].slice(0, 5)
                                : field.value.filter((x) => x !== b.id),
                            )
                          }
                          onBlur={field.onBlur}
                        />
                        {b.name}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          />
        </Section>

        <div className="flex flex-col gap-5 border-t border-line pt-6 lg:pl-[calc(14rem+var(--gutter))]">
          <Controller
            control={control}
            name="terms"
            render={({ field }) => (
              <div>
                <Checkbox
                  id="mr-terms"
                  checked={field.value}
                  onCheckedChange={(c) => field.onChange(c === true)}
                  onBlur={field.onBlur}
                  required
                  error={errors.terms?.message}
                  data-testid={TEST_IDS.mechanicRegTerms}
                  label={
                    <span>
                      Prihvatam{" "}
                      <Link href={ROUTES.terms} variant="inline" target="_blank">
                        uslove korišćenja
                      </Link>{" "}
                      i{" "}
                      <Link href={ROUTES.privacy} variant="inline" target="_blank">
                        politiku privatnosti
                      </Link>
                      .
                    </span>
                  }
                />
              </div>
            )}
          />
          <div className="flex flex-wrap items-center gap-4">
            <Button
              type="submit"
              size="lg"
              loading={pending}
              disabled={!hydrated}
              data-testid={TEST_IDS.mechanicRegSubmit}
            >
              Registrujte servis
            </Button>
            <p className="type-body-s text-ink-3">
              Odgovor stiže e-poštom, obično u toku radnog dana.
            </p>
          </div>
          <FormNoScript>
            Za registraciju je potreban JavaScript. Uključite ga u pregledaču, pa osvežite stranicu.
          </FormNoScript>
        </div>
      </RequiredUnlessOptional>
    </form>
  );
}
