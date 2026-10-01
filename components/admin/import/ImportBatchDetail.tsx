"use client";

/**
 * `/admin/uvoz/[id]` — the record of one import: file, who and when, counts, live progress,
 * rows by action (with errors, warnings and changed fields), per-product changes and their
 * rollback status, image failures, rollback and resume.
 */
import { usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState } from "react";
import { DownloadSimpleIcon } from "@phosphor-icons/react/dist/ssr";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { compactDateTime } from "@/lib/admin/format";
import { formatNumber } from "@/lib/format/number";
import {
  IMAGES,
  IMPORT_MODE_LABEL,
  ROW_ACTION,
  ROWS,
  countImport,
  type RowActionKey,
} from "@/lib/i18n/sr/import";
import { RouteLink } from "@/components/ui/RouteLink";
import { Tabs } from "@/components/ui/Tabs";
import { ADMIN } from "@/constants/routes";

import { useNowMinute } from "../hooks";
import { useAdminCrumb } from "../shell/context";
import {
  ActorLabel,
  DefinitionList,
  ErrorBanner,
  LoadMoreFooter,
  PageHeader,
  SegmentedFilter,
  Section,
} from "../ui";
import { CommitStep } from "./BatchSteps";
import { CountTiles, fieldLabel, IssueList, RowActionBadge, ImportStatusBadge } from "./parts";

type Row = FunctionReturnType<typeof api.imports.rows>["page"][number];

