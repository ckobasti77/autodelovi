"use client";

/**
 * VIN / part inquiry (§10.7, ARCHITECTURE §A2): VIN with live VAG decode (WMI → make, model code
 * → generation suggestion, position 10 → year hint), vehicle selects, what is needed, up to 5
 * photos, contact + reply channel, consent. Honeypot + timing + rate limit in Convex.
 *
 * Three form groups, each one panel and one reveal block: „Vozilo“, „Šta vam treba?“,
 * „Kontakt“. The VIN help is beside the first group on desktop (the page's aside); on phones
 * it opens directly under the VIN field (`vinHelp`), never after the submit button.
 */
import { useMutation } from "convex/react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import {
  CaretDownIcon,
  CheckCircleIcon,
  InfoIcon,
  PaperPlaneTiltIcon,
  QuestionIcon,
  WarningCircleIcon,
  XIcon,
} from "@phosphor-icons/react/dist/ssr";

import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/cn";
import { buildConsent, formStartTime } from "@/lib/validation/consent";
import type { Id } from "@/convex/_generated/dataModel";
import type { VehicleTree } from "@/lib/catalog/types";
import { whenIdle } from "@/lib/dom/idle";
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
import type { InquiryValues } from "@/lib/validation/inquiry";
import { lazyResolver } from "@/lib/validation/lazyResolver";
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
import { Reveal } from "@/components/reveal/Reveal";
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

type TreeBrand = VehicleTree[number];
type TreeModel = TreeBrand["models"][number];

/**
 * The vehicle tree reduced to the fields this form reads (ids, names, slugs, years, VIN model
 * codes): the page serializes it into the RSC payload, where the full tree is ~3× larger
 * (PERF-01).
 */
export type InquiryVehicleTree = {
  brand: Pick<TreeBrand["brand"], "_id" | "name" | "slug">;
  models: {
    model: Pick<TreeModel["model"], "_id" | "name" | "slug">;
    generations: Pick<
      TreeModel["generations"][number],
      "_id" | "name" | "slug" | "yearFrom" | "yearTo" | "vinModelCodes"
    >[];
  }[];
}[];

export type InquiryConfig = {
  tree: InquiryVehicleTree;
  categories: { slug: string; name: string }[];
  legal: { terms: string; privacy: string };
  viewer: { name: string; email: string; phone: string } | null;
  prefill: InquiryPrefill;
};

/** Text controls a visitor can type into before hydration (XB-01). */
type TextField = "vin" | "year" | "message" | "name" | "phone" | "email";

/**
 * zod and the schema load on demand, not with the page (PERF-01): warmed in idle time after
 * hydration and on the first focus in the form, awaited by the first validation at the latest.
 */
const validation = lazyResolver(() =>
  import("@/lib/validation/inquiryResolver").then((m) => m.inquiryResolver),
);
const warmValidation = () => void validation.preload().catch(() => undefined);

/** One form group: a resting panel (§5.5) that arrives as one block. */
const GROUP = "panel p-4 sm:p-6";
const LEGEND = "mb-4 type-h3 text-ink-1";
const VIN_HELP_ID = "iq-vin-help";

