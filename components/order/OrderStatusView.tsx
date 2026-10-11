"use client";

/**
 * Order status (`/porudzbina/[token]`, §10.6): server-rendered first, then live from
 * `orders.getByToken` so a confirmation or a tracking number shows up without a reload.
 */
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { PrinterIcon, TruckIcon } from "@phosphor-icons/react/dist/ssr";

import { api } from "@/convex/_generated/api";
import { formatDateTime } from "@/lib/format/date";
import { formatRSD } from "@/lib/format/money";
import { formatPhone } from "@/lib/format/phone";
import {
  DELIVERY_LABEL,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
  PAYMENT_LABEL,
} from "@/lib/i18n/sr/shop";
import { Badge } from "@/components/ui/Badge";
import { Link } from "@/components/ui/Link";
import { OrderTimeline } from "@/components/order/OrderTimeline";
import { ROUTES } from "@/constants/routes";
import { TEST_IDS } from "@/constants/testIds";

export type OrderView = NonNullable<FunctionReturnType<typeof api.orders.getByToken>>;

export function OrderStatusView({
  token,
  initial,
  children,
}: {
  token: string;
  initial: OrderView;
  children?: React.ReactNode;
}) {
  const live = useQuery(api.orders.getByToken, { token });
  const o = live ?? initial;
  return (
    <div className="grid gap-10 lg:grid-cols-12 lg:gap-x-(--gutter)" data-reveal="off">
      <div className="flex flex-col gap-8 lg:col-span-7">
        <div className="flex flex-wrap items-center gap-3">
          <span className="type-code-l text-ink-1" data-testid={TEST_IDS.orderNumber}>
            {o.number}
          </span>
          <Badge tone={ORDER_STATUS_TONE[o.status]} size="text">
            {ORDER_STATUS_LABEL[o.status]}
          </Badge>
          <span className="type-caption font-normal text-ink-3">{formatDateTime(o.createdAt)}</span>
        </div>
        {children}
        <section aria-labelledby="tl-title">
          <h2 id="tl-title" className="type-h3 text-ink-1">
            Tok porudžbine
          </h2>
          <div className="mt-4">
            <OrderTimeline
              status={o.status}
              deliveryMethod={o.delivery.method}
              createdAt={o.createdAt}
              events={o.timeline}
            />
          </div>
          {o.cancelReason ? (
            <p className="mt-4 type-body-s text-ink-2">Razlog otkazivanja: {o.cancelReason}</p>
          ) : null}
        </section>
        <section aria-labelledby="items-title">
          <h2 id="items-title" className="type-h3 text-ink-1">
            Stavke
          </h2>
          <ul className="mt-3 flex flex-col divide-y divide-line border-y border-line">
            {o.items.map((item, i) => (
              <li key={`${item.sku}-${i}`} className="flex justify-between gap-4 py-3 type-body-s">
                <span className="min-w-0">
                  <span className="block text-ink-1">{item.name}</span>
                  <span className="block type-caption text-ink-3">
                    {item.manufacturerName}
                    {item.oem ? (
                      <>
                        {" · OEM "}
                        <span className="whitespace-nowrap type-code">{item.oem}</span>
                      </>
                    ) : null}
                    {" · "}
                    {item.quantity} × {formatRSD(item.unitPricePara)}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums text-ink-1">
                  {formatRSD(item.lineTotalPara)}
                </span>
              </li>
            ))}
          </ul>
          <dl className="mt-3 flex flex-col gap-1.5 type-body-s">
            <div className="flex justify-between">
              <dt className="text-ink-2">Artikli</dt>
              <dd className="tabular-nums text-ink-1">{formatRSD(o.totals.itemsPara)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-2">Dostava</dt>
              <dd className="tabular-nums text-ink-1">{formatRSD(o.totals.deliveryPara)}</dd>
            </div>
            <div className="flex items-baseline justify-between border-t border-line pt-2">
              <dt className="font-semibold text-ink-1">Ukupno</dt>
              <dd className="type-numeral-m tabular-nums text-ink-1">
                {formatRSD(o.totals.totalPara)}
              </dd>
            </div>
          </dl>
          <p className="mt-1 type-caption font-normal text-ink-3">
            Uračunat PDV: {formatRSD(o.totals.vatPara)}
          </p>
        </section>
      </div>
      <aside className="flex flex-col gap-6 lg:col-span-5">
        <section className="panel p-5">
          <h2 className="type-h4 text-ink-1">Dostava</h2>
          <p className="mt-2 type-body-s text-ink-2">
            {DELIVERY_LABEL[o.delivery.method]}
            {o.delivery.address
              ? ` · ${o.delivery.address.street}, ${o.delivery.address.postalCode} ${o.delivery.address.city}`
              : ""}
          </p>
          {o.delivery.trackingNumber ? (
            <p className="mt-2 flex items-center gap-2 type-body-s text-ink-1">
              <TruckIcon size={18} aria-hidden="true" className="text-ink-3" />
              {o.delivery.courierName ? `${o.delivery.courierName}: ` : ""}
              {o.delivery.trackingUrl ? (
                <Link href={o.delivery.trackingUrl} variant="inline">
                  {o.delivery.trackingNumber}
                </Link>
              ) : (
                <span className="type-code">{o.delivery.trackingNumber}</span>
              )}
            </p>
          ) : null}
        </section>
        <section className="panel p-5">
          <h2 className="type-h4 text-ink-1">Plaćanje</h2>
          <p className="mt-2 type-body-s text-ink-2">
            {PAYMENT_LABEL[o.payment.method]}
            {o.payment.status === "paid" ? " · plaćeno" : ""}
          </p>
          {o.payment.method === "bank_transfer" ? (
            <p className="mt-3">
              <Link
                href={ROUTES.orderProforma(token)}
                variant="standalone"
                icon={<PrinterIcon size={14} />}
              >
                Predračun
              </Link>
            </p>
          ) : null}
        </section>
        <OrderNotices order={o} />
        <section className="panel p-5">
          <h2 className="type-h4 text-ink-1">Kupac</h2>
          <p className="mt-2 type-body-s text-ink-2">
            {o.contact.firstName} {o.contact.lastName}
            <span className="block">{formatPhone(o.contact.phone)}</span>
            <span className="block break-all">{o.contact.email}</span>
            {o.company ? (
              <span className="block">
                {o.company.name} · PIB {o.company.pib}
              </span>
            ) : null}
          </p>
          {o.vehicle ? (
            <p className="mt-2 type-caption font-normal text-ink-3">Vozilo: {o.vehicle.label}</p>
          ) : null}
        </section>
      </aside>
    </div>
  );
}

/**
 * Customer notices: where status news arrives and the e-mails already sent (history rows
 * `email_sent`, visible only when delivery is test/live — log mode never claims a sent mail).
 */
function OrderNotices({ order }: { order: OrderView }) {
  const sent = order.timeline
    .filter((e) => e.type === "email_sent")
    .slice(-3)
    .reverse();
  return (
    <section
      className="panel p-5"
      aria-labelledby="notices-title"
      data-testid="order-notices"
    >
      <h2 id="notices-title" className="type-h4 text-ink-1">
        Obaveštenja
      </h2>
      <p className="mt-2 type-body-s text-ink-2">
        {order.emailUpdates
          ? `Svaku promenu javljamo i e-poštom na ${order.contact.email}. Ova stranica se osvežava sama.`
          : "Svaku promenu vidite na ovoj stranici — osvežava se sama, bez ponovnog učitavanja."}
      </p>
      {sent.length ? (
        <ul className="mt-3 flex flex-col gap-2 border-t border-line pt-3">
          {sent.map((e) => (
            <li key={e.at} className="flex flex-col">
              <span className="type-body-s text-ink-1">
                {(e.message ?? "").replace(/^Poslata e-pošta: /, "")}
              </span>
              <span className="type-caption font-normal tabular-nums text-ink-3">
                E-pošta · {formatDateTime(e.at)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
