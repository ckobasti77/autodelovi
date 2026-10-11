"use client";

/**
 * `/admin/mejlovi` — e-mail outbox: every message the system produced, the delivery mode it
 * went out in, its status (updated by the Resend webhook), filters by status and template,
 * the rendered message in a sandboxed frame with its plain-text twin, and „Pošalji ponovo“.
 */
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useMemo, useState } from "react";
import { ArrowCounterClockwiseIcon } from "@phosphor-icons/react/dist/ssr";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { compactDateTime } from "@/lib/admin/format";
import {
  TEMPLATE_GROUP_LABEL,
  TEMPLATE_INFO,
  TEMPLATE_KEYS,
  templateLabel,
} from "@/lib/email/catalog";
import { EMAIL_MODE_LABEL, EMAIL_STATUS_LABEL } from "@/lib/i18n/sr/admin";
import { convexErrorMessage } from "@/lib/i18n/sr/shop";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { Select } from "@/components/ui/Select";
import { Sheet } from "@/components/ui/Sheet";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tabs } from "@/components/ui/Tabs";
import { toast } from "@/components/ui/Toast";

import { useNowMinute } from "../hooks";
import { DemoTag, LoadMoreFooter, PageHeader } from "../ui";
import { useUrlFilters } from "../useUrlFilters";
import { emailPreviewHtml } from "@/lib/email/preview";
import { DeliveryBanner, EmailsNav } from "./EmailDelivery";

type Row = FunctionReturnType<typeof api.emailsAdmin.outbox>["page"][number];

const RELATED_LABEL: Readonly<Record<string, string>> = {
  order: "Porudžbina",
  inquiry: "Upit",
  mechanic: "Majstor",
  user: "Nalog",
  product: "Artikal",
  digest: "Pregled",
  test: "Proba",
  auth: "Prijava",
};

const TEMPLATE_OPTIONS = (
  Object.keys(TEMPLATE_GROUP_LABEL) as (keyof typeof TEMPLATE_GROUP_LABEL)[]
).flatMap((group) =>
  TEMPLATE_KEYS.filter((k) => TEMPLATE_INFO[k].group === group).map((k) => ({
    value: k,
    label: `${TEMPLATE_GROUP_LABEL[group]} · ${TEMPLATE_INFO[k].label}`,
  })),
);

export function EmailsAdmin() {
  const nowMinute = useNowMinute();
  const [filters, setFilters] = useUrlFilters(["status", "sablon"] as const);
  const [openId, setOpenId] = useState<string | null>(null);
  // Below 1280 px „Način“ hides and the subject is capped, so the list fits a 1024 px laptop.
  const roomy = useMediaQuery("(min-width: 1280px)");
  const args = {
    ...(filters.status ? { status: filters.status as Row["status"] } : {}),
    ...(filters.sablon ? { templateKey: filters.sablon } : {}),
  };
  const {
    results,
    status: loadStatus,
    loadMore,
  } = usePaginatedQuery(api.emailsAdmin.outbox, args, { initialNumItems: 50 });
  const columns = useMemo<ColumnDef<Row, unknown>[]>(
    () => [
      {
        accessorKey: "createdAt",
        header: "Vreme",
        cell: ({ row }) => (
          <span className="whitespace-nowrap tabular-nums text-ink-2">
            {compactDateTime(row.original.createdAt, nowMinute)}
          </span>
        ),
      },
      {
        id: "to",
        header: "Prima",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="block max-w-[16rem] truncate" title={row.original.to.join(", ")}>
            {row.original.to.join(", ")}
          </span>
        ),
      },
      {
        accessorKey: "subject",
        header: "Naslov",
        cell: ({ row }) => (
          <span className="flex max-w-[22rem] flex-col xl:max-w-[30rem]">
            <span className="truncate text-ink-1" title={row.original.subject}>
              {row.original.subject}
            </span>
            <span className="flex items-center gap-2 type-caption text-ink-3">
              {templateLabel(row.original.templateKey)}
              {row.original.relatedType
                ? ` · ${RELATED_LABEL[row.original.relatedType] ?? ""}`
                : ""}
              {row.original.isDemo ? <DemoTag /> : null}
            </span>
          </span>
        ),
      },
      {
        accessorKey: "mode",
        header: "Način",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-ink-2">
            {EMAIL_MODE_LABEL[row.original.mode]}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const s = EMAIL_STATUS_LABEL[row.original.status] ?? {
            label: row.original.status,
            tone: "neutral" as const,
          };
          return <Badge tone={s.tone}>{s.label}</Badge>;
        },
      },
    ],
    [nowMinute],
  );
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="E-pošta"
        description="Sve poruke koje sistem pravi za kupce, majstore i osoblje — sa statusom isporuke."
      />
      <EmailsNav />
      <DeliveryBanner />
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-52">
          <Select
            size="sm"
            aria-label="Status poruke"
            placeholder="Svi statusi"
            value={filters.status}
            onChange={(e) => setFilters({ status: e.target.value })}
            options={Object.entries(EMAIL_STATUS_LABEL).map(([value, s]) => ({
              value,
              label: s.label,
            }))}
          />
        </div>
        <div className="w-80 max-w-full">
          <Select
            size="sm"
            aria-label="Šablon"
            placeholder="Svi šabloni"
            value={filters.sablon}
            onChange={(e) => setFilters({ sablon: e.target.value })}
            options={TEMPLATE_OPTIONS}
          />
        </div>
        {filters.status || filters.sablon ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFilters({ status: null, sablon: null })}
          >
            Poništi filtere
          </Button>
        ) : null}
      </div>
      <DataTable
        caption="Poslate i zabeležene poruke"
        columns={columns}
        data={results}
        getRowId={(r) => r._id}
        columnVisibility={{ mode: roomy }}
        loading={loadStatus === "LoadingFirstPage"}
        onRowOpen={(r) => setOpenId(r._id)}
        empty={
          <p className="py-10 text-center type-body-s text-ink-2">
            {filters.status || filters.sablon ? "Nema poruka za ove filtere." : "Još nema poruka."}
          </p>
        }
      />
      <LoadMoreFooter
        shown={results.length}
        status={loadStatus}
        onMore={loadMore}
        forms={["poruka", "poruke", "poruka"]}
      />
      <Sheet
        open={openId !== null}
        onOpenChange={(v) => !v && setOpenId(null)}
        title="Poruka"
        side="right"
        size="md"
      >
        {openId ? (
          <EmailView id={openId as Id<"emailLog">} onResent={(id) => setOpenId(id)} />
        ) : null}
      </Sheet>
    </div>
  );
}

