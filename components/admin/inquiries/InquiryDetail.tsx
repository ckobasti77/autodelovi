"use client";

/**
 * `/admin/upiti/[broj]`: the request (message, VIN, codes, photos), the quote composer and
 * earlier versions, „Pretvori u porudžbinu“ for a sent quote the customer accepted by phone,
 * contact with call / Viber / WhatsApp links, assignment, notes, history, close with reason.
 */
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeftIcon, ArrowSquareOutIcon } from "@phosphor-icons/react/dist/ssr";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { compactDateTime, formatElapsed } from "@/lib/admin/format";
import { workingMinutesBetween } from "@/lib/domain/sla";
import { formatDate } from "@/lib/format/date";
import { formatRSD } from "@/lib/format/money";
import { formatPhone } from "@/lib/format/phone";
import { convexErrorField } from "@/lib/i18n/sr/shop";
import { INQUIRY_KIND_LABEL } from "@/lib/i18n/sr/admin";
import {
  convexErrorMessage,
  DELIVERY_LABEL,
  PAYMENT_LABEL,
  PREFERRED_CHANNEL_LABEL,
} from "@/lib/i18n/sr/shop";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { CopyButton } from "@/components/ui/CopyButton";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { RouteLink } from "@/components/ui/RouteLink";
import { Select } from "@/components/ui/Select";
import { Skeleton, SkeletonRegion } from "@/components/ui/Skeleton";
import { Textarea } from "@/components/ui/Textarea";
import { toast } from "@/components/ui/Toast";
import { ADMIN } from "@/constants/routes";

import { AttributionView } from "../Attribution";
import { ConfirmDialog, useConfirm } from "../ConfirmDialog";
import { useNowMinute } from "../hooks";
import { useAdminCrumb, useAdminShell } from "../shell/context";
import {
  ActorLabel,
  ContactActions,
  DefinitionList,
  DemoTag,
  DocNumber,
  InquiryStatusBadge,
  Section,
  Chip,
} from "../ui";
import { QuoteComposer } from "./QuoteComposer";

type Detail = NonNullable<FunctionReturnType<typeof api.inquiriesAdmin.get>>;

export function InquiryDetail({ number }: { number: string }) {
  const data = useQuery(api.inquiriesAdmin.get, { number });
  useAdminCrumb(number);
  const startProcessing = useMutation(api.inquiriesAdmin.startProcessing);
  const started = useRef(false);
  // Opening a new inquiry moves it to „u obradi“ (the customer sees that it is being handled).
  useEffect(() => {
    if (data && data.inquiry.status === "nov" && !started.current) {
      started.current = true;
      void startProcessing({ inquiryId: data.inquiry._id }).catch(() => undefined);
    }
  }, [data, startProcessing]);
  if (data === undefined)
    return (
      <SkeletonRegion>
        <Skeleton className="mb-4 h-10 w-80" />
        <Skeleton className="h-[480px] w-full" />
      </SkeletonRegion>
    );
  if (data === null)
    return (
      <div className="flex flex-col items-start gap-3">
        <h1 className="type-h2">Upit {number} ne postoji</h1>
        <RouteLink href={ADMIN.inquiries} className="type-body-s text-accent-text underline">
          Nazad na upite
        </RouteLink>
      </div>
    );
  return <InquiryView data={data} />;
}

