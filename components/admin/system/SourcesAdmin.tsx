"use client";

/**
 * `/admin/izvori` — where leads come from (SEO-ADS §J8): per channel and per
 * source/medium/campaign — inquiries, mechanic registrations, orders, order value and the
 * value of completed orders — for 7/30/90 days; plus the Google Ads offline conversions
 * export (completed orders with a click id and ads consent).
 */
import { useQuery } from "convex/react";
import { useState } from "react";
import { DownloadSimpleIcon, WarningIcon } from "@phosphor-icons/react/dist/ssr";

import { api } from "@/convex/_generated/api";
import { formatRSD } from "@/lib/format/money";
import { CHANNEL_LABEL } from "@/lib/i18n/sr/admin";
import { Skeleton } from "@/components/ui/Skeleton";
import { RouteLink } from "@/components/ui/RouteLink";
import { ADMIN } from "@/constants/routes";

import { useNowMinute } from "../hooks";
import { PageHeader, Section, SegmentedFilter } from "../ui";
import { Button } from "@/components/ui/Button";

type Days = "7" | "30" | "90";

const th = "py-2 pr-3 font-normal";
const td = "py-2 pr-3 tabular-nums";

function Num({ value }: { value: number }) {
  return <>{value.toLocaleString("sr-RS")}</>;
}

