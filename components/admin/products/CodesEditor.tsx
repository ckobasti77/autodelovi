"use client";

/**
 * OEM and cross-reference numbers with a live normalisation preview (DESIGN-SYSTEM §10.12):
 * what staff type („1K0 615 301 AA“) and what search matches („1K0615301AA“), in mono.
 * Pasting several numbers at once (one per line, comma or semicolon) splits them.
 */
import { PlusIcon, TrashIcon } from "@phosphor-icons/react/dist/ssr";

import { normalizeCode } from "@/lib/domain/codes";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";

export type OemRow = { raw: string; brand: string };
export type CrossRow = { manufacturer: string; raw: string };

const cell =
  "h-9 w-full min-w-0 rounded-xs border border-control bg-surface-1 px-2 type-body-s text-ink-1 transition-control hover:border-ink-3 focus:border-focus focus:outline-none focus:shadow-[inset_0_0_0_1px_var(--color-focus)]";

function splitPaste(text: string): string[] {
  return text
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function Preview({ raw }: { raw: string }) {
  const n = normalizeCode(raw);
  if (!raw.trim()) return <span className="type-caption text-ink-4">—</span>;
  return (
    <span className={n.length >= 3 ? "type-code-s text-ink-2" : "type-caption text-warning"}>
      {n.length >= 3 ? n : "prekratko za pretragu"}
    </span>
  );
}

export function CodesEditor({
  oem,
  cross,
  onOem,
  onCross,
}: {
  oem: OemRow[];
  cross: CrossRow[];
  onOem: (rows: OemRow[]) => void;
  onCross: (rows: CrossRow[]) => void;
}) {
  const dupes = new Set<string>();
  const seen = new Set<string>();
  for (const r of oem) {
    const n = normalizeCode(r.raw);
    if (n && seen.has(n)) dupes.add(n);
    seen.add(n);
  }
  return (
    <div className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 type-body-s font-semibold text-ink-1">OEM brojevi</legend>
        <p className="type-caption text-ink-3">
          Prvi broj je glavni (prikazuje se na kartici). Kolona desno pokazuje kako ga pretraga
          čita.
        </p>
        {oem.map((r, i) => {
          const n = normalizeCode(r.raw);
          return (
            <div
              key={i}
              className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,1fr)_auto] items-center gap-2"
            >
              <input
                aria-label={`OEM broj ${i + 1}`}
                className={`${cell} font-mono`}
                value={r.raw}
                onChange={(e) =>
                  onOem(oem.map((x, j) => (j === i ? { ...x, raw: e.target.value } : x)))
                }
                onPaste={(e) => {
                  const parts = splitPaste(e.clipboardData.getData("text"));
                  if (parts.length > 1) {
                    e.preventDefault();
                    const rows = parts.map((raw) => ({ raw, brand: r.brand }));
                    onOem(
                      [...oem.slice(0, i), ...rows, ...oem.slice(i + 1)].filter(
                        (x, j, all) => x.raw || j === all.length - 1,
                      ),
                    );
                  }
                }}
              />
              <input
                aria-label={`Marka za OEM broj ${i + 1}`}
                placeholder="VW, Audi…"
                className={cell}
                value={r.brand}
                onChange={(e) =>
                  onOem(oem.map((x, j) => (j === i ? { ...x, brand: e.target.value } : x)))
                }
              />
              <span className="min-w-0 truncate">
                {dupes.has(n) ? (
                  <span className="type-caption text-warning">duplikat</span>
                ) : (
                  <Preview raw={r.raw} />
                )}
              </span>
              <IconButton
                label={`Ukloni OEM broj ${i + 1}`}
                icon={<TrashIcon size={16} />}
                size="sm"
                onClick={() => onOem(oem.filter((_, j) => j !== i))}
              />
            </div>
          );
        })}
        <Button
          variant="ghost"
          size="sm"
          icon={<PlusIcon size={16} />}
          className="self-start"
          onClick={() => onOem([...oem, { raw: "", brand: "" }])}
        >
          Dodaj OEM broj
        </Button>
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 type-body-s font-semibold text-ink-1">Zamenski brojevi</legend>
        <p className="type-caption text-ink-3">
          Brojevi istog dela kod drugih proizvođača (Bosch, Febi, TRW…).
        </p>
        {cross.map((r, i) => (
          <div
            key={i}
            className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)_minmax(0,1fr)_auto] items-center gap-2"
          >
            <input
              aria-label={`Proizvođač, zamenski broj ${i + 1}`}
              placeholder="Proizvođač"
              className={cell}
              value={r.manufacturer}
              onChange={(e) =>
                onCross(cross.map((x, j) => (j === i ? { ...x, manufacturer: e.target.value } : x)))
              }
            />
            <input
              aria-label={`Zamenski broj ${i + 1}`}
              className={`${cell} font-mono`}
              value={r.raw}
              onChange={(e) =>
                onCross(cross.map((x, j) => (j === i ? { ...x, raw: e.target.value } : x)))
              }
            />
            <span className="min-w-0 truncate">
              <Preview raw={r.raw} />
            </span>
            <IconButton
              label={`Ukloni zamenski broj ${i + 1}`}
              icon={<TrashIcon size={16} />}
              size="sm"
              onClick={() => onCross(cross.filter((_, j) => j !== i))}
            />
          </div>
        ))}
        <Button
          variant="ghost"
          size="sm"
          icon={<PlusIcon size={16} />}
          className="self-start"
          onClick={() => onCross([...cross, { manufacturer: "", raw: "" }])}
        >
          Dodaj zamenski broj
        </Button>
      </fieldset>
    </div>
  );
}