function EmailView({ id, onResent }: { id: Id<"emailLog">; onResent: (id: string) => void }) {
  const m = useQuery(api.emailsAdmin.get, { emailLogId: id });
  const resend = useMutation(api.emailsAdmin.resend);
  const [busy, setBusy] = useState(false);
  if (m === undefined) return <Skeleton className="h-96 w-full" />;
  if (m === null) return <p className="type-body-s text-ink-2">Poruka ne postoji.</p>;
  const status = EMAIL_STATUS_LABEL[m.status] ?? { label: m.status, tone: "neutral" as const };
  const onResend = async () => {
    setBusy(true);
    try {
      const res = await resend({ emailLogId: m._id });
      toast.success(
        res.mode === "log"
          ? "Poruka je ponovo zabeležena (režim „Samo zapis“)."
          : "Poruka je ponovo poslata.",
      );
      onResent(res.emailLogId);
    } catch (error) {
      toast.error(convexErrorMessage(error, "Poruka nije poslata."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-4" data-theme="paper">
      <dl className="grid grid-cols-[7rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 type-body-s">
        <dt className="text-ink-3">Prima</dt>
        <dd className="break-all">{m.to.join(", ")}</dd>
        {m.deliveredTo.join() !== m.to.join() ? (
          <>
            <dt className="text-ink-3">Isporučeno na</dt>
            <dd className="break-all">{m.deliveredTo.join(", ")} (probni režim)</dd>
          </>
        ) : null}
        <dt className="text-ink-3">Naslov</dt>
        <dd>{m.subject}</dd>
        {m.preheader ? (
          <>
            <dt className="text-ink-3">Pregled</dt>
            <dd className="text-ink-2">{m.preheader}</dd>
          </>
        ) : null}
        <dt className="text-ink-3">Šablon</dt>
        <dd>{templateLabel(m.templateKey)}</dd>
        <dt className="text-ink-3">Način · status</dt>
        <dd className="flex flex-wrap items-center gap-2">
          {EMAIL_MODE_LABEL[m.mode as keyof typeof EMAIL_MODE_LABEL] ?? m.mode}
          <Badge tone={status.tone}>{status.label}</Badge>
        </dd>
        {m.error ? (
          <>
            <dt className="text-ink-3">Greška</dt>
            <dd className="text-danger">{m.error}</dd>
          </>
        ) : null}
      </dl>
      {m.resendable ? (
        <div>
          <Button
            variant="secondary"
            size="sm"
            icon={<ArrowCounterClockwiseIcon size={16} aria-hidden="true" />}
            loading={busy}
            onClick={() => void onResend()}
          >
            Pošalji ponovo
          </Button>
        </div>
      ) : null}
      <Tabs
        label="Prikaz poruke"
        items={[
          ...(m.html
            ? [
                {
                  value: "html",
                  label: "Izgled",
                  content: (
                    <iframe
                      title={`Poruka: ${m.subject}`}
                      sandbox=""
                      srcDoc={emailPreviewHtml(m.html)}
                      className="mt-3 h-[60dvh] w-full rounded-sm border border-line bg-white"
                    />
                  ),
                },
              ]
            : []),
          {
            value: "text",
            label: "Običan tekst",
            content: (
              <pre className="mt-3 max-h-[60dvh] overflow-auto whitespace-pre-wrap rounded-sm border border-line bg-surface-2 p-3 type-code [overflow-wrap:anywhere]">
                {m.text}
              </pre>
            ),
          },
        ]}
      />
    </div>
  );
}
