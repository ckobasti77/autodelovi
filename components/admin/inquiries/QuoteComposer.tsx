"use client";

/**
 * Quote composer (brief §5 Inquiries): catalogue lines via the picker or free lines, each
 * with price, availability (na stanju / po porudžbini + rok) and a note; a delivery note;
 * the running total. „Sačuvaj nacrt“ keeps a draft (versioned: a new version once one was
 * sent); „Pošalji ponudu“ saves and sends — the customer gets the accept link (quote.sent).
 */
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState } from "react";
import { PlusIcon, TrashIcon } from "@phosphor-icons/react/dist/ssr";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { moneyInputValue, parseMoneyInput } from "@/lib/admin/format";
import { formatDate } from "@/lib/format/date";
import { formatRSD } from "@/lib/format/money";
import { QUALITY_LABEL } from "@/lib/i18n/sr/catalog";
import { convexErrorMessage } from "@/lib/i18n/sr/shop";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { toast } from "@/components/ui/Toast";

import { ProductPicker } from "../ProductPicker";

type Detail = NonNullable<FunctionReturnType<typeof api.inquiriesAdmin.get>>;
type Quote = Detail["quotes"][number];
type QuoteLine = Quote["lines"][number];

type LineState = {
  key: string;
  productId?: Id<"products">;
  sku: string;
  name: string;
  manufacturer: string;
  quality: "" | "original" | "oem" | "aftermarket";
  quantity: string;
  price: string;
  availability: "in_stock" | "on_order";
  leadTimeDays: string;
  note: string;
};

let seq = 0;
const nextKey = () => `l${++seq}`;

function fromQuote(lines: QuoteLine[]): LineState[] {
  return lines.map((l) => ({
    key: nextKey(),
    ...(l.productId ? { productId: l.productId } : {}),
    sku: l.sku ?? "",
    name: l.name,
    manufacturer: l.manufacturer ?? "",
    quality: l.quality ?? "",
    quantity: String(l.quantity),
    price: moneyInputValue(l.unitPricePara),
    availability: l.availability,
    leadTimeDays: l.leadTimeDays !== undefined ? String(l.leadTimeDays) : "",
    note: l.note ?? "",
  }));
}

const emptyLine = (): LineState => ({
  key: nextKey(),
  sku: "",
  name: "",
  manufacturer: "",
  quality: "",
  quantity: "1",
  price: "",
  availability: "in_stock",
  leadTimeDays: "",
  note: "",
});

