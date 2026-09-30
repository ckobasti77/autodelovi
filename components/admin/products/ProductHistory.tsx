"use client";

/** Per-product history: audit entries, price changes and stock movements (newest first). */
import { useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { compactDateTime } from "@/lib/admin/format";
import { formatRSD } from "@/lib/format/money";
import { STOCK_REASON_LABEL } from "@/lib/i18n/sr/admin";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tabs } from "@/components/ui/Tabs";

import { ActorLabel } from "../ui";

const PRICE_REASON: Record<string, string> = {
  manual: "Ručno",
  import: "Uvoz",
  import_rollback: "Poništen uvoz",
  bulk: "Grupna izmena",
};

export function ProductHistory({
  productId,
  nowMinute,
}: {
  productId: Id<"products">;
  nowMinute: number;
}) {
  const h = useQuery(api.catalog.productsAdmin.history, { productId });
  if (!h) return <Skeleton className="h-40 w-full" />;
  const empty = (text: string) => <p className="py-4 type-body-s text-ink-2">{text}</p>;
  return (
    <Tabs
      label="Istorija artikla"
      items={[
        {
          value: "izmene",
          label: `Izmene (${h.audit.length})`,
          content:
            h.audit.length === 0 ? (
              empty("Još nema izmena.")
            ) : (
              <ul className="divide-y divide-line-faint">
                {h.audit.map((a, i) => (
                  <li
                    key={i}
                    className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3 py-2 type-body-s"
                  >
                    <span className="tabular-nums text-ink-3">
                      {compactDateTime(a.at, nowMinute)}
                    </span>
                    <span className="flex flex-col">
                      <span className="text-ink-1">{a.summary}</span>
                      <span className="type-caption">
                        <ActorLabel actor={a.actor} />
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            ),
        },
        {
          value: "cene",
          label: `Cene (${h.prices.length})`,
          content:
            h.prices.length === 0 ? (
              empty("Cena nije menjana.")
            ) : (
              <ul className="divide-y divide-line-faint">
                {h.prices.map((p, i) => (
                  <li
                    key={i}
                    className="grid grid-cols-[7rem_minmax(0,1fr)_auto] gap-3 py-2 type-body-s"
                  >
                    <span className="tabular-nums text-ink-3">
                      {compactDateTime(p.at, nowMinute)}
                    </span>
                    <span className="tabular-nums">
                      {formatRSD(p.oldRetailPara)} →{" "}
                      <span className="font-semibold">{formatRSD(p.newRetailPara)}</span>
                    </span>
                    <span className="text-ink-3">{PRICE_REASON[p.reason] ?? p.reason}</span>
                  </li>
                ))}
              </ul>
            ),
        },
        {
          value: "stanje",
          label: `Stanje (${h.stock.length})`,
          content:
            h.stock.length === 0 ? (
              empty("Stanje nije menjano.")
            ) : (
              <ul className="divide-y divide-line-faint">
                {h.stock.map((s, i) => (
                  <li
                    key={i}
                    className="grid grid-cols-[7rem_4rem_minmax(0,1fr)] gap-3 py-2 type-body-s"
                  >
                    <span className="tabular-nums text-ink-3">
                      {compactDateTime(s.at, nowMinute)}
                    </span>
                    <span
                      className={
                        s.delta > 0 ? "tabular-nums text-success" : "tabular-nums text-danger"
                      }
                    >
                      {s.delta > 0 ? "+" : "−"}
                      {Math.abs(s.delta)}
                    </span>
                    <span className="text-ink-2">
                      {STOCK_REASON_LABEL[s.reason as keyof typeof STOCK_REASON_LABEL] ?? s.reason}{" "}
                      · posle {s.qtyAfter} kom.
                      {s.note ? ` · ${s.note}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            ),
        },
      ]}
    />
  );
}
