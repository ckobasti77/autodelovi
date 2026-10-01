"use client";

/**
 * Step 3 — check: the whole file validated in the worker with the same rules Convex uses.
 * Unknown categories are mapped to existing ones for the whole file, unknown
 * manufacturers are created or mapped; problem rows are listed and downloadable.
 */
import { useState } from "react";
import { DownloadSimpleIcon } from "@phosphor-icons/react/dist/ssr";

import type { ValidationSummary } from "@/lib/excel/importProtocol";
import { normalizeHeader } from "@/lib/import/headers";
import type { RefCategory, RefManufacturer } from "@/lib/import/row";
import { formatNumber } from "@/lib/format/number";
import { ROWS, countImport } from "@/lib/i18n/sr/import";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";

import { SegmentedFilter, Section } from "../ui";
import { CountTiles, IssueList, ProgressBar } from "./parts";

export type ValueMapsState = {
  category: Record<string, string>;
  manufacturer: Record<string, string>;
};

const SHOWN = 300;

export function CheckStep({
  summary,
  categories,
  manufacturers,
  valueMaps,
  onValueMaps,
  ambiguousHint,
  onBack,
  onStart,
  onReport,
  staging,
  busy,
}: {
  summary: ValidationSummary;
  categories: RefCategory[];
  manufacturers: RefManufacturer[];
  valueMaps: ValueMapsState;
  onValueMaps: (next: ValueMapsState) => void;
  ambiguousHint: boolean;
  onBack: () => void;
  onStart: () => void;
  onReport: () => void;
  staging: { done: number; total: number } | null;
  busy: boolean;
}) {
  const [filter, setFilter] = useState<"" | "errors" | "warnings">("");
  const rows = summary.problems.filter((p) =>
    filter === "errors"
      ? p.errors.length > 0
      : filter === "warnings"
        ? p.errors.length === 0
        : true,
  );
  const categoryOptions = [...categories]
    .map((c) => ({ value: c.id, label: c.parentName ? `${c.parentName} › ${c.name}` : c.name }))
    .sort((a, b) => a.label.localeCompare(b.label, "sr"));
  const importable = summary.rows - summary.withErrors;
  const errorRows = summary.problems.filter((p) => p.errors.length > 0).length;

  return (
    <div className="flex flex-col gap-4">
      <CountTiles
        tiles={[
          { key: "rows", label: "Redova u fajlu", value: summary.rows },
          { key: "ok", label: "Ispravnih", value: summary.ok, tone: "success" },
          {
            key: "warn",
            label: "Sa upozorenjem",
            value: summary.withWarnings,
            tone: "warning",
            hint: "uvoze se",
          },
          {
            key: "err",
            label: "Sa greškom",
            value: summary.withErrors,
            tone: "danger",
            hint: "preskaču se",
          },
          { key: "dup", label: "Ponovljenih šifara", value: summary.duplicates, tone: "danger" },
        ]}
      />

      {ambiguousHint ? (
        <p className="rounded-sm border border-warning bg-warning-subtle px-4 py-3 type-body-s text-ink-1">
          Neki brojevi mogu da se pročitaju na dva načina (npr. „12.990“). Ako cene nisu dobre,
          vratite se na kolone i promenite format brojeva.
        </p>
      ) : null}

      {summary.unknownCategories.length > 0 ? (
        <Section title="Kategorije kojih nema u katalogu">
          <p className="mb-3 type-body-s text-ink-3">
            Izaberite postojeću kategoriju za svaku vrednost iz fajla — izbor važi za sve redove sa
            tom vrednošću.
          </p>
          <table className="w-full border-collapse type-body-s">
            <caption className="sr-only">Nepoznate kategorije</caption>
            <thead>
              <tr className="border-b border-line text-left type-label uppercase text-ink-3">
                <th scope="col" className="py-2 pr-3">
                  Vrednost u fajlu
                </th>
                <th scope="col" className="w-20 py-2 pr-3 text-right">
                  Redova
                </th>
                <th scope="col" className="py-2">
                  Kategorija u katalogu
                </th>
              </tr>
            </thead>
            <tbody>
              {summary.unknownCategories.map((u) => {
                const key = normalizeHeader(u.value);
                const suggested = u.suggestions
                  .map((s) =>
                    categoryOptions.find((o) => o.label === s || o.label.endsWith(`› ${s}`)),
                  )
                  .filter((o): o is { value: string; label: string } => Boolean(o));
                return (
                  <tr key={key} className="border-b border-line-faint">
                    <th scope="row" className="py-2 pr-3 text-left font-semibold text-ink-1">
                      {u.value}
                    </th>
                    <td className="py-2 pr-3 text-right tabular-nums">{formatNumber(u.count)}</td>
                    <td className="py-1.5">
                      <div className="w-80 max-w-full">
                        <Select
                          size="sm"
                          aria-label={`Kategorija za „${u.value}“`}
                          placeholder="Izaberite kategoriju"
                          value={valueMaps.category[key] ?? ""}
                          onChange={(e) => {
                            const category = { ...valueMaps.category };
                            if (e.target.value) category[key] = e.target.value;
                            else delete category[key];
                            onValueMaps({ ...valueMaps, category });
                          }}
                          options={[
                            ...suggested.map((o) => ({
                              value: o.value,
                              label: `Predlog: ${o.label}`,
                            })),
                            ...categoryOptions.filter(
                              (o) => !suggested.some((x) => x.value === o.value),
                            ),
                          ]}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Section>
      ) : null}

      {summary.unknownManufacturers.length > 0 ? (
        <Section title="Novi proizvođači">
          <p className="mb-3 type-body-s text-ink-3">
            Ovi proizvođači ne postoje u katalogu. Uvoz ih pravi, osim ako izaberete postojećeg.
          </p>
          <table className="w-full border-collapse type-body-s">
            <caption className="sr-only">Nepoznati proizvođači</caption>
            <thead>
              <tr className="border-b border-line text-left type-label uppercase text-ink-3">
                <th scope="col" className="py-2 pr-3">
                  Vrednost u fajlu
                </th>
                <th scope="col" className="w-20 py-2 pr-3 text-right">
                  Redova
                </th>
                <th scope="col" className="py-2">
                  Proizvođač
                </th>
              </tr>
            </thead>
            <tbody>
              {summary.unknownManufacturers.map((u) => {
                const key = normalizeHeader(u.value);
                return (
                  <tr key={key} className="border-b border-line-faint">
                    <th scope="row" className="py-2 pr-3 text-left font-semibold text-ink-1">
                      {u.value}
                    </th>
                    <td className="py-2 pr-3 text-right tabular-nums">{formatNumber(u.count)}</td>
                    <td className="py-1.5">
                      <div className="w-80 max-w-full">
                        <Select
                          size="sm"
                          aria-label={`Proizvođač za „${u.value}“`}
                          value={valueMaps.manufacturer[key] ?? "new"}
                          onChange={(e) =>
                            onValueMaps({
                              ...valueMaps,
                              manufacturer: { ...valueMaps.manufacturer, [key]: e.target.value },
                            })
                          }
                          options={[
                            { value: "new", label: `Napravi novog: ${u.value}` },
                            ...[...manufacturers]
                              .sort((a, b) => a.name.localeCompare(b.name, "sr"))
                              .map((m) => ({ value: m.id, label: m.name })),
                          ]}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Section>
      ) : null}

      <Section
        title="Redovi sa napomenama"
        actions={
          summary.problems.length > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              icon={<DownloadSimpleIcon size={16} />}
              onClick={onReport}
            >
              Izveštaj (.xlsx)
            </Button>
          ) : null
        }
      >
        {summary.problems.length === 0 ? (
          <p className="py-4 type-body-s text-ink-2">Svi redovi su ispravni.</p>
        ) : (
          <div className="flex flex-col gap-3">
            <SegmentedFilter
              label="Vrsta napomene"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "", label: "Sve", count: summary.problems.length },
                { value: "errors", label: "Greške", count: errorRows },
                {
                  value: "warnings",
                  label: "Upozorenja",
                  count: summary.problems.length - errorRows,
                },
              ]}
            />
            <div className="overflow-x-auto">
              <table className="w-full border-collapse type-body-s" data-testid="import-problems">
                <caption className="sr-only">Redovi sa greškama i upozorenjima</caption>
                <thead>
                  <tr className="border-b border-line text-left type-label uppercase text-ink-3">
                    <th scope="col" className="w-16 py-2 pr-3">
                      Red
                    </th>
                    <th scope="col" className="w-40 py-2 pr-3">
                      Šifra
                    </th>
                    <th scope="col" className="py-2">
                      Napomene
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, SHOWN).map((p) => (
                    <tr key={p.rowNumber} className="border-b border-line-faint align-top">
                      <td className="py-2 pr-3 tabular-nums text-ink-2">{p.rowNumber}</td>
                      <td className="py-2 pr-3 type-code-s normal-case text-ink-1">
                        {p.sku ?? "—"}
                      </td>
                      <td className="py-2">
                        <IssueList errors={p.errors} warnings={p.warnings} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > SHOWN ? (
              <p className="type-caption text-ink-3">
                Prikazano {SHOWN} od {formatNumber(rows.length)} — ceo spisak je u izveštaju.
              </p>
            ) : null}
          </div>
        )}
      </Section>

      {staging ? (
        <ProgressBar value={staging.done} max={staging.total} label="Šaljem redove na proveru" />
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="secondary" onClick={onBack} disabled={busy}>
          Nazad na kolone
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <span className="type-caption text-ink-3">
            Ništa se još ne upisuje. Upisaće se najviše {countImport(importable, ROWS)}.
          </span>
          <Button
            onClick={onStart}
            loading={busy}
            disabled={importable === 0}
            data-testid="import-start-dry-run"
          >
            Pokreni probni uvoz
          </Button>
        </div>
      </div>
    </div>
  );
}
