"use client";

/**
 * `/admin/porudzbine/[broj]` (DESIGN-SYSTEM §10.11): header with the primary legal
 * transition and a menu of the others (each confirmed; cancel needs a reason; „Poslata“
 * needs the courier and tracking number), print links; left column: items (editable while
 * `nova`), notes, history, e-mail log; right: customer, company, delivery + tracking,
 * payment, attribution, earlier orders. Every write carries `expectedUpdatedAt`.
 */
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useRef, useState } from "react";
import {
  ArrowLeftIcon,
  CaretDownIcon,
  PrinterIcon,
  TrashIcon,
  WarningIcon,
} from "@phosphor-icons/react/dist/ssr";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { nextOrderStatuses, type OrderStatus } from "@/lib/domain/orderStateMachine";
import { compactDateTime, moneyInputValue, parseMoneyInput } from "@/lib/admin/format";
import { cn } from "@/lib/cn";
import { formatRSD } from "@/lib/format/money";
import { formatPhone } from "@/lib/format/phone";
import {
  ADMIN_ORDER_STATUS,
  CUSTOMER_TYPE_LABEL,
  EMAIL_STATUS_LABEL,
  ORDER_SOURCE_LABEL,
  ORDER_TRANSITION_VERB,
  PAYMENT_STATUS_LABEL,
} from "@/lib/i18n/sr/admin";
import {
  convexErrorCode,
  convexErrorMessage,
  DELIVERY_LABEL,
  PAYMENT_LABEL,
} from "@/lib/i18n/sr/shop";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { Menu } from "@/components/ui/Menu";
import { RouteLink } from "@/components/ui/RouteLink";
import { Select } from "@/components/ui/Select";
import { Skeleton, SkeletonRegion } from "@/components/ui/Skeleton";
import { Textarea } from "@/components/ui/Textarea";
import { toast } from "@/components/ui/Toast";
import { ADMIN } from "@/constants/routes";
import { TEST_IDS } from "@/constants/testIds";

import { AttributionView } from "../Attribution";
import { useConnectionLost, useNowMinute } from "../hooks";
import { ProductPicker, type PickedProduct } from "../ProductPicker";
import { useAdminCrumb } from "../shell/context";
import {
  ActorLabel,
  ContactActions,
  DefinitionList,
  DemoTag,
  DocNumber,
  OrderStatusBadge,
  Section,
  CompactInput,
  Chip,
} from "../ui";

type Detail = NonNullable<FunctionReturnType<typeof api.ordersAdmin.get>>;
type Order = Detail["order"];

/** 1000 bp → „10 %“, 1250 bp → „12,5 %“. */
function discountText(bp: number) {
  return `${String(bp / 100).replace(".", ",")}\u00a0%`;
}

function errorText(err: unknown, fallback: string) {
  return convexErrorCode(err) === "CONFLICT"
    ? "Porudžbina je u međuvremenu izmenjena. Osvežite prikaz."
    : convexErrorMessage(err, fallback);
}

export function OrderDetail({ number }: { number: string }) {
  const data = useQuery(api.ordersAdmin.get, { number });
  useAdminCrumb(number);
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
        <h1 className="type-h2">Porudžbina {number} ne postoji</h1>
        <RouteLink href={ADMIN.orders} className="type-body-s text-accent-text underline">
          Nazad na porudžbine
        </RouteLink>
      </div>
    );
  return <OrderView data={data} />;
}

