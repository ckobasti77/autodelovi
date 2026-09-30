"use client";

/**
 * Ad attribution block (brief §5 „ad attribution visible in admin“): first and last touch
 * with utm_*, click ids (gclid/gbraid/wbraid/fbclid/msclkid), referrer and landing path.
 */
import type { FunctionReturnType } from "convex/server";

import type { api } from "@/convex/_generated/api";
import { compactDateTime } from "@/lib/admin/format";

type Attribution = NonNullable<
  NonNullable<FunctionReturnType<typeof api.ordersAdmin.get>>["order"]["attribution"]
>;
type Touch = NonNullable<Attribution["first"]>;

function channelOf(t: Touch): string {
  if (t.gclid || t.gbraid || t.wbraid) return "Google Ads";
  if (t.fbclid) return "Meta Ads";
  if (t.msclkid) return "Microsoft Ads";
  if (t.source) return t.medium ? `${t.source} / ${t.medium}` : t.source;
  if (t.referrer) {
    try {
      return new URL(t.referrer).hostname.replace(/^www\./, "");
    } catch {
      return "Upućivanje";
    }
  }
  return "Direktno";
}

function TouchRows({ title, t }: { title: string; t: Touch }) {
  const rows: [string, string | undefined][] = [
    ["Kanal", channelOf(t)],
    ["Kampanja", t.campaign],
    ["Termin", t.term],
    ["Oglas", t.content],
    ["gclid", t.gclid ?? t.gbraid ?? t.wbraid],
    ["fbclid", t.fbclid],
    ["Upućeno sa", t.referrer],
    ["Odredišna strana", t.landingPath],
    ["Vreme", compactDateTime(t.at)],
  ];
  return (
    <div className="flex flex-col gap-1.5">
      <p className="type-label uppercase text-ink-3">{title}</p>
      <dl className="grid grid-cols-[7rem_minmax(0,1fr)] gap-x-3 gap-y-1 type-caption">
        {rows
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-ink-3">{k}</dt>
              <dd className="break-all text-ink-1">{v}</dd>
            </div>
          ))}
      </dl>
    </div>
  );
}

export function AttributionView({ attribution }: { attribution: Attribution | null }) {
  if (!attribution || (!attribution.first && !attribution.last)) {
    return (
      <p className="type-body-s text-ink-2">
        Bez podataka o izvoru (direktan dolazak ili stari pregledač).
      </p>
    );
  }
  const same =
    attribution.first &&
    attribution.last &&
    JSON.stringify(attribution.first) === JSON.stringify(attribution.last);
  return (
    <div className="flex flex-col gap-4">
      {attribution.first ? (
        <TouchRows title={same ? "Dolazak" : "Prvi dolazak"} t={attribution.first} />
      ) : null}
      {attribution.last && !same ? (
        <TouchRows title="Poslednji dolazak" t={attribution.last} />
      ) : null}
      <p className="type-caption text-ink-3">
        Saglasnost: analitika {attribution.consentAnalytics ? "da" : "ne"}, oglasi{" "}
        {attribution.consentAds ? "da" : "ne"}.
      </p>
    </div>
  );
}
