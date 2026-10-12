"use client";

/**
 * Steps 4–5, driven by the Convex batch: the dry-run diff (counts, sample rows per action
 * with before → after, deactivate-missing behind a typed phrase) and the commit (live
 * progress, result, images, rollback). Staff may leave the page; the work continues.
 */
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState } from "react";
import { ArrowRightIcon, DownloadSimpleIcon } from "@phosphor-icons/react/dist/ssr";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatNumber } from "@/lib/format/number";
import {
  COMMIT_PHASE_LABEL,
  ROW_ACTION,
  productsNotRestored,
  productsToDeactivate,
  productsWritten,
  rowsWithWarning,
  type RowActionKey,
} from "@/lib/i18n/sr/import";
import { convexErrorMessage } from "@/lib/i18n/sr/shop";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { RouteLink } from "@/components/ui/RouteLink";
import { Switch } from "@/components/ui/Switch";
import { Tabs } from "@/components/ui/Tabs";
import { ADMIN } from "@/constants/routes";

import { ConfirmDialog, useConfirm } from "../ConfirmDialog";
import { useNowMinute } from "../hooks";
import { ErrorBanner, Section } from "../ui";
import { CountTiles, fieldLabel, IssueList, ProgressBar } from "./parts";

type Batch = NonNullable<FunctionReturnType<typeof api.imports.batch>>;

const PHRASE = "DEAKTIVIRAJ";