export function SourcesAdmin() {
  const nowMinute = useNowMinute();
  const [days, setDays] = useState<Days>("30");
  const to = nowMinute;
  const from = to - Number(days) * 86_400_000;
  const report = useQuery(api.seoAdmin.sourcesReport, { from, to });
  const offline = useQuery(api.seoAdmin.offlineConversions, { from: to - 90 * 86_400_000, to });
  const csvHref = `${ADMIN.exportFile("offline-konverzije.csv")}?dana=90`;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Izvori"
        description="Odakle dolaze upiti, registracije i porudžbine. Izvor je poslednja kampanja pre upita (ili prva, ako je posle bio direktan dolazak)."
        actions={
          <SegmentedFilter
            label="Period"
            value={days}
            onChange={setDays}
            options={[
              { value: "7", label: "7 dana" },
              { value: "30", label: "30 dana" },
              { value: "90", label: "90 dana" },
            ]}
          />
        }
      />
      {!report ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <>
          <Section title="Po kanalu">
            {report.byChannel.length === 0 ? (
              <p className="type-body-s text-ink-3">Nema upita ni porudžbina u ovom periodu.</p>
            ) : (
              <div className="overflow-x-auto">
                <table
                  className="w-full min-w-[44rem] border-collapse type-body-s"
                  data-testid="sources-by-channel"
                >
                  <caption className="sr-only">Upiti, registracije i porudžbine po kanalu</caption>
                  <thead>
                    <tr className="border-b border-line text-left type-label uppercase text-ink-3">
                      <th scope="col" className={th}>
                        Kanal
                      </th>
                      <th scope="col" className={`${th} text-right`}>
                        Upiti
                      </th>
                      <th scope="col" className={`${th} text-right`}>
                        Registracije
                      </th>
                      <th scope="col" className={`${th} text-right`}>
                        Porudžbine
                      </th>
                      <th scope="col" className={`${th} text-right`}>
                        Vrednost
                      </th>
                      <th scope="col" className={`${th} text-right`}>
                        Završeno
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.byChannel.map((r) => (
                      <tr key={r.channel} className="border-b border-line-faint">
                        <th scope="row" className="py-2 pr-3 text-left font-medium text-ink-1">
                          {r.channel === "google_ads" || r.channel === "meta_ads" ? (
                            <RouteLink
                              href={`${ADMIN.orders}?status=sve&kampanja=${r.channel}`}
                              className="hover:text-accent"
                            >
                              {CHANNEL_LABEL[r.channel]}
                            </RouteLink>
                          ) : (
                            (CHANNEL_LABEL[r.channel] ?? r.channel)
                          )}
                        </th>
                        <td className={`${td} text-right`}>
                          <Num value={r.inquiries} />
                        </td>
                        <td className={`${td} text-right`}>
                          <Num value={r.registrations} />
                        </td>
                        <td className={`${td} text-right`}>
                          <Num value={r.orders} />
                        </td>
                        <td className={`${td} text-right`}>{formatRSD(r.valuePara)}</td>
                        <td className={`${td} text-right`}>
                          {r.completedOrders} · {formatRSD(r.completedValuePara)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {report.truncated ? (
              <p className="mt-3 type-caption text-ink-3">
                Prikazano je prvih 5.000 zapisa po vrsti.
              </p>
            ) : null}
          </Section>

          <Section title="Izvor / medij / kampanja">
            {report.rows.length === 0 ? (
              <p className="type-body-s text-ink-3">Nema podataka.</p>
            ) : (
              <div className="overflow-x-auto">
                <table
                  className="w-full min-w-[52rem] border-collapse type-body-s"
                  data-testid="sources-rows"
                >
                  <caption className="sr-only">Detalji po izvoru, mediju i kampanji</caption>
                  <thead>
                    <tr className="border-b border-line text-left type-label uppercase text-ink-3">
                      <th scope="col" className={th}>
                        Izvor / medij
                      </th>
                      <th scope="col" className={th}>
                        Kampanja
                      </th>
                      <th scope="col" className={`${th} text-right`}>
                        Upiti
                      </th>
                      <th scope="col" className={`${th} text-right`}>
                        Reg.
                      </th>
                      <th scope="col" className={`${th} text-right`}>
                        Porudžbine
                      </th>
                      <th scope="col" className={`${th} text-right`}>
                        Vrednost
                      </th>
                      <th scope="col" className={`${th} text-right`}>
                        Završeno
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.rows.map((r) => (
                      <tr
                        key={`${r.channel}|${r.source}|${r.medium}|${r.campaign}`}
                        className="border-b border-line-faint"
                      >
                        <th scope="row" className="py-2 pr-3 text-left font-normal">
                          <span className="block text-ink-1">
                            {r.source} / {r.medium}
                          </span>
                          <span className="type-caption text-ink-3">
                            {CHANNEL_LABEL[r.channel] ?? r.channel}
                          </span>
                        </th>
                        <td className="max-w-[16rem] truncate py-2 pr-3 text-ink-2">
                          {r.campaign ? (
                            <RouteLink
                              href={`${ADMIN.orders}?status=sve&kampanja=${encodeURIComponent(r.campaign)}`}
                              className="hover:text-accent"
                            >
                              {r.campaign}
                            </RouteLink>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className={`${td} text-right`}>
                          <Num value={r.inquiries} />
                        </td>
                        <td className={`${td} text-right`}>
                          <Num value={r.registrations} />
                        </td>
                        <td className={`${td} text-right`}>
                          <Num value={r.orders} />
                        </td>
                        <td className={`${td} text-right`}>{formatRSD(r.valuePara)}</td>
                        <td className={`${td} text-right`}>{formatRSD(r.completedValuePara)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-3 type-caption text-ink-3">
              Bez podataka o izvoru: {report.withoutSource.orders} porudžbina,{" "}
              {report.withoutSource.inquiries} upita, {report.withoutSource.registrations}{" "}
              registracija (direktan dolazak ili stari pregledač).
            </p>
          </Section>
        </>
      )}

      <Section title="Offline konverzije za Google Ads">
        {!offline ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <div className="flex flex-col gap-3">
            <p className="max-w-[72ch] type-body-s text-ink-2">
              Završene porudžbine iz poslednjih 90 dana koje su došle preko Google oglasa (gclid) i
              čiji je kupac dozvolio oglasne kolačiće. Fajl se uvozi u Google Ads → Ciljevi →
              Konverzije → Uvoz.
            </p>
            {!offline.conversionName ? (
              <p className="flex items-start gap-2 type-body-s text-warning">
                <WarningIcon size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
                <span>
                  Naziv konverzije nije podešen — upišite ga u{" "}
                  <RouteLink href={ADMIN.settingsTab("pracenje")} className="underline">
                    Podešavanja → Praćenje
                  </RouteLink>
                  , tačno kao u Google Ads nalogu.
                </span>
              </p>
            ) : null}
            <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-md border border-line bg-line type-body-s">
              {[
                ["Sa gclid", offline.gclid.length],
                ["Sa gbraid/wbraid", offline.braid.length],
                ["Bez saglasnosti", offline.withoutConsent],
              ].map(([k, value]) => (
                <div key={String(k)} className="flex flex-col gap-1 bg-surface-1 p-3">
                  <dt className="type-caption text-ink-3">{k}</dt>
                  <dd className="text-[1.25rem] font-semibold tabular-nums text-ink-1">{value}</dd>
                </div>
              ))}
            </dl>
            <Button asChild className="self-start">
              <a href={csvHref} download data-testid="offline-conversions-download">
                <DownloadSimpleIcon size={18} aria-hidden="true" />
                Preuzmi CSV (gclid)
              </a>
            </Button>
            {offline.braid.length > 0 ? (
              <p className="type-caption text-ink-3">
                Porudžbine sa gbraid/wbraid (iOS aplikacije):{" "}
                {offline.braid.map((b) => b.orderNumber).join(", ")}. Google ih ne prima u starom
                CSV šablonu — uvezite ih kroz Google Ads Data Manager.
              </p>
            ) : null}
          </div>
        )}
      </Section>
    </div>
  );
}
