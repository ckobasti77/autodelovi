import { cn } from "@/lib/cn";
import { formatPercent, formatRSD, formatRSDParts } from "@/lib/format";

export type PriceSize = "s" | "m" | "l";

const valueSize: Record<PriceSize, string> = {
  s: "type-numeral-s",
  m: "type-numeral-m",
  l: "type-numeral-l",
};

export type PriceProps = {
  /** Price the viewer pays, in para (VAT included). */
  para: number;
  /** `mechanic`: the viewer's price with the struck retail price above it (§3.7). */
  variant?: "retail" | "mechanic";
  /** Retail price in para — required for the mechanic variant. */
  retailPara?: number;
  /** Rabat ratio (0.15) — shown only on the product page / mechanic portal, never as a promo badge. */
  discount?: number;
  size?: PriceSize;
  /** „sa PDV-om“ note (default on: retail buyers and B2B buyers both need it). */
  vatNote?: boolean;
  align?: "start" | "end";
  className?: string;
};

function Amount({ para, size }: { para: number; size: PriceSize }) {
  const { value, unit } = formatRSDParts(para);
  return (
    <span
      className={cn("inline-flex items-baseline gap-[0.18em] whitespace-nowrap", valueSize[size])}
    >
      <span>{value}</span>
      <span className="font-ui text-[max(0.5em,11px)] font-semibold tracking-normal">{unit}</span>
    </span>
  );
}

/**
 * Price block (§3.7, §9.8). A live value: excluded from the text reveal and never animated
 * in; the cart total adds its own aria-live wrapper.
 */
export function Price({
  para,
  variant = "retail",
  retailPara,
  discount,
  size = "m",
  vatNote = true,
  align = "start",
  className,
}: PriceProps) {
  const isMechanic = variant === "mechanic" && retailPara !== undefined;
  return (
    <div
      data-reveal="off"
      className={cn(
        "flex flex-col gap-0.5",
        align === "end" ? "items-end text-right" : "items-start",
        className,
      )}
    >
      {isMechanic ? (
        <>
          <span className="type-caption-s text-ink-3">
            <abbr title="Maloprodajna cena" className="no-underline" aria-hidden="true">
              MP
            </abbr>
            <span className="sr-only">Maloprodajna cena:</span>{" "}
            <s className="decoration-1">{formatRSD(retailPara)}</s>
          </span>
          <span className="type-caption-s font-semibold text-accent-text">
            Vaša cena
            {discount ? <> · rabat {formatPercent(discount)}</> : null}
          </span>
          <span className="text-accent-text">
            <Amount para={para} size={size} />
          </span>
        </>
      ) : (
        <span className="text-ink-1">
          <Amount para={para} size={size} />
        </span>
      )}
      {vatNote ? <span className="type-caption-s text-ink-3">sa PDV-om</span> : null}
    </div>
  );
}
