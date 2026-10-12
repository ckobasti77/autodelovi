"use client";

/**
 * Inquiry status + quote (`/upit/[token]`, ARCHITECTURE §A2): live status and timeline; when a
 * quote is sent the customer sees lines, availability, lead time and validity, and can accept
 * (→ order), decline, or ask for a renewed quote after expiry.
 *
 * A record page in one panel language (UI-BOOST §8): the quote is one panel — lines, total and
 * its one primary action — with the inquiry and its timeline as panels beside it. The forms
 * that open on „Prihvati“ / „Odbij“ are panels of their own and appear at once (a state
 * change, not an arrival).
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
import { cn } from "@/lib/cn";
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
import { Reveal } from "@/components/reveal/Reveal";
import { InquirySteps } from "@/components/inquiry/InquirySteps";
import { InquirySummary } from "@/components/inquiry/InquirySummary";
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
      className="rounded-md border border-danger bg-danger-subtle p-4 outline-none"
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
  onCancel,
}: {
  token: string;
  inquiry: InquiryView;
  config: AcceptConfig;
  /** Back to the quote without sending anything. */
  onCancel: () => void;
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
      className="flex flex-col gap-5 panel p-4 sm:p-6"
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
      <div className="flex flex-col gap-3 border-t border-line pt-5 sm:flex-row">
        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={busy}
          data-testid="quote-accept-submit"
          className="w-full sm:w-auto"
        >
          Pošalji porudžbinu po ponudi
        </Button>
        <Button variant="ghost" size="lg" onClick={onCancel} className="w-full sm:w-auto">
          Nazad
        </Button>
      </div>
    </form>
  );
}

/**
 * „Tok upita“: the events of the inquiry, oldest first, on one rail; the latest one carries
 * the accent ring of the order timeline (§10.6).
 */
