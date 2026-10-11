"use client";

/**
 * `/za-majstore` quick-order demo: the real parser (`lib/domain/quickOrder.ts`) reading
 * messy lines live — normalised code and quantity per line. No prices here: matching and
 * „Vaša cena“ happen in the portal for approved mechanics.
 */
import { useMemo, useState } from "react";

import { parseQuickOrder } from "@/lib/domain/quickOrder";

const SAMPLE = "1k0-615-301-aa 2\n5Q0 698 151 x4\n2x 1K0.698.151\nOEM: 03L 115 562";

export function QuickOrderDemo() {
  const [text, setText] = useState(SAMPLE);
  const parsed = useMemo(() => parseQuickOrder(text.slice(0, 2_000)), [text]);
  const rows = parsed.items.slice(0, 8);
  return (
    <div className="grid gap-6 md:grid-cols-2 md:gap-x-(--gutter)" data-reveal="off">
      <div className="flex flex-col gap-2">
        <label htmlFor="qod-input" className="type-caption text-ink-2">
          Nalepite kako vam je stiglo
        </label>
        <textarea
          id="qod-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          spellCheck={false}
          autoComplete="off"
          className="w-full resize-y rounded-sm border border-control bg-surface-2 px-3 py-2.5 font-mono text-[0.9375rem] leading-relaxed text-ink-1 transition-control hover:border-ink-3 focus:border-focus focus:shadow-[inset_0_0_0_1px_var(--color-focus)] focus:outline-none"
        />
      </div>
      <div className="flex flex-col gap-2">
        <table className="w-full border-collapse">
          <caption className="mb-2 text-left type-caption text-ink-2">Ovako sistem čita brojeve</caption>
          <thead>
            <tr className="border-b border-line-strong">
              <th scope="col" className="py-2 pr-3 text-left type-label text-ink-3">
                Red
              </th>
              <th scope="col" className="py-2 pr-3 text-left type-label text-ink-3">
                OEM broj
              </th>
              <th scope="col" className="py-2 text-right type-label text-ink-3">
                Kom.
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-3 type-body-s text-ink-3">
                  Nijedan red ne liči na broj dela.
                </td>
              </tr>
            ) : (
              rows.map((item) => (
                <tr key={item.key} className="border-b border-line">
                  <td className="py-2.5 pr-3 type-caption tabular-nums text-ink-3">{item.lineNo}</td>
                  <td className="py-2.5 pr-3 type-code text-ink-1">{item.candidates[0]!.normalized}</td>
                  <td className="py-2.5 text-right type-numeral-s tabular-nums text-ink-1">
                    {item.candidates[0]!.quantity}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <p className="type-caption text-ink-3">
          Posle prijave svaki red dobija artikal, stanje i vašu cenu; brojeve koje nemamo šaljete kao upit jednim klikom.
        </p>
      </div>
    </div>
  );
}
