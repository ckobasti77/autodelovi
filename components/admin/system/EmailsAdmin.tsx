"use client";

/**
 * `/admin/mejlovi` — e-mail outbox: every message the system produced (log mode until a
 * provider key and a verified domain exist), status, recipient, the rendered message in a
 * sandboxed frame and its plain-text version. Template previews and test sends: step 18.
 */
import { usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useMemo, useState } from "react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { compactDateTime } from "@/lib/admin/format";
import { EMAIL_MODE_LABEL, EMAIL_STATUS_LABEL } from "@/lib/i18n/sr/admin";
import { Badge } from "@/components/ui/Badge";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";
import { Select } from "@/components/ui/Select";
import { Sheet } from "@/components/ui/Sheet";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tabs } from "@/components/ui/Tabs";

import { useNowMinute } from "../hooks";
import { LoadMoreFooter, PageHeader } from "../ui";

type Row = FunctionReturnType<typeof api.emailsAdmin.outbox>["page"][number];

export function EmailsAdmin() {
  const nowMinute = useNowMinute();
  const [status, setStatus] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const {
    results,
    status: loadStatus,
    loadMore,
  } = usePaginatedQuery(api.emailsAdmin.outbox, status ? { status: status as Row["status"] } : {}, {
    initialNumItems: 50,
  });
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
          <span className="max-w-[16rem] truncate">{row.original.to.join(", ")}</span>
        ),
      },
      {
        accessorKey: "subject",
        header: "Naslov",
        cell: ({ row }) => (
          <span className="flex max-w-[28rem] flex-col">
            <span className="truncate text-ink-1">{row.original.subject}</span>
            <span className="type-code-s normal-case text-ink-3">{row.original.templateKey}</span>
          </span>
        ),
      },
      {
        accessorKey: "mode",
        header: "Način",
        cell: ({ row }) => (
          <span className="text-ink-2">{EMAIL_MODE_LABEL[row.original.mode]}</span>
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
        description="Sve poruke koje sistem šalje kupcima i osoblju. Dok slanje nije podešeno (ključ i domen — vidi listu za vlasnika), poruke se samo beleže ovde."
      />
      <div className="w-52">
        <Select
          size="sm"
          aria-label="Status poruke"
          placeholder="Svi statusi"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          options={Object.entries(EMAIL_STATUS_LABEL).map(([value, s]) => ({
            value,
            label: s.label,
          }))}
        />
      </div>
      <DataTable
        caption="Poslate i zabeležene poruke"
        columns={columns}
        data={results}
        getRowId={(r) => r._id}
        loading={loadStatus === "LoadingFirstPage"}
        onRowOpen={(r) => setOpenId(r._id)}
        empty={<p className="py-10 text-center type-body-s text-ink-2">Još nema poruka.</p>}
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
        {openId ? <EmailView id={openId as Id<"emailLog">} /> : null}
      </Sheet>
    </div>
  );
}

function EmailView({ id }: { id: Id<"emailLog"> }) {
  const m = useQuery(api.emailsAdmin.get, { emailLogId: id });
  if (m === undefined) return <Skeleton className="h-96 w-full" />;
  if (m === null) return <p className="type-body-s text-ink-2">Poruka ne postoji.</p>;
  return (
    <div className="flex flex-col gap-4" data-theme="paper">
      <dl className="grid grid-cols-[6rem_minmax(0,1fr)] gap-x-3 gap-y-1 type-body-s">
        <dt className="text-ink-3">Prima</dt>
        <dd className="break-all">{m.to.join(", ")}</dd>
        <dt className="text-ink-3">Naslov</dt>
        <dd>{m.subject}</dd>
        <dt className="text-ink-3">Šablon</dt>
        <dd className="type-code-s normal-case">{m.templateKey}</dd>
        {m.error ? (
          <>
            <dt className="text-ink-3">Greška</dt>
            <dd className="text-danger">{m.error}</dd>
          </>
        ) : null}
      </dl>
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
                      srcDoc={m.html}
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
              <pre className="mt-3 max-h-[60dvh] overflow-auto whitespace-pre-wrap rounded-sm border border-line bg-surface-2 p-3 type-code-s">
                {m.text}
              </pre>
            ),
          },
        ]}
      />
    </div>
  );
}