function SampleTable({
  action,
  rows,
}: {
  action: RowActionKey;
  rows: FunctionReturnType<typeof api.imports.samples>[number]["rows"];
}) {
  if (rows.length === 0)
    return <p className="py-4 type-body-s text-ink-2">Nema redova ove vrste.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse type-body-s">
        <caption className="sr-only">Primeri: {ROW_ACTION[action].plural}</caption>
        <thead>
          <tr className="border-b border-line text-left type-label uppercase text-ink-3">
            <th scope="col" className="w-16 py-2 pr-3">
              Red
            </th>
            <th scope="col" className="w-36 py-2 pr-3">
              Šifra
            </th>
            <th scope="col" className="py-2 pr-3">
              Naziv
            </th>
            <th scope="col" className="py-2">
              {action === "update"
                ? "Šta se menja"
                : action === "create"
                  ? "Kategorija · cena · stanje"
                  : "Napomene"}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.rowNumber} className="border-b border-line-faint align-top">
              <td className="py-2 pr-3 tabular-nums text-ink-2">{r.rowNumber}</td>
              <td className="py-2 pr-3 type-code-s normal-case text-ink-1">{r.sku ?? "—"}</td>
              <td className="py-2 pr-3 text-ink-1">{r.name ?? "—"}</td>
              <td className="py-2">
                {action === "update" ? (
                  <ul className="flex flex-col gap-0.5 type-caption">
                    {r.changes.map((c) => (
                      <li key={c.field} className="flex flex-wrap items-center gap-1">
                        <span className="font-semibold text-ink-1">{fieldLabel(c.field)}:</span>
                        <span className="text-ink-3 line-through">{c.before ?? "prazno"}</span>
                        <ArrowRightIcon size={12} aria-hidden="true" className="text-ink-3" />
                        <span className="sr-only">postaje</span>
                        <span className="text-ink-1">{c.after ?? "prazno"}</span>
                      </li>
                    ))}
                  </ul>
                ) : action === "create" ? (
                  <span className="flex flex-col gap-1">
                    <span className="text-ink-2">{r.details}</span>
                    {r.issues.length > 0 ? (
                      <IssueList errors={[]} warnings={r.issues} max={2} />
                    ) : null}
                  </span>
                ) : r.issues.length > 0 ? (
                  <IssueList
                    errors={action === "error" ? r.issues : []}
                    warnings={action === "error" ? [] : r.issues}
                    max={3}
                  />
                ) : (
                  <span className="text-ink-4">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DiffStep({ batch, onNew }: { batch: Batch; onNew: () => void }) {
  const samples = useQuery(api.imports.samples, { batchId: batch._id });
  const commit = useMutation(api.imports.commit);
  const cancel = useMutation(api.imports.cancel);
  const confirm = useConfirm();
  const [deactivate, setDeactivate] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const c = batch.counts;
  const writes = c.create + c.update;
  const phraseOk = !deactivate || phrase.trim().toUpperCase() === PHRASE;

  if (batch.status === "staging") {
    return (
      <div className="flex flex-col gap-4">
        <ErrorBanner>
          Slanje redova na proveru je prekinuto ({formatNumber(batch.progress.stagedRows)} od{" "}
          {formatNumber(batch.counts.total)}). Otkažite ovaj uvoz i pokrenite ga ponovo sa istim
          fajlom.
        </ErrorBanner>
        <div>
          <Button
            variant="secondary"
            onClick={() => void cancel({ batchId: batch._id }).then(onNew)}
          >
            Otkaži i počni ponovo
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <CountTiles
        tiles={[
          { key: "create", label: "Novi artikli", value: c.create, tone: "success" },
          { key: "update", label: "Izmene", value: c.update },
          { key: "unchanged", label: "Bez promena", value: c.unchanged },
          { key: "skip", label: "Preskočeni", value: c.skip },
          {
            key: "error",
            label: "Greške",
            value: c.error,
            tone: "danger",
            hint: c.warning > 0 ? rowsWithWarning(c.warning) : undefined,
          },
        ]}
      />

      <Section
        title="Probni rezultat"
        actions={
          <div className="flex items-center gap-2">
            <a
              href={ADMIN.importReport(batch._id)}
              download
              className="inline-flex h-9 items-center gap-1.5 rounded-sm px-3 type-body-s text-ink-1 transition-control hover:bg-surface-2 focus-ring"
            >
              <DownloadSimpleIcon size={16} aria-hidden="true" />
              Izveštaj
            </a>
            <RouteLink
              href={ADMIN.importBatch(batch._id)}
              className="inline-flex h-9 items-center rounded-sm px-3 type-body-s text-accent-text underline-offset-2 hover:underline"
            >
              Svi redovi
            </RouteLink>
          </div>
        }
      >
        {samples === undefined ? (
          <p className="py-6 type-body-s text-ink-3">Učitavam primere…</p>
        ) : (
          <Tabs
            label="Primeri po vrsti reda"
            items={(["create", "update", "error", "skip"] as const).map((action) => ({
              value: action,
              label: `${ROW_ACTION[action].plural} (${formatNumber(c[action])})`,
              content: (
                <div className="mt-3">
                  <SampleTable
                    action={action}
                    rows={samples.find((s) => s.action === action)?.rows ?? []}
                  />
                  {c[action] > 5 ? (
                    <p className="mt-2 type-caption text-ink-3">
                      Prvih 5 od {formatNumber(c[action])}.
                    </p>
                  ) : null}
                </div>
              ),
            }))}
          />
        )}
      </Section>

      {batch.mode === "full" ? (
        <Section title="Artikli kojih nema u fajlu">
          <div className="flex flex-col gap-3">
            <Switch
              label="Deaktiviraj aktivne artikle kojih nema u ovom fajlu"
              description={
                batch.missing?.done
                  ? `${productsToDeactivate(batch.missing.count)}. Demo artikli se ne diraju; poništavanje uvoza ih vraća.`
                  : "Brojim artikle kojih nema u fajlu…"
              }
              checked={deactivate}
              onCheckedChange={(v) => {
                setDeactivate(v);
                setPhrase("");
              }}
            />
            {deactivate ? (
              <Field label={`Za potvrdu upišite ${PHRASE}`} required>
                <Input
                  value={phrase}
                  onChange={(e) => setPhrase(e.target.value)}
                  autoComplete="off"
                  className="h-10 max-w-xs"
                  data-testid="import-deactivate-phrase"
                />
              </Field>
            ) : null}
          </div>
        </Section>
      ) : null}

      {error ? <ErrorBanner>{error}</ErrorBanner> : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() =>
            confirm.ask({
              title: "Otkazati ovaj uvoz?",
              description: "Ništa nije upisano. Fajl i probni rezultat se odbacuju.",
              confirmLabel: "Otkaži uvoz",
              danger: true,
              onConfirm: async () => {
                await cancel({ batchId: batch._id });
                onNew();
              },
            })
          }
        >
          Otkaži uvoz
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <span className="type-caption text-ink-3">
            {productsWritten(writes)}; redovi sa greškom se preskaču.
          </span>
          <Button
            loading={busy}
            disabled={(writes === 0 && !deactivate) || !phraseOk}
            data-testid="import-commit"
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await commit({
                  batchId: batch._id,
                  deactivateMissing: deactivate,
                  ...(deactivate ? { confirmPhrase: phrase } : {}),
                });
              } catch (err) {
                setError(convexErrorMessage(err, "Upis nije pokrenut. Pokušajte ponovo."));
              } finally {
                setBusy(false);
              }
            }}
          >
            Upiši u katalog
          </Button>
        </div>
      </div>
      <ConfirmDialog {...confirm.props} />
    </div>
  );
}

