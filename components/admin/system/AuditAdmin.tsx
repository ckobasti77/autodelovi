"use client";

/**
 * `/admin/revizija` — every staff write (who, what, when, field-level diff), filterable by
 * person, entity type, action and date; opens the entity when it has a screen.
 */
import { usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState } from "react";
import { CaretDownIcon, CaretRightIcon } from "@phosphor-icons/react/dist/ssr";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { compactDateTime } from "@/lib/admin/format";
import { belgradeLocalToUtc } from "@/lib/domain/time";
import { ENTITY_TYPE_LABEL } from "@/lib/i18n/sr/admin";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { RouteLink } from "@/components/ui/RouteLink";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { ADMIN } from "@/constants/routes";

import { useNowMinute } from "../hooks";
import { ActorLabel, LoadMoreFooter, PageHeader } from "../ui";
import { useUrlFilters } from "../useUrlFilters";

type Row = FunctionReturnType<typeof api.audit.list>["page"][number];

function entityHref(r: Row): string | null {
  switch (r.entityType) {
    case "product":
      return r.entityId === "bulk" ? null : ADMIN.product(r.entityId);
    case "mechanic":
      return ADMIN.mechanic(r.entityId);
    case "user":
      return ADMIN.customer(r.entityId);
    case "settings":
      return ADMIN.settings;
    case "category":
      return ADMIN.categories;
    case "priceTier":
      return ADMIN.tiers;
    default:
      return null;
  }
}

const day = (d: string, end = false) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) return undefined;
  const start = belgradeLocalToUtc(Number(m[1]), Number(m[2]), Number(m[3]));
  return end ? start + 86_400_000 - 1 : start;
};

export function AuditAdmin() {
  const nowMinute = useNowMinute();
  const staff = useQuery(api.staff.listUsers, {});
  const [f, setF] = useUrlFilters(["ko", "vrsta", "radnja", "od", "do"] as const);
  const from = f.od ? day(f.od) : undefined;
  const to = f.do ? day(f.do, true) : undefined;
  const { results, status, loadMore } = usePaginatedQuery(
    api.audit.list,
    {
      ...(f.ko ? { actorUserId: f.ko as Id<"users"> } : {}),
      ...(f.vrsta ? { entityType: f.vrsta } : {}),
      ...(f.radnja ? { action: f.radnja.trim() } : {}),
      ...(from !== undefined ? { from } : {}),
      ...(to !== undefined ? { to } : {}),
    },
    { initialNumItems: 50 },
  );
  const [open, setOpen] = useState<Record<string, boolean>>({});

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Revizija"
        description="Svaka izmena koju je napravilo osoblje: ko, šta, kada i šta je bilo pre toga."
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Field label="Ko">
          <Select
            size="sm"
            placeholder="Svi"
            value={f.ko}
            onChange={(e) => setF({ ko: e.target.value })}
            options={(staff ?? []).map((u) => ({ value: u._id, label: u.name }))}
          />
        </Field>
        <Field label="Šta">
          <Select
            size="sm"
            placeholder="Sve"
            value={f.vrsta}
            onChange={(e) => setF({ vrsta: e.target.value })}
            options={Object.entries(ENTITY_TYPE_LABEL)
              .filter(([k]) => k !== "tier")
              .map(([value, label]) => ({ value, label }))}
          />
        </Field>
        <Field label="Radnja" help="npr. order.status, product.update">
          <Input
            value={f.radnja}
            onChange={(e) => setF({ radnja: e.target.value })}
            className="h-9"
            inputClassName="font-mono"
          />
        </Field>
        <Field label="Od">
          <Input
            type="date"
            value={f.od}
            onChange={(e) => setF({ od: e.target.value })}
            className="h-9"
          />
        </Field>
        <Field label="Do">
          <Input
            type="date"
            value={f.do}
            onChange={(e) => setF({ do: e.target.value })}
            className="h-9"
          />
        </Field>
      </div>
      <div className="rounded-sm border border-line bg-surface-1">
        {status === "LoadingFirstPage" ? (
          <Skeleton className="m-4 h-60" />
        ) : results.length === 0 ? (
          <p className="px-4 py-10 text-center type-body-s text-ink-2">
            Nema izmena za ovaj izbor.
          </p>
        ) : (
          <ol className="divide-y divide-line-faint">
            {results.map((r) => {
              const href = entityHref(r);
              const expanded = open[r._id];
              return (
                <li key={r._id} className="px-4 py-2.5">
                  <div className="grid grid-cols-[7.5rem_minmax(0,1fr)_auto] items-start gap-3 type-body-s">
                    <span className="whitespace-nowrap tabular-nums text-ink-3">
                      {compactDateTime(r.at, nowMinute)}
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="text-ink-1">
                        {href ? (
                          <RouteLink href={href} className="hover:underline">
                            {r.summary}
                          </RouteLink>
                        ) : (
                          r.summary
                        )}
                      </span>
                      <span className="type-caption text-ink-3">
                        <ActorLabel actor={r.actor} /> ·{" "}
                        {ENTITY_TYPE_LABEL[r.entityType] ?? r.entityType} ·{" "}
                        <span className="type-code-s normal-case">{r.action}</span>
                      </span>
                    </span>
                    {r.diff && r.diff.length > 0 ? (
                      <button
                        type="button"
                        aria-expanded={expanded ? "true" : "false"}
                        onClick={() => setOpen({ ...open, [r._id]: !expanded })}
                        className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-xs px-2 type-caption text-ink-2 hover:bg-surface-2 focus-ring-inset"
                      >
                        {expanded ? (
                          <CaretDownIcon size={12} aria-hidden="true" />
                        ) : (
                          <CaretRightIcon size={12} aria-hidden="true" />
                        )}
                        Izmene ({r.diff.length})
                      </button>
                    ) : null}
                  </div>
                  {expanded && r.diff ? (
                    <table className="mt-2 w-full border-collapse type-caption">
                      <caption className="sr-only">Izmenjena polja</caption>
                      <thead>
                        <tr className="text-left text-ink-3">
                          <th scope="col" className="w-48 py-1 pr-2 font-medium">
                            Polje
                          </th>
                          <th scope="col" className="py-1 pr-2 font-medium">
                            Pre
                          </th>
                          <th scope="col" className="py-1 font-medium">
                            Posle
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {r.diff.map((d, i) => (
                          <tr key={i} className="border-t border-line-faint align-top">
                            <td className="py-1 pr-2 type-code-s normal-case text-ink-2">
                              {d.field}
                            </td>
                            <td className="break-all py-1 pr-2 text-ink-3">{d.before ?? "—"}</td>
                            <td className="break-all py-1 text-ink-1">{d.after ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
      </div>
      <LoadMoreFooter shown={results.length} status={status} onMore={loadMore} noun="izmena" />
    </div>
  );
}
