"use client";

/**
 * `/admin/uvoz` — Excel import wizard (docs/IMPORT.md §K): Datoteka → Kolone → Provera run
 * in the browser (worker); Probni uvoz and Upis run on the Convex batch, whose id is kept
 * in the URL (`?uvoz=`) so a reload resumes the right step.
 */
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { ClockCounterClockwiseIcon, DownloadSimpleIcon } from "@phosphor-icons/react/dist/ssr";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { compactDateTime } from "@/lib/admin/format";
import type { ParsedSheet, ValidationSummary } from "@/lib/excel/importProtocol";
import type { CsvEncoding } from "@/lib/import/csv";
import type { ImportMode, MappingTarget } from "@/lib/import/fields";
import {
  applyPreset,
  autoMap,
  presetScore,
  toPresetMapping,
  type AutoMapped,
} from "@/lib/import/headers";
import type { FormatEvidence, NumberFormat } from "@/lib/import/numbers";
import { formatNumber } from "@/lib/format/number";
import { IMPORT_MODE_LABEL, IMPORT_STEPS } from "@/lib/i18n/sr/import";
import { convexErrorMessage } from "@/lib/i18n/sr/shop";
import { RouteLink } from "@/components/ui/RouteLink";
import { Stepper } from "@/components/ui/Stepper";
import { toast } from "@/components/ui/Toast";
import { ADMIN } from "@/constants/routes";

import { useNowMinute } from "../hooks";
import { ErrorBanner, PageHeader, Section } from "../ui";
import { CommitStep, DiffStep } from "./BatchSteps";
import { CheckStep, type ValueMapsState } from "./CheckStep";
import { FileDrop, MAX_FILE_BYTES, SheetPreview } from "./FileStep";
import { MappingStep } from "./MappingStep";
import { ImportStatusBadge } from "./parts";
import { useImportWorker } from "./useImportWorker";

const STAGE_CHUNK = 250;
const EXTENSIONS = /\.(xlsx|xls|csv)$/i;

const GUIDE = [
  ["Datoteka", "xlsx, xls ili csv iz knjigovodstvenog programa ili iz šablona."],
  ["Kolone", "Kolone se prepoznaju same; proverite ih i sačuvajte raspored za sledeći put."],
  ["Provera", "Greške, ponovljene šifre i nepoznate kategorije vidite pre slanja."],
  ["Probni uvoz", "Šta je novo, šta se menja i šta se preskače — ništa se još ne upisuje."],
  ["Upis", "Svaka izmena ostaje zapisana, a ceo uvoz može da se poništi."],
] as const;

function ImportGuide() {
  return (
    <Section title="Kako teče uvoz">
      <ol className="flex flex-col gap-3">
        {GUIDE.map(([title, text], i) => (
          <li key={title} className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-2 type-body-s">
            <span className="font-condensed text-[1.125rem] font-semibold leading-5 tabular-nums text-accent-text">
              {i + 1}
            </span>
            <span className="flex flex-col">
              <span className="font-semibold text-ink-1">{title}</span>
              <span className="text-ink-3">{text}</span>
            </span>
          </li>
        ))}
      </ol>
    </Section>
  );
}

