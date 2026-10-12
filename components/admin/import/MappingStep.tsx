"use client";

/**
 * Step 2 — columns: import mode, number format (detected from the file, with a parsed
 * example), saved mapping presets and the column → field table with the confidence of
 * each automatic match.
 */
import { useState } from "react";
import { FloppyDiskIcon } from "@phosphor-icons/react/dist/ssr";

import type { ParsedSheet } from "@/lib/excel/importProtocol";
import {
  FIELD_DEFS,
  fieldsForMode,
  mappingIndex,
  mappingProblems,
  type ImportMode,
  type MappingTarget,
} from "@/lib/import/fields";
import type { AutoMapped } from "@/lib/import/headers";
import { parseMoney, type FormatEvidence, type NumberFormat } from "@/lib/import/numbers";
import type { CellValue } from "@/lib/import/row";
import { formatRSD } from "@/lib/format/money";
import { CELLS, CONFIDENCE_LABEL, IMPORT_MODE_LABEL, countImport } from "@/lib/i18n/sr/import";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { RadioGroup } from "@/components/ui/Radio";
import { Select } from "@/components/ui/Select";

import { CompactInput, Section, sentenceCase } from "../ui";

export type Preset = { _id: string; name: string; score: number };

const cellText = (v: CellValue | undefined) => (v === null || v === undefined ? "" : String(v));

function samples(sheet: ParsedSheet, column: number): string {
  const values: string[] = [];
  for (const row of sheet.preview) {
    const text = cellText(row[column]).trim();
    if (text && !values.includes(text)) values.push(text);
    if (values.length === 3) break;
  }
  return values.join(" · ");
}

