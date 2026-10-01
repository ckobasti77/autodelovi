"use client";

/**
 * Inquiry status + quote (`/upit/[token]`, ARCHITECTURE §A2): live status and timeline; when a
 * quote is sent the customer sees lines, availability, lead time and validity, and can accept
 * (→ order), decline, or ask for a renewed quote after expiry.
 */
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  CheckCircleIcon,
  ClockCounterClockwiseIcon,
  WarningCircleIcon,
  XCircleIcon,
} from "@phosphor-icons/react/dist/ssr";

import { api } from "@/convex/_generated/api";
import { checkoutSchema, formFieldForServerField } from "@/lib/validation/checkout";
import { buildConsent } from "@/lib/validation/consent";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { formatRSD } from "@/lib/format/money";
import { formatPhone, normalizePhone } from "@/lib/format/phone";
import { normalizeEmail } from "@/lib/domain/identifiers";
import { leadTimeLabel } from "@/lib/i18n/sr/catalog";
import {
  convexErrorField,
  convexErrorMessage,
  INQUIRY_STATUS_LABEL,
  INQUIRY_STATUS_TONE,
  PREFERRED_CHANNEL_LABEL,
  type DeliveryCode,
  type PaymentCode,
} from "@/lib/i18n/sr/shop";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Link } from "@/components/ui/Link";
import { RadioGroup } from "@/components/ui/Radio";
import { Textarea } from "@/components/ui/Textarea";
import { toast } from "@/components/ui/Toast";
import { ROUTES } from "@/constants/routes";
import { TEST_IDS } from "@/constants/testIds";

export type InquiryView = NonNullable<FunctionReturnType<typeof api.inquiries.getByToken>>;

export type AcceptConfig = {
  deliveryMethods: { code: DeliveryCode; label: string; pricePara: number }[];
  paymentMethods: {
    code: PaymentCode;
    label: string;
    requires: string;
    deliveryCodes: DeliveryCode[];
  }[];
  legal: { terms: string; privacy: string };
};

type AcceptField =
  | "firstName"
  | "lastName"
  | "phone"
  | "email"
  | "companyName"
  | "pib"
  | "mb"
  | "street"
  | "postalCode"
  | "city"
  | "paymentMethod"
  | "terms";

/** Summary and focus order (top to bottom of the form). */
const ACCEPT_FIELDS: readonly AcceptField[] = [
  "firstName",
  "lastName",
  "phone",
  "email",
  "companyName",
  "pib",
  "mb",
  "street",
  "postalCode",
  "city",
  "paymentMethod",
  "terms",
];

const isAcceptField = (f: string | null): f is AcceptField =>
  f !== null && (ACCEPT_FIELDS as readonly string[]).includes(f);

const fieldId = (f: AcceptField) => `qa-${f}`;

type AcceptErrors = Partial<Record<AcceptField, string>>;

/**
 * Form-level error summary (DS §9.2, the checkout pattern): it takes focus once per failed
 * submit (`attempt` grows only then) and links every message to its field.
 */
