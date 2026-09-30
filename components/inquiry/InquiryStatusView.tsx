"use client";

/**
 * Inquiry status + quote (`/upit/[token]`, ARCHITECTURE §A2): live status and timeline; when a
 * quote is sent the customer sees lines, availability, lead time and validity, and can accept
 * (→ order), decline, or ask for a renewed quote after expiry.
 */
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  CheckCircleIcon,
  ClockCounterClockwiseIcon,
  XCircleIcon,
} from "@phosphor-icons/react/dist/ssr";

import { api } from "@/convex/_generated/api";
import { buildConsent } from "@/lib/validation/consent";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { formatRSD } from "@/lib/format/money";
import { normalizePhone } from "@/lib/format/phone";
import { isValidEmail, isValidPostalCode, normalizeEmail } from "@/lib/domain/identifiers";
import { leadTimeLabel } from "@/lib/i18n/sr/catalog";
import {
  convexErrorMessage,
  ERRORS,
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

function AcceptForm({
  token,
  inquiry,
  config,
}: {
  token: string;
  inquiry: InquiryView;
  config: AcceptConfig;
}) {
  const router = useRouter();
  const accept = useMutation(api.inquiries.acceptQuote);
  const [first, ...rest] = inquiry.contactName.split(" ");
  const [v, setV] = useState({
    firstName: first ?? "",
    lastName: rest.join(" "),
    email: "",
    phone: "",
    delivery: (config.deliveryMethods[0]?.code ?? "pickup") as DeliveryCode,
    payment: "" as PaymentCode | "",
    street: "",
    city: "",
    postalCode: "",
    terms: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const payments = config.paymentMethods.filter(
    (p) => p.deliveryCodes.includes(v.delivery) && p.requires === "none",
  );
  const payment = payments.find((p) => p.code === v.payment)?.code ?? payments[0]?.code;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!v.firstName.trim() || !v.lastName.trim()) return setError("Upišite ime i prezime.");
    if (!normalizePhone(v.phone)) return setError(ERRORS.phone);
    if (!isValidEmail(normalizeEmail(v.email))) return setError(ERRORS.email);
    if (
      v.delivery === "courier" &&
      (!v.street.trim() || !v.city.trim() || !isValidPostalCode(v.postalCode))
    )
      return setError("Upišite adresu za dostavu (ulica, poštanski broj, mesto).");
    if (!payment) return setError("Izaberite način plaćanja.");
    if (!v.terms) return setError("Potrebna je saglasnost sa uslovima kupovine.");
    setBusy(true);
    try {
      const r = await accept({
        token,
        quoteId: inquiry.quote!.quoteId,
        contact: {
          firstName: v.firstName.trim(),
          lastName: v.lastName.trim(),
          email: normalizeEmail(v.email),
          phone: normalizePhone(v.phone)!,
        },
        delivery: {
          method: v.delivery,
          ...(v.delivery === "courier"
            ? {
                address: {
                  street: v.street.trim(),
                  city: v.city.trim(),
                  postalCode: v.postalCode.trim(),
                },
              }
            : {}),
        },
        payment: { method: payment },
        consent: buildConsent(config.legal),
      });
      router.push(ROUTES.orderThanks(r.orderToken));
    } catch (err) {
      setBusy(false);
      setError(
        convexErrorMessage(err, "Ponuda nije prihvaćena. Pokušajte ponovo ili nas pozovite."),
      );
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
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ime">
          <Input
            autoComplete="given-name"
            value={v.firstName}
            onChange={(e) => setV({ ...v, firstName: e.target.value })}
          />
        </Field>
        <Field label="Prezime">
          <Input
            autoComplete="family-name"
            value={v.lastName}
            onChange={(e) => setV({ ...v, lastName: e.target.value })}
          />
        </Field>
        <Field label="Telefon">
          <Input
            type="tel"
            autoComplete="tel"
            value={v.phone}
            onChange={(e) => setV({ ...v, phone: e.target.value })}
          />
        </Field>
        <Field label="E-pošta">
          <Input
            type="email"
            autoComplete="email"
            value={v.email}
            onChange={(e) => setV({ ...v, email: e.target.value })}
          />
        </Field>
      </div>
      <RadioGroup
        label="Dostava"
        value={v.delivery}
        onValueChange={(d) => setV({ ...v, delivery: d as DeliveryCode })}
        options={config.deliveryMethods.map((d) => ({
          value: d.code,
          label: `${d.label} · ${formatRSD(d.pricePara)}`,
        }))}
      />
      {v.delivery === "courier" ? (
        <div className="grid gap-4 sm:grid-cols-6">
          <Field label="Ulica i broj" className="sm:col-span-6">
            <Input
              autoComplete="street-address"
              value={v.street}
              onChange={(e) => setV({ ...v, street: e.target.value })}
            />
          </Field>
          <Field label="Poštanski broj" className="sm:col-span-2">
            <Input
              inputMode="numeric"
              maxLength={5}
              value={v.postalCode}
              onChange={(e) => setV({ ...v, postalCode: e.target.value })}
            />
          </Field>
          <Field label="Mesto" className="sm:col-span-4">
            <Input value={v.city} onChange={(e) => setV({ ...v, city: e.target.value })} />
          </Field>
        </div>
      ) : null}
      <RadioGroup
        label="Plaćanje"
        value={payment}
        onValueChange={(p) => setV({ ...v, payment: p as PaymentCode })}
        options={payments.map((p) => ({ value: p.code, label: p.label }))}
      />
      <Checkbox
        checked={v.terms}
        onCheckedChange={(c) => setV({ ...v, terms: c === true })}
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
      {error ? (
        <p role="alert" className="type-body-s text-danger">
          {error}
        </p>
      ) : null}
      <Button
        type="submit"
        variant="primary"
        size="lg"
        loading={busy}
        data-testid="quote-accept-submit"
        className="self-start"
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
              <div className="flex flex-wrap gap-3">
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
