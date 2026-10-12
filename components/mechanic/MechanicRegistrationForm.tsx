"use client";

/**
 * Mechanic registration (`/za-majstore/registracija`, ARCHITECTURE §A3): account (e-mail +
 * lozinka, only when signed out) → company → contact → workshop → consent. Signs up first,
 * then `mechanics.register` creates the pending profile for that account; Convex re-validates
 * everything (PIB checksum, MB, duplicate PIB).
 *
 * Every field group is one panel (title and note on the left, fields on the right) and one
 * reveal block; the groups on the first screen are eager, so the form is usable from the first
 * frame. The consent and the submit button close the form in a raised panel.
 */
import { useAuthActions } from "@convex-dev/auth/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
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
import { convexErrorCode, convexErrorMessage } from "@/lib/i18n/sr/shop";
import { SERVICE_TYPES } from "@/lib/i18n/sr/mechanic";
import { buildConsent } from "@/lib/validation/consent";
import {
  mechanicRegistrationSchema,
  REGISTRATION_FIELDS,
  type MechanicRegistrationValues,
} from "@/lib/validation/mechanicRegistration";
import { PasswordField } from "@/components/auth/PasswordField";
import { ChoiceChip } from "@/components/mechanic/ChoiceChip";
import { Reveal } from "@/components/reveal/Reveal";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import {
  Field,
  FormNoScript,
  useKeepTypedBeforeHydration,
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

/** Text controls a visitor can type into before hydration (XB-01). */
type TextField =
  | "email"
  | "password"
  | "companyName"
  | "pib"
  | "mb"
  | "contactPerson"
  | "phone"
  | "city"
  | "address";

const PASSWORD_HELP = "Najmanje 10 znakova, bar jedno slovo i jedna cifra.";

/** Groups that fit the first screen at 1440 px are eager; the rest arrive on scroll. */
const EAGER_GROUPS = 3;

const GROUP_GRID = "grid gap-x-(--gutter) gap-y-4 p-4 sm:p-6 lg:grid-cols-[13rem_minmax(0,1fr)]";

function Section({
  id,
  title,
  aside,
  order,
  children,
}: {
  id: string;
  title: string;
  aside?: string;
  /** Position among the form's groups (decides eager and the entrance delay). */
  order: number;
  children: React.ReactNode;
}) {
  return (
    <Reveal
      as="section"
      eager={order < EAGER_GROUPS}
      index={order}
      aria-labelledby={id}
      className={`${GROUP_GRID} panel`}
    >
      <div>
        <h2 id={id} className="type-h3 text-ink-1">
          {title}
        </h2>
        {aside ? <p className="mt-1.5 max-w-[34ch] type-body-s text-ink-3">{aside}</p> : null}
      </div>
      <div role="group" aria-labelledby={id} className="flex min-w-0 flex-col gap-5">
        {children}
      </div>
    </Reveal>
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
  const pib = useWatch({ control, name: "pib" });
  const mb = useWatch({ control, name: "mb" });
  // XB-01: text typed before hydration is read by each control's ref in the hydration commit
  // (before register() writes the defaults) and restored in the same commit, before paint.
  // After the watchers: they subscribe in layout effects, which run in declaration order.
  const keep = useKeepTypedBeforeHydration<TextField>((name, value) =>
    setValue(name, value, { shouldDirty: true }),
  );
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
  // The account group exists only for signed-out visitors; the others follow it.
  const first = needsAccount ? 1 : 0;

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
        firstName: values.contactPerson.trim().split(/\s+/)[0],
        lastName: values.contactPerson.trim().split(/\s+/).slice(1).join(" "),
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
      className="flex flex-col gap-4"
      data-reveal="off"
      data-testid={TEST_IDS.mechanicRegistrationForm}
    >
      <RequiredUnlessOptional>
        <div ref={summary} tabIndex={-1} className="outline-none empty:hidden">
          {errorList.length || serverError ? (
            <div role="alert" className="rounded-md border border-danger bg-danger-subtle p-4">
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
            order={0}
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="mr-email" label="E-pošta" error={errors.email?.message}>
                <Input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  data-testid={TEST_IDS.mechanicRegEmail}
                  {...keep(register("email"))}
                />
              </Field>
              <PasswordField
                id="mr-password"
                label="Lozinka"
                help={PASSWORD_HELP}
                error={errors.password?.message}
                autoComplete="new-password"
                data-testid={TEST_IDS.mechanicRegPassword}
                {...keep(register("password"))}
              />
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
          <p className="flex items-start gap-2 panel-inset p-4 type-body-s text-ink-2">
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
          order={first}
        >
          <Field
            id="mr-companyName"
            label="Naziv servisa ili firme"
            error={errors.companyName?.message}
          >
            <Input
              autoComplete="organization"
              data-testid={TEST_IDS.mechanicRegCompany}
              {...keep(register("companyName"))}
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
                {...keep(register("pib"))}
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
                {...keep(register("mb"))}
              />
            </Field>
          </div>
        </Section>

        <Section id="mr-sec-contact" title="Kontakt" order={first + 1}>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              id="mr-contactPerson"
              label="Kontakt osoba"
              error={errors.contactPerson?.message}
            >
              <Input
                autoComplete="name"
                data-testid={TEST_IDS.mechanicRegContact}
                {...keep(register("contactPerson"))}
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
                {...keep(register("phone"))}
              />
            </Field>
          </div>
        </Section>

        <Section
          id="mr-sec-workshop"
          title="Servis"
          aside="Na ovu adresu šaljemo delove. Adresu možete da promenite u svakoj porudžbini."
          order={first + 2}
        >
          <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <Field id="mr-city" label="Mesto" error={errors.city?.message}>
              <Input
                autoComplete="address-level2"
                data-testid={TEST_IDS.mechanicRegCity}
                {...keep(register("city"))}
              />
            </Field>
            <Field id="mr-address" label="Adresa servisa" error={errors.address?.message}>
              <Input
                autoComplete="street-address"
                data-testid={TEST_IDS.mechanicRegAddress}
                {...keep(register("address"))}
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
                  {SERVICE_TYPES.map((s) => (
                    <ChoiceChip
                      key={s.value}
                      on={field.value.includes(s.value)}
                      onChange={(on) =>
                        field.onChange(
                          on ? [...field.value, s.value] : field.value.filter((x) => x !== s.value),
                        )
                      }
                      onBlur={field.onBlur}
                      testId={`${TEST_IDS.mechanicRegService}-${s.value}`}
                    >
                      {s.label}
                    </ChoiceChip>
                  ))}
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
                  {config.brands.map((b) => (
                    <ChoiceChip
                      key={b.id}
                      on={field.value.includes(b.id)}
                      onChange={(on) =>
                        field.onChange(
                          on
                            ? [...field.value, b.id].slice(0, 5)
                            : field.value.filter((x) => x !== b.id),
                        )
                      }
                      onBlur={field.onBlur}
                    >
                      {b.name}
                    </ChoiceChip>
                  ))}
                </div>
              </div>
            )}
          />
        </Section>

        <Reveal className={`${GROUP_GRID} panel-raised`}>
          <div className="flex min-w-0 flex-col gap-5 lg:col-start-2">
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
              Za registraciju je potreban JavaScript. Uključite ga u pregledaču, pa osvežite
              stranicu.
            </FormNoScript>
          </div>
        </Reveal>
      </RequiredUnlessOptional>
    </form>
  );
}