function AcceptErrorSummary({ errors, attempt }: { errors: AcceptErrors; attempt: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const list = ACCEPT_FIELDS.flatMap((f) => {
    const message = errors[f];
    return message ? [{ f, message }] : [];
  });
  useEffect(() => {
    if (attempt > 0) ref.current?.focus();
  }, [attempt]);
  if (!list.length) return null;
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alert"
      data-reveal="off"
      data-testid="quote-accept-errors"
      className="rounded-sm border border-danger bg-danger-subtle p-4 outline-none"
    >
      <p className="flex items-center gap-2 type-body-s font-semibold text-danger">
        <WarningCircleIcon size={18} aria-hidden="true" />
        Proverite {list.length === 1 ? "jedno polje" : `${list.length} polja`}:
      </p>
      <ul className="mt-2 flex flex-col gap-1 pl-6.5 type-body-s">
        {list.map((e) => (
          <li key={e.f}>
            <a
              href={`#${fieldId(e.f)}`}
              className="text-ink-1 underline decoration-line-strong underline-offset-4 hover:decoration-accent"
            >
              {e.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AcceptForm({
  token,
  inquiry,
  config,
}: {
  token: string;
  inquiry: InquiryView;
  config: AcceptConfig;
}) {
  const accept = useMutation(api.inquiries.acceptQuote);
  const [first, ...rest] = inquiry.contactName.split(" ");
  const [v, setV] = useState({
    firstName: first ?? "",
    lastName: rest.join(" "),
    email: inquiry.prefill.email ?? "",
    phone: inquiry.prefill.phone ? formatPhone(inquiry.prefill.phone) : "",
    isCompany: false,
    companyName: "",
    pib: "",
    mb: "",
    delivery: (config.deliveryMethods[0]?.code ?? "pickup") as DeliveryCode,
    payment: "" as PaymentCode | "",
    street: "",
    city: "",
    postalCode: "",
    terms: false,
  });
  const [errors, setErrors] = useState<AcceptErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  // The checkout offer: predračun once the buyer is a company, deferred payment only for the
  // signed-in approved mechanic who owns the inquiry (the server re-checks both, QA FLOW-08).
  const payments = config.paymentMethods.filter(
    (p) =>
      p.deliveryCodes.includes(v.delivery) &&
      (p.requires === "none" ||
        (p.requires === "company" && v.isCompany) ||
        (p.requires === "mechanic_credit" && inquiry.deferredCredit !== null)),
  );
  const payment = payments.find((p) => p.code === v.payment)?.code ?? payments[0]?.code;
  const credit = inquiry.deferredCredit?.availablePara ?? null;

  const update = (patch: Partial<typeof v>) => {
    setV({ ...v, ...patch });
    // A corrected field drops its message; focus never moves on change.
    const touched = Object.keys(patch).map((k) => (k === "payment" ? "paymentMethod" : k));
    if (touched.some((k) => k in errors)) {
      const next = { ...errors };
      for (const k of touched) if (isAcceptField(k)) delete next[k];
      setErrors(next);
    }
  };

  const showErrors = (next: AcceptErrors) => {
    setErrors(next);
    setAttempt((a) => a + 1);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!payment) return showErrors({ paymentMethod: "Izaberite način plaćanja." });
    const parsed = checkoutSchema.safeParse({
      firstName: v.firstName,
      lastName: v.lastName,
      phone: v.phone,
      email: v.email,
      isCompany: v.isCompany,
      companyName: v.companyName,
      pib: v.pib,
      mb: v.mb,
      deliveryMethod: v.delivery,
      street: v.street,
      city: v.city,
      postalCode: v.postalCode,
      addressNote: "",
      paymentMethod: payment,
      vin: "",
      useVehicle: false,
      note: "",
      terms: v.terms,
    });
    if (!parsed.success) {
      const next: AcceptErrors = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0]);
        if (isAcceptField(key) && !next[key]) next[key] = issue.message;
      }
      return showErrors(next);
    }
    setErrors({});
    setBusy(true);
    const d = parsed.data;
    try {
      const r = await accept({
        token,
        quoteId: inquiry.quote!.quoteId,
        contact: {
          firstName: d.firstName,
          lastName: d.lastName,
          email: normalizeEmail(d.email),
          phone: normalizePhone(d.phone)!,
        },
        ...(d.isCompany
          ? { company: { name: d.companyName, pib: d.pib, ...(d.mb ? { mb: d.mb } : {}) } }
          : {}),
        delivery: {
          method: d.deliveryMethod,
          ...(d.deliveryMethod === "courier"
            ? { address: { street: d.street, city: d.city, postalCode: d.postalCode } }
            : {}),
        },
        payment: { method: d.paymentMethod },
        consent: buildConsent(config.legal),
      });
      // Full load: analytics must only see the token page through its redacted URL.
      window.location.assign(ROUTES.orderThanks(r.orderToken));
    } catch (err) {
      setBusy(false);
      const message = convexErrorMessage(
        err,
        "Ponuda nije prihvaćena. Pokušajte ponovo ili nas pozovite.",
      );
      const field = formFieldForServerField(convexErrorField(err));
      if (isAcceptField(field)) showErrors({ [field]: message });
      else setFormError(message);
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-5 rounded-sm border border-line bg-surface-1 p-5"
      data-reveal="off"
    >
      <h3 className="type-h4 text-ink-1">Podaci za porudžbinu</h3>
      <AcceptErrorSummary errors={errors} attempt={attempt} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={fieldId("firstName")} label="Ime" error={errors.firstName}>
          <Input
            autoComplete="given-name"
            value={v.firstName}
            onChange={(e) => update({ firstName: e.target.value })}
          />
        </Field>
        <Field id={fieldId("lastName")} label="Prezime" error={errors.lastName}>
          <Input
            autoComplete="family-name"
            value={v.lastName}
            onChange={(e) => update({ lastName: e.target.value })}
          />
        </Field>
        <Field id={fieldId("phone")} label="Telefon" error={errors.phone}>
          <Input
            type="tel"
            autoComplete="tel"
            value={v.phone}
            onChange={(e) => update({ phone: e.target.value })}
          />
        </Field>
        <Field id={fieldId("email")} label="E-pošta" error={errors.email}>
          <Input
            type="email"
            autoComplete="email"
            value={v.email}
            onChange={(e) => update({ email: e.target.value })}
          />
        </Field>
      </div>
      <Checkbox
        checked={v.isCompany}
        onCheckedChange={(c) => update({ isCompany: c === true })}
        label="Kupujem kao firma"
      />
      {v.isCompany ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id={fieldId("companyName")}
            label="Naziv firme"
            error={errors.companyName}
            className="sm:col-span-2"
          >
            <Input
              autoComplete="organization"
              value={v.companyName}
              onChange={(e) => update({ companyName: e.target.value })}
            />
          </Field>
          <Field id={fieldId("pib")} label="PIB" error={errors.pib}>
            <Input
              inputMode="numeric"
              maxLength={9}
              value={v.pib}
              onChange={(e) => update({ pib: e.target.value })}
            />
          </Field>
          <Field id={fieldId("mb")} label="Matični broj" optional error={errors.mb}>
            <Input
              inputMode="numeric"
              maxLength={8}
              value={v.mb}
              onChange={(e) => update({ mb: e.target.value })}
            />
          </Field>
        </div>
      ) : null}
      <RadioGroup
        label="Dostava"
        value={v.delivery}
        onValueChange={(d) => update({ delivery: d as DeliveryCode })}
        options={config.deliveryMethods.map((d) => ({
          value: d.code,
          label: `${d.label} · ${formatRSD(d.pricePara)}`,
        }))}
      />
      {v.delivery === "courier" ? (
        <div className="grid gap-4 sm:grid-cols-6">
          <Field
            id={fieldId("street")}
            label="Ulica i broj"
            className="sm:col-span-6"
            error={errors.street}
          >
            <Input
              autoComplete="street-address"
              value={v.street}
              onChange={(e) => update({ street: e.target.value })}
            />
          </Field>
          <Field
            id={fieldId("postalCode")}
            label="Poštanski broj"
            className="sm:col-span-2"
            error={errors.postalCode}
          >
            <Input
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={5}
              value={v.postalCode}
              onChange={(e) => update({ postalCode: e.target.value })}
            />
          </Field>
          <Field id={fieldId("city")} label="Mesto" className="sm:col-span-4" error={errors.city}>
            <Input
              autoComplete="address-level2"
              value={v.city}
              onChange={(e) => update({ city: e.target.value })}
            />
          </Field>
        </div>
      ) : null}
      <RadioGroup
        id={fieldId("paymentMethod")}
        label="Plaćanje"
        value={payment}
        onValueChange={(p) => update({ payment: p as PaymentCode })}
        options={payments.map((p) => ({
          value: p.code,
          label:
            p.code === "deferred" && credit !== null
              ? `${p.label} · preostali limit ${formatRSD(credit)}`
              : p.label,
        }))}
        error={errors.paymentMethod}
      />
      <Checkbox
        id={fieldId("terms")}
        checked={v.terms}
        onCheckedChange={(c) => update({ terms: c === true })}
        error={errors.terms}
        label={
          <span>
            Prihvatam{" "}
            <Link href={ROUTES.terms} variant="inline" target="_blank">
              uslove kupovine
            </Link>
            .
          </span>
        }
      />
      {formError ? (
        <p role="alert" className="type-body-s text-danger">
          {formError}
        </p>
      ) : null}
      <Button
        type="submit"
        variant="primary"
        size="lg"
        loading={busy}
        data-testid="quote-accept-submit"
        className="w-full sm:w-auto sm:self-start"
      >
        Pošalji porudžbinu po ponudi
      </Button>
    </form>
  );
}

export function InquiryStatusView({
  token,
  initial,
  config,
}: {
  token: string;
  initial: InquiryView;
  config: AcceptConfig;
}) {
  const live = useQuery(api.inquiries.getByToken, { token });
  const i = live ?? initial;
  const decline = useMutation(api.inquiries.declineQuote);
  const renew = useMutation(api.inquiries.requestRenewal);
  const [mode, setMode] = useState<"idle" | "accept" | "decline">("idle");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [now] = useState(() => Date.now());
  const q = i.quote;
  const open = q && q.status === "sent" && q.validUntil >= now && i.status === "ponuda_poslata";
  const expired = i.status === "istekla" || (q && q.status === "sent" && q.validUntil < now);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      setMode("idle");
    } catch (err) {
      toast.error(convexErrorMessage(err, "Nije uspelo. Pokušajte ponovo ili nas pozovite."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-10 lg:grid-cols-12 lg:gap-x-(--gutter)" data-reveal="off">
      <div className="flex flex-col gap-8 lg:col-span-7">
        <div className="flex flex-wrap items-center gap-3">
          <span className="type-code-l text-ink-1">{i.number}</span>
          <Badge tone={INQUIRY_STATUS_TONE[i.status]} size="text">
            {INQUIRY_STATUS_LABEL[i.status]}
          </Badge>
          <span className="type-caption font-normal text-ink-3">{formatDateTime(i.createdAt)}</span>
        </div>

        {q ? (
          <section aria-labelledby="quote-title" className="flex flex-col gap-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="quote-title" className="type-h2 text-ink-1">
                Ponuda{q.version > 1 ? ` (izmena ${q.version})` : ""}
              </h2>
              <span className={expired ? "type-body-s text-warning" : "type-body-s text-ink-3"}>
                {expired
                  ? `Istekla ${formatDate(q.validUntil)}`
                  : `Važi do ${formatDate(q.validUntil)}`}
              </span>
            </div>
            <ul className="flex flex-col divide-y divide-line border-y border-line">
              {q.lines.map((l, idx) => (
                <li key={idx} className="flex justify-between gap-4 py-3 type-body-s">
                  <span className="min-w-0">
                    <span className="block text-ink-1">
                      {l.productSlug ? (
                        <Link href={ROUTES.product(l.productSlug)} variant="inline">
                          {l.name}
                        </Link>
                      ) : (
                        l.name
                      )}
                    </span>
                    <span className="block type-caption text-ink-3">
                      {[
                        l.manufacturer,
                        l.availability === "in_stock"
                          ? "na stanju"
                          : `po porudžbini${l.leadTimeDays ? ` · ${leadTimeLabel(l.leadTimeDays)}` : ""}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                      {" · "}
                      {l.quantity} × {formatRSD(l.unitPricePara)}
                    </span>
                    {l.note ? (
                      <span className="block type-caption text-ink-3">{l.note}</span>
                    ) : null}
                  </span>
                  <span className="shrink-0 tabular-nums text-ink-1">
                    {formatRSD(l.lineTotalPara)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="flex items-baseline justify-between">
              <span className="font-semibold text-ink-1">Ukupno</span>
              <span className="type-numeral-m tabular-nums text-ink-1">
                {formatRSD(q.totalPara)}
              </span>
            </p>
            {q.deliveryNote ? <p className="type-body-s text-ink-2">{q.deliveryNote}</p> : null}

            {open && mode === "idle" ? (
              <div className="grid gap-3 sm:flex sm:flex-wrap">
                <Button
                  variant="primary"
                  size="lg"
                  icon={<CheckCircleIcon size={20} />}
                  onClick={() => setMode("accept")}
                  data-testid={TEST_IDS.quoteAccept}
                >
                  Prihvati ponudu
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  icon={<XCircleIcon size={20} />}
                  onClick={() => setMode("decline")}
                >
                  Odbij ponudu
                </Button>
              </div>
            ) : null}
            {open && mode === "accept" ? (
              <AcceptForm token={token} inquiry={i} config={config} />
            ) : null}
            {open && mode === "decline" ? (
              <div className="flex flex-col gap-3 rounded-sm border border-line bg-surface-1 p-5">
                <Field label="Razlog" optional>
                  <Textarea
                    rows={3}
                    maxLength={500}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </Field>
                <div className="flex gap-3">
                  <Button
                    variant="danger"
                    loading={busy}
                    onClick={() =>
                      run(
                        () =>
                          decline({
                            token,
                            quoteId: q.quoteId,
                            ...(reason.trim() ? { reason: reason.trim() } : {}),
                          }),
                        "Ponuda je odbijena.",
                      )
                    }
                  >
                    Odbij ponudu
                  </Button>
                  <Button variant="ghost" onClick={() => setMode("idle")}>
                    Nazad
                  </Button>
                </div>
              </div>
            ) : null}
            {expired && i.status === "istekla" ? (
              <Button
                variant="primary"
                icon={<ClockCounterClockwiseIcon size={20} />}
                loading={busy}
                onClick={() =>
                  run(
                    () => renew({ token }),
                    "Zatražili ste novu ponudu. Javljamo se u toku radnog dana.",
                  )
                }
                className="self-start"
              >
                Zatraži novu ponudu
              </Button>
            ) : null}
            {i.orderNumber ? (
              <p className="type-body text-success">
                Ponuda je prihvaćena — porudžbina <span className="type-code">{i.orderNumber}</span>
                .
              </p>
            ) : null}
          </section>
        ) : (
          <section className="rounded-sm border border-line bg-surface-1 p-5">
            <h2 className="type-h4 text-ink-1">Ponuda još nije spremna</h2>
            <p className="mt-2 type-body-s text-ink-2">
              Proveravamo kod dobavljača. Odgovor stiže kanalom koji ste izabrali (
              {PREFERRED_CHANNEL_LABEL[i.preferredChannel].toLowerCase()}), a ponuda će se pojaviti
              i ovde.
            </p>
          </section>
        )}
        {i.closedReason && i.status === "odbijena" ? (
          <p className="type-body-s text-ink-2">Napomena: {i.closedReason}</p>
        ) : null}
      </div>
      <aside className="flex flex-col gap-6 lg:col-span-5">
        <section className="rounded-sm border border-line bg-surface-1 p-5">
          <h2 className="type-h4 text-ink-1">Vaš upit</h2>
          {i.vehicleLabel ? <p className="mt-2 type-body-s text-ink-2">{i.vehicleLabel}</p> : null}
          {i.vin ? <p className="mt-1 type-code text-ink-1">{i.vin}</p> : null}
          <p className="mt-3 whitespace-pre-line type-body-s text-ink-2">{i.message}</p>
          {i.photoCount ? (
            <p className="mt-2 type-caption font-normal text-ink-3">Fotografija: {i.photoCount}</p>
          ) : null}
        </section>
        <section>
          <h2 className="type-h4 text-ink-1">Tok upita</h2>
          <ol className="mt-3 flex flex-col gap-3 border-l border-line-strong pl-4">
            {i.timeline.map((e, idx) => (
              <li key={idx} className="flex flex-col">
                <span className="type-body-s text-ink-1">{e.message ?? "Izmena"}</span>
                <span className="type-caption font-normal tabular-nums text-ink-3">
                  {formatDateTime(e.at)}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-3 type-caption font-normal text-ink-3">
            {i.emailUpdates
              ? "Ponudu i svaku promenu šaljemo i e-poštom. Ova stranica se osvežava sama."
              : "Ponudu i svaku promenu vidite na ovoj stranici — osvežava se sama."}
          </p>
        </section>
      </aside>
    </div>
  );
}
