"use client";

/**
 * Fitment editor with the vehicle tree: make → model → generation → engine (optional) →
 * years (optional) → note; „cela generacija“ when no engine is chosen, „sve generacije
 * modela“ in one click. Rows are grouped by make and model for scanning.
 */
import { useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { PlusIcon, TrashIcon } from "@phosphor-icons/react/dist/ssr";

import { api } from "@/convex/_generated/api";
import { engineLabel as formatEngine } from "@/lib/admin/format";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

export type FitmentRow = {
  brandId: Id<"vehicleBrands">;
  modelId: Id<"vehicleModels">;
  generationId: Id<"vehicleGenerations">;
  engineId: Id<"engines"> | null;
  yearFrom: number | null;
  yearTo: number | null;
  note: string;
  label: string;
  engineLabel: string | null;
};

const MAX = 200;
const COLLAPSE_AT = 12;

type Group = { title: string; items: { row: FitmentRow; index: number }[] };

/** The first groups up to `limit` rows (the last one trimmed). */
function visibleGroups(groups: Group[], limit: number): Group[] {
  const out: Group[] = [];
  let left = limit;
  for (const g of groups) {
    if (left <= 0) break;
    out.push({ ...g, items: g.items.slice(0, left) });
    left -= g.items.length;
  }
  return out;
}

export function FitmentEditor({
  rows,
  onChange,
}: {
  rows: FitmentRow[];
  onChange: (rows: FitmentRow[]) => void;
}) {
  const tree = useQuery(api.catalog.vehicles.tree, {});
  const [brandId, setBrandId] = useState("");
  const [modelId, setModelId] = useState("");
  const [generationId, setGenerationId] = useState("");
  const [engineId, setEngineId] = useState("");
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const engines = useQuery(
    api.catalog.vehicles.engines,
    generationId ? { generationId: generationId as Id<"vehicleGenerations"> } : "skip",
  );

  const brand = tree?.find((b) => b.brand._id === brandId);
  const model = brand?.models.find((m) => m.model._id === modelId);
  const generation = model?.generations.find((g) => g._id === generationId);

  const groups = useMemo(() => {
    const map = new Map<string, Group>();
    rows.forEach((row, index) => {
      const key = `${row.brandId}:${row.modelId}`;
      const g = map.get(key) ?? { title: row.label.split(" ").slice(0, 2).join(" "), items: [] };
      g.items.push({ row, index });
      map.set(key, g);
    });
    return [...map.values()];
  }, [rows]);

  const add = (gens: { _id: Id<"vehicleGenerations">; name: string }[], withEngine: boolean) => {
    setError(null);
    if (!brand || !model) return;
    const yf = yearFrom.trim() ? Number(yearFrom) : null;
    const yt = yearTo.trim() ? Number(yearTo) : null;
    if ((yf !== null && !Number.isInteger(yf)) || (yt !== null && !Number.isInteger(yt)))
      return setError("Godine su celi brojevi.");
    if (yf !== null && yt !== null && yt < yf) return setError("Godina „do“ je pre godine „od“.");
    const engine = withEngine ? engines?.find((e) => e._id === engineId) : undefined;
    const next = [...rows];
    for (const g of gens) {
      const exists = next.some(
        (r) => r.generationId === g._id && (r.engineId ?? null) === (engine?._id ?? null),
      );
      if (exists) continue;
      next.push({
        brandId: brand.brand._id,
        modelId: model.model._id,
        generationId: g._id,
        engineId: engine?._id ?? null,
        yearFrom: yf,
        yearTo: yt,
        note: note.trim(),
        label: `${brand.brand.name} ${model.model.name} ${g.name}`,
        engineLabel: engine ? formatEngine(engine.name, engine.powerKw) : null,
      });
    }
    if (next.length > MAX) return setError(`Najviše ${MAX} vozila po artiklu.`);
    onChange(next);
    setEngineId("");
    setNote("");
  };

  return (
    <div className="flex flex-col gap-4">
      {rows.length === 0 ? (
        <p className="type-body-s text-ink-2">
          Artikal još nema vozila. Bez kompatibilnosti ga kupci ne vide kad izaberu vozilo.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="grid items-start gap-3 lg:grid-cols-2">
            {(expanded || rows.length <= COLLAPSE_AT
              ? groups
              : visibleGroups(groups, COLLAPSE_AT)
            ).map((g) => (
              <div key={g.title} className="rounded-md border border-line">
                <p className="border-b border-line-faint bg-surface-2 px-3 py-1.5 type-label uppercase text-ink-3">
                  {g.title}
                </p>
                <ul className="divide-y divide-line-faint">
                  {g.items.map(({ row, index }) => (
                    <li
                      key={`${row.generationId}:${row.engineId}`}
                      className="flex items-center gap-3 px-3 py-1.5 type-body-s"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="text-ink-1">{row.label}</span>
                        <span className="text-ink-3">
                          {" "}
                          · {row.engineLabel ?? "svi motori"}
                          {row.yearFrom || row.yearTo
                            ? ` · ${row.yearFrom ?? "…"}–${row.yearTo ?? "…"}`
                            : ""}
                          {row.note ? ` · ${row.note}` : ""}
                        </span>
                      </span>
                      <IconButton
                        label={`Ukloni ${row.label}`}
                        icon={<TrashIcon size={16} />}
                        size="sm"
                        onClick={() => onChange(rows.filter((_, j) => j !== index))}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          {rows.length > COLLAPSE_AT ? (
            <Button
              variant="ghost"
              size="sm"
              className="self-start"
              aria-expanded={expanded}
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? "Prikaži manje" : `Prikaži sva vozila (${rows.length})`}
            </Button>
          ) : null}
          <p className="type-caption text-ink-3">
            {rows.length} {rows.length === 1 ? "vozilo" : "vozila"} · najviše {MAX}
          </p>
        </div>
      )}
      <fieldset className="flex flex-col gap-3 rounded-md border border-dashed border-line-strong p-3">
        <legend className="px-1 type-body-s font-semibold">Dodaj vozilo</legend>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="Marka">
            <Select
              size="sm"
              placeholder="Izaberite"
              value={brandId}
              onChange={(e) => {
                setBrandId(e.target.value);
                setModelId("");
                setGenerationId("");
                setEngineId("");
              }}
              options={(tree ?? []).map((b) => ({ value: b.brand._id, label: b.brand.name }))}
            />
          </Field>
          <Field label="Model">
            <Select
              size="sm"
              placeholder="Izaberite"
              disabled={!brand}
              value={modelId}
              onChange={(e) => {
                setModelId(e.target.value);
                setGenerationId("");
                setEngineId("");
              }}
              options={(brand?.models ?? []).map((m) => ({
                value: m.model._id,
                label: m.model.name,
              }))}
            />
          </Field>
          <Field label="Generacija">
            <Select
              size="sm"
              placeholder="Izaberite"
              disabled={!model}
              value={generationId}
              onChange={(e) => {
                setGenerationId(e.target.value);
                setEngineId("");
              }}
              options={(model?.generations ?? []).map((g) => ({
                value: g._id,
                label: `${g.name}${g.code ? ` (${g.code})` : ""} · ${g.yearFrom}–${g.yearTo ?? "danas"}`,
              }))}
            />
          </Field>
          <Field label="Motor">
            <Select
              size="sm"
              placeholder="Svi motori"
              disabled={!generation}
              value={engineId}
              onChange={(e) => setEngineId(e.target.value)}
              options={(engines ?? []).map((en) => ({
                value: en._id,
                label: `${formatEngine(en.name, en.powerKw)}${en.codes.length ? ` · ${en.codes.slice(0, 3).join(", ")}` : ""}`,
              }))}
            />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-[8rem_8rem_minmax(0,1fr)]">
          <Field label="Od godine">
            <Input
              value={yearFrom}
              onChange={(e) => setYearFrom(e.target.value)}
              inputMode="numeric"
              className="h-9"
            />
          </Field>
          <Field label="Do godine">
            <Input
              value={yearTo}
              onChange={(e) => setYearTo(e.target.value)}
              inputMode="numeric"
              className="h-9"
            />
          </Field>
          <Field label="Napomena">
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="npr. samo za vozila sa start-stop sistemom"
              className="h-9"
            />
          </Field>
        </div>
        {error ? (
          <p role="alert" className="type-body-s text-danger">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            icon={<PlusIcon size={16} />}
            disabled={!generation}
            onClick={() => generation && add([generation], true)}
          >
            Dodaj
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={!model}
            onClick={() => model && add(model.generations, false)}
          >
            Dodaj sve generacije modela
          </Button>
        </div>
      </fieldset>
    </div>
  );
}
