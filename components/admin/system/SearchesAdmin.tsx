"use client";

/**
 * `/admin/pretrage` — search analytics: searches and misses per day (chart + table), the
 * most searched queries and „Traženo, a nemamo“ with a direct path to add the product or
 * look it up, plus the latest misses with their source (header, quick order, 3D …).
 */
import { useQuery } from "convex/react";
import { useState } from "react";

import { api } from "@/convex/_generated/api";
import { compactDateTime } from "@/lib/admin/format";
import { SEARCH_SOURCE_LABEL, USER_TYPE_LABEL } from "@/lib/i18n/sr/admin";
import { Button } from "@/components/ui/Button";
import { RouteLink } from "@/components/ui/RouteLink";
import { Skeleton } from "@/components/ui/Skeleton";
import { ADMIN, ROUTES } from "@/constants/routes";

import { ColumnChart } from "../charts";
import { useNowMinute } from "../hooks";
import { PageHeader, Section, SegmentedFilter } from "../ui";

const shortDay = (day: string) => `${day.slice(8, 10)}.${day.slice(5, 7)}.`;

export function SearchesAdmin() {
  const nowMinute = useNowMinute();
  const [days, setDays] = useState<"7" | "30" | "90">("30");
  const data = useQuery(api.search.analytics, { days: Number(days), nowMs: nowMinute });
  const totals = data?.perDay.reduce(
    (acc, d) => ({ searches: acc.searches + d.searches, zero: acc.zero + d.zero }),
    { searches: 0, zero: 0 },
  );
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Pretrage"
        description="Šta kupci traže na sajtu i u brzoj porudžbini. Pretrage bez rezultata su spisak delova koje vredi nabaviti."
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
      {!data || !totals ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-px border-y border-line bg-line">
            {[
              ["Pretraga", String(totals.searches)],
              ["Bez rezultata", String(totals.zero)],
              [
                "Uspešnost",
                totals.searches
                  ? `${Math.round(((totals.searches - totals.zero) / totals.searches) * 100)} %`
                  : "—",
              ],
            ].map(([label, value]) => (
              <div key={label} className="flex flex-col gap-1 bg-bg px-5 py-4">
                <span className="type-caption text-ink-3">{label}</span>
                <span className="font-condensed text-[2.5rem] font-semibold leading-[0.95] tabular-nums">
                  {value}
                </span>
              </div>
            ))}
          </div>
          <Section title="Pretrage bez rezultata po danima">
            <ColumnChart
              label="Pretrage bez rezultata po danima"
              valueLabel={(v) => `${v} pretraga bez rezultata`}
              data={data.perDay.map((d, i) => ({
                key: d.day,
                label: shortDay(d.day),
                value: d.zero,
                highlight: i === data.perDay.length - 1,
                detail: [shortDay(d.day), `${d.zero} bez rezultata`, `${d.searches} ukupno`],
              }))}
              table={
                <table className="w-full border-collapse type-body-s">
                  <caption className="sr-only">Pretrage po danima</caption>
                  <thead>
                    <tr className="border-b border-line text-left type-label uppercase text-ink-3">
                      <th scope="col" className="py-1.5">
                        Dan
                      </th>
                      <th scope="col" className="py-1.5 text-right">
                        Ukupno
                      </th>
                      <th scope="col" className="py-1.5 text-right">
                        Bez rezultata
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...data.perDay].reverse().map((d) => (
                      <tr key={d.day} className="border-b border-line-faint">
                        <td className="py-1.5 tabular-nums">{shortDay(d.day)}</td>
                        <td className="py-1.5 text-right tabular-nums">{d.searches}</td>
                        <td className="py-1.5 text-right tabular-nums">{d.zero}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              }
            />
          </Section>
          <div className="grid gap-6 xl:grid-cols-2">
            <Section title="Traženo, a nemamo">
              {data.misses.length === 0 ? (
                <p className="type-body-s text-ink-2">
                  Nema pretraga bez rezultata u ovom periodu.
                </p>
              ) : (
                <table className="w-full border-collapse text-cell">
                  <caption className="sr-only">Najčešće pretrage bez rezultata</caption>
                  <thead>
                    <tr className="border-b border-line text-left type-label uppercase text-ink-3">
                      <th scope="col" className="py-1.5">
                        Upit
                      </th>
                      <th scope="col" className="py-1.5 text-right">
                        Puta
                      </th>
                      <th scope="col" className="py-1.5 text-right">
                        Poslednji put
                      </th>
                      <th scope="col" className="py-1.5">
                        <span className="sr-only">Radnje</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.misses.map((m) => (
                      <tr key={m.normalized} className="border-b border-line-faint">
                        <td className="max-w-[16rem] truncate py-1.5 type-code-s normal-case">
                          {m.sample}
                        </td>
                        <td className="py-1.5 text-right tabular-nums">{m.zeroCount}</td>
                        <td className="py-1.5 text-right tabular-nums text-ink-3">
                          {compactDateTime(m.lastAt, nowMinute)}
                        </td>
                        <td className="py-1.5 text-right">
                          <span className="inline-flex gap-1">
                            <Button asChild size="sm" variant="ghost">
                              <RouteLink
                                href={`${ADMIN.products}?q=${encodeURIComponent(m.sample)}`}
                              >
                                U katalogu
                              </RouteLink>
                            </Button>
                            <Button asChild size="sm" variant="ghost">
                              <RouteLink href={ADMIN.productNew}>Dodaj artikal</RouteLink>
                            </Button>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Section>
            <Section title="Najčešće pretrage">
              <table className="w-full border-collapse text-cell">
                <caption className="sr-only">Najčešće pretrage</caption>
                <thead>
                  <tr className="border-b border-line text-left type-label uppercase text-ink-3">
                    <th scope="col" className="py-1.5">
                      Upit
                    </th>
                    <th scope="col" className="py-1.5 text-right">
                      Puta
                    </th>
                    <th scope="col" className="py-1.5 text-right">
                      Bez rezultata
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.top.map((m) => (
                    <tr key={m.normalized} className="border-b border-line-faint">
                      <td className="max-w-[18rem] truncate py-1.5">
                        <a
                          href={ROUTES.searchFor(m.sample)}
                          target="_blank"
                          rel="noopener"
                          className="type-code-s normal-case hover:underline"
                        >
                          {m.sample}
                        </a>
                      </td>
                      <td className="py-1.5 text-right tabular-nums">{m.count}</td>
                      <td className="py-1.5 text-right tabular-nums text-ink-3">
                        {m.zeroCount || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          </div>
          <Section title="Poslednje pretrage bez rezultata">
            {data.recentMisses.length === 0 ? (
              <p className="type-body-s text-ink-2">Nema.</p>
            ) : (
              <ul className="-mx-4 divide-y divide-line-faint">
                {data.recentMisses.map((m, i) => (
                  <li key={i} className="flex items-center gap-3 px-4 py-1.5 type-body-s">
                    <span className="w-28 shrink-0 tabular-nums text-ink-3">
                      {compactDateTime(m.at, nowMinute)}
                    </span>
                    <span className="min-w-0 flex-1 truncate type-code-s normal-case">
                      {m.query}
                    </span>
                    <span className="type-caption text-ink-3">
                      {SEARCH_SOURCE_LABEL[m.source] ?? m.source} ·{" "}
                      {USER_TYPE_LABEL[m.userType] ?? m.userType}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </>
      )}
    </div>
  );
}
