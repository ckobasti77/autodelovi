"use client";

/**
 * Checkout (§9.12, §10.5, ARCHITECTURE §A1): Kontakt → Dostava → Plaćanje → Pregled in client
 * state, validated per step (react-hook-form + zod), then `orders.submit` re-validates and
 * re-prices everything on the server. Guest or signed in; honeypot + timing + rate limits.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "convex/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm, useWatch, type FieldErrors } from "react-hook-form";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CarIcon,
  PaperPlaneTiltIcon,
  ShoppingCartSimpleIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react/dist/ssr";

import { api } from "@/convex/_generated/api";
import { buildConsent, formStartTime } from "@/lib/validation/consent";
import { cn } from "@/lib/cn";
import { formatRSD } from "@/lib/format/money";
import { vatIncludedPara } from "@/lib/domain/orderTotals";
import { normalizePhone } from "@/lib/format/phone";
import { normalizeEmail, normalizeMb, normalizePib } from "@/lib/domain/identifiers";
import { normalizeVin } from "@/lib/domain/vin";
import { analyticsItem, track } from "@/lib/analytics/track";
import { readAttribution } from "@/lib/analytics/attribution";
import { resetGuestToken, useCart, useCartArgs } from "@/lib/cart/guestCart";
import { openCartDrawer } from "@/lib/cart/drawer";
import {
  convexErrorCode,
  convexErrorField,
  convexErrorMessage,
  ERRORS,
  PAYMENT_REMINDER,
  type DeliveryCode,
  type PaymentCode,
} from "@/lib/i18n/sr/shop";
import { useSelectedVehicle, vehicleFullLabel } from "@/lib/vehicle/store";
import { useVehicleFilter } from "@/lib/vehicle/useVehicleFilter";
import {
  CHECKOUT_STEPS,
  checkoutSchema,
  formFieldForServerField,
  STEP_FIELDS,
  stepForServerField,
  type CheckoutValues,
} from "@/lib/validation/checkout";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Link } from "@/components/ui/Link";
import { RadioGroup } from "@/components/ui/Radio";
import { Skeleton, SkeletonRegion } from "@/components/ui/Skeleton";
import { Stepper } from "@/components/ui/Stepper";
import { Textarea } from "@/components/ui/Textarea";
import { Honeypot } from "@/components/forms/Honeypot";
import { ROUTES } from "@/constants/routes";
import { TEST_IDS } from "@/constants/testIds";

export type CheckoutConfig = {
  deliveryMethods: {
    code: DeliveryCode;
    label: string;
    description: string;
    pricePara: number;
    freeOverPara?: number;
    etaText: string;
  }[];
  paymentMethods: {
    code: PaymentCode;
    label: string;
    instructions: string;
    requires: "none" | "company" | "mechanic_credit";
    deliveryCodes: DeliveryCode[];
  }[];
  legal: { terms: string; privacy: string };
  store: { address: string; hours: string } | null;
  viewer: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    creditEnabled: boolean;
    /** Approved mechanic: saved company + workshop address, deferred-payment terms. */
    mechanic?: {
      companyName: string;
      pib: string;
      mb: string;
      address: string;
      city: string;
      paymentTermsDays: number;
      /** Remaining deferred-payment limit; null = no limit. */
      availablePara: number | null;
    };
  } | null;
  vatRateBp: number;
};

const DRAFT_KEY = "sk.checkout.v1";

function readDraft(): Partial<CheckoutValues> {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Partial<CheckoutValues>) : {};
  } catch {
    return {};
  }
}

function deliveryPricePara(
  method: CheckoutConfig["deliveryMethods"][number] | undefined,
  itemsPara: number,
): number {
  if (!method) return 0;
  return method.freeOverPara !== undefined && itemsPara >= method.freeOverPara ? 0 : method.pricePara;
}