/** Quarter milestones only, so a screen reader hears 25 / 50 / 75 / 100 %, not every chunk. */
function milestone(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.floor((done / total) * 4) * 25);
}

/**
 * What the polite status region says for a batch past the dry run (A11Y-17): the phase with
 * quarter milestones while it runs, then the result. Counts use label form („Novih artikala:
 * 12“), which needs no plural agreement.
 */
export function importAnnouncement(batch: Batch): string {
  const c = batch.counts;
  const result = `Novih artikala: ${formatNumber(c.created ?? 0)}, izmenjenih: ${formatNumber(c.updated ?? 0)}, neuspelih: ${formatNumber(c.failed + c.error)}.`;
  switch (batch.status) {
    case "committing":
      return `Upis u toku: ${milestone(batch.progress.committedRows, c.total)} %.`;
    case "committed":
      return `Uvoz je upisan u katalog. ${result}`;
    case "failed":
      return `Upis je prekinut. ${result}`;
    case "rolling_back": {
      const total = Math.max((c.created ?? 0) + (c.updated ?? 0) + c.deactivated, 1);
      return `Poništavanje u toku: ${milestone(batch.progress.rolledBackRows, total)} %.`;
    }
    case "rolled_back":
      return c.rollbackSkipped
        ? `Uvoz je poništen. ${productsNotRestored(c.rollbackSkipped)} jer su menjani posle uvoza.`
        : "Uvoz je poništen. Sve vrednosti su vraćene.";
    case "cancelled":
      return "Uvoz je otkazan.";
    default:
      return "";
  }
}

