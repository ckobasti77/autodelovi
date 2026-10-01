"use client";

/**
 * VIN / part inquiry (§10.7, ARCHITECTURE §A2): VIN with live VAG decode (WMI → make, model code
 * → generation suggestion, position 10 → year hint), vehicle selects, what is needed, up to 5
 * photos, contact + reply channel, consent. Honeypot + timing + rate limit in Convex.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "convex/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import {
  InfoIcon,
  PaperPlaneTiltIcon,
  WarningCircleIcon,
  XIcon,
} from "@phosphor-icons/react/dist/ssr";

import { api } from "@/convex/_generated/api";
import { buildConsent, formStartTime } from "@/lib/validation/consent";
import type { Id } from "@/convex/_generated/dataModel";
import type { VehicleTree } from "@/lib/catalog/types";
import { normalizeEmail } from "@/lib/domain/identifiers";
import { decodeVin, normalizeVin } from "@/lib/domain/vin";
import { normalizePhone } from "@/lib/format/phone";
import { readAttribution } from "@/lib/analytics/attribution";
import { storeLeadUserData } from "@/lib/analytics/leadUserData";
import {
  convexErrorCode,
  convexErrorMessage,
  ERRORS,
  PREFERRED_CHANNEL_LABEL,
} from "@/lib/i18n/sr/shop";
import { useSelectedVehicle } from "@/lib/vehicle/store";
import { inquirySchema, type InquiryValues } from "@/lib/validation/inquiry";
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
import { RadioGroup } from "@/components/ui/Radio";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Honeypot } from "@/components/forms/Honeypot";
import { PhotoPicker, type PhotoItem } from "@/components/inquiry/PhotoPicker";
import { ROUTES } from "@/constants/routes";
import { TEST_IDS } from "@/constants/testIds";

export type InquiryPrefill = {
  kind: "part" | "not_found" | "product_question" | "quick_order_missing";
  message: string;
  categories: { slug: string; name: string }[];
  productId: string | null;
  productName: string | null;
  searchQuery: string | null;
  requestedCodes: string[];
};

export type InquiryConfig = {
  tree: VehicleTree;
  categories: { slug: string; name: string }[];
  legal: { terms: string; privacy: string };
  viewer: { name: string; email: string; phone: string } | null;
  prefill: InquiryPrefill;
};

/** Text controls a visitor can type into before hydration (XB-01). */
type TextField = "vin" | "year" | "message" | "name" | "phone" | "email";