function InquiryTimeline({ events }: { events: InquiryView["timeline"] }) {
  return (
    <ol className="relative flex flex-col">
      {events.map((e, idx) => {
        const latest = idx === events.length - 1;
        return (
          <li key={idx} className="relative flex gap-3.5 pb-5 last:pb-0">
            {latest ? null : (
              <span
                aria-hidden="true"
                className="absolute top-5 bottom-0 left-[7px] w-px bg-line-strong"
              />
            )}
            <span
              aria-hidden="true"
              className={cn(
                "relative mt-0.5 inline-flex size-4 shrink-0 rounded-full border",
                latest ? "border-2 border-accent bg-bg" : "border-line-strong bg-surface-3",
              )}
            />
            <div className="flex min-w-0 flex-col">
              <span className="type-body-s text-ink-1">{e.message ?? "Izmena"}</span>
              <span className="type-caption font-normal tabular-nums text-ink-3">
                {formatDateTime(e.at)}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
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
  // Without a quote: still being checked (the steps), or closed by the shop (the note).
  const waiting = i.status === "nov" || i.status === "u_obradi";

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
    <div className="flex flex-col gap-6" data-reveal="off">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="type-code-l text-ink-1">{i.number}</span>
        <Badge tone={INQUIRY_STATUS_TONE[i.status]} size="text">
          {INQUIRY_STATUS_LABEL[i.status]}
        </Badge>
        <span className="type-caption font-normal tabular-nums text-ink-3">
          {formatDateTime(i.createdAt)}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-12 lg:gap-x-(--gutter)">
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-7">
          {q ? (
            <Reveal as="section" eager aria-labelledby="quote-title" className="panel">
              <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 pt-4 sm:px-6 sm:pt-5">
                <h2 id="quote-title" className="type-h3 text-ink-1">
                  Ponuda{q.version > 1 ? ` (izmena ${q.version})` : ""}
                </h2>
                <span
                  className={cn(
                    "type-body-s tabular-nums",
                    expired ? "text-warning" : "text-ink-3",
                  )}
                >
                  {expired
                    ? `Istekla ${formatDate(q.validUntil)}`
                    : `Važi do ${formatDate(q.validUntil)}`}
                </span>
              </div>
              <ul className="mt-4 flex flex-col border-t border-line">
                {q.lines.map((l, idx) => (
                  <li
                    key={idx}
                    className="flex justify-between gap-4 border-b border-line-faint px-4 py-3.5 type-body-s last:border-b-0 sm:px-6"
                  >
                    <span className="min-w-0">
                      <span className="block font-semibold text-ink-1">
                        {l.productSlug ? (
                          <Link href={ROUTES.product(l.productSlug)} variant="inline">
                            {l.name}
                          </Link>
                        ) : (
                          l.name
                        )}
                      </span>
                      <span className="mt-0.5 block type-caption font-normal text-ink-3">
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
                        <span className="mt-0.5 block type-caption font-normal text-ink-3">
                          {l.note}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 type-numeral-s text-ink-1">
                      {formatRSD(l.lineTotalPara)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="flex items-baseline justify-between gap-4 border-t border-line-strong px-4 py-4 sm:px-6">
                <span className="type-body font-semibold text-ink-1">Ukupno</span>
                <span className="type-numeral-m text-ink-1">{formatRSD(q.totalPara)}</span>
              </p>
              {q.deliveryNote ? (
                <p className="border-t border-line-faint px-4 py-3.5 type-body-s text-ink-2 sm:px-6">
                  {q.deliveryNote}
                </p>
              ) : null}

              {open && mode === "idle" ? (
                <div className="grid gap-3 border-t border-line px-4 py-4 sm:flex sm:flex-wrap sm:px-6 sm:py-5">
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
              {expired && i.status === "istekla" ? (
                <div className="flex flex-col gap-3 border-t border-line px-4 py-4 sm:flex-row sm:items-center sm:gap-5 sm:px-6 sm:py-5">
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
                    className="w-full shrink-0 sm:w-auto"
                  >
                    Zatraži novu ponudu
                  </Button>
                </div>
              ) : null}
              {i.orderNumber ? (
                <p className="flex items-start gap-2 border-t border-line px-4 py-4 type-body text-success sm:px-6">
                  <CheckCircleIcon
                    size={20}
                    weight="fill"
                    aria-hidden="true"
                    className="mt-0.5 shrink-0"
                  />
                  <span>
                    Ponuda je prihvaćena — porudžbina{" "}
                    <span className="type-code">{i.orderNumber}</span>.
                  </span>
                </p>
              ) : null}
            </Reveal>
          ) : waiting ? (
            <Reveal as="section" eager className="panel p-4 sm:p-6">
              <h2 className="type-h4 text-ink-1">Ponuda još nije spremna</h2>
              <p className="mt-2 type-body-s text-ink-2">
                Proveravamo kod dobavljača. Odgovor stiže kanalom koji ste izabrali (
                {PREFERRED_CHANNEL_LABEL[i.preferredChannel].toLowerCase()}), a ponuda će se
                pojaviti i ovde.
              </p>
              <InquirySteps reached={1} className="mt-5 border-t border-line pt-5" />
            </Reveal>
          ) : (
            <Reveal as="section" eager className="flex flex-col gap-4 panel p-4 sm:p-6">
              <h2 className="type-h4 text-ink-1">Za ovaj upit nema ponude</h2>
              <p className="type-body-s text-ink-2">
                Upit je zatvoren bez ponude. Ako vam deo i dalje treba, pošaljite nov upit ili nam
                se javite.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild variant="primary" className="w-full sm:w-auto">
                  <Link href={ROUTES.inquiry} variant="unstyled">
                    Pošaljite nov upit
                  </Link>
                </Button>
                <Button asChild variant="secondary" className="w-full sm:w-auto">
                  <Link href={ROUTES.contact} variant="unstyled">
                    Kontakt
                  </Link>
                </Button>
              </div>
            </Reveal>
          )}

          {open && mode === "accept" ? (
            <AcceptForm
              token={token}
              inquiry={i}
              config={config}
              onCancel={() => setMode("idle")}
            />
          ) : null}
          {open && mode === "decline" && q ? (
            <div className="flex flex-col gap-4 panel p-4 sm:p-6">
              <h3 className="type-h4 text-ink-1">Odbijanje ponude</h3>
              <Field label="Razlog" optional>
                <Textarea
                  rows={3}
                  maxLength={500}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </Field>
              <div className="flex flex-wrap gap-3">
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
          {i.closedReason && i.status === "odbijena" ? (
            <p className="panel-inset px-4 py-3 type-body-s text-ink-2">
              Napomena: {i.closedReason}
            </p>
          ) : null}
        </div>

        <aside className="flex min-w-0 flex-col gap-4 lg:col-span-5">
          <Reveal as="section" eager index={1} className="panel p-4 sm:p-6">
            <InquirySummary inquiry={i} />
          </Reveal>
          <Reveal as="section" eager index={2} className="panel p-4 sm:p-6">
            <h2 className="type-h4 text-ink-1">Tok upita</h2>
            <div className="mt-4">
              <InquiryTimeline events={i.timeline} />
            </div>
            <p className="mt-4 border-t border-line-faint pt-3 type-caption font-normal text-ink-3">
              {i.emailUpdates
                ? "Ponudu i svaku promenu šaljemo i e-poštom. Ova stranica se osvežava sama."
                : "Ponudu i svaku promenu vidite na ovoj stranici — osvežava se sama."}
            </p>
          </Reveal>
        </aside>
      </div>
    </div>
  );
}
