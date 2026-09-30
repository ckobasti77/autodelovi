"use client";

/**
 * Read-only SEO/ads status panels for Podešavanja: the programmatic landing guard (how many
 * category × vehicle pages are indexable and why the others are not) and the tracking status
 * (Conversions API token, cache purge, feed and sitemap addresses).
 */
import { useMutation, useQuery } from "convex/react";
import { ArrowsClockwiseIcon, CheckCircleIcon, WarningIcon } from "@phosphor-icons/react/dist/ssr";

import { api } from "@/convex/_generated/api";
import { compactDateTime } from "@/lib/admin/format";
import { LANDING_REASON_LABEL, type LandingReason } from "@/lib/seo/landingGuard";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/Toast";

import { Section } from "../ui";

export function LandingOverview() {
  const data = useQuery(api.seoAdmin.landingOverview, {});
  const recompute = useMutation(api.seoAdmin.recomputeLandings);
  return (
    <Section
      title="Odredišne strane kategorija × vozilo"
      actions={
        <Button
          size="sm"
          variant="secondary"
          icon={<ArrowsClockwiseIcon size={16} />}
          onClick={() =>
            void recompute({}).then(() => toast.success("Preračunavanje je pokrenuto (oko minut)."))
          }
        >
          Preračunaj sada
        </Button>
      }
    >
      {!data ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        <div className="flex flex-col gap-4 type-body-s">
          <p className="text-ink-2">
            U pretrazi: <strong className="text-ink-1">{data.indexable}</strong> od {data.total}{" "}
            mogućih (ograničenje {data.cap}). Strana ulazi u indeks kad ima dovoljno artikala, bar 2
            na stanju i više proizvođača ili generacija; računa se svakog sata
            {data.lastUpdatedAt
              ? ` (poslednja promena ${compactDateTime(data.lastUpdatedAt)})`
              : ""}
            .
          </p>
          {data.byReason.length ? (
            <ul className="flex flex-wrap gap-x-6 gap-y-1 text-ink-3">
              {data.byReason.map((r) => (
                <li key={r.reason}>
                  {LANDING_REASON_LABEL[r.reason as LandingReason] ?? r.reason}:{" "}
                  <span className="tabular-nums text-ink-2">{r.count}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {data.top.length ? (
            <ul className="flex flex-col divide-y divide-line-faint border-y border-line-faint">
              {data.top.map((t) => (
                <li key={t.path} className="flex items-center gap-3 py-1.5">
                  {t.indexable ? (
                    <CheckCircleIcon size={16} aria-label="U pretrazi" className="text-success" />
                  ) : (
                    <span className="size-4" aria-hidden="true" />
                  )}
                  <a
                    href={t.path}
                    target="_blank"
                    rel="noreferrer"
                    className="min-w-0 flex-1 truncate font-mono text-ink-2 hover:text-ink-1"
                  >
                    {t.path}
                  </a>
                  <span className="tabular-nums text-ink-3">
                    {t.productCount} art. · {t.inStockCount} na stanju
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </Section>
  );
}

const FEEDS: [string, string][] = [
  ["Mapa sajta (Search Console)", "/sitemap.xml"],
  ["Google Merchant Center (XML)", "/feeds/google-merchant.xml"],
  ["Meta katalog (CSV)", "/feeds/meta-catalog.csv"],
  ["robots.txt", "/robots.txt"],
];

export function TrackingStatus() {
  const status = useQuery(api.seoAdmin.trackingStatus, {});
  return (
    <Section title="Status servera i adrese za oglasne naloge">
      {!status ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        <div className="flex flex-col gap-4 type-body-s">
          <ul className="flex flex-col gap-2">
            <li className="flex items-start gap-2">
              {status.capiTokenSet ? (
                <CheckCircleIcon size={18} aria-hidden="true" className="mt-0.5 text-success" />
              ) : (
                <WarningIcon size={18} aria-hidden="true" className="mt-0.5 text-warning" />
              )}
              <span className="text-ink-2">
                Meta Conversions API token{" "}
                {status.capiTokenSet
                  ? "je podešen."
                  : "nije podešen — slanje sa servera ne radi dok se ne unese (uputstvo: ADS-PLAYBOOK)."}
              </span>
            </li>
            <li className="flex items-start gap-2">
              {status.revalidateEnabled ? (
                <CheckCircleIcon size={18} aria-hidden="true" className="mt-0.5 text-success" />
              ) : (
                <WarningIcon size={18} aria-hidden="true" className="mt-0.5 text-ink-3" />
              )}
              <span className="text-ink-2">
                Trenutno osvežavanje sajta posle izmena kataloga{" "}
                {status.revalidateEnabled
                  ? "je uključeno."
                  : "nije uključeno (lokalni rad) — strane se osvežavaju same u roku od 5–60 minuta."}
              </span>
            </li>
          </ul>
          {status.recentCapi.length ? (
            <div>
              <p className="mb-1 type-caption text-ink-3">Poslednja slanja ka Meti</p>
              <ul className="flex flex-col gap-0.5 font-mono type-caption text-ink-2">
                {status.recentCapi.map((c) => (
                  <li key={c.at}>
                    {compactDateTime(c.at)} · {c.status}
                    {c.detail ? ` · ${c.detail}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <ul className="grid gap-2 md:grid-cols-2">
            {FEEDS.map(([label, path]) => (
              <li key={path} className="flex flex-col">
                <span className="type-caption text-ink-3">{label}</span>
                <a
                  href={path}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-ink-1 underline decoration-line-strong underline-offset-4 hover:decoration-accent"
                >
                  {path}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Section>
  );
}
