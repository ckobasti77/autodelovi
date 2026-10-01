"use client";

/**
 * Step 1 — file: drop zone (xlsx / xls / csv ≤ 25 MB), then sheet, header row and CSV
 * encoding with a preview of the first rows. Parsing happens in the worker.
 */
import { useRef, useState } from "react";
import { DownloadSimpleIcon, FileXlsIcon, UploadSimpleIcon } from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/cn";
import type { CsvEncoding } from "@/lib/import/csv";
import type { ParsedSheet } from "@/lib/excel/importProtocol";
import type { CellValue } from "@/lib/import/row";
import { formatNumber } from "@/lib/format/number";
import { ROWS, countImport } from "@/lib/i18n/sr/import";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { ADMIN } from "@/constants/routes";

import { ErrorBanner, Section } from "../ui";

export const MAX_FILE_BYTES = 25 * 1024 * 1024;
const ACCEPT =
  ".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv";

const cellText = (v: CellValue) => (v === null || v === undefined ? "" : String(v));
const kb = (bytes: number) =>
  bytes > 1024 * 1024
    ? `${formatNumber(Math.round((bytes / 1024 / 1024) * 10) / 10)} MB`
    : `${formatNumber(Math.ceil(bytes / 1024))} KB`;

export function FileDrop({
  onFile,
  busy,
  error,
}: {
  onFile: (file: File) => void;
  busy: boolean;
  error: string | null;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const file = e.dataTransfer.files[0];
          if (file) onFile(file);
        }}
        className={cn(
          "flex min-h-60 flex-col items-center justify-center gap-4 rounded-sm border-2 border-dashed px-6 py-10 text-center transition-control",
          over ? "border-accent bg-accent-subtle" : "border-line-strong bg-surface-1",
        )}
      >
        {busy ? (
          <>
            <Spinner size={20} label="Čitam fajl" />
            <p className="type-body text-ink-2">Čitam fajl…</p>
          </>
        ) : (
          <>
            <FileXlsIcon size={40} className="text-ink-3" aria-hidden="true" />
            <div className="flex flex-col gap-1">
              <p className="type-body font-semibold text-ink-1">Prevucite fajl ovde</p>
              <p className="type-body-s text-ink-3">xlsx, xls ili csv · do 25 MB i 50.000 redova</p>
            </div>
            <Button icon={<UploadSimpleIcon size={18} />} onClick={() => input.current?.click()}>
              Izaberi fajl
            </Button>
            <input
              ref={input}
              type="file"
              accept={ACCEPT}
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              data-testid="import-file-input"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onFile(file);
                e.target.value = "";
              }}
            />
          </>
        )}
      </div>
      {error ? <ErrorBanner>{error}</ErrorBanner> : null}
      <p className="type-body-s text-ink-3">
        Nemate fajl u pravom obliku?{" "}
        <a
          href={ADMIN.importTemplate}
          download
          className="inline-flex items-center gap-1 font-semibold text-accent-text underline underline-offset-2"
        >
          <DownloadSimpleIcon size={14} aria-hidden="true" />
          Preuzmite šablon
        </a>{" "}
        sa uputstvom i listama kategorija, proizvođača i vozila.
      </p>
    </div>
  );
}

export function SheetPreview({
  file,
  sheet,
  encoding,
  onSelect,
  onEncoding,
  onReset,
  onNext,
  busy,
}: {
  file: File;
  sheet: ParsedSheet;
  encoding: CsvEncoding | undefined;
  onSelect: (sheetName: string, headerRow: number) => void;
  onEncoding: (encoding: CsvEncoding) => void;
  onReset: () => void;
  onNext: () => void;
  busy: boolean;
}) {
  const width = Math.min(sheet.headers.length, 14);
  return (
    <div className="flex flex-col gap-4">
      <Section
        title={file.name}
        actions={
          <Button variant="ghost" size="sm" onClick={onReset}>
            Drugi fajl
          </Button>
        }
      >
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <p className="type-body-s text-ink-2">
            {sheet.format.toUpperCase()} · {kb(file.size)} ·{" "}
            <span className="font-semibold text-ink-1" data-testid="import-row-count">
              {countImport(sheet.rowCount, ROWS)}
            </span>
            {sheet.delimiter
              ? ` · razdvajanje „${sheet.delimiter === "\t" ? "tab" : sheet.delimiter}“`
              : ""}
          </p>
          {sheet.sheets.length > 1 ? (
            <div className="w-56">
              <Field label="List">
                <Select
                  size="sm"
                  value={sheet.sheet}
                  onChange={(e) => onSelect(e.target.value, 0)}
                  options={sheet.sheets.map((s) => ({ value: s, label: s }))}
                />
              </Field>
            </div>
          ) : null}
          <div className="w-72">
            <Field label="Red sa nazivima kolona">
              <Select
                size="sm"
                value={String(sheet.headerRow)}
                onChange={(e) => onSelect(sheet.sheet, Number(e.target.value))}
                options={sheet.top.slice(0, 10).map((row, i) => {
                  const first = row.map(cellText).filter(Boolean).slice(0, 2).join(", ");
                  return {
                    value: String(i),
                    label: `Red ${i + 1}${first ? ` — ${first.slice(0, 30)}` : ""}`,
                  };
                })}
              />
            </Field>
          </div>
          {sheet.format === "csv" ? (
            <div className="w-56">
              <Field label="Kodna strana">
                <Select
                  size="sm"
                  value={encoding ?? sheet.encoding ?? "utf-8"}
                  onChange={(e) => onEncoding(e.target.value as CsvEncoding)}
                  options={[
                    { value: "utf-8", label: "UTF-8" },
                    { value: "windows-1250", label: "Windows-1250" },
                  ]}
                />
              </Field>
            </div>
          ) : null}
        </div>
        <div className="mt-4 overflow-x-auto rounded-xs border border-line-faint">
          <table className="w-full border-collapse type-caption">
            <caption className="sr-only">Prvi redovi fajla</caption>
            <thead>
              <tr className="bg-surface-2 text-left">
                <th scope="col" className="w-12 px-2 py-1.5 font-medium text-ink-3">
                  Red
                </th>
                {sheet.headers.slice(0, width).map((h, i) => (
                  <th
                    key={i}
                    scope="col"
                    className="max-w-48 truncate px-2 py-1.5 font-semibold text-ink-1"
                  >
                    {h || `Kolona ${i + 1}`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sheet.preview.slice(0, 8).map((row, r) => (
                <tr key={r} className="border-t border-line-faint">
                  <td className="px-2 py-1 tabular-nums text-ink-3">{sheet.headerRow + r + 2}</td>
                  {Array.from({ length: width }, (_, c) => (
                    <td
                      key={c}
                      className="max-w-48 truncate px-2 py-1 text-ink-2"
                      title={cellText(row[c] ?? null)}
                    >
                      {cellText(row[c] ?? null)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {sheet.headers.length > width ? (
          <p className="mt-2 type-caption text-ink-3">
            Prikazano je prvih {width} od {sheet.headers.length} kolona.
          </p>
        ) : null}
      </Section>
      <div className="flex justify-end">
        <Button
          onClick={onNext}
          loading={busy}
          disabled={sheet.rowCount === 0}
          data-testid="import-to-mapping"
        >
          Dalje: kolone
        </Button>
      </div>
      {sheet.rowCount === 0 ? (
        <ErrorBanner>
          Ispod reda sa nazivima kolona nema podataka. Izaberite drugi red ili list.
        </ErrorBanner>
      ) : null}
    </div>
  );
}