function InquiryView({ data }: { data: Detail }) {
  const i = data.inquiry;
  const nowMinute = useNowMinute();
  const { viewer } = useAdminShell();
  const settings = useQuery(api.settings.getAdmin, {});
  const staff = useQuery(api.staff.listUsers, {});
  const assign = useMutation(api.inquiriesAdmin.assign);
  const close = useMutation(api.inquiriesAdmin.close);
  const addNote = useMutation(api.inquiriesAdmin.addNote);
  const confirm = useConfirm();
  const [composing, setComposing] = useState(false);
  const [converting, setConverting] = useState(false);
  const [note, setNote] = useState("");
  const closed = i.status === "prihvacena" || i.status === "odbijena";
  const current = data.quotes.find((q) => q._id === i.currentQuoteId);
  const draft = data.quotes.find((q) => q.status === "draft");
  const canConvert =
    i.status === "ponuda_poslata" && current?.status === "sent" && current.validUntil > nowMinute;
  const waiting =
    !i.firstResponseAt && !closed && settings
      ? workingMinutesBetween(
          i.createdAt,
          nowMinute,
          settings.hours,
          settings.holidays.map((h) => h.date),
        )
      : null;
  const phone = i.contact.phone?.replace(/\s/g, "");

  return (
    <div className="flex flex-col gap-6">
      <RouteLink
        href={ADMIN.inquiries}
        className="inline-flex min-h-9 items-center gap-2 self-start type-body-s text-ink-2 hover:text-ink-1"
      >
        <ArrowLeftIcon size={16} aria-hidden="true" /> Upiti
      </RouteLink>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[1.375rem] font-[650] leading-tight">
              <span className="sr-only">Upit </span>
              <DocNumber number={i.number} className="type-code-l" />
            </h1>
            <InquiryStatusBadge status={i.status} />
            {i.mechanic ? <Chip tone="info">Majstor — prioritet</Chip> : null}
            {i.isDemo ? <DemoTag /> : null}
          </div>
          <p className="type-body-s text-ink-3">
            {INQUIRY_KIND_LABEL[i.kind]} · primljen {compactDateTime(i.createdAt, nowMinute)}
            {waiting !== null ? ` · čeka ${formatElapsed(waiting)} radnog vremena` : ""}
            {i.orderNumber ? (
              <>
                {" "}
                · porudžbina{" "}
                <RouteLink
                  href={ADMIN.order(i.orderNumber)}
                  className="text-accent-text underline-offset-2 hover:underline"
                >
                  {i.orderNumber}
                </RouteLink>
              </>
            ) : null}
          </p>
        </div>
        {!closed ? (
          <div className="flex flex-wrap items-center gap-2">
            {i.assignedTo !== viewer.userId ? (
              <Button
                variant="quiet"
                size="sm"
                onClick={() =>
                  void assign({ inquiryId: i._id, userId: viewer.userId as Id<"users"> })
                }
              >
                Preuzmi upit
              </Button>
            ) : null}
            <Button
              variant="danger"
              size="sm"
              onClick={() =>
                confirm.ask({
                  title: `Zatvoriti upit ${i.number}?`,
                  description: "Upit se zatvara bez ponude. Kupac vidi da je upit zatvoren.",
                  confirmLabel: "Zatvori upit",
                  danger: true,
                  reasonLabel: "Razlog (npr. „Deo se više ne proizvodi“)",
                  onConfirm: (reason) => close({ inquiryId: i._id, reason }),
                })
              }
            >
              Zatvori upit
            </Button>
            {canConvert ? (
              <Button variant="secondary" size="sm" onClick={() => setConverting(true)}>
                Pretvori u porudžbinu
              </Button>
            ) : null}
            {!composing ? (
              <Button
                size="sm"
                onClick={() => setComposing(true)}
                data-testid="admin-quote-compose"
              >
                {draft ? "Nastavi ponudu" : current ? "Nova verzija ponude" : "Napravi ponudu"}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Section title="Upit">
            <div className="flex flex-col gap-4">
              <p className="whitespace-pre-wrap type-body text-ink-1">{i.message}</p>
              <DefinitionList
                rows={[
                  { label: "Vozilo", value: i.vehicleLabel, hidden: !i.vehicleLabel },
                  {
                    label: "VIN",
                    value: (
                      <span>
                        <span className="type-code">{i.vin}</span>
                        {i.vinBrandGuess || i.vinYearHint ? (
                          <span className="text-ink-3">
                            {" "}
                            ·{" "}
                            {[i.vinBrandGuess, i.vinYearHint ? `oko ${i.vinYearHint}.` : null]
                              .filter(Boolean)
                              .join(", ")}
                          </span>
                        ) : null}
                      </span>
                    ),
                    hidden: !i.vin,
                  },
                  {
                    label: "Traženi brojevi",
                    value: <span className="type-code">{i.requestedCodes.join(", ")}</span>,
                    hidden: i.requestedCodes.length === 0,
                  },
                  {
                    label: "Kategorije",
                    value: i.categorySlugs.join(", "),
                    hidden: i.categorySlugs.length === 0,
                  },
                  {
                    label: "Pretraga",
                    value: <span className="type-code">{i.searchQuery}</span>,
                    hidden: !i.searchQuery,
                  },
                  {
                    label: "Artikal",
                    value: i.product ? (
                      <RouteLink
                        href={ADMIN.product(i.product._id)}
                        className="text-accent-text underline-offset-2 hover:underline"
                      >
                        {i.product.name} ({i.product.sku})
                      </RouteLink>
                    ) : null,
                    hidden: !i.product,
                  },
                  { label: "Zatvoren", value: i.closedReason, hidden: !i.closedReason },
                ]}
              />
              {data.photos.length > 0 ? (
                <ul
                  className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
                  aria-label="Fotografije kupca"
                >
                  {data.photos.map((p, idx) =>
                    p.url ? (
                      <li key={p.storageId}>
                        <a
                          href={p.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group relative block aspect-square overflow-hidden rounded-lg border border-line bg-surface-2"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element -- signed Convex storage URL, shown at thumbnail size */}
                          <img
                            src={p.url}
                            alt={`Fotografija ${idx + 1} uz upit`}
                            className="size-full object-cover"
                            loading="lazy"
                          />
                          <span
                            className="absolute right-1.5 top-1.5 rounded-xs bg-surface-1/90 p-1 text-ink-2 transition-control hover-hover:opacity-0 hover-hover:group-hover:opacity-100 hover-hover:group-focus-visible:opacity-100"
                            aria-hidden="true"
                          >
                            <ArrowSquareOutIcon size={14} />
                          </span>
                        </a>
                      </li>
                    ) : null,
                  )}
                </ul>
              ) : null}
            </div>
          </Section>

          {composing && !closed ? (
            <Section
              title={draft ? `Ponuda br. ${draft.version} — nacrt` : "Nova ponuda"}
              actions={
                <Button variant="ghost" size="sm" onClick={() => setComposing(false)}>
                  Zatvori
                </Button>
              }
            >
              <QuoteComposer
                detail={data}
                validityDays={settings?.commerce.quoteValidityDays ?? 7}
                onDone={() => setComposing(false)}
              />
            </Section>
          ) : null}

          {current?.status === "sent" &&
          i.statusLink &&
          (!i.contact.email || i.contact.preferredChannel !== "email") ? (
            <Section title="Link za kupca">
              <QuoteShareLink
                link={i.statusLink}
                phone={i.contact.phone ?? null}
                hasEmail={Boolean(i.contact.email)}
                number={i.number}
              />
            </Section>
          ) : null}

          {data.quotes.length > 0 ? (
            <Section title="Ponude">
              <ol className="flex flex-col gap-4">
                {data.quotes.map((q) => (
                  <li key={q._id} className="rounded-md border border-line">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-faint bg-surface-2 px-3 py-2 type-body-s">
                      <span className="font-semibold">Verzija {q.version}</span>
                      <span className="text-ink-2">
                        {
                          {
                            draft: "Nacrt",
                            sent: "Poslata",
                            accepted: "Prihvaćena",
                            declined: "Odbijena",
                            expired: "Istekla",
                            superseded: "Zamenjena",
                          }[q.status]
                        }
                        {q.sentAt ? ` ${compactDateTime(q.sentAt, nowMinute)}` : ""}
                        {q.status === "sent" ? ` · važi do ${formatDate(q.validUntil)}` : ""}
                      </span>
                      <span className="font-semibold tabular-nums">{formatRSD(q.totalPara)}</span>
                    </div>
                    <table className="w-full border-collapse text-cell">
                      <caption className="sr-only">Stavke ponude, verzija {q.version}</caption>
                      <tbody>
                        {q.lines.map((l, idx) => (
                          <tr key={idx} className="border-b border-line-faint last:border-b-0">
                            <td className="px-3 py-2">
                              <span className="flex flex-col">
                                <span>{l.name}</span>
                                <span className="type-caption text-ink-3">
                                  {[
                                    l.sku,
                                    l.manufacturer,
                                    l.availability === "in_stock"
                                      ? "na stanju"
                                      : `po porudžbini${l.leadTimeDays ? `, ${l.leadTimeDays} d` : ""}`,
                                  ]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </span>
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">{l.quantity} ×</td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {formatRSD(l.unitPricePara)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {q.deliveryNote ? (
                      <p className="px-3 py-2 type-caption text-ink-2">{q.deliveryNote}</p>
                    ) : null}
                  </li>
                ))}
              </ol>
            </Section>
          ) : null}

          <Section title="Istorija">
            <ol className="flex flex-col gap-3">
              {[...data.events].reverse().map((e, idx) => (
                <li key={idx} className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3 type-body-s">
                  <span className="whitespace-nowrap tabular-nums text-ink-3">
                    {compactDateTime(e.at, nowMinute)}
                  </span>
                  <span className="flex flex-col">
                    <span className="text-ink-1">{e.message ?? e.type}</span>
                    <span className="type-caption text-ink-3">
                      <ActorLabel actor={e.actor} />
                      {e.type === "note" ? " · interno" : ""}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </Section>
        </div>

        <aside className="flex flex-col gap-6" aria-label="Kontakt i dodela">
          <Section title="Kontakt">
            <DefinitionList
              rows={[
                {
                  label: "Ime",
                  value: i.userId ? (
                    <RouteLink
                      href={ADMIN.customer(i.userId)}
                      className="text-accent-text underline-offset-2 hover:underline"
                    >
                      {i.contact.name}
                    </RouteLink>
                  ) : (
                    i.contact.name
                  ),
                },
                {
                  label: "Telefon",
                  value: phone ? (
                    <a href={`tel:${phone}`} className="tabular-nums hover:underline">
                      {formatPhone(i.contact.phone!)}
                    </a>
                  ) : null,
                  hidden: !phone,
                },
                {
                  label: "E-pošta",
                  value: (
                    <a href={`mailto:${i.contact.email}`} className="break-all hover:underline">
                      {i.contact.email}
                    </a>
                  ),
                  hidden: !i.contact.email,
                },
                {
                  label: "Želi odgovor",
                  value:
                    PREFERRED_CHANNEL_LABEL[
                      i.contact.preferredChannel as keyof typeof PREFERRED_CHANNEL_LABEL
                    ] ?? i.contact.preferredChannel,
                },
                {
                  label: "Majstor",
                  value: i.mechanic ? (
                    <RouteLink
                      href={ADMIN.mechanic(i.mechanic.profileId)}
                      className="text-accent-text underline-offset-2 hover:underline"
                    >
                      {i.mechanic.companyName}
                      {i.mechanic.tierName ? ` · ${i.mechanic.tierName}` : ""}
                    </RouteLink>
                  ) : null,
                  hidden: !i.mechanic,
                },
              ]}
            />
            <ContactActions phone={i.contact.phone} />
          </Section>

          <Section title="Dodela">
            <Field label="Radi na upitu">
              <Select
                size="sm"
                disabled={closed}
                value={i.assignedTo ?? ""}
                placeholder="Niko"
                onChange={(e) =>
                  void assign({
                    inquiryId: i._id,
                    userId: (e.target.value || null) as Id<"users"> | null,
                  }).then(
                    () => toast.success("Dodela je sačuvana."),
                    (err) => toast.error(convexErrorMessage(err, "Nije sačuvano.")),
                  )
                }
                options={(staff ?? [])
                  .filter((u) => !u.blocked)
                  .map((u) => ({ value: u._id, label: u.name }))}
              />
            </Field>
          </Section>

          <Section title="Interna beleška">
            <form
              className="flex flex-col gap-3"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!note.trim()) return;
                try {
                  await addNote({ inquiryId: i._id, message: note.trim() });
                  setNote("");
                } catch (err) {
                  toast.error(convexErrorMessage(err, "Beleška nije sačuvana."));
                }
              }}
            >
              <Textarea
                rows={3}
                maxLength={1000}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                aria-label="Nova beleška"
              />
              <Button
                type="submit"
                variant="secondary"
                size="sm"
                className="self-end"
                disabled={!note.trim()}
              >
                Dodaj belešku
              </Button>
            </form>
          </Section>

          {data.sameVin.length > 0 ? (
            <Section title="Isti broj šasije">
              <ul className="flex flex-col gap-2">
                {data.sameVin.map((s) => (
                  <li
                    key={s.number}
                    className="flex items-center justify-between gap-2 type-body-s"
                  >
                    <RouteLink href={ADMIN.inquiry(s.number)} className="hover:underline">
                      <DocNumber number={s.number} />
                    </RouteLink>
                    <InquiryStatusBadge status={s.status} />
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          <Section title="Izvor">
            <AttributionView attribution={i.attribution} />
          </Section>
        </aside>
      </div>
      <ConfirmDialog {...confirm.props} />
      {converting && current ? (
        <ConvertDialog
          detail={data}
          quoteId={current._id}
          total={current.totalPara}
          onClose={() => setConverting(false)}
        />
      ) : null}
    </div>
  );
}

/** Digits of an E.164 number for wa.me (`+381641234567` → `381641234567`). */
const waNumber = (e164: string) => e164.replace(/\D/g, "");

/**
 * The customer's status/accept link for phone, Viber and WhatsApp customers (QA FLOW-13):
 * copy it, or open Viber / WhatsApp / SMS with a short prefilled message.
 */
function QuoteShareLink({
  link,
  phone,
  hasEmail,
  number,
}: {
  link: string;
  phone: string | null;
  hasEmail: boolean;
  number: string;
}) {
  const message = `Ponuda za upit ${number} je spremna. Pogledajte je i prihvatite ovde: ${link}`;
  const text = encodeURIComponent(message);
  return (
    <div className="flex flex-col gap-3" data-testid="admin-quote-share">
      <p className="type-body-s text-ink-2">
        {hasEmail
          ? "Kupac je tražio odgovor porukom. Pošaljite mu link ponude:"
          : "Kupac nema e-poštu i ponuda mu nije stigla sama. Pošaljite mu link ponude:"}
      </p>
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 break-all panel-inset px-3 py-2 type-code">{link}</p>
        <CopyButton value={link} label="Kopiraj link" toastMessage="Link je kopiran." />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="quiet" size="sm">
          <a href={`viber://forward?text=${text}`}>Pošalji Viberom</a>
        </Button>
        {phone ? (
          <>
            <Button asChild variant="quiet" size="sm">
              <a
                href={`https://wa.me/${waNumber(phone)}?text=${text}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Pošalji WhatsApp-om
              </a>
            </Button>
            <Button asChild variant="quiet" size="sm">
              <a href={`sms:${phone}?body=${text}`}>Pošalji SMS</a>
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}

type ConvertField =
  "firstName" | "lastName" | "phone" | "email" | "street" | "city" | "postalCode" | "payment";

/** Server field path (`contact.email`, `delivery.address.postalCode`) → dialog field. */
const CONVERT_FIELD_LABEL: Record<ConvertField, string> = {
  firstName: "Ime",
  lastName: "Prezime",
  phone: "Telefon",
  email: "E-pošta",
  street: "Ulica i broj",
  city: "Mesto",
  postalCode: "Poštanski broj",
  payment: "Plaćanje",
};

function convertFieldFor(path: string | null): ConvertField | null {
  if (!path) return null;
  if (path.startsWith("contact.")) {
    const f = path.slice("contact.".length);
    return f === "firstName" || f === "lastName" || f === "phone" || f === "email" ? f : null;
  }
  if (path === "delivery.address.postalCode") return "postalCode";
  if (path.startsWith("delivery.address")) return "street";
  if (path === "payment.method") return "payment";
  return null;
}

function ConvertDialog({
  detail,
  quoteId,
  total,
  onClose,
}: {
  detail: Detail;
  quoteId: Id<"quotes">;
  total: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const settings = useQuery(api.settings.getAdmin, {});
  const convert = useMutation(api.inquiriesAdmin.convertToOrder);
  const c = detail.inquiry.contact;
  const [first = "", ...rest] = c.name.trim().split(/\s+/);
  const [form, setForm] = useState({
    firstName: first,
    lastName: rest.join(" "),
    email: c.email ?? "",
    phone: c.phone ?? "",
    delivery: "pickup" as "pickup" | "courier",
    street: "",
    city: "",
    postalCode: "",
    payment: "pickup_cash",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<ConvertField, string>>>({});
  const [creditOverride, setCreditOverride] = useState(false);
  const { viewer } = useAdminShell();
  // Staff never raise their own credit (server: FORBIDDEN); only the owner may.
  const canOverrideCredit = viewer.isOwner || detail.inquiry.userId !== viewer.userId;
  // A phone/Viber/WhatsApp customer may have no e-mail; the order then goes without e-mails.
  const emailRequired = Boolean(c.email);
  const payments = (settings?.paymentMethods ?? []).filter(
    (p) => p.active && p.deliveryCodes.includes(form.delivery) && p.requires !== "company",
  );
  const set = (patch: Partial<typeof form>) => {
    setForm({ ...form, ...patch });
    if (Object.keys(patch).some((k) => k in fieldErrors)) {
      const next = { ...fieldErrors };
      for (const k of Object.keys(patch)) delete next[k as ConvertField];
      setFieldErrors(next);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(v) => !v && !busy && onClose()}
      title="Pretvori ponudu u porudžbinu"
      size="md"
      dismissible={!busy}
    >
      <form
        className="flex flex-col gap-4"
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          setFieldErrors({});
          try {
            const res = await convert({
              quoteId,
              contact: {
                firstName: form.firstName,
                lastName: form.lastName,
                email: form.email.trim(),
                phone: form.phone,
              },
              delivery: {
                method: form.delivery,
                ...(form.delivery === "courier"
                  ? {
                      address: {
                        street: form.street,
                        city: form.city,
                        postalCode: form.postalCode,
                      },
                    }
                  : {}),
              },
              payment: { method: form.payment as keyof typeof PAYMENT_LABEL },
              ...(form.payment === "deferred" && canOverrideCredit && creditOverride
                ? { creditOverride: true }
                : {}),
            });
            toast.success(`Porudžbina ${res.orderNumber} je kreirana.`);
            router.push(ADMIN.order(res.orderNumber));
          } catch (err) {
            const message = convexErrorMessage(err, "Porudžbina nije kreirana.");
            const field = convertFieldFor(convexErrorField(err));
            if (field) {
              // The message sits under the field; the alert only points to it.
              setFieldErrors({ [field]: message });
              setError(
                `Porudžbina nije kreirana. Proverite polje „${CONVERT_FIELD_LABEL[field]}“.`,
              );
            } else {
              setError(message);
            }
            setBusy(false);
          }
        }}
      >
        <p className="type-body-s text-ink-2">
          Kupac je prihvatio ponudu telefonom ili u radnji. Porudžbina na {formatRSD(total)} dobija
          sve stavke iz ponude; upit se zatvara kao prihvaćen.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Ime" required markRequired error={fieldErrors.firstName}>
            <Input value={form.firstName} onChange={(e) => set({ firstName: e.target.value })} />
          </Field>
          <Field label="Prezime" required markRequired error={fieldErrors.lastName}>
            <Input value={form.lastName} onChange={(e) => set({ lastName: e.target.value })} />
          </Field>
          <Field label="Telefon" required markRequired error={fieldErrors.phone}>
            <Input
              value={form.phone}
              onChange={(e) => set({ phone: e.target.value })}
              inputMode="tel"
            />
          </Field>
          <Field
            label="E-pošta"
            required={emailRequired}
            markRequired={emailRequired}
            optional={!emailRequired}
            help={
              emailRequired || form.email.trim()
                ? undefined
                : "Kupac nije ostavio e-poštu: porudžbina ide bez obaveštenja e-poštom."
            }
            error={fieldErrors.email}
          >
            <Input
              value={form.email}
              onChange={(e) => set({ email: e.target.value })}
              type="email"
            />
          </Field>
        </div>
        <Field label="Dostava">
          <Select
            value={form.delivery}
            onChange={(e) => {
              const delivery = e.target.value as "pickup" | "courier";
              set({ delivery, payment: delivery === "pickup" ? "pickup_cash" : "cod" });
            }}
            options={Object.entries(DELIVERY_LABEL).map(([value, label]) => ({ value, label }))}
          />
        </Field>
        {form.delivery === "courier" ? (
          <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_7rem]">
            <Field label="Ulica i broj" required markRequired error={fieldErrors.street}>
              <Input value={form.street} onChange={(e) => set({ street: e.target.value })} />
            </Field>
            <Field label="Mesto" required markRequired>
              <Input value={form.city} onChange={(e) => set({ city: e.target.value })} />
            </Field>
            <Field label="Poštanski broj" required markRequired error={fieldErrors.postalCode}>
              <Input
                value={form.postalCode}
                onChange={(e) => set({ postalCode: e.target.value })}
                inputMode="numeric"
              />
            </Field>
          </div>
        ) : null}
        <Field label="Plaćanje" error={fieldErrors.payment}>
          <Select
            value={form.payment}
            onChange={(e) => set({ payment: e.target.value })}
            options={payments.map((p) => ({ value: p.code, label: p.label }))}
          />
        </Field>
        {form.payment === "deferred" && canOverrideCredit ? (
          <Checkbox
            checked={creditOverride}
            onCheckedChange={(v) => setCreditOverride(v === true)}
            label="Dozvoli prekoračenje limita odloženog plaćanja"
            description="Samo uz dogovor sa majstorom; prekoračenje se beleži u reviziji."
          />
        ) : null}
        {error ? (
          <p role="alert" className="type-body-s text-danger">
            {error}
          </p>
        ) : null}
        <div className="flex flex-col-reverse gap-3 border-t border-line pt-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Odustani
          </Button>
          <Button type="submit" loading={busy}>
            Kreiraj porudžbinu
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