function OrderView({ data }: { data: Detail }) {
  const o = data.order;
  const nowMinute = useNowMinute();
  return (
    <div className="flex flex-col gap-6">
      <RouteLink
        href={ADMIN.orders}
        className="inline-flex min-h-9 items-center gap-2 self-start type-body-s text-ink-2 hover:text-ink-1"
      >
        <ArrowLeftIcon size={16} aria-hidden="true" /> Porudžbine
      </RouteLink>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[1.375rem] font-[650] leading-tight">
              <span className="sr-only">Porudžbina </span>
              <DocNumber number={o.number} className="type-code-l" />
            </h1>
            <OrderStatusBadge status={o.status} />
            {o.isDemo ? <DemoTag /> : null}
          </div>
          <p className="type-body-s text-ink-3">
            Primljena {compactDateTime(o.createdAt, nowMinute)} · {ORDER_SOURCE_LABEL[o.source]}
            {o.inquiryNumber ? (
              <>
                {" "}
                · iz upita{" "}
                <RouteLink
                  href={ADMIN.inquiry(o.inquiryNumber)}
                  className="text-accent-text underline-offset-2 hover:underline"
                >
                  {o.inquiryNumber}
                </RouteLink>
              </>
            ) : null}
          </p>
        </div>
        <TransitionBar order={o} itemCount={data.items.length} />
      </div>

      {o.status === "otkazana" && o.cancelReason ? (
        <p
          role="status"
          className="flex items-start gap-2 rounded-md border border-danger bg-danger-subtle px-4 py-3 type-body-s text-danger"
        >
          <WarningIcon size={18} className="mt-0.5 shrink-0" aria-hidden="true" /> Otkazana:{" "}
          {o.cancelReason}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-6">
          <ItemsSection data={data} />
          <NotesSection orderId={o._id} />
          <Section title="Istorija">
            <ol className="flex flex-col gap-3">
              {[...data.events].reverse().map((e, i) => (
                <li key={i} className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3 type-body-s">
                  <span className="whitespace-nowrap tabular-nums text-ink-3">
                    {compactDateTime(e.at, nowMinute)}
                  </span>
                  <span className="flex flex-col">
                    <span className="text-ink-1">
                      {e.toStatus
                        ? `${ADMIN_ORDER_STATUS[e.toStatus].label}${e.message ? ` — ${e.message}` : ""}`
                        : (e.message ?? e.type)}
                    </span>
                    <span className="type-caption text-ink-3">
                      <ActorLabel actor={e.actor} />
                      {e.type === "note"
                        ? e.visibleToCustomer
                          ? " · vidi kupac"
                          : " · interno"
                        : ""}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </Section>
          <Section title="E-pošta">
            {data.emails.length === 0 ? (
              <p className="type-body-s text-ink-2">
                Za ovu porudžbinu još nije poslata nijedna poruka. Slanje stiže sa podešavanjem
                e-pošte.
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-line-faint">
                {data.emails.map((m) => (
                  <li key={m._id} className="flex items-center gap-3 py-2 type-body-s">
                    <span className="w-28 shrink-0 tabular-nums text-ink-3">
                      {compactDateTime(m.at, nowMinute)}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{m.subject}</span>
                    <Chip tone={EMAIL_STATUS_LABEL[m.status]?.tone ?? "neutral"}>
                      {EMAIL_STATUS_LABEL[m.status]?.label ?? m.status}
                    </Chip>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
        <aside className="flex flex-col gap-6" aria-label="Kupac, dostava i plaćanje">
          <CustomerSection order={o} />
          <DeliverySection order={o} />
          <PaymentSection order={o} />
          <Section title="Izvor">
            <AttributionView attribution={o.attribution} />
          </Section>
          <HistorySection orderId={o._id} />
        </aside>
      </div>
    </div>
  );
}

type Pending = { to: OrderStatus } | null;

function TransitionBar({ order, itemCount }: { order: Order; itemCount: number }) {
  const transition = useMutation(api.ordersAdmin.transition);
  const settings = useQuery(api.settings.getAdmin, {});
  const [pending, setPending] = useState<Pending>(null);
  const [reason, setReason] = useState("");
  const [courier, setCourier] = useState("");
  const [tracking, setTracking] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // FLOW-19: offline, the write waits for the connection; staff may close the dialog meanwhile
  // (same pattern as ConfirmDialog). A later failure then reaches them as a toast.
  const { lost } = useConnectionLost();
  const waiting = busy && lost;
  const detached = useRef(false);
  const next = nextOrderStatuses(order.status, order.deliveryMethod);
  const primary =
    next.find((s) => s !== "otkazana" && s !== "ceka_deo") ?? next.find((s) => s !== "otkazana");
  const others = next.filter((s) => s !== primary);

  const open = (to: OrderStatus) => {
    detached.current = false;
    setPending({ to });
    setReason("");
    setCourier(order.courierCode ?? settings?.couriers[0]?.code ?? "");
    setTracking(order.trackingNumber ?? "");
    setError(null);
  };

  const run = async () => {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      await transition({
        orderId: order._id,
        to: pending.to,
        expectedUpdatedAt: order.updatedAt,
        ...(pending.to === "otkazana" ? { reason: reason.trim() } : {}),
        ...(pending.to === "poslata"
          ? { tracking: { courierCode: courier, trackingNumber: tracking.trim() } }
          : {}),
      });
      toast.success(`${order.number}: ${ADMIN_ORDER_STATUS[pending.to].label.toLowerCase()}.`);
      if (!detached.current) setPending(null);
    } catch (err) {
      const message = errorText(err, "Status nije promenjen.");
      if (detached.current) toast.error(message);
      else setError(message);
    } finally {
      setBusy(false);
    }
  };

  const to = pending?.to;
  const valid =
    to === "otkazana"
      ? reason.trim().length >= 3
      : to === "poslata"
        ? Boolean(courier && tracking.trim())
        : true;
  const description =
    to === "potvrdjena"
      ? `Stanje se umanjuje za artikle iz porudžbine (${itemCount} ${itemCount === 1 ? "stavka" : "stavke"}); kupac dobija potvrdu.`
      : to === "otkazana"
        ? order.stockCommitted
          ? "Artikli se vraćaju na stanje. Kupac dobija obaveštenje sa razlogom."
          : "Kupac dobija obaveštenje sa razlogom."
        : to === "poslata"
          ? "Kupac dobija broj pošiljke i link za praćenje."
          : to === "zavrsena"
            ? "Porudžbina se zatvara; posle toga se više ne menja."
            : to
              ? "Kupac dobija obaveštenje o promeni statusa."
              : "";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button asChild variant="quiet" size="sm" icon={<PrinterIcon size={16} />}>
        <a href={ADMIN.orderProforma(order.number)} target="_blank" rel="noopener">
          Predračun
        </a>
      </Button>
      <Button asChild variant="quiet" size="sm" icon={<PrinterIcon size={16} />}>
        <a href={ADMIN.orderDeliveryNote(order.number)} target="_blank" rel="noopener">
          Otpremnica
        </a>
      </Button>
      {others.length > 0 ? (
        <Menu
          trigger={
            <Button variant="secondary" size="sm" trailingIcon={<CaretDownIcon size={14} />}>
              Promeni status
            </Button>
          }
          items={others.map((s) => ({
            label: ORDER_TRANSITION_VERB[s],
            danger: s === "otkazana",
            onSelect: () => open(s),
          }))}
        />
      ) : null}
      {primary ? (
        <Button
          size="sm"
          onClick={() => open(primary)}
          data-testid={TEST_IDS.adminOrderTransition(primary)}
        >
          {ORDER_TRANSITION_VERB[primary]}
        </Button>
      ) : null}
      <Dialog
        open={pending !== null}
        onOpenChange={(v) => {
          if (v || (busy && !lost)) return;
          if (busy) detached.current = true;
          setPending(null);
        }}
        title={to ? `${ORDER_TRANSITION_VERB[to]} — ${order.number}` : ""}
        role="alertdialog"
        dismissible={!busy || lost}
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid && !busy) void run();
          }}
        >
          <p className="type-body-s text-ink-2">{description}</p>
          {to === "otkazana" ? (
            <Field
              label="Razlog otkazivanja"
              required
              markRequired
              help="Kupac vidi razlog u obaveštenju i na stranici porudžbine."
            >
              <Textarea
                rows={3}
                maxLength={300}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                autoFocus
              />
            </Field>
          ) : null}
          {to === "poslata" ? (
            <>
              <Field label="Kurirska služba" required markRequired>
                <Select
                  value={courier}
                  onChange={(e) => setCourier(e.target.value)}
                  options={(settings?.couriers ?? []).map((c) => ({
                    value: c.code,
                    label: c.name,
                  }))}
                />
              </Field>
              <Field label="Broj pošiljke" required markRequired>
                <Input
                  value={tracking}
                  onChange={(e) => setTracking(e.target.value)}
                  inputClassName="font-mono"
                  autoFocus
                  data-testid="admin-order-tracking-input"
                />
              </Field>
            </>
          ) : null}
          <p role="status" className={waiting ? "type-body-s text-ink-2" : "sr-only"}>
            {waiting
              ? "Nema veze sa serverom. Radnja čeka i biće izvršena čim se veza vrati; prozor možete zatvoriti."
              : ""}
          </p>
          {error ? (
            <p role="alert" className="type-body-s text-danger">
              {error}
            </p>
          ) : null}
          <div className="flex flex-col-reverse gap-3 border-t border-line pt-4 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                if (busy) detached.current = true;
                setPending(null);
              }}
              disabled={busy && !lost}
            >
              {waiting ? "Zatvori" : "Odustani"}
            </Button>
            <Button
              type="submit"
              variant={to === "otkazana" ? "danger" : "primary"}
              loading={busy}
              disabled={!valid}
              data-testid="admin-order-transition-confirm"
            >
              {waiting ? "Čeka vezu…" : to ? ORDER_TRANSITION_VERB[to] : "Potvrdi"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

type LineEdit = { quantity: string; price: string; remove: boolean };

function ItemsSection({ data }: { data: Detail }) {
  const o = data.order;
  const editable = o.status === "nova";
  const editItems = useMutation(api.ordersAdmin.editItems);
  const [editing, setEditing] = useState(false);
  const [edits, setEdits] = useState<Record<string, LineEdit>>({});
  const [adds, setAdds] = useState<{ product: PickedProduct; quantity: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = () => {
    setEdits(
      Object.fromEntries(
        data.items.map((i) => [
          i._id,
          { quantity: String(i.quantity), price: moneyInputValue(i.unitPricePara), remove: false },
        ]),
      ),
    );
    setAdds([]);
    setError(null);
    setEditing(true);
  };

  const save = async () => {
    setError(null);
    const changes = [];
    for (const i of data.items) {
      const e = edits[i._id];
      if (!e) continue;
      if (e.remove) {
        changes.push({ itemId: i._id, remove: true });
        continue;
      }
      const quantity = Number(e.quantity);
      const price = parseMoneyInput(e.price);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999)
        return setError(`${i.sku}: količina 1–999.`);
      if (price === undefined || Number.isNaN(price) || price < 0)
        return setError(`${i.sku}: upišite ispravnu cenu.`);
      if (quantity !== i.quantity || price !== i.unitPricePara)
        changes.push({ itemId: i._id, quantity, unitPricePara: price });
    }
    const add = adds.map((a) => ({
      productId: a.product._id as Id<"products">,
      quantity: Number(a.quantity),
    }));
    if (add.some((a) => !Number.isInteger(a.quantity) || a.quantity < 1 || a.quantity > 999))
      return setError("Količina novih stavki: 1–999.");
    if (changes.length === 0 && add.length === 0) return setEditing(false);
    setBusy(true);
    try {
      await editItems({
        orderId: o._id,
        expectedUpdatedAt: o.updatedAt,
        changes,
        ...(add.length ? { add } : {}),
      });
      toast.success("Stavke su izmenjene; kupac dobija obaveštenje.");
      setEditing(false);
    } catch (err) {
      setError(errorText(err, "Stavke nisu sačuvane."));
    } finally {
      setBusy(false);
    }
  };

  // VIS-18: below 1280 px (the two-column lg layout and phones) the read-only table folds to
  // Artikal | Iznos with „2 × 4.690 RSD“ under the name; Rabat only when a line has one.
  const showRabat = data.items.some((i) => i.discountBp > 0);
  const wide = editing ? undefined : "hidden xl:table-cell";

  return (
    <Section
      title="Stavke"
      actions={
        editable && !editing ? (
          <Button variant="secondary" size="sm" onClick={start}>
            Izmeni stavke
          </Button>
        ) : !editable ? (
          <span className="type-caption text-ink-3">
            Stavke se menjaju samo dok je porudžbina nova.
          </span>
        ) : null
      }
    >
      <div className="-mx-4 overflow-x-auto">
        <table className={cn("w-full border-collapse text-cell", editing && "min-w-[560px]")}>
          <caption className="sr-only">Stavke porudžbine {o.number}</caption>
          <thead>
            <tr className="border-b border-line text-left type-label uppercase text-ink-3">
              <th scope="col" className="px-4 py-2">
                Artikal
              </th>
              <th scope="col" className={cn("px-2 py-2 text-right", wide)}>
                Kol.
              </th>
              <th scope="col" className={cn("px-2 py-2 text-right", wide)}>
                Cena
              </th>
              {showRabat ? (
                <th scope="col" className={cn("px-2 py-2 text-right", wide)}>
                  Rabat
                </th>
              ) : null}
              <th scope="col" className="px-4 py-2 text-right">
                Iznos
              </th>
              {editing ? (
                <th scope="col" className="w-10 px-2 py-2">
                  <span className="sr-only">Ukloni</span>
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {data.items.map((i) => {
              const e = edits[i._id];
              const removed = editing && e?.remove;
              return (
                <tr
                  key={i._id}
                  className={
                    removed ? "border-b border-line-faint opacity-50" : "border-b border-line-faint"
                  }
                >
                  <td className="px-4 py-2.5">
                    <span className="flex flex-col">
                      {i.productId ? (
                        <RouteLink
                          href={ADMIN.product(i.productId)}
                          className="text-ink-1 hover:underline"
                        >
                          {i.name}
                        </RouteLink>
                      ) : (
                        <span className="text-ink-1">{i.name}</span>
                      )}
                      <span className="type-caption text-ink-3">
                        <span className="type-code-s">{i.sku}</span>
                        {i.oem ? (
                          <>
                            {" "}
                            · OEM <span className="type-code-s">{i.oem}</span>
                          </>
                        ) : null}{" "}
                        · {i.manufacturerName}
                      </span>
                      <span className="type-caption text-ink-3">
                        {i.availabilityAtOrder === "on_order" ||
                        i.availabilityAtOrder === "out_of_stock"
                          ? `Po porudžbini${i.leadTimeDays ? `, rok ${i.leadTimeDays} d` : ""}`
                          : "Bilo na stanju"}
                        {i.currentStock !== null ? ` · sada ${i.currentStock} kom.` : ""}
                        {i.committedQty ? ` · skinuto ${i.committedQty}` : ""}
                      </span>
                      {editing ? null : (
                        <span className="mt-0.5 type-body-s tabular-nums text-ink-2 xl:hidden">
                          {i.quantity} × {formatRSD(i.unitPricePara)}
                          {i.discountBp > 0 ? ` · rabat ${discountText(i.discountBp)}` : ""}
                        </span>
                      )}
                    </span>
                  </td>
                  <td className={cn("px-2 py-2.5 text-right tabular-nums", wide)}>
                    {editing && e ? (
                      <CompactInput
                        aria-label={`Količina, ${i.sku}`}
                        inputMode="numeric"
                        value={e.quantity}
                        disabled={e.remove}
                        onChange={(ev) =>
                          setEdits({ ...edits, [i._id]: { ...e, quantity: ev.target.value } })
                        }
                        className="w-16! px-2!"
                        inputClassName="text-right tabular-nums"
                      />
                    ) : (
                      i.quantity
                    )}
                  </td>
                  <td className={cn("px-2 py-2.5 text-right tabular-nums", wide)}>
                    {editing && e ? (
                      <CompactInput
                        aria-label={`Cena po komadu, ${i.sku}`}
                        inputMode="decimal"
                        value={e.price}
                        disabled={e.remove}
                        onChange={(ev) =>
                          setEdits({ ...edits, [i._id]: { ...e, price: ev.target.value } })
                        }
                        className="w-28! px-2!"
                        inputClassName="text-right tabular-nums"
                      />
                    ) : (
                      <span className="flex flex-col items-end">
                        <span>{formatRSD(i.unitPricePara)}</span>
                        {i.unitRetailPara !== i.unitPricePara ? (
                          <span className="type-caption text-ink-3 line-through">
                            {formatRSD(i.unitRetailPara)}
                          </span>
                        ) : null}
                      </span>
                    )}
                  </td>
                  {showRabat ? (
                    <td className={cn("px-2 py-2.5 text-right tabular-nums text-ink-2", wide)}>
                      {i.discountBp > 0 ? discountText(i.discountBp) : "—"}
                    </td>
                  ) : null}
                  <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                    {formatRSD(i.lineTotalPara)}
                  </td>
                  {editing && e ? (
                    <td className="px-2 py-2.5">
                      <IconButton
                        label={e.remove ? `Vrati ${i.sku}` : `Ukloni ${i.sku}`}
                        icon={<TrashIcon size={16} />}
                        size="sm"
                        aria-pressed={e.remove}
                        onClick={() => setEdits({ ...edits, [i._id]: { ...e, remove: !e.remove } })}
                      />
                    </td>
                  ) : null}
                </tr>
              );
            })}
            {editing
              ? adds.map((a, idx) => (
                  <tr
                    key={`add-${a.product._id}`}
                    className="border-b border-line-faint bg-surface-2"
                  >
                    <td className="px-4 py-2.5">
                      <span className="flex flex-col">
                        <span>{a.product.name}</span>
                        <span className="type-caption text-ink-3">
                          Nova stavka · <span className="type-code-s">{a.product.sku}</span>
                        </span>
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-right">
                      <CompactInput
                        aria-label={`Količina, ${a.product.sku}`}
                        inputMode="numeric"
                        value={a.quantity}
                        onChange={(ev) =>
                          setAdds(
                            adds.map((x, j) =>
                              j === idx ? { ...x, quantity: ev.target.value } : x,
                            ),
                          )
                        }
                        className="w-16! px-2!"
                        inputClassName="text-right tabular-nums"
                      />
                    </td>
                    <td
                      className="px-2 py-2.5 text-right type-caption text-ink-3"
                      colSpan={showRabat ? 3 : 2}
                    >
                      Cena po cenovniku kupca pri čuvanju
                    </td>
                    <td className="px-2 py-2.5">
                      <IconButton
                        label={`Ukloni ${a.product.sku}`}
                        icon={<TrashIcon size={16} />}
                        size="sm"
                        onClick={() => setAdds(adds.filter((_, j) => j !== idx))}
                      />
                    </td>
                  </tr>
                ))
              : null}
          </tbody>
        </table>
      </div>
      {editing ? (
        <div className="mt-4 flex flex-col gap-3">
          <ProductPicker
            onPick={(p) =>
              setAdds(
                adds.some((a) => a.product._id === p._id)
                  ? adds
                  : [...adds, { product: p, quantity: "1" }],
              )
            }
          />
          {error ? (
            <p role="alert" className="type-body-s text-danger">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditing(false)} disabled={busy}>
              Odbaci izmene
            </Button>
            <Button onClick={() => void save()} loading={busy}>
              Sačuvaj stavke
            </Button>
          </div>
        </div>
      ) : (
        <dl className="ml-auto mt-4 flex w-full max-w-xs flex-col gap-1 type-body-s">
          {o.discountPara > 0 ? (
            <>
              <div className="flex justify-between">
                <dt className="text-ink-2">Po maloprodajnim cenama</dt>
                <dd className="tabular-nums">{formatRSD(o.itemsRetailPara)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-2">Rabat{o.tierName ? ` (${o.tierName})` : ""}</dt>
                <dd className="tabular-nums">−{formatRSD(o.discountPara)}</dd>
              </div>
            </>
          ) : null}
          <div className="flex justify-between">
            <dt className="text-ink-2">Artikli</dt>
            <dd className="tabular-nums">{formatRSD(o.itemsPara)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-2">Dostava</dt>
            <dd className="tabular-nums">
              {o.deliveryPara === 0 ? "Besplatno" : formatRSD(o.deliveryPara)}
            </dd>
          </div>
          <div className="flex justify-between border-t border-line-strong pt-2 font-semibold">
            <dt>Ukupno sa PDV-om</dt>
            <dd className="tabular-nums">{formatRSD(o.totalPara)}</dd>
          </div>
          <div className="flex justify-between type-caption text-ink-3">
            <dt>od toga PDV</dt>
            <dd className="tabular-nums">{formatRSD(o.vatPara)}</dd>
          </div>
        </dl>
      )}
    </Section>
  );
}

function NotesSection({ orderId }: { orderId: Id<"orders"> }) {
  const addNote = useMutation(api.ordersAdmin.addNote);
  const [text, setText] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <Section title="Napomena">
      <form
        className="flex flex-col gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!text.trim()) return;
          setBusy(true);
          try {
            await addNote({ orderId, message: text.trim(), visibleToCustomer: visible });
            setText("");
            setVisible(false);
            toast.success("Napomena je dodata.");
          } catch (err) {
            toast.error(convexErrorMessage(err, "Napomena nije sačuvana."));
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field
          label="Nova napomena"
          help="Interna napomena vidi samo osoblje, osim ako je označeno drugačije."
        >
          <Textarea
            rows={3}
            maxLength={1000}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </Field>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Checkbox
            label="Vidljivo kupcu na stranici porudžbine"
            checked={visible}
            onCheckedChange={(v) => setVisible(v === true)}
          />
          <Button
            type="submit"
            variant="secondary"
            size="sm"
            loading={busy}
            disabled={!text.trim()}
          >
            Dodaj napomenu
          </Button>
        </div>
      </form>
    </Section>
  );
}

function CustomerSection({ order: o }: { order: Order }) {
  const name = `${o.contact.firstName} ${o.contact.lastName}`;
  const tel = o.contact.phone.replace(/\s/g, "");
  return (
    <Section title="Kupac">
      <DefinitionList
        rows={[
          {
            label: "Ime",
            value: o.userId ? (
              <RouteLink
                href={ADMIN.customer(o.userId)}
                className="text-accent-text underline-offset-2 hover:underline"
              >
                {name}
              </RouteLink>
            ) : (
              name
            ),
          },
          {
            label: "Tip",
            value: `${CUSTOMER_TYPE_LABEL[o.customerType]}${o.tierName ? ` · ${o.tierName}` : ""}`,
          },
          {
            label: "Telefon",
            value: (
              <a href={`tel:${tel}`} className="tabular-nums hover:underline">
                {formatPhone(o.contact.phone)}
              </a>
            ),
          },
          {
            label: "E-pošta",
            value: o.contact.email ? (
              <a href={`mailto:${o.contact.email}`} className="break-all hover:underline">
                {o.contact.email}
              </a>
            ) : (
              <span className="text-ink-3">kupac bez e-pošte</span>
            ),
          },
          { label: "Firma", value: o.company?.name, hidden: !o.company },
          {
            label: "PIB",
            value: <span className="type-code">{o.company?.pib}</span>,
            hidden: !o.company,
          },
          {
            label: "MB",
            value: <span className="type-code">{o.company?.mb}</span>,
            hidden: !o.company?.mb,
          },
          {
            label: "Sedište",
            value: o.company?.address
              ? `${o.company.address.street}, ${o.company.address.postalCode} ${o.company.address.city}`
              : "",
            hidden: !o.company?.address,
          },
          { label: "Vozilo", value: o.vehicle, hidden: !o.vehicle },
          { label: "VIN", value: <span className="type-code">{o.vin}</span>, hidden: !o.vin },
          {
            label: "Majstor",
            value: o.mechanicProfileId ? (
              <RouteLink
                href={ADMIN.mechanic(o.mechanicProfileId)}
                className="text-accent-text underline-offset-2 hover:underline"
              >
                Profil servisa
              </RouteLink>
            ) : null,
            hidden: !o.mechanicProfileId,
          },
        ]}
      />
      <ContactActions phone={o.contact.phone} />
      {o.customerNote ? (
        <div className="mt-4 rounded-sm bg-surface-2 px-3 py-2">
          <p className="type-label uppercase text-ink-3">Napomena kupca</p>
          <p className="type-body-s text-ink-1">{o.customerNote}</p>
        </div>
      ) : null}
    </Section>
  );
}

function DeliverySection({ order: o }: { order: Order }) {
  const setTracking = useMutation(api.ordersAdmin.setTracking);
  const settings = useQuery(api.settings.getAdmin, {});
  const [editing, setEditing] = useState(false);
  const [courier, setCourier] = useState(o.courierCode ?? "");
  const [number, setNumber] = useState(o.trackingNumber ?? "");
  const [busy, setBusy] = useState(false);
  const courierName =
    settings?.couriers.find((c) => c.code === o.courierCode)?.name ?? o.courierCode;
  const canTrack = o.deliveryMethod === "courier" && !["otkazana", "zavrsena"].includes(o.status);
  return (
    <Section
      title="Dostava"
      actions={
        canTrack && !editing ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setCourier(o.courierCode ?? settings?.couriers[0]?.code ?? "");
              setNumber(o.trackingNumber ?? "");
              setEditing(true);
            }}
          >
            {o.trackingNumber ? "Izmeni broj pošiljke" : "Upiši broj pošiljke"}
          </Button>
        ) : null
      }
    >
      <DefinitionList
        rows={[
          { label: "Način", value: DELIVERY_LABEL[o.deliveryMethod] },
          { label: "Cena", value: o.deliveryPara === 0 ? "Besplatno" : formatRSD(o.deliveryPara) },
          {
            label: "Adresa",
            value: o.deliveryAddress
              ? `${o.deliveryAddress.street}, ${o.deliveryAddress.postalCode} ${o.deliveryAddress.city}${o.deliveryAddress.note ? ` (${o.deliveryAddress.note})` : ""}`
              : "",
            hidden: !o.deliveryAddress,
          },
          { label: "Kurir", value: courierName, hidden: !o.courierCode },
          {
            label: "Pošiljka",
            value: o.trackingUrl ? (
              <a
                href={o.trackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="type-code text-accent-text underline"
              >
                {o.trackingNumber}
              </a>
            ) : (
              <span className="type-code">{o.trackingNumber}</span>
            ),
            hidden: !o.trackingNumber,
          },
        ]}
      />
      {editing ? (
        <form
          className="mt-4 flex flex-col gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await setTracking({
                orderId: o._id,
                courierCode: courier,
                trackingNumber: number.trim(),
                expectedUpdatedAt: o.updatedAt,
              });
              toast.success("Broj pošiljke je sačuvan.");
              setEditing(false);
            } catch (err) {
              toast.error(errorText(err, "Broj pošiljke nije sačuvan."));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Kurirska služba">
            <Select
              size="sm"
              value={courier}
              onChange={(e) => setCourier(e.target.value)}
              options={(settings?.couriers ?? []).map((c) => ({ value: c.code, label: c.name }))}
            />
          </Field>
          <Field label="Broj pošiljke">
            <CompactInput
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              inputClassName="font-mono"
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" type="button" onClick={() => setEditing(false)}>
              Odustani
            </Button>
            <Button size="sm" type="submit" loading={busy} disabled={!courier || !number.trim()}>
              Sačuvaj
            </Button>
          </div>
        </form>
      ) : null}
    </Section>
  );
}

function PaymentSection({ order: o }: { order: Order }) {
  const markPaid = useMutation(api.ordersAdmin.markPaid);
  const [busy, setBusy] = useState(false);
  const paid = o.paymentStatus === "paid";
  return (
    <Section
      title="Plaćanje"
      actions={
        o.status !== "otkazana" ? (
          <Button
            variant={paid ? "ghost" : "secondary"}
            size="sm"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await markPaid({ orderId: o._id, paid: !paid });
                toast.success(paid ? "Uplata je poništena." : "Uplata je evidentirana.", {
                  action: {
                    label: "Poništi",
                    onClick: () => void markPaid({ orderId: o._id, paid }),
                  },
                });
              } catch (err) {
                toast.error(convexErrorMessage(err, "Nije sačuvano."));
              } finally {
                setBusy(false);
              }
            }}
          >
            {paid ? "Poništi uplatu" : "Označi kao plaćeno"}
          </Button>
        ) : null
      }
    >
      <DefinitionList
        rows={[
          { label: "Način", value: PAYMENT_LABEL[o.paymentMethod] },
          {
            label: "Status",
            value: (
              <Chip tone={paid ? "success" : "neutral"}>
                {PAYMENT_STATUS_LABEL[o.paymentStatus]}
              </Chip>
            ),
          },
          { label: "Plaćeno", value: o.paidAt ? compactDateTime(o.paidAt) : "", hidden: !o.paidAt },
          { label: "Rok", value: o.dueAt ? compactDateTime(o.dueAt) : "", hidden: !o.dueAt },
          {
            label: "Poziv na broj",
            value: <span className="type-code">{o.paymentReference}</span>,
          },
        ]}
      />
    </Section>
  );
}

function HistorySection({ orderId }: { orderId: Id<"orders"> }) {
  const rows = useQuery(api.ordersAdmin.customerHistory, { orderId });
  if (!rows || rows.length === 0) return null;
  return (
    <Section title="Ranije porudžbine kupca">
      <ul className="flex flex-col divide-y divide-line-faint">
        {rows.map((r) => (
          <li key={r.number}>
            <RouteLink
              href={ADMIN.order(r.number)}
              className="flex items-center gap-3 py-2 type-body-s hover:bg-surface-2"
            >
              <DocNumber number={r.number} />
              <span className="flex-1 text-right tabular-nums">{formatRSD(r.totalPara)}</span>
              <OrderStatusBadge status={r.status} />
            </RouteLink>
          </li>
        ))}
      </ul>
    </Section>
  );
}