export function InquiryForm({ config }: { config: InquiryConfig }) {
  const submit = useMutation(api.inquiries.submit);
  const stored = useSelectedVehicle();
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [categories, setCategories] = useState(config.prefill.categories);
  const [honeypot, setHoneypot] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [startedAt] = useState(formStartTime);
  const summary = useRef<HTMLDivElement>(null);
  const hydrated = useHydrated();
  const form = useForm<InquiryValues>({
    resolver: zodResolver(inquirySchema),
    mode: "onTouched",
    defaultValues: {
      vin: "",
      brandSlug: "",
      modelSlug: "",
      generationSlug: "",
      year: "",
      message: config.prefill.message,
      name: config.viewer?.name ?? "",
      phone: config.viewer?.phone ?? "",
      email: config.viewer?.email ?? "",
      channel: "phone",
      consent: false,
    },
  });
  const { register, control, setValue, handleSubmit, formState } = form;
  const errors = formState.errors;
  const vin = useWatch({ control, name: "vin" });
  const brandSlug = useWatch({ control, name: "brandSlug" });
  const modelSlug = useWatch({ control, name: "modelSlug" });
  const channel = useWatch({ control, name: "channel" });

  // XB-01: text typed before hydration is read by each control's ref in the hydration commit
  // (before register() writes the defaults) and restored in the same commit, before paint.
  // After the watchers: they subscribe in layout effects, which run in declaration order.
  const keep = useKeepTypedBeforeHydration<TextField>((name, value) =>
    setValue(name, value, { shouldDirty: true }),
  );

  // The visitor's stored vehicle prefills the selects once.
  const prefilled = useRef(false);
  useEffect(() => {
    if (prefilled.current || !stored) return;
    prefilled.current = true;
    setValue("brandSlug", stored.brand.slug);
    setValue("modelSlug", stored.model.slug);
    if (stored.generation) setValue("generationSlug", stored.generation.slug);
  }, [stored, setValue]);

  const decoded = useMemo(() => {
    const n = normalizeVin(vin ?? "");
    return n.length >= 3 ? decodeVin(n) : null;
  }, [vin]);

  // Valid VIN → make (WMI) and generation (model code) suggestions; the selects stay editable.
  const lastDecoded = useRef("");
  useEffect(() => {
    if (!decoded || !decoded.validation.valid || lastDecoded.current === decoded.normalized) return;
    lastDecoded.current = decoded.normalized;
    const make = decoded.wmi.make;
    const brand = make ? config.tree.find((b) => b.brand.name === make) : undefined;
    if (!brand) return;
    setValue("brandSlug", brand.brand.slug);
    const code = decoded.modelCode;
    if (code) {
      for (const m of brand.models) {
        const g = m.generations.find((gen) => gen.vinModelCodes.includes(code));
        if (g) {
          setValue("modelSlug", m.model.slug);
          setValue("generationSlug", g.slug);
          break;
        }
      }
    }
    if (decoded.modelYear) setValue("year", String(decoded.modelYear));
  }, [decoded, config.tree, setValue]);

  const brand = config.tree.find((b) => b.brand.slug === brandSlug);
  const model = brand?.models.find((m) => m.model.slug === modelSlug);

  const onValid = async (v: InquiryValues) => {
    const pending = photos.some((p) => p.status === "uploading");
    if (pending) {
      setServerError("Sačekajte da se fotografije učitaju.");
      return;
    }
    setBusy(true);
    setServerError(null);
    const b = config.tree.find((x) => x.brand.slug === v.brandSlug);
    const m = b?.models.find((x) => x.model.slug === v.modelSlug);
    const g = m?.generations.find((x) => x.slug === v.generationSlug);
    const label = [b?.brand.name, g?.name ?? m?.model.name, v.year ? `(${v.year})` : ""]
      .filter(Boolean)
      .join(" ");
    const normalizedVin = v.vin ? normalizeVin(v.vin) : "";
    const kind = normalizedVin && config.prefill.kind === "part" ? "vin" : config.prefill.kind;
    try {
      const attribution = readAttribution();
      const result = await submit({
        kind,
        ...(normalizedVin ? { vin: normalizedVin } : {}),
        ...(b
          ? {
              vehicle: {
                brandId: b.brand._id,
                ...(m ? { modelId: m.model._id } : {}),
                ...(g ? { generationId: g._id } : {}),
                ...(v.year ? { year: Number(v.year) } : {}),
                ...(normalizedVin ? { vin: normalizedVin } : {}),
                label: label || b.brand.name,
              },
            }
          : {}),
        message: v.message,
        categorySlugs: categories.map((c) => c.slug),
        ...(config.prefill.productId
          ? { productId: config.prefill.productId as Id<"products"> }
          : {}),
        ...(config.prefill.searchQuery ? { searchQuery: config.prefill.searchQuery } : {}),
        ...(config.prefill.requestedCodes.length
          ? { requestedCodes: config.prefill.requestedCodes }
          : {}),
        photos: photos.filter((p) => p.status === "done" && p.storageId).map((p) => p.storageId!),
        contact: {
          name: v.name,
          ...(v.email ? { email: normalizeEmail(v.email) } : {}),
          ...(v.phone ? { phone: normalizePhone(v.phone) ?? v.phone } : {}),
          preferredChannel: v.channel,
        },
        consent: buildConsent(config.legal),
        ...(attribution ? { attribution } : {}),
        eventSourceUrl: window.location.href,
        honeypot,
        startedAt,
      });
      await storeLeadUserData(result.number, {
        email: v.email,
        phone: v.phone,
        firstName: v.name.split(/s+/)[0],
        lastName: v.name.split(/s+/).slice(1).join(" "),
      });
      // Full load: analytics must only see the token page through its redacted URL.
      window.location.assign(ROUTES.inquiryThanks(result.token));
    } catch (error) {
      setBusy(false);
      setServerError(
        convexErrorCode(error) === "RATE_LIMITED"
          ? ERRORS.rateLimit
          : convexErrorMessage(error, "Upit nije poslat. Pokušajte ponovo ili nas pozovite."),
      );
      requestAnimationFrame(() => summary.current?.focus());
    }
  };

  function focusSummary() {
    requestAnimationFrame(() => summary.current?.focus());
  }

  const errorList = Object.entries(errors)
    .map(([k, e]) => ({ k, message: e?.message }))
    .filter((e): e is { k: string; message: string } => typeof e.message === "string");

  return (
    // method="post": before hydration (or without JavaScript) a submit must never put the
    // contact data into a GET URL; the submit button stays disabled until hydration (A11Y-04).
    <form
      method="post"
      noValidate
      onSubmit={(event) => {
        void handleSubmit(onValid, focusSummary)(event);
      }}
      className="relative flex flex-col gap-8"
      data-reveal="off"
    >
      <RequiredUnlessOptional>
        <Honeypot value={honeypot} onChange={setHoneypot} />
        <div ref={summary} tabIndex={-1} className="outline-none">
          {errorList.length || serverError ? (
            <div role="alert" className="rounded-sm border border-danger bg-danger-subtle p-4">
              <p className="flex items-center gap-2 type-body-s font-semibold text-danger">
                <WarningCircleIcon size={18} aria-hidden="true" />
                {serverError ?? "Proverite označena polja:"}
              </p>
              {errorList.length ? (
                <ul className="mt-2 flex flex-col gap-1 pl-6.5 type-body-s">
                  {errorList.map((e) => (
                    <li key={e.k}>
                      <a
                        href={`#iq-${e.k}`}
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

        <fieldset className="flex flex-col gap-5">
          <legend className="mb-4 type-h3 text-ink-1">Vozilo</legend>
          <Field
            id="iq-vin"
            label="Broj šasije — VIN"
            optional
            error={errors.vin?.message}
            help={
              decoded && decoded.validation.valid
                ? [
                    decoded.wmi.make ?? decoded.wmi.manufacturer,
                    decoded.model ? decoded.model.model : null,
                    decoded.modelYear ? `model ${decoded.modelYear}?` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")
                : `${normalizeVin(vin ?? "").length} / 17 znakova · bez slova I, O i Q`
            }
          >
            <Input
              autoComplete="off"
              spellCheck={false}
              maxLength={20}
              inputClassName="font-mono uppercase tracking-wider"
              placeholder="WVWZZZ1KZ8W000001"
              data-testid={TEST_IDS.inquiryVinInput}
              {...keep(register("vin"))}
            />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <Field id="iq-brandSlug" label="Marka">
              <Select
                placeholder="Izaberite"
                options={config.tree.map((b) => ({ value: b.brand.slug, label: b.brand.name }))}
                {...register("brandSlug", {
                  onChange: () => {
                    setValue("modelSlug", "");
                    setValue("generationSlug", "");
                  },
                })}
              />
            </Field>
            <Field id="iq-modelSlug" label="Model">
              <Select
                placeholder={brand ? "Izaberite" : "Prvo izaberite marku"}
                disabled={!brand}
                options={(brand?.models ?? []).map((m) => ({
                  value: m.model.slug,
                  label: m.model.name,
                }))}
                {...register("modelSlug", { onChange: () => setValue("generationSlug", "") })}
              />
            </Field>
            <Field id="iq-generationSlug" label="Generacija">
              <Select
                placeholder={model ? "Izaberite" : "Prvo izaberite model"}
                disabled={!model}
                options={(model?.generations ?? []).map((g) => ({
                  value: g.slug,
                  label: `${g.name} · ${g.yearFrom}–${g.yearTo ?? ""}`,
                }))}
                {...register("generationSlug")}
              />
            </Field>
            <Field id="iq-year" label="Godište" optional error={errors.year?.message}>
              <Input inputMode="numeric" maxLength={4} placeholder="2016" {...keep(register("year"))} />
            </Field>
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-5">
          <legend className="mb-4 type-h3 text-ink-1">Šta vam treba?</legend>
          {config.prefill.productName ? (
            <p className="flex items-start gap-2 rounded-sm border border-line bg-surface-1 p-3 type-body-s text-ink-2">
              <InfoIcon size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-3" />
              Pitanje o artiklu:{" "}
              <strong className="font-semibold text-ink-1">{config.prefill.productName}</strong>
            </p>
          ) : null}
          {config.prefill.requestedCodes.length ? (
            <p className="type-body-s text-ink-2">
              Brojevi:{" "}
              <span className="type-code text-ink-1">
                {config.prefill.requestedCodes.join(", ")}
              </span>
            </p>
          ) : null}
          <Field
            id="iq-message"
            label="Opis"
            error={errors.message?.message}
            help="Naziv dela, strana (levo/desno, napred/nazad), kvar ili broj sa starog dela."
          >
            <Textarea rows={5} maxLength={2000} {...keep(register("message"))} />
          </Field>
          <div className="flex flex-col gap-2">
            <span className="type-caption text-ink-2">Kategorija (nije obavezno)</span>
            <div className="flex flex-wrap items-center gap-2">
              {categories.map((c) => (
                <button
                  key={c.slug}
                  type="button"
                  onClick={() => setCategories((prev) => prev.filter((x) => x.slug !== c.slug))}
                  aria-label={`Ukloni kategoriju ${c.name}`}
                  className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xs border border-accent bg-accent-subtle px-3 type-body-s text-ink-1"
                >
                  {c.name}
                  <XIcon size={14} aria-hidden="true" />
                </button>
              ))}
              {categories.length < 5 ? (
                <Select
                  aria-label="Dodaj kategoriju"
                  className="w-auto min-w-56"
                  placeholder="Dodaj kategoriju"
                  value=""
                  options={config.categories
                    .filter((c) => !categories.some((x) => x.slug === c.slug))
                    .map((c) => ({ value: c.slug, label: c.name }))}
                  onChange={(e) => {
                    const hit = config.categories.find((c) => c.slug === e.target.value);
                    if (hit) setCategories((prev) => [...prev, hit].slice(0, 5));
                  }}
                />
              ) : null}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <span className="type-caption text-ink-2">Fotografije (nije obavezno)</span>
            <PhotoPicker photos={photos} onChange={setPhotos} />
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-5">
          <legend className="mb-4 type-h3 text-ink-1">Kontakt</legend>
          <div className="grid gap-5 sm:grid-cols-3">
            <Field id="iq-name" label="Ime" error={errors.name?.message}>
              <Input autoComplete="name" {...keep(register("name"))} />
            </Field>
            <Field id="iq-phone" label="Telefon" error={errors.phone?.message}>
              <Input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="064 123 4567"
                {...keep(register("phone"))}
              />
            </Field>
            <Field
              id="iq-email"
              label="E-pošta"
              optional={channel !== "email"}
              error={errors.email?.message}
            >
              <Input type="email" inputMode="email" autoComplete="email" {...keep(register("email"))} />
            </Field>
          </div>
          <Controller
            control={control}
            name="channel"
            render={({ field }) => (
              <RadioGroup
                label="Kako da vam odgovorimo?"
                value={field.value}
                onValueChange={field.onChange}
                className="[&_[role=radiogroup]]:flex-row [&_[role=radiogroup]]:flex-wrap [&_[role=radiogroup]]:gap-x-6"
                options={(["phone", "viber", "whatsapp", "email"] as const).map((c) => ({
                  value: c,
                  label: PREFERRED_CHANNEL_LABEL[c],
                }))}
              />
            )}
          />
          <div>
            <Controller
              control={control}
              name="consent"
              render={({ field }) => (
                <Checkbox
                  id="iq-consent"
                  checked={field.value}
                  onCheckedChange={(c) => field.onChange(c === true)}
                  onBlur={field.onBlur}
                  required
                  error={errors.consent?.message}
                  label={
                    <span>
                      Slažem se da podatke iz upita koristite za odgovor, prema{" "}
                      <Link href={ROUTES.privacy} variant="inline" target="_blank">
                        politici privatnosti
                      </Link>
                      .
                    </span>
                  }
                />
              )}
            />
          </div>
        </fieldset>

        <div className="flex flex-col items-start gap-3 border-t border-line pt-6">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            icon={<PaperPlaneTiltIcon size={20} />}
            loading={busy}
            disabled={!hydrated}
            data-testid={TEST_IDS.inquirySubmit}
          >
            Pošalji upit
          </Button>
          <FormNoScript>
            Za slanje upita potreban je JavaScript. Uključite ga u pregledaču, pa osvežite stranicu.
          </FormNoScript>
          <p className="type-caption font-normal text-ink-3">
            Odgovaramo u toku radnog dana, kanalom koji ste izabrali.
          </p>
        </div>
      </RequiredUnlessOptional>
    </form>
  );
}
