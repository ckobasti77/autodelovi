"use client";

/**
 * `/admin/majstori` (step 14, minimal; step 15 folds it into the admin shell): registrations
 * by status with counts, table rows open the detail with the approve / reject decision.
 */
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { HourglassIcon, ProhibitIcon, SealCheckIcon, XCircleIcon } from "@phosphor-icons/react/dist/ssr";

import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/cn";
import { formatDateShort } from "@/lib/format/date";
import { formatPhone } from "@/lib/format/phone";
import { MECHANIC_STATUS_LABEL, MECHANIC_STATUS_TONE, type MechanicStatus } from "@/lib/i18n/sr/mechanic";
import { Badge } from "@/components/ui/Badge";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";
import { ROUTES } from "@/constants/routes";
import { TEST_IDS } from "@/constants/testIds";

type Row = FunctionReturnType<typeof api.mechanicsAdmin.list>[number];

export const MECHANIC_STATUS_ICON: Record<MechanicStatus, React.ReactNode> = {
  pending: <HourglassIcon size={14} />,
  approved: <SealCheckIcon size={14} />,
  rejected: <XCircleIcon size={14} />,
  suspended: <ProhibitIcon size={14} />,
};

const FILTERS: { value: MechanicStatus | "all"; label: string }[] = [
  { value: "pending", label: "Na čekanju" },
  { value: "approved", label: "Odobreni" },
  { value: "suspended", label: "Pauzirani" },
  { value: "rejected", label: "Odbijeni" },
  { value: "all", label: "Svi" },
];

export function MechanicsAdminList() {
  const router = useRouter();
  const [filter, setFilter] = useState<MechanicStatus | "all">("pending");
  const rows = useQuery(api.mechanicsAdmin.list, filter === "all" ? {} : { status: filter });
  const counts = useQuery(api.mechanicsAdmin.counts, {});
  const tiers = useQuery(api.pricing.listTiers, {});
  const tierName = useMemo(() => new Map((tiers ?? []).map((t) => [t._id, t.name])), [tiers]);

  const columns = useMemo<ColumnDef<Row, unknown>[]>(
    () => [
      {
        accessorKey: "companyName",
        header: "Servis",
        cell: ({ row }) => (
          <span className="flex flex-col" data-testid={TEST_IDS.adminMechanicRow}>
            <span className="font-semibold text-ink-1">{row.original.companyName}</span>
            <span className="type-caption text-ink-3">{row.original.city}</span>
          </span>
        ),
      },
      {
        accessorKey: "pib",
        header: "PIB",
        cell: ({ getValue }) => <span className="type-code">{String(getValue())}</span>,
      },
      {
        accessorKey: "contactPerson",
        header: "Kontakt",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="flex flex-col">
            <span>{row.original.contactPerson}</span>
            <span className="type-caption tabular-nums text-ink-3">{formatPhone(row.original.phone)}</span>
          </span>
        ),
      },
      {
        accessorKey: "createdAt",
        header: "Registrovan",
        cell: ({ getValue }) => <span className="tabular-nums text-ink-2">{formatDateShort(Number(getValue()))}</span>,
      },
      {
        id: "tier",
        header: "Nivo",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-ink-2">
            {row.original.tierId ? (tierName.get(row.original.tierId) ?? "—") : "—"}
            {row.original.creditEnabled ? " · odloženo" : ""}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        enableSorting: false,
        cell: ({ row }) => (
          <Badge tone={MECHANIC_STATUS_TONE[row.original.status]} icon={MECHANIC_STATUS_ICON[row.original.status]}>
            {MECHANIC_STATUS_LABEL[row.original.status]}
          </Badge>
        ),
      },
    ],
    [tierName],
  );

  return (
    <div className="flex flex-col gap-5">
      <div role="group" aria-label="Status registracije" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const count =
            f.value === "all"
              ? counts
                ? counts.pending + counts.approved + counts.rejected + counts.suspended
                : undefined
              : counts?.[f.value];
          return (
            <button
              key={f.value}
              type="button"
              aria-pressed={filter === f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "inline-flex h-9 cursor-pointer items-center gap-2 rounded-xs border px-3 type-body-s transition-control",
                filter === f.value
                  ? "border-ink-1 bg-surface-3 text-ink-1"
                  : "border-line-strong bg-surface-1 text-ink-2 hover:text-ink-1",
              )}
            >
              {f.label}
              {count !== undefined ? <span className="tabular-nums text-ink-3">{count}</span> : null}
            </button>
          );
        })}
      </div>
      <DataTable
        caption="Registracije servisa"
        columns={columns}
        data={rows ?? []}
        loading={rows === undefined}
        getRowId={(r) => r._id}
        rowLabel={(r) => r.companyName}
        onRowOpen={(r) => router.push(ROUTES.adminMechanic(r._id))}
        empty={<p className="py-10 text-center type-body-s text-ink-2">Nema registracija sa ovim statusom.</p>}
      />
    </div>
  );
}
