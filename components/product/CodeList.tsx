import { CopyButton } from "@/components/ui/CopyButton";

/**
 * OEM and cross numbers (§9.8, principle 3): every number visible, in mono, with a copy
 * button; search accepts them in any format.
 */
export function CodeList({
  oem,
  cross,
}: {
  oem: { raw: string; brand?: string }[];
  cross: { raw: string; manufacturer: string }[];
}) {
  return (
    <div className="grid gap-8 sm:grid-cols-2">
      <div>
        <h3 className="type-label uppercase text-ink-3">OEM brojevi</h3>
        {oem.length ? (
          <ul className="mt-2 flex flex-col divide-y divide-line panel pl-4 pr-1.5">
            {oem.map((c) => (
              <li key={c.raw} className="flex items-center justify-between gap-3 py-1.5">
                <span className="flex min-w-0 flex-col">
                  <span className="type-code-l text-ink-1">{c.raw}</span>
                  {c.brand ? (
                    <span className="type-caption font-normal text-ink-3">{c.brand}</span>
                  ) : null}
                </span>
                <CopyButton
                  value={c.raw}
                  label={`Kopiraj OEM broj ${c.raw}`}
                  toastMessage="OEM broj kopiran."
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 type-body-s text-ink-3">Nema unetih OEM brojeva.</p>
        )}
      </div>
      <div>
        <h3 className="type-label uppercase text-ink-3">Zamenski brojevi</h3>
        {cross.length ? (
          <ul className="mt-2 flex flex-col divide-y divide-line panel pl-4 pr-1.5">
            {cross.map((c) => (
              <li
                key={`${c.manufacturer}-${c.raw}`}
                className="flex items-center justify-between gap-3 py-1.5"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="type-code-l text-ink-1">{c.raw}</span>
                  <span className="type-caption font-normal text-ink-3">{c.manufacturer}</span>
                </span>
                <CopyButton
                  value={c.raw}
                  label={`Kopiraj broj ${c.raw}`}
                  toastMessage="Broj kopiran."
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 type-body-s text-ink-3">Nema unetih zamenskih brojeva.</p>
        )}
      </div>
    </div>
  );
}