export function QuoteComposer({
  detail,
  validityDays,
  onDone,
}: {
  detail: Detail;
  validityDays: number;
  onDone: () => void;
}) {
  const draft = detail.quotes.find((q) => q.status === "draft");
  const base = draft ?? detail.quotes.find((q) => q.status === "sent" || q.status === "expired");
  const [lines, setLines] = useState<LineState[]>(() => (base ? fromQuote(base.lines) : []));
  const [deliveryNote, setDeliveryNote] = useState(base?.deliveryNote ?? "");
  const [busy, setBusy] = useState<"save" | "send" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmSend, setConfirmSend] = useState(false);
  const saveDraft = useMutation(api.inquiriesAdmin.saveQuoteDraft);
  const sendQuote = useMutation(api.inquiriesAdmin.sendQuote);

  const set = (key: string, patch: Partial<LineState>) =>
    setLines(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const build = () => {
    if (lines.length === 0) throw new Error("Dodajte bar jednu stavku.");
    return lines.map((l, i) => {
      const quantity = Number(l.quantity);
      const unitPricePara = parseMoneyInput(l.price);
      const lead = l.leadTimeDays.trim() ? Number(l.leadTimeDays) : undefined;
      if (!l.name.trim()) throw new Error(`Stavka ${i + 1}: upišite naziv.`);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999)
        throw new Error(`Stavka ${i + 1}: količina 1–999.`);
      if (unitPricePara === undefined || Number.isNaN(unitPricePara) || unitPricePara < 0)
        throw new Error(`Stavka ${i + 1}: upišite cenu.`);
      if (lead !== undefined && (!Number.isInteger(lead) || lead < 0 || lead > 365))
        throw new Error(`Stavka ${i + 1}: rok 0–365 dana.`);
      return {
        ...(l.productId ? { productId: l.productId } : {}),
        ...(l.sku.trim() ? { sku: l.sku.trim() } : {}),
        name: l.name.trim(),
        ...(l.manufacturer.trim() ? { manufacturer: l.manufacturer.trim() } : {}),
        ...(l.quality ? { quality: l.quality } : {}),
        quantity,
        unitPricePara,
        availability: l.availability,
        ...(lead !== undefined ? { leadTimeDays: lead } : {}),
        ...(l.note.trim() ? { note: l.note.trim() } : {}),
      };
    });
  };

  const total = lines.reduce((s, l) => {
    const p = parseMoneyInput(l.price);
    const q = Number(l.quantity);
    return s + (p && !Number.isNaN(p) && Number.isInteger(q) ? p * q : 0);
  }, 0);

  const run = async (send: boolean) => {
    setError(null);
    let payload;
    try {
      payload = build();
    } catch (err) {
      setError((err as Error).message);
      return;
    }
    setBusy(send ? "send" : "save");
    try {
      const quoteId = await saveDraft({
        inquiryId: detail.inquiry._id,
        lines: payload,
        ...(deliveryNote.trim() ? { deliveryNote: deliveryNote.trim() } : {}),
      });
      if (send) {
        const { validUntil } = await sendQuote({ quoteId });
        toast.success(`Ponuda je poslata. Važi do ${formatDate(validUntil)}.`);
        onDone();
      } else {
        toast.success("Nacrt ponude je sačuvan.");
      }
    } catch (err) {
      setError(convexErrorMessage(err, "Ponuda nije sačuvana."));
    } finally {
      setBusy(null);
      setConfirmSend(false);
    }
  };

  return (
    <div className="flex flex-col gap-4" data-testid="admin-quote-composer">
      {lines.length === 0 ? (
        <p className="type-body-s text-ink-2">
          Dodajte artikle iz kataloga ili slobodnu stavku (deo koji naručujete od dobavljača).
        </p>
      ) : null}
      <ol className="flex flex-col gap-3">
        {lines.map((l, i) => (
          <li key={l.key} className="rounded-sm border border-line bg-surface-2 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="type-label uppercase text-ink-3">
                Stavka {i + 1}
                {l.productId ? " · iz kataloga" : " · slobodna"}
              </span>
              <IconButton
                label={`Ukloni stavku ${i + 1}`}
                icon={<TrashIcon size={16} />}
                size="sm"
                onClick={() => setLines(lines.filter((x) => x.key !== l.key))}
              />
            </div>
            <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
              <Field label="Naziv">
                <Input
                  value={l.name}
                  onChange={(e) => set(l.key, { name: e.target.value })}
                  className="h-9"
                />
              </Field>
              <Field label="Šifra / OEM" optional>
                <Input
                  value={l.sku}
                  onChange={(e) => set(l.key, { sku: e.target.value })}
                  className="h-9"
                  inputClassName="font-mono"
                />
              </Field>
              <Field label="Proizvođač" optional>
                <Input
                  value={l.manufacturer}
                  onChange={(e) => set(l.key, { manufacturer: e.target.value })}
                  className="h-9"
                />
              </Field>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-[repeat(5,minmax(0,1fr))]">
              <Field label="Kvalitet" optional>
                <Select
                  size="sm"
                  value={l.quality}
                  placeholder="—"
                  onChange={(e) => set(l.key, { quality: e.target.value as LineState["quality"] })}
                  options={Object.entries(QUALITY_LABEL).map(([value, label]) => ({
                    value,
                    label,
                  }))}
                />
              </Field>
              <Field label="Količina">
                <Input
                  value={l.quantity}
                  inputMode="numeric"
                  onChange={(e) => set(l.key, { quantity: e.target.value })}
                  className="h-9"
                  inputClassName="text-right tabular-nums"
                />
              </Field>
              <Field label="Cena sa PDV">
                <Input
                  value={l.price}
                  inputMode="decimal"
                  suffix="RSD"
                  onChange={(e) => set(l.key, { price: e.target.value })}
                  className="h-9"
                  inputClassName="text-right tabular-nums"
                />
              </Field>
              <Field label="Dostupnost">
                <Select
                  size="sm"
                  value={l.availability}
                  onChange={(e) =>
                    set(l.key, { availability: e.target.value as LineState["availability"] })
                  }
                  options={[
                    { value: "in_stock", label: "Na stanju" },
                    { value: "on_order", label: "Po porudžbini" },
                  ]}
                />
              </Field>
              <Field label="Rok (dana)" optional>
                <Input
                  value={l.leadTimeDays}
                  inputMode="numeric"
                  onChange={(e) => set(l.key, { leadTimeDays: e.target.value })}
                  className="h-9"
                  inputClassName="text-right tabular-nums"
                />
              </Field>
            </div>
            <Field label="Napomena uz stavku" optional className="mt-3">
              <Input
                value={l.note}
                onChange={(e) => set(l.key, { note: e.target.value })}
                className="h-9"
              />
            </Field>
          </li>
        ))}
      </ol>
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <ProductPicker
          onPick={(p) =>
            setLines([
              ...lines,
              {
                key: nextKey(),
                productId: p._id as Id<"products">,
                sku: p.oemPrimary ?? p.sku,
                name: p.name,
                manufacturer: p.manufacturerName,
                quality: p.quality,
                quantity: "1",
                price: moneyInputValue(p.retailPricePara),
                availability: p.stockQty > 0 ? "in_stock" : "on_order",
                leadTimeDays:
                  p.stockQty > 0 ? "" : p.leadTimeDays !== null ? String(p.leadTimeDays) : "",
                note: "",
              },
            ])
          }
        />
        <Button
          variant="secondary"
          icon={<PlusIcon size={16} />}
          onClick={() => setLines([...lines, emptyLine()])}
        >
          Slobodna stavka
        </Button>
      </div>
      <Field
        label="Napomena o isporuci"
        optional
        help="Npr. „Deo stiže za 3 radna dana od potvrde.“"
      >
        <Textarea
          rows={2}
          maxLength={500}
          value={deliveryNote}
          onChange={(e) => setDeliveryNote(e.target.value)}
        />
      </Field>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
        <p className="type-body-s">
          Ukupno: <span className="font-semibold tabular-nums">{formatRSD(total)}</span>
          <span className="text-ink-3"> · važi {validityDays} dana od slanja</span>
        </p>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => void run(false)}
            loading={busy === "save"}
            disabled={busy !== null}
          >
            Sačuvaj nacrt
          </Button>
          <Button
            onClick={() => setConfirmSend(true)}
            disabled={busy !== null || lines.length === 0}
            data-testid="admin-quote-send"
          >
            Pošalji ponudu
          </Button>
        </div>
      </div>
      {error ? (
        <p role="alert" className="type-body-s text-danger">
          {error}
        </p>
      ) : null}
      <Dialog
        open={confirmSend}
        onOpenChange={(v) => !busy && setConfirmSend(v)}
        title="Poslati ponudu kupcu?"
        role="alertdialog"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setConfirmSend(false)}
              disabled={busy !== null}
            >
              Odustani
            </Button>
            <Button
              onClick={() => void run(true)}
              loading={busy === "send"}
              data-testid="admin-quote-send-confirm"
            >
              Pošalji ponudu
            </Button>
          </>
        }
      >
        <p className="type-body-s text-ink-2">
          {detail.inquiry.contact.name} dobija ponudu na {formatRSD(total)} sa linkom za
          prihvatanje. Ponuda važi {validityDays} dana.
          {detail.quotes.some((q) => q.status === "sent")
            ? " Prethodna poslata ponuda se zamenjuje novom."
            : ""}
        </p>
      </Dialog>
    </div>
  );
}
