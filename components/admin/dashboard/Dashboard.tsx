"use client";

/**
 * `/admin` (DESIGN-SYSTEM §10.10): KPI row as links separated by rules (no cards), orders
 * per day (30 d, today in accent), „Traženo, a nemamo“ with a 7-day trend; the SLA queue of
 * unanswered inquiries and new orders with live timers, recent activity, orders by system.
 */
import { useQuery } from "convex/react";
import type { ReactNode } from "react";
import {
  ArrowDownIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  MinusIcon,
} from "@phosphor-icons/react/dist/ssr";

import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/cn";
import { compactDateTime, formatAgo, formatElapsed } from "@/lib/admin/format";
import { workingMinutesBetween } from "@/lib/domain/sla";
import { belgradeDay } from "@/lib/domain/time";
import { formatDate } from "@/lib/format/date";
import { formatRSD } from "@/lib/format/money";
import { INQUIRY_KIND_LABEL } from "@/lib/i18n/sr/admin";
import { RouteLink } from "@/components/ui/RouteLink";
import { Skeleton } from "@/components/ui/Skeleton";
import { ADMIN } from "@/constants/routes";

import { BarList, ColumnChart } from "../charts";
import { useNowMinute } from "../hooks";
import { ActorLabel, Chip, CompanySetupNotice, DocNumber, PageHeader, Section } from "../ui";
import { WAIT_HINT, WAIT_LEVELS, WaitMark, waitLevel } from "../waiting";

/**
 * One KPI cell: a link to the list filtered to exactly what the figure counts. The figure stays
 * neutral ink — a state (late, low) is said in the line under it, with an icon and a word.
 */
function Kpi({
  href,
  label,
  value,
  sub,
}: {
  href: string;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <RouteLink
      href={href}
      className="group relative flex min-w-0 flex-col gap-1 bg-surface-1 px-4 py-3.5 transition-control hover:bg-surface-2 focus-ring-inset sm:px-5 sm:py-4"
    >
      <span className="flex items-center justify-between gap-2 type-caption text-ink-3 group-hover:text-ink-2">
        {label}
        <ArrowRightIcon
          size={14}
          aria-hidden="true"
          className="shrink-0 text-ink-4 transition-control group-hover:text-accent-text group-focus-visible:text-accent-text"
        />
      </span>
      <span className="font-condensed text-[2.25rem] font-semibold leading-[0.95] tabular-nums tracking-[0.005em] text-ink-1 sm:text-[2.5rem]">
        {value}
      </span>
      {sub ? <span className="type-caption text-ink-2">{sub}</span> : null}
    </RouteLink>
  );
}

function Trend({ now, before }: { now: number; before: number }) {
  // Nothing to compare against: „više nego (0)“ says nothing (VIS-40).
  if (before === 0 && now > 0) return <span className="text-ink-3">prethodnih 7 dana: 0</span>;
  if (now === before)
    return (
      <span className="inline-flex items-start gap-1 text-ink-3">
        <MinusIcon size={12} weight="bold" aria-hidden="true" className="mt-[0.2em] shrink-0" />
        <span>isto kao prošle nedelje</span>
      </span>
    );
  const up = now > before;
  const Icon = up ? ArrowUpIcon : ArrowDownIcon;
  return (
    <span className="inline-flex items-start gap-1 text-ink-2">
      <Icon size={12} weight="bold" aria-hidden="true" className="mt-[0.2em] shrink-0" />
      <span>
        {up ? "više" : "manje"} nego prethodnih 7 dana ({before})
      </span>
    </span>
  );
}

const shortDay = (day: string) => `${day.slice(8, 10)}.${day.slice(5, 7)}.`;