function ErrorSummary({ errors, fields }: { errors: FieldErrors<CheckoutValues>; fields: readonly (keyof CheckoutValues)[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const list = fields
    .map((f) => ({ f, message: errors[f]?.message }))
    .filter((e): e is { f: keyof CheckoutValues; message: string } => typeof e.message === "string");
  useEffect(() => {
    if (list.length) ref.current?.focus();
  }, [list.length]);
  if (!list.length) return null;
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alert"
      data-reveal="off"
      className="rounded-sm border border-danger bg-danger-subtle p-4 outline-none"
    >
      <p className="flex items-center gap-2 type-body-s font-semibold text-danger">
        <WarningCircleIcon size={18} aria-hidden="true" />
        Proverite {list.length === 1 ? "jedno polje" : `${list.length} polja`}:
      </p>
      <ul className="mt-2 flex flex-col gap-1 pl-6.5 type-body-s">
        {list.map((e) => (
          <li key={e.f}>
            <a href={`#co-${e.f}`} className="text-ink-1 underline decoration-line-strong underline-offset-4 hover:decoration-accent">
              {e.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CheckoutForm({ config }: { config: CheckoutConfig }) {
  const cart = useCart();
  const cartArgs = useCartArgs();
  const submitOrder = useMutation(api.orders.submit);
  const vehicle = useSelectedVehicle();
  const { filter: vehicleIds } = useVehicleFilter(vehicle);
  const [step, setStep] = useState(0);
  const [honeypot, setHoneypot] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [startedAt] = useState(formStartTime);
  const top = useRef<HTMLDivElement>(null);
  const tracked = useRef(false);

  const mechanic = config.viewer?.mechanic;
  // Mechanics: delivery to the workshop by default (address from the profile).
  const firstDelivery =
    mechanic && config.deliveryMethods.some((d) => d.code === "courier")
      ? "courier"
      : (config.deliveryMethods[0]?.code ?? "pickup");
  const form = useForm<CheckoutValues>({
    resolver: zodResolver(checkoutSchema),
    mode: "onTouched",
    defaultValues: {
      firstName: config.viewer?.firstName ?? "",
      lastName: config.viewer?.lastName ?? "",
      phone: config.viewer?.phone ?? "",
      email: config.viewer?.email ?? "",
      isCompany: Boolean(mechanic),
      companyName: mechanic?.companyName ?? "",
      pib: mechanic?.pib ?? "",
      mb: mechanic?.mb ?? "",
      deliveryMethod: firstDelivery,
      street: mechanic?.address ?? "",
      city: mechanic?.city ?? "",
      postalCode: "",
      addressNote: "",
      paymentMethod: firstDelivery === "courier" ? "cod" : "pickup_cash",
      vin: "",
      useVehicle: true,
      note: "",
      terms: false,
    },
  });
  const { register, control, setValue, trigger, formState, getValues, reset, setError } = form;
  const values = useWatch({ control }) as CheckoutValues;

  // Restore a draft from this tab (survives a reload), then keep it updated.
  useEffect(() => {
    const draft = readDraft();
    if (Object.keys(draft).length) reset({ ...getValues(), ...draft, terms: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const draft = JSON.stringify({ ...values, terms: false });
  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT_KEY, draft);
    } catch {
      // Storage unavailable — the form still works.
    }
  }, [draft]);

  const delivery = config.deliveryMethods.find((d) => d.code === values.deliveryMethod);
  const payments = useMemo(
    () =>
      config.paymentMethods.filter(
        (p) =>
          p.deliveryCodes.includes(values.deliveryMethod) &&
          (p.requires !== "mechanic_credit" || config.viewer?.creditEnabled),
      ),
    [config.paymentMethods, config.viewer, values.deliveryMethod],
  );

  // Keep the payment valid for the chosen delivery.
  useEffect(() => {
    if (!payments.some((p) => p.code === values.paymentMethod) && payments[0]) {
      setValue("paymentMethod", payments[0].code);
    }
  }, [payments, values.paymentMethod, setValue]);

  const itemsPara = cart?.itemsPara ?? 0;
  const shippingPara = deliveryPricePara(delivery, itemsPara);
  const totalPara = itemsPara + shippingPara;

  useEffect(() => {
    if (!cart || cart.lines.length === 0 || tracked.current) return;
    tracked.current = true;
    track({
      name: "begin_checkout",
      valuePara: cart.itemsPara,
      items: cart.lines
        .filter((l) => l.product)
        .map((l) =>
          analyticsItem({
            sku: l.product!.sku,
            name: l.product!.name,
            manufacturerName: l.product!.manufacturerName,
            systemSlug: l.product!.systemSlug,
            categorySlug: l.product!.categorySlug,
            pricePara: l.unitPricePara,
            quantity: l.quantity,
          }),
        ),
    });
  }, [cart]);

  const goTo = (next: number) => {
    setStep(next);
    setServerError(null);
    requestAnimationFrame(() => {
      top.current?.scrollIntoView({ block: "start" });
      top.current?.querySelector<HTMLElement>("[data-step-heading]")?.focus();
    });
  };

  const nextStep = async () => {
    const ok = await trigger([...STEP_FIELDS[step]], { shouldFocus: false });
    if (ok) goTo(step + 1);
  };

  const onSubmit = async () => {
    const ok = await trigger();
    if (!ok) {
      const errors = form.formState.errors;
      const firstBad = STEP_FIELDS.findIndex((fields) => fields.some((f) => errors[f]));
      if (firstBad >= 0 && firstBad !== step) goTo(firstBad);
      return;
    }
    const v = getValues();
    setSubmitting(true);
    setServerError(null);
    try {
      const vin = v.vin ? normalizeVin(v.vin) : undefined;
      const vehicleSnapshot =
        vehicle && v.useVehicle
          ? { ...(vehicleIds ?? {}), label: vehicleFullLabel(vehicle), ...(vin ? { vin } : {}) }
          : vin
            ? { label: "Vozilo po broju šasije", vin }
            : undefined;
      const attribution = readAttribution();
      const result = await submitOrder({
        ...(cartArgs !== "skip" && cartArgs.guestToken ? { guestToken: cartArgs.guestToken } : {}),
        contact: {
          firstName: v.firstName.trim(),
          lastName: v.lastName.trim(),
          email: normalizeEmail(v.email),
          phone: normalizePhone(v.phone) ?? v.phone,
        },
        ...(v.isCompany
          ? {
              company: {
                name: v.companyName.trim(),
                pib: normalizePib(v.pib),
                ...(v.mb.trim() ? { mb: normalizeMb(v.mb) } : {}),
              },
            }
          : {}),
        delivery: {
          method: v.deliveryMethod,
          ...(v.deliveryMethod === "courier"
            ? {
                address: {
                  street: v.street.trim(),
                  city: v.city.trim(),
                  postalCode: v.postalCode.trim(),
                  ...(v.addressNote.trim() ? { note: v.addressNote.trim() } : {}),
                },
              }
            : {}),
        },
        payment: { method: v.paymentMethod },
        ...(vehicleSnapshot ? { vehicle: vehicleSnapshot } : {}),
        ...(v.note.trim() ? { note: v.note.trim() } : {}),
        consent: buildConsent(config.legal),
        ...(attribution ? { attribution } : {}),
        eventSourceUrl: window.location.href,
        expectedTotalPara: totalPara,
        honeypot,
        startedAt,
      });
      try {
        sessionStorage.removeItem(DRAFT_KEY);
      } catch {
        // ignore
      }
      resetGuestToken();
      // Full load: analytics must only see the token page through its redacted URL.
      window.location.assign(ROUTES.orderThanks(result.token));
    } catch (error) {
      setSubmitting(false);
      const code = convexErrorCode(error);
      const field = convexErrorField(error);
      const message = convexErrorMessage(error, ERRORS.server);
      if (code === "INVALID") {
        const name = formFieldForServerField(field);
        const target = stepForServerField(field);
        if (name) setError(name, { message });
        if (target !== step) goTo(target);
        else setServerError(message);
        return;
      }
      setServerError(
        code === "RATE_LIMITED" ? ERRORS.rateLimit : message,
      );
    }
  };

  // ------------------------------------------------------------------ states
  if (cart === undefined) {
    return (
      <SkeletonRegion label="Učitava se porudžbina" className="grid gap-8 lg:grid-cols-12">
        <div className="flex flex-col gap-4 lg:col-span-8">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-2/3" />
        </div>
        <Skeleton className="h-64 lg:col-span-4" />
      </SkeletonRegion>
    );
  }
  if (cart === null || cart.lines.length === 0) {
    return (
      <EmptyState
        icon={<ShoppingCartSimpleIcon size={44} />}
        as="h2"
        title="Korpa je prazna"
        action={
          <Button asChild variant="primary">
            <Link href={ROUTES.parts} variant="unstyled">
              Pretražite delove
            </Link>
          </Button>
        }
      >
        Dodajte delove u korpu, pa se vratite na porudžbinu.
      </EmptyState>
    );
  }

  const errors = formState.errors;
  const stepName = CHECKOUT_STEPS[step].id;
  const paymentReminder = PAYMENT_REMINDER[values.paymentMethod];

  const summary = (
    <div className="flex flex-col gap-3" data-reveal="off">
      <ul className="flex flex-col gap-2 type-body-s">
        {cart.lines.map((l) => (
          <li key={l.itemId} className="flex justify-between gap-3">
            <span className="min-w-0 text-ink-2">
              <span className="line-clamp-2">{l.product?.name ?? "Artikal"}</span>
              <span className="type-caption tabular-nums text-ink-3">× {l.quantity}</span>
            </span>
            <span className="shrink-0 tabular-nums text-ink-1">{formatRSD(l.lineTotalPara)}</span>
          </li>
        ))}
      </ul>
      <dl className="flex flex-col gap-1.5 border-t border-line pt-3 type-body-s">
        <div className="flex justify-between gap-3">
          <dt className="text-ink-2">Međuzbir</dt>
          <dd className="tabular-nums text-ink-1">{formatRSD(itemsPara)}</dd>
        </div>
        {cart.discountPara > 0 ? (
          <div className="flex justify-between gap-3 text-accent-text">
            <dt>Vaš rabat</dt>
            <dd className="tabular-nums">−{formatRSD(cart.discountPara)}</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-3">
          <dt className="text-ink-2">Dostava{delivery ? ` · ${delivery.label.toLowerCase()}` : ""}</dt>
          <dd className="tabular-nums text-ink-1">{formatRSD(shippingPara)}</dd>
        </div>
        <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-line pt-3">
          <dt className="type-body font-semibold text-ink-1">Ukupno</dt>
          <dd className="type-numeral-l tabular-nums text-ink-1" aria-live="polite" data-testid="checkout-total">
            {formatRSD(totalPara)}
          </dd>
        </div>
      </dl>
      <p className="type-caption font-normal text-ink-3">
        U cenu je uračunat PDV {config.vatRateBp / 100} %: {formatRSD(vatIncludedPara(totalPara, config.vatRateBp))}
      </p>
      {cart.hasProblems ? (
        <p className="flex items-start gap-2 type-caption text-warning">
          <WarningCircleIcon size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
          <span>
            Neke stavke su se promenile.{" "}
            <button type="button" onClick={openCartDrawer} className="cursor-pointer font-semibold underline underline-offset-4">
              Proverite korpu
            </button>
          </span>
        </p>
      ) : null}
    </div>
  );

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (step < 3) void nextStep();
        else void onSubmit();
      }}
      className="relative grid gap-8 lg:grid-cols-12 lg:gap-x-(--gutter)"
      data-reveal="off"
    >
      <Honeypot value={honeypot} onChange={setHoneypot} />
      <div ref={top} className="flex scroll-mt-24 flex-col gap-6 lg:col-span-8">
        <Stepper steps={[...CHECKOUT_STEPS]} current={step} onSelect={goTo} />
        <details className="rounded-sm border border-line bg-surface-1 lg:hidden">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 [&::-webkit-details-marker]:hidden">
            <span className="type-body-s text-ink-2">Ukupno</span>
            <span className="type-numeral-s tabular-nums text-ink-1">{formatRSD(totalPara)}</span>
          </summary>
          <div className="border-t border-line p-4">{summary}</div>
        </details>

        <section data-testid={TEST_IDS.checkoutStep(stepName)} aria-labelledby="step-title" className="flex flex-col gap-5">
          <h2 id="step-title" data-step-heading tabIndex={-1} className="type-h2 text-ink-1 outline-none">
            {CHECKOUT_STEPS[step].label}
          </h2>
          <ErrorSummary errors={errors} fields={STEP_FIELDS[step]} />

          {step === 0 ? (
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="co-firstName" label="Ime" error={errors.firstName?.message}>
                <Input autoComplete="given-name" {...register("firstName")} />
              </Field>
              <Field id="co-lastName" label="Prezime" error={errors.lastName?.message}>
                <Input autoComplete="family-name" {...register("lastName")} />
              </Field>
              <Field id="co-phone" label="Telefon" help="Zovemo samo zbog ove porudžbine." error={errors.phone?.message}>
                <Input type="tel" inputMode="tel" autoComplete="tel" placeholder="064 123 4567" {...register("phone")} />
              </Field>
              <Field id="co-email" label="E-pošta" help="Na nju šaljemo potvrdu i status." error={errors.email?.message}>
                <Input type="email" inputMode="email" autoComplete="email" placeholder="ime@primer.rs" {...register("email")} />
              </Field>
              <div className="sm:col-span-2">
                <Controller
                  control={control}
                  name="isCompany"
                  render={({ field }) => (
                    <Checkbox
                      id="co-isCompany"
                      checked={field.value}
                      onCheckedChange={(c) => field.onChange(c === true)}
                      label="Kupujem kao firma"
                      description="Unesite podatke firme za račun i predračun (virman)."
                    />
                  )}
                />
              </div>
              {values.isCompany ? (
                <>
                  <Field id="co-companyName" label="Naziv firme" error={errors.companyName?.message} className="sm:col-span-2">
                    <Input autoComplete="organization" {...register("companyName")} />
                  </Field>
                  <Field id="co-pib" label="PIB" help="9 cifara, proveravamo kontrolni broj." error={errors.pib?.message}>
                    <Input inputMode="numeric" autoComplete="off" inputClassName="font-mono" {...register("pib")} />
                  </Field>
                  <Field id="co-mb" label="Matični broj" optional error={errors.mb?.message}>
                    <Input inputMode="numeric" autoComplete="off" inputClassName="font-mono" {...register("mb")} />
                  </Field>
                </>
              ) : null}
            </div>
          ) : null}

          {step === 1 ? (
            <div className="flex flex-col gap-5">
              <Controller
                control={control}
                name="deliveryMethod"
                render={({ field }) => (
                  <RadioGroup
                    label="Način dostave"
                    value={field.value}
                    onValueChange={(v) => field.onChange(v)}
                    options={config.deliveryMethods.map((d) => ({
                      value: d.code,
                      label: (
                        <span className="flex w-full flex-wrap justify-between gap-x-3">
                          <span>{d.label}</span>
                          <span className="tabular-nums text-ink-2">
                            {d.pricePara === 0
                              ? "0 RSD"
                              : d.freeOverPara !== undefined && itemsPara >= d.freeOverPara
                                ? "besplatno"
                                : formatRSD(d.pricePara)}
                          </span>
                        </span>
                      ),
                      description: `${d.description} ${d.etaText}.`,
                    }))}
                  />
                )}
              />
              {values.deliveryMethod === "pickup" && config.store ? (
                <p className="rounded-sm border border-line bg-surface-1 p-4 type-body-s text-ink-2">
                  Preuzimanje: {config.store.address}
                  {config.store.hours ? ` · ${config.store.hours}` : ""}
                </p>
              ) : null}
              {values.deliveryMethod === "courier" ? (
                <div className="grid gap-5 sm:grid-cols-6">
                  <Field id="co-street" label="Ulica i broj" error={errors.street?.message} className="sm:col-span-6">
                    <Input autoComplete="street-address" {...register("street")} />
                  </Field>
                  <Field id="co-postalCode" label="Poštanski broj" error={errors.postalCode?.message} className="sm:col-span-2">
                    <Input inputMode="numeric" autoComplete="postal-code" maxLength={5} {...register("postalCode")} />
                  </Field>
                  <Field id="co-city" label="Mesto" error={errors.city?.message} className="sm:col-span-4">
                    <Input autoComplete="address-level2" {...register("city")} />
                  </Field>
                  <Field id="co-addressNote" label="Napomena za kurira" optional className="sm:col-span-6">
                    <Input placeholder="Sprat, interfon, radno vreme servisa" {...register("addressNote")} />
                  </Field>
                </div>
              ) : null}
            </div>
          ) : null}

          {step === 2 ? (
            <div className="flex flex-col gap-4">
              <Controller
                control={control}
                name="paymentMethod"
                render={({ field }) => (
                  <RadioGroup
                    label="Način plaćanja"
                    value={field.value}
                    onValueChange={(v) => field.onChange(v)}
                    error={errors.paymentMethod?.message}
                    options={payments.map((p) => {
                      const overLimit =
                        p.requires === "mechanic_credit" &&
                        mechanic?.availablePara !== undefined &&
                        mechanic.availablePara !== null &&
                        totalPara > mechanic.availablePara;
                      const credit =
                        p.requires === "mechanic_credit" && mechanic
                          ? ` Rok ${mechanic.paymentTermsDays} dana${mechanic.availablePara !== null ? `, preostali limit ${formatRSD(mechanic.availablePara)}` : ""}.`
                          : "";
                      return {
                        value: p.code,
                        label: p.label,
                        description: overLimit
                          ? `Iznos porudžbine prelazi preostali limit (${formatRSD(mechanic!.availablePara!)}). Izaberite drugi način ili nas pozovite.`
                          : p.requires === "company" && !values.isCompany
                            ? `${p.instructions} Samo za firme — u koraku Kontakt uključite „Kupujem kao firma“.`
                            : `${p.instructions}${credit}`,
                        disabled: (p.requires === "company" && !values.isCompany) || overLimit,
                      };
                    })}
                  />
                )}
              />
              <p className="type-caption font-normal text-ink-3">Na sajtu se ne plaća i ne unose se podaci kartice.</p>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="flex flex-col gap-6">
              <dl className="grid gap-4 rounded-sm border border-line bg-surface-1 p-4 type-body-s sm:grid-cols-3">
                <div>
                  <dt className="type-label uppercase text-ink-3">Kontakt</dt>
                  <dd className="mt-1 text-ink-1">
                    {values.firstName} {values.lastName}
                    <span className="block text-ink-2">{values.phone}</span>
                    <span className="block break-all text-ink-2">{values.email}</span>
                    {values.isCompany ? <span className="block text-ink-2">{values.companyName} · PIB {values.pib}</span> : null}
                  </dd>
                </div>
                <div>
                  <dt className="type-label uppercase text-ink-3">Dostava</dt>
                  <dd className="mt-1 text-ink-1">
                    {delivery?.label}
                    {values.deliveryMethod === "courier" ? (
                      <span className="block text-ink-2">
                        {values.street}, {values.postalCode} {values.city}
                      </span>
                    ) : null}
                  </dd>
                </div>
                <div>
                  <dt className="type-label uppercase text-ink-3">Plaćanje</dt>
                  <dd className="mt-1 text-ink-1">
                    {config.paymentMethods.find((p) => p.code === values.paymentMethod)?.label}
                  </dd>
                </div>
              </dl>
              {vehicle ? (
                <Controller
                  control={control}
                  name="useVehicle"
                  render={({ field }) => (
                    <Checkbox
                      id="co-useVehicle"
                      checked={field.value}
                      onCheckedChange={(c) => field.onChange(c === true)}
                      label={
                        <span className="inline-flex items-center gap-2">
                          <CarIcon size={16} aria-hidden="true" className="text-ink-3" />
                          Delovi su za: {vehicleFullLabel(vehicle)}
                        </span>
                      }
                    />
                  )}
                />
              ) : null}
              <Field id="co-vin" label="Broj šasije (VIN)" optional help="Proverimo da li deo odgovara pre slanja." error={errors.vin?.message}>
                <Input
                  autoComplete="off"
                  maxLength={17}
                  inputClassName="font-mono uppercase"
                  placeholder="WVWZZZ…"
                  {...register("vin")}
                />
              </Field>
              <Field id="co-note" label="Napomena" optional error={errors.note?.message}>
                <Textarea rows={4} maxLength={1000} {...register("note")} />
              </Field>
              <div>
                <Controller
                  control={control}
                  name="terms"
                  render={({ field }) => (
                    <Checkbox
                      id="co-terms"
                      checked={field.value}
                      onCheckedChange={(c) => field.onChange(c === true)}
                      aria-invalid={errors.terms ? true : undefined}
                      label={
                        <span>
                          Prihvatam{" "}
                          <Link href={ROUTES.terms} variant="inline" target="_blank">
                            uslove kupovine
                          </Link>{" "}
                          i{" "}
                          <Link href={ROUTES.privacy} variant="inline" target="_blank">
                            politiku privatnosti
                          </Link>
                          .
                        </span>
                      }
                    />
                  )}
                />
                {errors.terms?.message ? (
                  <p className="type-caption text-danger">{errors.terms.message}</p>
                ) : null}
              </div>
              {serverError ? (
                <p role="alert" className="flex items-start gap-2 rounded-sm border border-danger bg-danger-subtle p-4 type-body-s text-danger">
                  <WarningCircleIcon size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
                  {serverError}
                </p>
              ) : null}
              <p className="type-body-s text-ink-2">{paymentReminder}</p>
            </div>
          ) : null}

          {serverError && step !== 3 ? (
            <p role="alert" className="rounded-sm border border-danger bg-danger-subtle p-4 type-body-s text-danger">
              {serverError}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
            {step > 0 ? (
              <Button type="button" variant="ghost" icon={<ArrowLeftIcon size={18} />} onClick={() => goTo(step - 1)}>
                Nazad
              </Button>
            ) : (
              <Link href={ROUTES.cart} variant="standalone" icon={<ArrowLeftIcon size={14} />}>
                Korpa
              </Link>
            )}
            {step < 3 ? (
              <Button type="submit" variant="primary" size="lg" trailingIcon={<ArrowRightIcon size={16} />} data-testid="checkout-next">
                Dalje
              </Button>
            ) : (
              <Button
                type="submit"
                variant="primary"
                size="lg"
                icon={<PaperPlaneTiltIcon size={20} />}
                loading={submitting}
                data-testid={TEST_IDS.checkoutSubmit}
                className={cn("sm:min-w-[16rem]")}
              >
                Pošalji porudžbinu
              </Button>
            )}
          </div>
        </section>
      </div>

      <aside aria-label="Pregled porudžbine" className="hidden lg:col-span-4 lg:block">
        <div className="sticky top-[calc(var(--header-h)+1.5rem)] rounded-sm border border-line bg-surface-1 p-5">
          <h2 className="mb-4 type-h4 text-ink-1">Vaša porudžbina</h2>
          {summary}
        </div>
      </aside>
    </form>
  );
}
