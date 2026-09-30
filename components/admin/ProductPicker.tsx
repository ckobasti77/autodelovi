"use client";

/**
 * Catalogue line picker (order edits, quotes): type an OEM / SKU / cross number or a name;
 * results show maker, stock and retail price; Enter or click adds the highlighted product.
 */
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useId, useState } from "react";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/ssr";

import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/cn";
import { formatRSD } from "@/lib/format/money";
import { STOCK_STATE_LABEL } from "@/lib/i18n/sr/admin";

import { useDebouncedValue } from "./hooks";

export type PickedProduct = FunctionReturnType<typeof api.catalog.productsAdmin.pick>[number];

export function ProductPicker({
  onPick,
  label = "Dodaj artikal iz kataloga",
  autoFocus,
}: {
  onPick: (p: PickedProduct) => void;
  label?: string;
  autoFocus?: boolean;
}) {
  const id = useId();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const term = useDebouncedValue(q.trim(), 200);
  const results = useQuery(api.catalog.productsAdmin.pick, term.length >= 2 ? { q: term } : "skip");
  const list = results ?? [];
  const open = term.length >= 2;

  const pick = (p: PickedProduct | undefined) => {
    if (!p) return;
    onPick(p);
    setQ("");
    setActive(0);
  };

  return (
    <div className="relative">
      <label htmlFor={`${id}-input`} className="mb-1 block type-caption font-medium text-ink-2">
        {label}
      </label>
      <div className="flex h-10 items-center gap-2 rounded-xs border border-control bg-surface-1 px-3 focus-within:border-focus focus-within:shadow-[inset_0_0_0_1px_var(--color-focus)]">
        <MagnifyingGlassIcon size={16} className="shrink-0 text-ink-3" aria-hidden="true" />
        <input
          id={`${id}-input`}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-activedescendant={open && list[active] ? `${id}-${active}` : undefined}
          autoComplete="off"
          autoFocus={autoFocus}
          value={q}
          placeholder="OEM, šifra ili naziv…"
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(list.length - 1, a + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(0, a - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              pick(list[active]);
            } else if (e.key === "Escape") {
              setQ("");
            }
          }}
          className="h-full min-w-0 flex-1 bg-transparent type-body-s text-ink-1 outline-none placeholder:text-ink-3"
        />
      </div>
      {open ? (
        <ul
          id={`${id}-list`}
          role="listbox"
          aria-label="Artikli"
          className="absolute inset-x-0 top-full z-dropdown mt-1 max-h-80 overflow-y-auto rounded-md bg-surface-3 py-1 shadow-overlay"
        >
          {results === undefined ? (
            <li className="px-3 py-3 type-body-s text-ink-3" role="presentation">
              Traži se…
            </li>
          ) : list.length === 0 ? (
            <li className="px-3 py-3 type-body-s text-ink-2" role="presentation">
              Nema artikla za „{term}“. Dodajte slobodnu stavku.
            </li>
          ) : (
            list.map((p, i) => (
              <li
                key={p._id}
                id={`${id}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseMove={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(p)}
                className={cn(
                  "flex cursor-pointer items-center gap-3 px-3 py-2 type-body-s",
                  i === active && "bg-selected",
                )}
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-ink-1">
                    {p.name}
                    {!p.active ? <span className="text-ink-3"> (neaktivan)</span> : null}
                  </span>
                  <span className="truncate type-caption text-ink-3">
                    <span className="type-code-s">{p.sku}</span>
                    {p.oemPrimary ? (
                      <>
                        {" "}
                        · OEM <span className="type-code-s">{p.oemPrimary}</span>
                      </>
                    ) : null}{" "}
                    · {p.manufacturerName}
                  </span>
                </span>
                <span className="flex flex-col items-end whitespace-nowrap">
                  <span className="tabular-nums text-ink-1">{formatRSD(p.retailPricePara)}</span>
                  <span className="type-caption tabular-nums text-ink-3">
                    {STOCK_STATE_LABEL[p.stockState]} · {p.stockQty} kom.
                  </span>
                </span>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
