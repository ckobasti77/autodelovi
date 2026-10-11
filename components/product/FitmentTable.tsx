import type { FitmentRow } from "@/lib/catalog/types";
import { Disclosure } from "@/components/ui/Disclosure";

const years = (r: FitmentRow) => (r.yearFrom ? `${r.yearFrom}–${r.yearTo ?? ""}` : "");

const HEAD = [
  { label: "Marka", className: "" },
  { label: "Model / generacija", className: "" },
  { label: "Godine", className: "hidden sm:table-cell" },
  { label: "Motor", className: "" },
  { label: "Napomena", className: "hidden md:table-cell" },
];

function Table({ rows, caption }: { rows: FitmentRow[]; caption?: string }) {
  return (
    <div className="overflow-x-auto rounded-md border border-line">
      <table className="w-full border-collapse type-body-s">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead className="bg-surface-2">
          <tr>
            {HEAD.map((h) => (
              <th
                key={h.label}
                scope="col"
                className={`border-b border-line-strong px-3 py-2.5 text-left type-label uppercase text-ink-3 ${h.className}`}
              >
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={`${r.generationId}-${r.engineId ?? "all"}-${i}`}
              className="border-b border-line last:border-b-0"
            >
              <td className="px-3 py-2.5 text-ink-2">{r.brandName}</td>
              <td className="px-3 py-2.5 text-ink-1">
                {r.generationName}
                <span className="block type-caption font-normal text-ink-3 sm:hidden">
                  {years(r)}
                </span>
              </td>
              <td className="hidden px-3 py-2.5 tabular-nums text-ink-2 sm:table-cell">
                {years(r)}
              </td>
              <td className="px-3 py-2.5 text-ink-2">
                {r.engineName ? (
                  <>
                    {r.engineName}
                    {r.engineCodes.length ? (
                      <span className="block type-code-s text-ink-3">
                        {r.engineCodes.join(", ")}
                      </span>
                    ) : null}
                  </>
                ) : (
                  <span className="text-ink-3">Svi motori</span>
                )}
              </td>
              <td className="hidden px-3 py-2.5 text-ink-3 md:table-cell">{r.note ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Fitment table (§10.3): make, generation, years, engine (codes in mono), note. */
export function FitmentTable({ rows }: { rows: FitmentRow[] }) {
  const sorted = [...rows].sort(
    (a, b) =>
      a.brandName.localeCompare(b.brandName) ||
      a.modelName.localeCompare(b.modelName) ||
      (a.yearFrom ?? 0) - (b.yearFrom ?? 0),
  );
  const first = sorted.slice(0, 12);
  const rest = sorted.slice(12);
  return (
    <div className="flex flex-col gap-3" data-reveal="off">
      <Table rows={first} caption="Vozila za koja deo odgovara" />
      {rest.length ? (
        <Disclosure
          className="group"
          summaryClassName="inline-flex min-h-11 items-center type-body-s font-semibold text-ink-1 underline decoration-line-strong underline-offset-4 hover:decoration-accent"
          summary={
            <>
              <span className="group-open:hidden">Prikaži još {rest.length}</span>
              <span className="hidden group-open:inline">Prikaži manje</span>
            </>
          }
          contentClassName="pt-3"
        >
          <Table rows={rest} />
        </Disclosure>
      ) : null}
    </div>
  );
}
