"use client";

/**
 * Cart lines and summary (§9.11, §10.5), shared by the drawer and `/korpa`. Prices come from
 * `carts.get` (priced per viewer on every read; never stored). Line notices say exactly what
 * changed („Na stanju je još 1 kom.“) and the quantity can be fixed in place.
 */
import { useMutation } from "convex/react";
import { useState } from "react";
import { TrashIcon, WarningIcon } from "@phosphor-icons/react/dist/ssr";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/cn";
import { formatRSD } from "@/lib/format/money";
import { formatQuantity } from "@/lib/format/number";
import { useCart, useCartArgs } from "@/lib/cart/guestCart";
import { leadTimeLabel } from "@/lib/i18n/sr/catalog";
import { convexErrorMessage } from "@/lib/i18n/sr/shop";
import { vatIncludedPara } from "@/lib/domain/orderTotals";
import { IconButton } from "@/components/ui/IconButton";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
import { RouteLink } from "@/components/ui/RouteLink";
import { toast } from "@/components/ui/Toast";
import { ProductThumb } from "@/components/catalog/ProductThumb";
import { ROUTES } from "@/constants/routes";

export type CartData = NonNullable<ReturnType<typeof useCart>>;
export type CartLine = CartData["lines"][number];

export type DeliveryInfo = {
  courierPricePara: number | null;
  freeOverPara: number | null;
  pickup: boolean;
  vatRateBp: number;
};

function LineNotice({ line }: { line: CartLine }) {
  const n = line.notice;
  if (!n) return null;
  const text =
    n.kind === "unavailable"
      ? "Artikal više nije dostupan. Uklonite ga iz korpe."
      : n.kind === "insufficient_stock"
        ? n.available > 0
          ? `Na stanju je još ${formatQuantity(n.available)} Smanjite količinu.`
          : "Artikal trenutno nije na stanju."
        : `Deo ide po porudžbini${n.leadTimeDays ? ` · ${leadTimeLabel(n.leadTimeDays)}` : ""}.`;
  const tone = n.kind === "backorder" ? "text-info" : "text-warning";
  return (
    <p className={cn("flex items-start gap-1.5 type-caption", tone)} data-reveal="off">
      <WarningIcon size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
      {text}
    </p>
  );
}