export function InquiryForm({
  config,
  vinHelp,
}: {
  config: InquiryConfig;
  /** „Gde je broj šasije?“ for phones: opens under the VIN field (the aside shows it from lg). */
  vinHelp?: ReactNode;
}) {
  const submit = useMutation(api.inquiries.submit);
  const stored = useSelectedVehicle();
  const [helpOpen, setHelpOpen] = useState(false);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [categories, setCategories] = useState(config.prefill.categories);
  const [honeypot, setHoneypot] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [startedAt] = useState(formStartTime);
  const summary = useRef<HTMLDivElement>(null);
  const hydrated = useHydrated();
  const form = useForm<InquiryValues>({
    resolver: validation.resolver,
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

  useEffect(() => whenIdle(warmValidation), []);

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

  const vinLength = normalizeVin(vin ?? "").length;
  // What the VIN says about the vehicle, once it is a valid one („Volkswagen · Golf · model 2008?“).
  const recognized =
    decoded && decoded.validation.valid
      ? [
          decoded.wmi.make ?? decoded.wmi.manufacturer,
          decoded.model ? decoded.model.model : null,
          decoded.modelYear ? `model ${decoded.modelYear}?` : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : "";

  return (
    // method="post": before hydration (or without JavaScript) a submit must never put the
    // contact data into a GET URL; the submit button stays disabled until hydration (A11Y-04).
    <form
      method="post"
      noValidate
      onFocus={warmValidation}
      onSubmit={(event) => {
        // A new attempt replaces the previous attempt's message (field errors list themselves).
        setServerError(null);
        handleSubmit(
          onValid,
          focusSummary,
        )(event).catch(() => {
          // Only the on-demand validation code can fail here (offline, a deploy in between);
          // onValid handles its own errors. The next submit retries the import.
          setServerError("Upit nije poslat — proverite vezu sa internetom i pokušajte ponovo.");
          focusSummary();
        });
      }}
      className="relative flex flex-col gap-4 sm:gap-5"
      data-reveal="off"
    >
      <RequiredUnlessOptional>
        <Honeypot value={honeypot} onChange={setHoneypot} />
        <div ref={summary} tabIndex={-1} className="outline-none empty:hidden">
          {errorList.length || serverError ? (
            <div role="alert" className="rounded-md border border-danger bg-danger-subtle p-4">
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

        <Reveal eager className={GROUP}>
          <fieldset className="min-w-0">
            <legend className={LEGEND}>Vozilo</legend>
            {/*
              From xl one row of four, the year in a narrow last column: the dependent selects
              keep the width their „Prvo izaberite marku“ needs.
            */}
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-[repeat(3,minmax(0,1fr))_9.5rem]">
              <Field
                id="iq-vin"
                label="Broj šasije — VIN"
                optional
                className="sm:col-span-2"
                error={errors.vin?.message}
                help={`${vinLength} / 17 znakova · bez slova I, O i Q`}
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
              {vinHelp ? (
                <div className="-mt-2 sm:col-span-2 lg:hidden">
                  <button
                    type="button"
                    aria-expanded={helpOpen}
                    aria-controls={VIN_HELP_ID}
                    onClick={() => setHelpOpen((open) => !open)}
                    className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-sm type-body-s font-semibold text-ink-1"
                  >
                    <QuestionIcon size={18} aria-hidden="true" className="shrink-0 text-ink-3" />
                    <span className="underline decoration-line-strong underline-offset-4">
                      Gde je broj šasije?
                    </span>
                    <CaretDownIcon
                      size={14}
                      aria-hidden="true"
                      className={cn("shrink-0 text-ink-3", helpOpen && "rotate-180")}
                    />
                  </button>
                  <div id={VIN_HELP_ID} hidden={!helpOpen} className="mt-1 panel-inset p-4">
                    {vinHelp}
                  </div>
                </div>
              ) : null}
              {/* Live value: what the VIN says, as soon as it is a valid one. */}
              <div
                className={cn("flex flex-col gap-2 sm:col-span-2", !recognized && "max-lg:hidden")}
              >
                <span id="iq-vin-read" className="type-caption text-ink-2">
                  Prepoznato iz broja šasije
                </span>
                <p
                  role="status"
                  aria-labelledby="iq-vin-read"
                  className="flex min-h-11 items-center gap-2 panel-inset px-3 py-2 type-body-s"
                >
                  {recognized ? (
                    <>
                      <CheckCircleIcon
                        size={18}
                        weight="fill"
                        aria-hidden="true"
                        className="shrink-0 text-success"
                      />
                      <span className="text-ink-1">{recognized}</span>
                    </>
                  ) : (
                    <span className="text-ink-3">
                      Posle 17. znaka: marka, model i godište.
                    </span>
                  )}
                </p>
              </div>
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
                <Input
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="2016"
                  {...keep(register("year"))}
                />
              </Field>
            </div>
          </fieldset>
        </Reveal>

        {/* Its top is on the first screen at 1440: eager, like the first group. */}
        <Reveal eager index={1} className={GROUP}>
          <fieldset className="flex min-w-0 flex-col gap-5">
            <legend className={LEGEND}>Šta vam treba?</legend>
            {config.prefill.productName ? (
              <p className="flex items-start gap-2 panel-inset p-3 type-body-s text-ink-2">
                <InfoIcon size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-3" />
                <span>
                  Pitanje o artiklu:{" "}
                  <strong className="font-semibold text-ink-1">{config.prefill.productName}</strong>
                </span>
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
              <span className="type-caption text-ink-2">
                Kategorija <span className="font-normal text-ink-3">(nije obavezno)</span>
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {categories.map((c) => (
                  <button
                    key={c.slug}
                    type="button"
                    onClick={() => setCategories((prev) => prev.filter((x) => x.slug !== c.slug))}
                    aria-label={`Ukloni kategoriju ${c.name}`}
                    className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-sm border border-accent bg-accent-subtle px-3 type-body-s text-ink-1 transition-control active:translate-y-px"
                  >
                    {c.name}
                    <XIcon size={14} aria-hidden="true" />
                  </button>
                ))}
                {categories.length < 5 ? (
                  <Select
                    aria-label="Dodaj kategoriju"
                    className="w-full sm:w-auto sm:min-w-64"
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
              <span className="type-caption text-ink-2">
                Fotografije <span className="font-normal text-ink-3">(nije obavezno)</span>
              </span>
              <PhotoPicker photos={photos} onChange={setPhotos} />
            </div>
          </fieldset>
        </Reveal>

        <Reveal className={GROUP}>
          <fieldset className="flex min-w-0 flex-col gap-5">
            <legend className={LEGEND}>Kontakt</legend>
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
                <Input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  {...keep(register("email"))}
                />
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
            <div className="border-t border-line pt-4">
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
        </Reveal>

        {/* Not a reveal block: the one action of the form is never hidden for an effect. */}
        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:gap-5">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            icon={<PaperPlaneTiltIcon size={20} />}
            loading={busy}
            disabled={!hydrated}
            data-testid={TEST_IDS.inquirySubmit}
            className="w-full sm:w-auto"
          >
            Pošalji upit
          </Button>
          <div className="flex flex-col gap-2">
            <FormNoScript>
              Za slanje upita potreban je JavaScript. Uključite ga u pregledaču, pa osvežite
              stranicu.
            </FormNoScript>
            <p className="type-caption font-normal text-ink-3">
              Odgovaramo u toku radnog dana, kanalom koji ste izabrali.
            </p>
          </div>
        </div>
      </RequiredUnlessOptional>
    </form>
  );
}