function RowsTab({ batchId, rolledBack }: { batchId: Id<"importBatches">; rolledBack: boolean }) {
  const [action, setAction] = useState<RowActionKey | "">("");
  const { results, status, loadMore } = usePaginatedQuery(
    api.imports.rows,
    { batchId, ...(action ? { action } : {}) },
    { initialNumItems: 100 },
  );
  return (
    <div className="mt-3 flex flex-col gap-3">
      <SegmentedFilter
        label="Vrsta reda"
        value={action}
        onChange={setAction}
        options={[
          { value: "", label: "Svi" },
          ...(Object.keys(ROW_ACTION) as RowActionKey[]).map((a) => ({
            value: a,
            label: ROW_ACTION[a].plural,
          })),
        ]}
      />
      <div className="overflow-x-auto rounded-sm border border-line bg-surface-1">
        <table className="w-full border-collapse type-body-s" data-testid="import-rows">
          <caption className="sr-only">Redovi uvoza</caption>
          <thead>
            <tr className="border-b border-line bg-surface-2 text-left type-label uppercase text-ink-3">
              <th scope="col" className="w-16 px-3 py-2">
                Red
              </th>
              <th scope="col" className="w-40 px-3 py-2">
                Šifra
              </th>
              <th scope="col" className="px-3 py-2">
                Naziv
              </th>
              <th scope="col" className="w-36 px-3 py-2">
                Status
              </th>
              <th scope="col" className="px-3 py-2">
                Izmene i napomene
              </th>
            </tr>
          </thead>
          <tbody>
            {results.map((r: Row) => (
              <tr key={r._id} className="border-b border-line-faint align-top">
                <td className="px-3 py-2 tabular-nums text-ink-2">{r.rowNumber}</td>
                <td className="px-3 py-2 type-code-s normal-case">
                  {r.productId ? (
                    <RouteLink
                      href={ADMIN.product(r.productId)}
                      className="text-ink-1 hover:underline"
                    >
                      {r.sku ?? "—"}
                    </RouteLink>
                  ) : (
                    (r.sku ?? "—")
                  )}
                </td>
                <td className="max-w-80 truncate px-3 py-2 text-ink-1">{r.data.name ?? "—"}</td>
                <td className="px-3 py-2">
                  <span className="flex flex-col items-start gap-1">
                    <RowActionBadge action={r.action} />
                    {r.committed &&
                    !r.commitError &&
                    (r.action === "create" || r.action === "update") ? (
                      rolledBack ? (
                        <span className="type-caption text-ink-3">upisano, pa poništeno</span>
                      ) : (
                        <span className="type-caption text-success">upisano</span>
                      )
                    ) : null}
                  </span>
                </td>
                <td className="px-3 py-2">
                  {r.changedFields.length > 0 ? (
                    <p className="type-caption text-ink-2">
                      {r.changedFields.map(fieldLabel).join(", ")}
                    </p>
                  ) : null}
                  <IssueList
                    errors={
                      r.commitError
                        ? [...r.errors, { message: `Upis nije uspeo: ${r.commitError}` }]
                        : r.errors
                    }
                    warnings={r.warnings}
                    max={3}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {status !== "LoadingFirstPage" && results.length === 0 ? (
          <p className="py-8 text-center type-body-s text-ink-2">Nema redova ove vrste.</p>
        ) : null}
      </div>
      <LoadMoreFooter
        shown={results.length}
        status={status}
        onMore={loadMore}
        forms={["red", "reda", "redova"]}
      />
    </div>
  );
}

const CHANGE_LABEL = {
  create: "Napravljen",
  update: "Izmenjen",
  deactivate: "Deaktiviran",
} as const;

function ChangesTab({ batchId }: { batchId: Id<"importBatches"> }) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.imports.changes,
    { batchId },
    { initialNumItems: 100 },
  );
  return (
    <div className="mt-3 flex flex-col gap-3">
      <div className="overflow-x-auto rounded-sm border border-line bg-surface-1">
        <table className="w-full border-collapse type-body-s">
          <caption className="sr-only">Izmene artikala iz ovog uvoza</caption>
          <thead>
            <tr className="border-b border-line bg-surface-2 text-left type-label uppercase text-ink-3">
              <th scope="col" className="px-3 py-2">
                Artikal
              </th>
              <th scope="col" className="w-32 px-3 py-2">
                Radnja
              </th>
              <th scope="col" className="px-3 py-2">
                Polja
              </th>
              <th scope="col" className="px-3 py-2">
                Poništavanje
              </th>
            </tr>
          </thead>
          <tbody>
            {results.map((c) => (
              <tr key={c._id} className="border-b border-line-faint align-top">
                <td className="px-3 py-2">
                  <RouteLink
                    href={ADMIN.product(c.productId)}
                    className="flex flex-col hover:underline"
                  >
                    <span className="text-ink-1">{c.name ?? "—"}</span>
                    <span className="type-code-s normal-case text-ink-3">{c.sku ?? ""}</span>
                  </RouteLink>
                </td>
                <td className="px-3 py-2 text-ink-1">{CHANGE_LABEL[c.action]}</td>
                <td className="px-3 py-2 type-caption text-ink-2">
                  {c.fields.map(fieldLabel).join(", ")}
                </td>
                <td className="px-3 py-2 type-caption">
                  {c.rolledBack ? (
                    c.rollbackSkippedReason ? (
                      <span className="text-warning">{c.rollbackSkippedReason}</span>
                    ) : (
                      <span className="text-success">vraćeno</span>
                    )
                  ) : (
                    <span className="text-ink-3">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {status !== "LoadingFirstPage" && results.length === 0 ? (
          <p className="py-8 text-center type-body-s text-ink-2">Ovaj uvoz nije menjao artikle.</p>
        ) : null}
      </div>
      <LoadMoreFooter
        shown={results.length}
        status={status}
        onMore={loadMore}
        forms={["izmena", "izmene", "izmena"]}
      />
    </div>
  );
}

function ImagesTab({ batchId }: { batchId: Id<"importBatches"> }) {
  const jobs = useQuery(api.imports.imageJobs, { batchId });
  if (!jobs) return <p className="mt-3 type-body-s text-ink-3">Učitavam…</p>;
  return (
    <div className="mt-3 flex flex-col gap-2">
      {jobs.pending > 0 ? (
        <p className="type-body-s text-ink-2">Na čekanju: {countImport(jobs.pending, IMAGES)}.</p>
      ) : null}
      {jobs.failed.length === 0 ? (
        <p className="type-body-s text-ink-2">Nema neuspelih slika.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line-faint rounded-sm border border-line bg-surface-1">
          {jobs.failed.map((j, i) => (
            <li key={i} className="flex flex-col gap-0.5 px-3 py-2 type-body-s">
              <span className="break-all type-code-s normal-case text-ink-1">{j.url}</span>
              <span className="type-caption text-danger">{j.error}</span>
              <RouteLink
                href={ADMIN.product(j.productId)}
                className="type-caption text-accent-text hover:underline"
              >
                Otvori artikal
              </RouteLink>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ImportBatchDetail({ batchId }: { batchId: Id<"importBatches"> }) {
  const batch = useQuery(api.imports.batch, { batchId });
  const sourceUrl = useQuery(api.imports.sourceFileUrl, { batchId });
  const now = useNowMinute();
  useAdminCrumb(batch?.fileName);

  if (batch === undefined) return <p className="type-body-s text-ink-3">Učitavam uvoz…</p>;
  if (batch === null) return <ErrorBanner>Uvoz ne postoji.</ErrorBanner>;
  const c = batch.counts;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={batch.fileName}
        meta={<ImportStatusBadge status={batch.status} />}
        description={`${IMPORT_MODE_LABEL[batch.mode]} · ${countImport(c.total, ROWS)} · ${compactDateTime(batch._creationTime, now)}`}
        actions={
          <>
            <a
              href={ADMIN.importReport(batch._id)}
              download
              className="inline-flex h-11 items-center gap-2 rounded-xs border border-control px-4 type-body-s text-ink-1 transition-control hover:bg-surface-2 focus-ring"
            >
              <DownloadSimpleIcon size={18} aria-hidden="true" />
              Izveštaj
            </a>
            {sourceUrl ? (
              <a
                href={sourceUrl}
                download={batch.fileName}
                className="inline-flex h-11 items-center gap-2 rounded-xs px-4 type-body-s text-ink-1 transition-control hover:bg-surface-2 focus-ring"
              >
                Originalni fajl
              </a>
            ) : null}
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-5">
          <CountTiles
            tiles={[
              { key: "create", label: "Novi", value: c.created ?? c.create, tone: "success" },
              { key: "update", label: "Izmene", value: c.updated ?? c.update },
              { key: "unchanged", label: "Bez promena", value: c.unchanged },
              { key: "skip", label: "Preskočeni", value: c.skip },
              { key: "error", label: "Greške", value: c.error + c.failed, tone: "danger" },
            ]}
          />
          {batch.status !== "validated" && batch.status !== "staging" ? (
            <CommitStep batch={batch} />
          ) : (
            <p className="type-body-s text-ink-2">
              Uvoz još nije upisan.{" "}
              <RouteLink
                href={`${ADMIN.imports}?uvoz=${batch._id}`}
                className="text-accent-text underline underline-offset-2"
              >
                Nastavite na probni rezultat
              </RouteLink>
              .
            </p>
          )}
        </div>
        <Section title="Podaci o uvozu">
          <DefinitionList
            rows={[
              { label: "Pokrenuo", value: batch.actor ? <ActorLabel actor={batch.actor} /> : "—" },
              { label: "Režim", value: IMPORT_MODE_LABEL[batch.mode] },
              {
                label: "Brojevi",
                value: batch.numberFormat === "sr" ? "srpski zapis" : "engleski zapis",
              },
              {
                label: "Kodna strana",
                value: batch.encoding ?? "—",
                hidden: batch.format !== "csv",
              },
              { label: "List", value: batch.sheetName ?? "—", hidden: batch.format === "csv" },
              {
                label: "Provereno",
                value: batch.validatedAt ? compactDateTime(batch.validatedAt, now) : "—",
              },
              {
                label: "Upisano",
                value: batch.committedAt ? compactDateTime(batch.committedAt, now) : "—",
              },
              {
                label: "Poništeno",
                value: batch.rolledBackAt ? compactDateTime(batch.rolledBackAt, now) : "—",
                hidden: !batch.rolledBackAt,
              },
              {
                label: "Deaktivirano",
                value: formatNumber(c.deactivated),
                hidden: !batch.deactivateMissing,
              },
              {
                label: "Kolone",
                value: `${batch.mapping.filter((m) => m.field !== "ignore").length} od ${batch.mapping.length}`,
              },
            ]}
          />
        </Section>
      </div>

      <Tabs
        label="Zapis uvoza"
        items={[
          {
            value: "redovi",
            label: `Redovi (${formatNumber(c.total)})`,
            content: <RowsTab batchId={batch._id} rolledBack={batch.status === "rolled_back"} />,
          },
          {
            value: "izmene",
            label: "Izmene artikala",
            content: <ChangesTab batchId={batch._id} />,
          },
          ...(batch.images && batch.images.total > 0
            ? [
                {
                  value: "slike",
                  label: `Slike (${formatNumber(batch.images.done)}/${formatNumber(batch.images.total)})`,
                  content: <ImagesTab batchId={batch._id} />,
                },
              ]
            : []),
        ]}
      />
    </div>
  );
}