export function Dashboard() {
  const nowMinute = useNowMinute();
  const kpis = useQuery(api.dashboard.kpis, { nowMinute });
  const perDay = useQuery(api.dashboard.ordersPerDay, { nowMinute, days: 30 });
  const byCategory = useQuery(api.dashboard.byCategory, { nowMinute, days: 30 });
  const missing = useQuery(api.dashboard.searchedNotFound, { nowMinute, days: 7, limit: 10 });
  const queue = useQuery(api.dashboard.slaQueue, {});
  const activity = useQuery(api.dashboard.recentActivity, {});

  const elapsed = (from: number) =>
    kpis ? workingMinutesBetween(from, nowMinute, kpis.hours, kpis.holidays) : 0;
  const oldest = kpis?.oldestInquiryAt ? elapsed(kpis.oldestInquiryAt) : null;
  const oldestLevel = oldest !== null && kpis ? waitLevel(oldest, kpis.slaTargetMinutes) : "ok";

  // Every KPI opens the list filtered to what its figure counts (the order list reads `od` / `do`
  // as Belgrade days and `status=sve` as every status).
  const today = belgradeDay(nowMinute);
  const ordersToday = `${ADMIN.orders}?status=sve&od=${today}&do=${today}`;
  const ordersWeek = `${ADMIN.orders}?status=sve&od=${belgradeDay(nowMinute - 6 * 86_400_000)}&do=${today}`;

  // The queue: oldest first, each row graded against the response target.
  const queueRows =
    queue && kpis
      ? [
          ...queue.inquiries.map((i) => ({
            key: `i:${i.number}`,
            href: ADMIN.inquiry(i.number),
            number: i.number,
            kind: "Upit",
            who: i.contactName,
            what: `${INQUIRY_KIND_LABEL[i.kind]} · ${i.summary}`,
            priority: i.isMechanic,
            at: i.createdAt,
          })),
          ...queue.orders.map((o) => ({
            key: `o:${o.number}`,
            href: ADMIN.order(o.number),
            number: o.number,
            kind: "Porudžbina",
            who: o.customerName,
            what: formatRSD(o.totalPara),
            priority: false,
            at: o.createdAt,
          })),
        ]
          .sort((a, b) => a.at - b.at)
          .slice(0, 10)
          .map((row) => {
            const minutes = elapsed(row.at);
            return { ...row, minutes, level: waitLevel(minutes, kpis.slaTargetMinutes) };
          })
      : [];
  const queueLevels = WAIT_LEVELS.map((level) => ({
    level,
    count: queueRows.filter((r) => r.level === level).length,
  })).filter((l) => l.count > 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Pregled"
        description={`Danas ${formatDate(nowMinute)} — stanje u realnom vremenu.`}
      />

      {kpis ? <CompanySetupNotice missing={kpis.missingCompany} /> : null}

      <div
        className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line md:grid-cols-3 xl:grid-cols-6"
        data-reveal="block"
      >
        {kpis ? (
          <>
            <Kpi
              href={ordersToday}
              label="Porudžbine danas"
              value={kpis.today.orders}
              sub={`${kpis.newOrders} čeka potvrdu`}
            />
            <Kpi
              href={ordersToday}
              label="Vrednost danas"
              value={formatRSD(kpis.today.valuePara, { unit: false })}
              sub="RSD sa PDV-om"
            />
            <Kpi
              href={ordersWeek}
              label="Poslednjih 7 dana"
              value={kpis.week.orders}
              sub={<Trend now={kpis.week.orders} before={kpis.previousWeek.orders} />}
            />
            <Kpi
              href={`${ADMIN.inquiries}?status=nov`}
              label="Upiti bez odgovora"
              value={kpis.openInquiries}
              sub={
                oldest !== null ? (
                  <span className="flex flex-col gap-0.5">
                    {oldestLevel !== "ok" ? <WaitMark level={oldestLevel} /> : null}
                    <span>najstariji čeka {formatElapsed(oldest)} radnog vremena</span>
                  </span>
                ) : (
                  "svi upiti imaju odgovor"
                )
              }
            />
            <Kpi
              href={ADMIN.mechanics}
              label="Majstori na čekanju"
              value={kpis.pendingMechanics}
              sub="registracije za odobrenje"
            />
            <Kpi
              href={ADMIN.stock}
              label="Bez zaliha"
              value={kpis.outOfStock}
              sub={
                kpis.lowStock > 0
                  ? `još ${kpis.lowStock} sa malo zaliha`
                  : "nijedan artikal sa malo zaliha"
              }
            />
          </>
        ) : (
          Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex flex-col gap-2 bg-surface-1 px-4 py-3.5 sm:px-5 sm:py-4">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-9 w-16" />
              <Skeleton className="h-3 w-28" />
            </div>
          ))
        )}
      </div>

      {/* grid-cols-1 = minmax(0, 1fr): the implicit auto track would grow to the min-content
          of the nowrap queue rows and push the SLA column off a phone screen (VIS-14). */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Section
          title="Red čekanja"
          actions={
            kpis ? (
              <span className="type-caption text-ink-3">
                cilj: odgovor za {formatElapsed(kpis.slaTargetMinutes)}
              </span>
            ) : null
          }
        >
          {queue === undefined || kpis === undefined ? (
            <Skeleton className="h-48 w-full" />
          ) : queue.inquiries.length === 0 && queue.orders.length === 0 ? (
            <p className="py-6 type-body-s text-ink-2">
              Ništa ne čeka. Svi upiti imaju odgovor, sve porudžbine su potvrđene.
            </p>
          ) : (
            <>
              {/* Summary and legend in one line: what the marks in the rows mean, and how many. */}
              <p className="flex flex-wrap items-center gap-x-4 gap-y-1 pb-2" data-reveal="off">
                {queueLevels.map((l) => (
                  <WaitMark
                    key={l.level}
                    level={l.level}
                    count={l.count}
                    title={WAIT_HINT[l.level]}
                  />
                ))}
              </p>
              <ul className="flex flex-col divide-y divide-line-faint">
                {queueRows.map((row) => {
                  // Zero working minutes after more than a minute of wall time: it arrived
                  // outside working hours and the SLA clock has not started yet.
                  const started = row.minutes >= 1;
                  const waiting = started
                    ? formatElapsed(row.minutes)
                    : nowMinute - row.at < 120_000
                      ? "upravo"
                      : "van radnog vremena";
                  const received = compactDateTime(row.at, nowMinute);
                  return (
                    <li key={row.key}>
                      <RouteLink
                        href={row.href}
                        className="-mx-2 flex min-h-13 items-center gap-3 rounded-sm px-2 py-2 transition-control hover:bg-surface-2 focus-ring-inset"
                      >
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="flex items-center gap-2">
                            <DocNumber number={row.number} />
                            <span className="type-caption text-ink-3">{row.kind}</span>
                            {row.priority ? (
                              <Chip tone="info" dense>
                                Majstor
                              </Chip>
                            ) : null}
                          </span>
                          <span
                            className="truncate type-caption text-ink-2"
                            title={`${row.who} · ${row.what}`}
                          >
                            {row.who} · {row.what}
                          </span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end">
                          <span
                            className={cn(
                              "whitespace-nowrap type-body-s tabular-nums",
                              started ? "text-ink-1" : "text-ink-3",
                              row.level === "critical" && "font-semibold",
                            )}
                            title={`Primljeno ${received}`}
                          >
                            {waiting}
                          </span>
                          {started ? (
                            <WaitMark level={row.level} />
                          ) : (
                            <span className="whitespace-nowrap type-caption tabular-nums text-ink-3">
                              primljeno {received}
                            </span>
                          )}
                        </span>
                      </RouteLink>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </Section>

        <Section
          title="Aktivnost"
          actions={
            <RouteLink
              href={ADMIN.audit}
              className="type-caption text-accent-text underline-offset-2 hover:underline"
            >
              Cela revizija
            </RouteLink>
          }
        >
          {activity === undefined ? (
            <Skeleton className="h-48 w-full" />
          ) : activity.length === 0 ? (
            <p className="py-6 type-body-s text-ink-2">Još nema zabeleženih izmena.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line-faint">
              {activity.slice(0, 10).map((a) => (
                <li key={a._id} className="flex items-start gap-3 py-2 type-body-s">
                  <span className="w-20 shrink-0 whitespace-nowrap type-caption tabular-nums text-ink-3">
                    {formatAgo(a.at, nowMinute)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-ink-1">{a.summary}</span>
                    <span className="type-caption">
                      <ActorLabel actor={a.actor} />
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Section
          title="Porudžbine po danima"
          actions={<span className="type-caption text-ink-3">poslednjih 30 dana</span>}
        >
          {perDay ? (
            <ColumnChart
              label="Porudžbine po danima"
              valueLabel={(v) => `${v} porudžbina`}
              data={perDay.map((d, i) => ({
                key: d.day,
                label: shortDay(d.day),
                value: d.orders,
                highlight: i === perDay.length - 1,
                detail: [
                  i === perDay.length - 1 ? `Danas, ${shortDay(d.day)}` : shortDay(d.day),
                  `${d.orders} porudžbina`,
                  formatRSD(d.valuePara),
                ],
              }))}
              table={
                <table className="w-full border-collapse type-body-s">
                  <caption className="sr-only">Porudžbine po danima, poslednjih 30 dana</caption>
                  <thead>
                    <tr className="border-b border-line text-left type-label uppercase text-ink-3">
                      <th scope="col" className="py-1.5 pr-3">
                        Dan
                      </th>
                      <th scope="col" className="py-1.5 pr-3 text-right">
                        Porudžbine
                      </th>
                      <th scope="col" className="py-1.5 text-right">
                        Vrednost
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...perDay].reverse().map((d) => (
                      <tr key={d.day} className="border-b border-line-faint">
                        <td className="py-1.5 pr-3 tabular-nums">{shortDay(d.day)}</td>
                        <td className="py-1.5 pr-3 text-right tabular-nums">{d.orders}</td>
                        <td className="py-1.5 text-right tabular-nums">{formatRSD(d.valuePara)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              }
            />
          ) : (
            <Skeleton className="h-[220px] w-full" />
          )}
        </Section>

        <Section
          title="Traženo, a nemamo"
          actions={
            <RouteLink
              href={ADMIN.searches}
              className="type-caption text-accent-text underline-offset-2 hover:underline"
            >
              Sve pretrage
            </RouteLink>
          }
        >
          {missing === undefined ? (
            <Skeleton className="h-48 w-full" />
          ) : missing.length === 0 ? (
            <p className="py-6 type-body-s text-ink-2">
              Nema neuspešnih pretraga u poslednjih 7 dana.
            </p>
          ) : (
            <ol className="flex flex-col divide-y divide-line-faint">
              {missing.map((m) => {
                const delta = m.zeroCount - m.previousZeroCount;
                return (
                  <li key={m.normalized} className="flex items-center gap-3 py-2 type-body-s">
                    <span className="min-w-0 flex-1 truncate type-code text-ink-1" title={m.sample}>
                      {m.sample}
                    </span>
                    <span className="tabular-nums text-ink-1">{m.zeroCount}×</span>
                    <span
                      className={cn(
                        "w-16 text-right type-caption tabular-nums",
                        delta > 0 ? "text-warning" : "text-ink-3",
                      )}
                      title="Promena u odnosu na prethodnih 7 dana"
                    >
                      {m.previousZeroCount === 0
                        ? "novo"
                        : delta === 0
                          ? "isto"
                          : `${delta > 0 ? "+" : "−"}${Math.abs(delta)}`}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </Section>
      </div>

      <Section
        title="Porudžbine po sistemima"
        actions={<span className="type-caption text-ink-3">komada, poslednjih 30 dana</span>}
      >
        {byCategory === undefined ? (
          <Skeleton className="h-40 w-full" />
        ) : byCategory.length === 0 ? (
          <p className="py-6 type-body-s text-ink-2">Još nema porudžbina u poslednjih 30 dana.</p>
        ) : (
          <BarList
            label="Porudžbine po sistemima"
            data={byCategory.map((c) => ({
              key: c.key,
              label: c.name,
              value: c.lines,
              valueText: `${c.lines} kom.`,
              meta: formatRSD(c.valuePara),
            }))}
          />
        )}
      </Section>
    </div>
  );
}