function Line({ line, compact }: { line: CartLine; compact: boolean }) {
  const args = useCartArgs();
  const setQty = useMutation(api.carts.setQuantity);
  const remove = useMutation(api.carts.removeItem);
  const [busy, setBusy] = useState(false);
  const p = line.product;
  const guest = args === "skip" ? {} : args;
  const name = p?.name ?? "Artikal";
  const max =
    p && (p.stockState === "on_order" || p.stockState === "out_of_stock")
      ? 99
      : Math.max(1, Math.min(99, p?.stockQty ?? line.quantity));

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } catch (error) {
      toast.error(convexErrorMessage(error, "Izmena nije sačuvana. Pokušajte ponovo."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <li
      className={cn(
        "grid gap-x-3 gap-y-2 border-b border-line py-4 last:border-b-0",
        compact
          ? "grid-cols-[4rem_minmax(0,1fr)]"
          : "grid-cols-[4rem_minmax(0,1fr)] sm:grid-cols-[5rem_minmax(0,1fr)_auto_auto]",
      )}
      aria-busy={busy || undefined}
      data-testid="cart-line"
    >
      <ProductThumb
        imageUrl={p?.imageUrl ?? null}
        categorySlug={p?.categorySlug ?? ""}
        alt=""
        sizes="80px"
        className={cn("rounded-xs", compact ? "size-16" : "size-16 sm:size-20")}
      />
      <div className="flex min-w-0 flex-col gap-1">
        {p ? (
          <RouteLink
            href={ROUTES.product(p.slug)}
            className="line-clamp-2 type-body-s font-semibold text-ink-1 hover:underline hover:decoration-accent hover:underline-offset-4"
          >
            {name}
          </RouteLink>
        ) : (
          <span className="type-body-s font-semibold text-ink-1">{name}</span>
        )}
        {p ? (
          <p className="type-caption text-ink-3">
            {p.manufacturerName}
            {p.oemPrimary ? (
              <>
                {" · OEM "}
                <span className="type-code text-ink-2">{p.oemPrimary}</span>
              </>
            ) : null}
          </p>
        ) : null}
        <p className="type-caption tabular-nums text-ink-3" data-reveal="off">
          {formatRSD(line.unitPricePara)} × {line.quantity}
          {line.unitPricePara < line.unitRetailPara ? (
            <span className="text-accent-text"> · Vaša cena</span>
          ) : null}
        </p>
        <LineNotice line={line} />
        {compact ? (
          <div className="mt-1 flex items-center justify-between gap-3">
            <QuantityStepper
              size="sm"
              value={line.quantity}
              min={1}
              max={max}
              label={`Količina: ${name}`}
              onChange={(q) =>
                run(() => setQty({ ...guest, productId: line.productId as Id<"products">, quantity: q }))
              }
            />
            <span className="type-numeral-s tabular-nums text-ink-1" data-reveal="off">
              {formatRSD(line.lineTotalPara)}
            </span>
          </div>
        ) : null}
      </div>
      {!compact ? (
        <>
          <div className="col-start-2 sm:col-start-auto sm:self-center">
            <QuantityStepper
              size="sm"
              value={line.quantity}
              min={1}
              max={max}
              label={`Količina: ${name}`}
              onChange={(q) =>
                run(() => setQty({ ...guest, productId: line.productId as Id<"products">, quantity: q }))
              }
            />
          </div>
          <span
            className="col-start-2 type-numeral-s tabular-nums text-ink-1 sm:col-start-auto sm:self-center sm:text-right"
            data-reveal="off"
          >
            {formatRSD(line.lineTotalPara)}
          </span>
        </>
      ) : null}
      <div className={cn("col-start-2 -ml-2.5", !compact && "sm:col-start-2")}>
        <IconButton
          label={`Ukloni ${name}`}
          icon={<TrashIcon size={18} />}
          variant="ghost"
          onClick={() => run(() => remove({ ...guest, productId: line.productId as Id<"products"> }))}
          className="size-9"
        />
      </div>
    </li>
  );
}

export function CartLines({ cart, compact = false }: { cart: CartData; compact?: boolean }) {
  return (
    <ul className="flex flex-col" aria-label="Stavke u korpi">
      {cart.lines.map((line) => (
        <Line key={line.itemId} line={line} compact={compact} />
      ))}
    </ul>
  );
}

/** Summary rows (§9.8 totals): Međuzbir, rabat (mechanics), delivery hint, PDV. */
export function CartSummary({ cart, delivery }: { cart: CartData; delivery: DeliveryInfo }) {
  const remaining =
    delivery.freeOverPara !== null && delivery.courierPricePara
      ? delivery.freeOverPara - cart.itemsPara
      : null;
  return (
    <div className="flex flex-col gap-2 type-body-s" data-reveal="off">
      <dl className="flex flex-col gap-2">
      {cart.discountPara > 0 ? (
        <>
          <div className="flex justify-between gap-4 text-ink-3">
            <dt>Maloprodajna vrednost</dt>
            <dd className="tabular-nums">{formatRSD(cart.itemsRetailPara)}</dd>
          </div>
          <div className="flex justify-between gap-4 text-accent-text">
            <dt>Vaš rabat</dt>
            <dd className="tabular-nums">−{formatRSD(cart.discountPara)}</dd>
          </div>
        </>
      ) : null}
      <div className="flex items-baseline justify-between gap-4">
        <dt className="text-ink-2">Međuzbir</dt>
        <dd className="type-numeral-m tabular-nums text-ink-1" aria-live="polite">
          {formatRSD(cart.itemsPara)}
        </dd>
      </div>
      <div className="flex justify-between gap-4 text-ink-3">
        <dt>Dostava</dt>
        <dd className="text-right">
          {delivery.pickup ? "Preuzimanje 0 RSD" : null}
          {delivery.pickup && delivery.courierPricePara !== null ? " · " : null}
          {delivery.courierPricePara !== null
            ? remaining !== null && remaining <= 0
              ? "kurir besplatno"
              : `kurir ${formatRSD(delivery.courierPricePara)}`
            : null}
        </dd>
      </div>
      </dl>
      {remaining !== null && remaining > 0 ? (
        <p className="type-caption font-normal text-ink-3">
          Još {formatRSD(remaining)} do besplatne dostave.
        </p>
      ) : null}
      <p className="type-caption font-normal text-ink-3">
        U cenu je uračunat PDV {delivery.vatRateBp / 100} %:{" "}
        {formatRSD(vatIncludedPara(cart.itemsPara, delivery.vatRateBp))}
      </p>
    </div>
  );
}