function RecentImports() {
  const now = useNowMinute();
  const { results } = usePaginatedQuery(api.imports.history, {}, { initialNumItems: 5 });
  if (results.length === 0) return null;
  return (
    <Section
      title="Poslednji uvozi"
      actions={
        <RouteLink
          href={ADMIN.importHistory}
          className="type-caption text-accent-text underline-offset-2 hover:underline"
        >
          Istorija uvoza
        </RouteLink>
      }
    >
      <ul className="flex flex-col divide-y divide-line-faint">
        {results.slice(0, 5).map((b) => (
          <li key={b._id}>
            <RouteLink
              href={ADMIN.importBatch(b._id)}
              className="flex flex-col gap-1 px-1 py-2.5 transition-control hover:bg-surface-2 focus-ring-inset"
            >
              <span className="flex min-w-0 items-center justify-between gap-3">
                <span className="min-w-0 truncate type-body-s font-semibold text-ink-1">
                  {b.fileName}
                </span>
                <ImportStatusBadge status={b.status} />
              </span>
              <span className="type-caption text-ink-3">
                {compactDateTime(b._creationTime, now)} · {IMPORT_MODE_LABEL[b.mode]} ·{" "}
                {formatNumber(b.counts.total)} redova
              </span>
            </RouteLink>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function ImportWizard() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const batchId = (params.get("uvoz") as Id<"importBatches"> | null) ?? null;
  const request = useImportWorker();
  const reference = useQuery(api.imports.reference, {});
  const presetRows = useQuery(api.imports.presets, {});
  const batch = useQuery(api.imports.batch, batchId ? { batchId } : "skip");
  const savePreset = useMutation(api.imports.savePreset);
  const generateUploadUrl = useMutation(api.imports.generateUploadUrl);
  const createBatch = useMutation(api.imports.createBatch);
  const stageRows = useMutation(api.imports.stageRows);
  const finalizeStaging = useMutation(api.imports.finalizeStaging);

  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [encoding, setEncoding] = useState<CsvEncoding | undefined>(undefined);
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapping, setMapping] = useState<AutoMapped[]>([]);
  const [mode, setMode] = useState<ImportMode>("full");
  const [numberFormat, setNumberFormat] = useState<NumberFormat>("sr");
  const [formatConfirmed, setFormatConfirmed] = useState(false);
  const [evidence, setEvidence] = useState<FormatEvidence | null>(null);
  const [presetId, setPresetId] = useState<Id<"importMappingPresets"> | null>(null);
  const [summary, setSummary] = useState<ValidationSummary | null>(null);
  const [valueMaps, setValueMaps] = useState<ValueMapsState>({ category: {}, manufacturer: {} });
  const [staging, setStaging] = useState<{ done: number; total: number } | null>(null);

  const presets = useMemo(
    () =>
      (presetRows ?? [])
        .map((p) => ({
          _id: p._id,
          name: p.name,
          score: sheet ? presetScore(p.mapping, sheet.headers) : 0,
        }))
        .sort((a, b) => b.score - a.score),
    [presetRows, sheet],
  );

  const reset = useCallback(() => {
    setStep(0);
    setFile(null);
    setSheet(null);
    setEncoding(undefined);
    setMapping([]);
    setSummary(null);
    setValueMaps({ category: {}, manufacturer: {} });
    setStaging(null);
    setError(null);
    setPresetId(null);
    router.replace(pathname);
  }, [pathname, router]);

  const detect = async (nextSheet: ParsedSheet, nextMapping: AutoMapped[]) => {
    const res = await request<"evidence">({ type: "evidence", mapping: nextMapping });
    setEvidence(res.evidence);
    setNumberFormat(res.evidence.format);
    setFormatConfirmed(res.evidence.sr > 0 || res.evidence.en > 0);
    void nextSheet;
  };

  const mapFor = (next: ParsedSheet) => {
    const best = (presetRows ?? [])
      .map((p) => ({ p, score: presetScore(p.mapping, next.headers) }))
      .sort((a, b) => b.score - a.score)[0];
    if (best && best.score >= 0.8) {
      setPresetId(best.p._id);
      return applyPreset(best.p.mapping, next.headers);
    }
    setPresetId(null);
    return autoMap(next.headers);
  };

  const parse = async (f: File, enc?: CsvEncoding) => {
    setError(null);
    if (!EXTENSIONS.test(f.name)) return setError("Izaberite xlsx, xls ili csv fajl.");
    if (f.size > MAX_FILE_BYTES)
      return setError("Fajl je veći od 25 MB. Podelite ga na manje delove.");
    setBusy(true);
    try {
      const bytes = await f.arrayBuffer();
      const res = await request<"parsed">(
        { type: "parse", bytes, fileName: f.name, ...(enc ? { encoding: enc } : {}) },
        [bytes],
      );
      if (res.sheet.rowCount > 50_000) {
        setError("Fajl ima više od 50.000 redova. Podelite ga na manje delove.");
        return;
      }
      setFile(f);
      setSheet(res.sheet);
      const nextMapping = mapFor(res.sheet);
      setMapping(nextMapping);
      await detect(res.sheet, nextMapping);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fajl nije mogao da se pročita.");
    } finally {
      setBusy(false);
    }
  };

  const selectSheet = async (sheetName: string, headerRow: number) => {
    setBusy(true);
    try {
      const res = await request<"parsed">({ type: "select", sheet: sheetName, headerRow });
      setSheet(res.sheet);
      const nextMapping = mapFor(res.sheet);
      setMapping(nextMapping);
      await detect(res.sheet, nextMapping);
    } finally {
      setBusy(false);
    }
  };

  const validate = async (maps: ValueMapsState = valueMaps) => {
    if (!reference) return;
    setBusy(true);
    setError(null);
    try {
      const res = await request<"validated">({
        type: "validate",
        input: {
          mapping: mapping.map(({ column, header, field }) => ({ column, header, field })),
          mode,
          numberFormat,
          warnAmbiguous: !formatConfirmed,
          vatRateBp: reference.vatRateBp,
          categories: reference.categories,
          manufacturers: reference.manufacturers,
          vehicles: reference.vehicles,
          valueMaps: maps,
        },
      });
      setSummary(res.summary);
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Provera nije uspela.");
    } finally {
      setBusy(false);
    }
  };

  const downloadClientReport = async () => {
    if (!summary || !file) return;
    const { buildReportWorkbook, XLSX_TYPE } = await import("@/lib/excel/importWorkbooks");
    const bytes = buildReportWorkbook(
      file.name,
      summary.problems.map((p) => ({ ...p, action: p.errors.length > 0 ? "error" : "update" })),
    );
    const url = URL.createObjectURL(
      new Blob([bytes.slice().buffer as ArrayBuffer], { type: XLSX_TYPE }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `provera-${file.name.replace(EXTENSIONS, "")}.xlsx`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1_000);
  };

  const startDryRun = async () => {
    if (!file || !sheet || !summary) return;
    setBusy(true);
    setError(null);
    try {
      const uploadUrl = await generateUploadUrl({});
      const upload = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      const sourceFileId = upload.ok
        ? ((await upload.json()) as { storageId: Id<"_storage"> }).storageId
        : undefined;
      const cleanMapping = mapping.map(({ column, header, field }) => ({ column, header, field }));
      const id = await createBatch({
        fileName: file.name,
        fileSize: file.size,
        format: sheet.format,
        ...(sheet.encoding ? { encoding: sheet.encoding } : {}),
        ...(sheet.delimiter ? { delimiter: sheet.delimiter } : {}),
        sheetName: sheet.sheet,
        headerRow: sheet.headerRow,
        numberFormat,
        warnAmbiguous: !formatConfirmed,
        mode,
        mapping: cleanMapping,
        ...(presetId ? { presetId } : {}),
        valueMaps: {
          category: valueMaps.category as Record<string, Id<"categories">>,
          manufacturer: valueMaps.manufacturer as Record<string, Id<"manufacturers"> | "new">,
        },
        total: sheet.rowCount,
        ...(sourceFileId ? { sourceFileId } : {}),
      });
      setStaging({ done: 0, total: sheet.rowCount });
      for (let from = 0; from < sheet.rowCount; from += STAGE_CHUNK) {
        const res = await request<"rows">({
          type: "rows",
          mapping: cleanMapping,
          from,
          count: STAGE_CHUNK,
        });
        if (res.rows.length > 0) await stageRows({ batchId: id, rows: res.rows });
        setStaging({ done: Math.min(sheet.rowCount, from + STAGE_CHUNK), total: sheet.rowCount });
      }
      await finalizeStaging({ batchId: id });
      setStaging(null);
      router.replace(`${pathname}?uvoz=${id}`);
    } catch (err) {
      setError(convexErrorMessage(err, "Probni uvoz nije uspeo. Pokušajte ponovo."));
    } finally {
      setBusy(false);
    }
  };

  const currentStep = batchId
    ? batch &&
      ["committing", "committed", "failed", "rolling_back", "rolled_back", "cancelled"].includes(
        batch.status,
      )
      ? 4
      : 3
    : step;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Uvoz iz Excela"
        description="Cenovnik ili lager iz knjigovodstvenog programa: provera pre upisa, probni rezultat i poništavanje."
        actions={
          <>
            <a
              href={ADMIN.importTemplate}
              download
              data-testid="import-template"
              className="inline-flex h-11 items-center gap-2 rounded-xs border border-control px-4 type-body-s text-ink-1 transition-control hover:bg-surface-2 focus-ring"
            >
              <DownloadSimpleIcon size={18} aria-hidden="true" />
              Šablon (.xlsx)
            </a>
            <RouteLink
              href={ADMIN.importHistory}
              className="inline-flex h-11 items-center gap-2 rounded-xs px-4 type-body-s text-ink-1 transition-control hover:bg-surface-2 focus-ring"
            >
              <ClockCounterClockwiseIcon size={18} aria-hidden="true" />
              Istorija
            </RouteLink>
          </>
        }
      />
      <Stepper
        label="Koraci uvoza"
        steps={IMPORT_STEPS}
        current={currentStep}
        {...(!batchId ? { onSelect: (i: number) => i < step && setStep(i) } : {})}
      />

      {batchId ? (
        batch === undefined ? (
          <p className="type-body-s text-ink-3">Učitavam uvoz…</p>
        ) : batch === null ? (
          <ErrorBanner>Uvoz ne postoji.</ErrorBanner>
        ) : currentStep === 3 ? (
          <DiffStep batch={batch} onNew={reset} />
        ) : (
          <CommitStep batch={batch} onNew={reset} />
        )
      ) : step === 0 ? (
        !file || !sheet ? (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <FileDrop onFile={(f) => void parse(f)} busy={busy} error={error} />
            <div className="flex flex-col gap-5">
              <ImportGuide />
              <RecentImports />
            </div>
          </div>
        ) : (
          <SheetPreview
            file={file}
            sheet={sheet}
            encoding={encoding}
            onSelect={(s, h) => void selectSheet(s, h)}
            onEncoding={(enc) => {
              setEncoding(enc);
              void parse(file, enc);
            }}
            onReset={reset}
            onNext={() => setStep(1)}
            busy={busy}
          />
        )
      ) : step === 1 && sheet ? (
        <MappingStep
          sheet={sheet}
          mapping={mapping}
          onMapping={(column, field: MappingTarget) =>
            setMapping((prev) =>
              prev.map((m) =>
                m.column === column
                  ? { ...m, field, confidence: null }
                  : field !== "ignore" && m.field === field
                    ? { ...m, field: "ignore", confidence: null }
                    : m,
              ),
            )
          }
          mode={mode}
          onMode={setMode}
          numberFormat={numberFormat}
          onNumberFormat={(f) => {
            setNumberFormat(f);
            setFormatConfirmed(true);
          }}
          evidence={evidence}
          presets={presets}
          onApplyPreset={(id) => {
            const preset = presetRows?.find((p) => p._id === id);
            if (!preset || !sheet) return;
            setPresetId(preset._id);
            setMapping(applyPreset(preset.mapping, sheet.headers));
            toast.success(`Primenjen šablon „${preset.name}“.`);
          }}
          onSavePreset={async (name) => {
            try {
              const id = await savePreset({ name, mapping: toPresetMapping(mapping) });
              setPresetId(id);
              toast.success(`Šablon „${name}“ je sačuvan.`);
            } catch (err) {
              toast.error(convexErrorMessage(err, "Šablon nije sačuvan."));
            }
          }}
          onBack={() => setStep(0)}
          onNext={() => void validate()}
          busy={busy || reference === undefined}
        />
      ) : step === 2 && summary && reference ? (
        <>
          <CheckStep
            summary={summary}
            categories={reference.categories}
            manufacturers={reference.manufacturers}
            valueMaps={valueMaps}
            onValueMaps={(next) => {
              setValueMaps(next);
              void validate(next);
            }}
            ambiguousHint={summary.problems.some((p) =>
              p.warnings.some((w) => w.code === "AMBIGUOUS_NUMBER"),
            )}
            onBack={() => setStep(1)}
            onStart={() => void startDryRun()}
            onReport={() => void downloadClientReport()}
            staging={staging}
            busy={busy}
          />
          {error ? <ErrorBanner>{error}</ErrorBanner> : null}
        </>
      ) : null}
      {!batchId && step === 1 && error ? <ErrorBanner>{error}</ErrorBanner> : null}
    </div>
  );
}