export function MappingStep({
  sheet,
  mapping,
  onMapping,
  mode,
  onMode,
  numberFormat,
  onNumberFormat,
  evidence,
  presets,
  onApplyPreset,
  onSavePreset,
  onBack,
  onNext,
  busy,
}: {
  sheet: ParsedSheet;
  mapping: AutoMapped[];
  onMapping: (column: number, field: MappingTarget) => void;
  mode: ImportMode;
  onMode: (mode: ImportMode) => void;
  numberFormat: NumberFormat;
  onNumberFormat: (format: NumberFormat) => void;
  evidence: FormatEvidence | null;
  presets: Preset[];
  onApplyPreset: (presetId: string) => void;
  onSavePreset: (name: string) => Promise<void>;
  onBack: () => void;
  onNext: () => void;
  busy: boolean;
}) {
  const [presetName, setPresetName] = useState("");
  const [saving, setSaving] = useState(false);
  const allowed = new Set(fieldsForMode(mode));
  const problems = mappingProblems(mapping, mode);
  const index = mappingIndex(mapping);
  const priceColumn = index.priceRetail ?? index.priceNet ?? index.cost;
  const priceSample =
    priceColumn !== undefined
      ? sheet.preview.map((r) => r[priceColumn]).find((v) => cellText(v).trim() !== "")
      : undefined;
  const parsedSample = priceSample !== undefined ? parseMoney(priceSample, numberFormat) : null;
  const detected =
    evidence && (evidence.sr > 0 || evidence.en > 0)
      ? `Prepoznato iz fajla: ${evidence.format === "sr" ? "srpski" : "engleski"} zapis (${countImport(evidence.format === "sr" ? evidence.sr : evidence.en, CELLS)}).`
      : "Fajl ne pokazuje jasno format brojeva — proverite primer.";
  const suggested = presets.filter((p) => p.score >= 0.8);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Šta uvozite">
          <RadioGroup
            label="Režim uvoza"
            value={mode}
            onValueChange={(v) => onMode(v as ImportMode)}
            options={[
              {
                value: "full",
                label: IMPORT_MODE_LABEL.full,
                description:
                  "Novi artikli se prave, postojeći se menjaju u kolonama koje ste izabrali.",
              },
              {
                value: "stock_price",
                label: IMPORT_MODE_LABEL.stock_price,
                description:
                  "Menja samo količinu, cene, rok isporuke i status postojećih artikala. Nepoznate šifre se preskaču.",
              },
            ]}
          />
        </Section>
        <Section title="Brojevi">
          <div className="flex flex-col gap-3">
            <div className="w-72">
              <Select
                size="sm"
                aria-label="Format brojeva"
                value={numberFormat}
                onChange={(e) => onNumberFormat(e.target.value as NumberFormat)}
                options={[
                  { value: "sr", label: "Srpski zapis: 1.234,56" },
                  { value: "en", label: "Engleski zapis: 1,234.56" },
                ]}
              />
            </div>
            <p className="type-body-s text-ink-3">{detected}</p>
            {priceSample !== undefined ? (
              <p className="type-body-s text-ink-2">
                Primer iz fajla:{" "}
                <span className="type-code normal-case">{cellText(priceSample)}</span> →{" "}
                <span className="font-semibold text-ink-1">
                  {parsedSample?.ok ? formatRSD(parsedSample.para) : "nije broj u ovom zapisu"}
                </span>
              </p>
            ) : null}
          </div>
        </Section>
      </div>

      <Section
        title="Kolone"
        actions={
          presets.length > 0 ? (
            <div className="w-64">
              <Select
                size="sm"
                aria-label="Primeni šablon mapiranja"
                placeholder={
                  suggested.length > 0 ? `Predlog: ${suggested[0]!.name}` : "Šablon mapiranja"
                }
                value=""
                onChange={(e) => e.target.value && onApplyPreset(e.target.value)}
                options={presets.map((p) => ({
                  value: p._id,
                  label: `${p.name}${p.score >= 0.8 ? " (odgovara fajlu)" : ""}`,
                }))}
              />
            </div>
          ) : null
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse type-body-s" data-testid="import-mapping">
            <caption className="sr-only">Mapiranje kolona fajla na polja artikla</caption>
            <thead>
              <tr className="border-b border-line text-left type-label uppercase text-ink-3">
                <th scope="col" className="py-2 pr-3">
                  Kolona u fajlu
                </th>
                <th scope="col" className="py-2 pr-3">
                  Primeri
                </th>
                <th scope="col" className="w-64 py-2 pr-3">
                  Polje
                </th>
                <th scope="col" className="w-28 py-2">
                  Prepoznato
                </th>
              </tr>
            </thead>
            <tbody>
              {mapping.map((m) => (
                <tr key={m.column} className="border-b border-line-faint align-middle">
                  <th scope="row" className="py-2 pr-3 text-left font-semibold text-ink-1">
                    {m.header || `Kolona ${m.column + 1}`}
                  </th>
                  <td
                    className="max-w-80 truncate py-2 pr-3 text-ink-3"
                    title={samples(sheet, m.column)}
                  >
                    {samples(sheet, m.column) || "—"}
                  </td>
                  <td className="py-1.5 pr-3">
                    <div className="w-64">
                      <Select
                        size="sm"
                        aria-label={`Polje za kolonu ${m.header || m.column + 1}`}
                        value={m.field}
                        onChange={(e) => onMapping(m.column, e.target.value as MappingTarget)}
                        options={[
                          { value: "ignore", label: "Ne uvozi" },
                          ...FIELD_DEFS.filter((d) => allowed.has(d.field)).map((d) => ({
                            value: d.field,
                            label: d.label,
                          })),
                        ]}
                      />
                    </div>
                  </td>
                  <td className="py-2">
                    {m.field !== "ignore" && m.confidence ? (
                      <Badge
                        size="text"
                        tone={
                          m.confidence === "exact" || m.confidence === "alias"
                            ? "success"
                            : "warning"
                        }
                      >
                        {sentenceCase(CONFIDENCE_LABEL[m.confidence])}
                      </Badge>
                    ) : m.field !== "ignore" ? (
                      <span className="type-caption text-ink-3">ručno</span>
                    ) : (
                      <span className="text-ink-4">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <form
          className="mt-4 flex flex-wrap items-end gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!presetName.trim()) return;
            setSaving(true);
            try {
              await onSavePreset(presetName.trim());
              setPresetName("");
            } finally {
              setSaving(false);
            }
          }}
        >
          <div className="w-72">
            <CompactInput
              aria-label="Naziv šablona mapiranja"
              placeholder="Naziv šablona, npr. Izvoz iz programa"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              maxLength={60}
            />
          </div>
          <Button
            type="submit"
            variant="secondary"
            size="sm"
            icon={<FloppyDiskIcon size={16} />}
            loading={saving}
            disabled={!presetName.trim()}
          >
            Sačuvaj mapiranje
          </Button>
          <span className="type-caption text-ink-3">
            Sledeći put se isti raspored kolona prepozna sam.
          </span>
        </form>
      </Section>

      {problems.length > 0 ? (
        <ul className="flex flex-col gap-1 rounded-md border border-warning bg-warning-subtle px-4 py-3 type-body-s text-ink-1">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      ) : null}

      <div className="flex justify-between gap-3">
        <Button variant="secondary" onClick={onBack}>
          Nazad
        </Button>
        <Button
          onClick={onNext}
          loading={busy}
          disabled={problems.length > 0}
          data-testid="import-to-check"
        >
          Dalje: provera
        </Button>
      </div>
    </div>
  );
}