export function CommitStep({ batch, onNew }: { batch: Batch; onNew?: () => void }) {
  const rollback = useMutation(api.imports.rollback);
  const resume = useMutation(api.imports.resume);
  const confirm = useConfirm();
  const now = useNowMinute();
  const c = batch.counts;
  const running = batch.status === "committing" || batch.status === "rolling_back";
  const stalled = running && now - batch.updatedAt > 2 * 60_000;
  const changeTotal = (c.created ?? 0) + (c.updated ?? 0) + c.deactivated;

  return (
    <div className="flex flex-col gap-4" data-testid="import-commit-step">
      <p role="status" className="sr-only" data-testid="import-status">
        {importAnnouncement(batch)}
      </p>
      {batch.status === "committing" ? (
        <Section title="Upis u toku">
          <div className="flex flex-col gap-3">
            <ProgressBar
              value={batch.progress.committedRows}
              max={c.total}
              label={COMMIT_PHASE_LABEL[batch.phase ?? "rows"] ?? "Upisujem"}
            />
            <p className="type-body-s text-ink-3">
              Možete da napustite stranicu — upis se nastavlja, a obaveštenje stiže kada završi.
            </p>
          </div>
        </Section>
      ) : null}

      {batch.status === "rolling_back" ? (
        <Section title="Poništavanje u toku">
          <ProgressBar
            value={batch.progress.rolledBackRows}
            max={Math.max(changeTotal, batch.progress.rolledBackRows)}
            label="Vraćam prethodne vrednosti"
            tone="warning"
          />
        </Section>
      ) : null}

      {stalled ? (
        <ErrorBanner onRetry={() => void resume({ batchId: batch._id })}>
          Nema napretka duže od dva minuta. Nastavite obradu — ništa se neće upisati dvaput.
        </ErrorBanner>
      ) : null}

      {batch.status === "committed" || batch.status === "failed" ? (
        <>
          <p className="type-body font-semibold text-ink-1" data-testid="import-result">
            Uvoz je upisan u katalog.
          </p>
          <CountTiles
            tiles={[
              { key: "created", label: "Novih artikala", value: c.created ?? 0, tone: "success" },
              { key: "updated", label: "Izmenjenih", value: c.updated ?? 0 },
              { key: "unchanged", label: "Bez promena", value: c.unchanged },
              {
                key: "failed",
                label: "Neuspelih",
                value: c.failed + c.error,
                tone: "danger",
                hint: "greške i neuspeli upisi",
              },
              { key: "deactivated", label: "Deaktiviranih", value: c.deactivated, tone: "warning" },
            ]}
          />
          {batch.images && batch.images.total > 0 ? (
            <ProgressBar
              value={batch.images.done + batch.images.failed}
              max={batch.images.total}
              label={`Slike: ${formatNumber(batch.images.done)} preuzeto${batch.images.failed ? `, ${formatNumber(batch.images.failed)} neuspešno` : ""}`}
              tone="success"
            />
          ) : null}
        </>
      ) : null}

      {batch.status === "rolled_back" ? (
        <p className="type-body text-ink-1" data-testid="import-rolled-back">
          Uvoz je poništen.
          {c.rollbackSkipped
            ? ` ${productsNotRestored(c.rollbackSkipped)} jer su menjani posle uvoza — spisak je u zapisu uvoza.`
            : " Sve vrednosti su vraćene."}
        </p>
      ) : null}

      {batch.status === "cancelled" ? (
        <p className="type-body text-ink-1">Uvoz je otkazan.</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="quiet">
          <RouteLink href={ADMIN.importBatch(batch._id)}>Zapis uvoza</RouteLink>
        </Button>
        <Button asChild variant="ghost">
          <a href={ADMIN.importReport(batch._id)} download>
            <DownloadSimpleIcon size={16} aria-hidden="true" />
            Izveštaj
          </a>
        </Button>
        {batch.status === "committed" || batch.status === "failed" ? (
          <Button
            variant="secondary"
            data-testid="import-rollback"
            onClick={() =>
              confirm.ask({
                title: "Poništiti ovaj uvoz?",
                description:
                  "Novi artikli iz ovog uvoza se brišu (ili deaktiviraju ako su već poručeni), izmenjenim artiklima se vraćaju prethodne vrednosti, deaktivirani se ponovo aktiviraju. Artikli menjani posle uvoza ostaju kakvi jesu.",
                confirmLabel: "Poništi uvoz",
                danger: true,
                onConfirm: async () => {
                  await rollback({ batchId: batch._id });
                },
              })
            }
          >
            Poništi uvoz
          </Button>
        ) : null}
        {!running && onNew ? (
          <Button onClick={onNew} data-testid="import-new">
            Novi uvoz
          </Button>
        ) : null}
      </div>
      <ConfirmDialog {...confirm.props} />
    </div>
  );
}

export type { Batch as ImportBatchSummary };
export type ImportBatchId = Id<"importBatches">;
