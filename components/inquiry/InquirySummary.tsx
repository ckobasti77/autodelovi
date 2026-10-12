import { cn } from "@/lib/cn";

/**
 * „Vaš upit“: what the visitor sent — vehicle, VIN, the description and the number of photos —
 * as a record panel beside the confirmation (thank-you page) and beside the quote (status
 * page). No hooks: rendered by a server page and by the live status view.
 */
export function InquirySummary({
  inquiry,
  className,
}: {
  inquiry: {
    vehicleLabel: string | null;
    vin: string | null;
    message: string;
    photoCount: number;
  };
  className?: string;
}) {
  const row = "flex flex-col gap-1 border-t border-line-faint py-3 first:border-t-0 first:pt-0 last:pb-0";
  const term = "type-label uppercase text-ink-3";
  return (
    <div className={cn("flex flex-col", className)}>
      <h2 className="type-h4 text-ink-1">Vaš upit</h2>
      <dl className="mt-4 flex flex-col">
        {inquiry.vehicleLabel ? (
          <div className={row}>
            <dt className={term}>Vozilo</dt>
            <dd className="type-body-s text-ink-1">{inquiry.vehicleLabel}</dd>
          </div>
        ) : null}
        {inquiry.vin ? (
          <div className={row}>
            <dt className={term}>Broj šasije</dt>
            <dd className="type-code break-all text-ink-1">{inquiry.vin}</dd>
          </div>
        ) : null}
        <div className={row}>
          <dt className={term}>Opis</dt>
          <dd className="type-body-s whitespace-pre-line break-words text-ink-2">
            {inquiry.message}
          </dd>
        </div>
        {inquiry.photoCount ? (
          <div className={row}>
            <dt className={term}>Fotografije</dt>
            <dd className="type-body-s tabular-nums text-ink-2">{inquiry.photoCount}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}
