import { contrastRows, swatches, type Swatch } from "../_lib/tokens";
import { Group, Section } from "./Section";

function SwatchGrid({ items }: { items: Swatch[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {items.map((swatch) => (
        <li key={swatch.token} className="flex flex-col gap-2">
          <span
            aria-hidden="true"
            className="block h-16 rounded-md border border-line"
            style={{ background: `var(${swatch.cssVar})` }}
          />
          <span className="flex flex-col">
            <span className="type-code text-ink-1">{swatch.token}</span>
            <span className="type-code-s text-ink-3">{swatch.hex}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

const SPACING = [
  ["0.5", "2 px"],
  ["1", "4 px"],
  ["2", "8 px"],
  ["3", "12 px"],
  ["4", "16 px"],
  ["5", "20 px"],
  ["6", "24 px"],
  ["8", "32 px"],
  ["10", "40 px"],
  ["12", "48 px"],
  ["16", "64 px"],
  ["20", "80 px"],
  ["24", "96 px"],
  ["32", "128 px"],
] as const;

const SPACING_WIDTH: Record<string, string> = {
  "0.5": "w-0.5",
  "1": "w-1",
  "2": "w-2",
  "3": "w-3",
  "4": "w-4",
  "5": "w-5",
  "6": "w-6",
  "8": "w-8",
  "10": "w-10",
  "12": "w-12",
  "16": "w-16",
  "20": "w-20",
  "24": "w-24",
  "32": "w-32",
};

const RADII = [
  ["rounded-xs", "4 px: čipovi, bedževi, polja za potvrdu"],
  ["rounded-sm", "6 px: dugmad, polja, mali kadrovi"],
  ["rounded-md", "8 px: kartice, paneli, tabele, meniji"],
  ["rounded-lg", "10 px: slike, crteži, kadar 3D prikaza"],
  ["rounded-xl", "12 px: dijalozi, veliki paneli"],
  ["rounded-2xl", "14 px: gornji uglovi donjeg panela"],
  ["rounded-full", "999 px: brojači, prekidači"],
] as const;

const Z = [
  ["raised", 10],
  ["sticky", 20],
  ["header", 30],
  ["dropdown", 40],
  ["overlay", 50],
  ["drawer", 60],
  ["dialog", 70],
  ["toast", 80],
  ["tooltip", 90],
  ["skip", 100],
] as const;

export function Tokens() {
  const rows = contrastRows();
  const failing = rows.filter((row) => row.ratio < row.min).length;

  return (
    <>
      <Section
        id="boje"
        title="Boje"
        intro="Noćna tema za prodavnicu, papirna za administraciju. Komponente koriste samo ove tokene; narandžasta znači „vaše“ ili „sledeće“."
      >
        <Group
          title="Noć (prodavnica)"
          note="Promenljive na :root&nbsp;— utility klase čitaju var(--color-*)."
        >
          <SwatchGrid items={swatches("night")} />
        </Group>
        <Group
          title="Papir (administracija)"
          note='Isti nazivi, druge vrednosti pod data-theme="paper".'
        >
          <div data-theme="paper" className="rounded-md p-5">
            <SwatchGrid items={swatches("paper")} />
          </div>
        </Group>
        <Group
          title="Kontrast (WCAG 2.2)"
          note={`${rows.length} parova iz docs/design/tokens.json, izračunato pri renderu\u00a0— ${failing === 0 ? "nijedan ne pada" : `${failing} ispod praga`}.`}
        >
          <div
            className="overflow-x-auto rounded-md border border-line"
            tabIndex={0}
            role="region"
            aria-label="Tabela kontrasta"
          >
            <table className="w-full min-w-[640px] border-collapse text-left type-body-s">
              <caption className="sr-only">Kontrast parova boja</caption>
              <thead>
                <tr className="bg-surface-2">
                  <th scope="col" className="h-9 px-3 type-label text-ink-3">
                    Upotreba
                  </th>
                  <th scope="col" className="px-3 type-label text-ink-3">
                    Uzorak
                  </th>
                  <th scope="col" className="px-3 text-right type-label text-ink-3">
                    Odnos
                  </th>
                  <th scope="col" className="px-3 text-right type-label text-ink-3">
                    Prag
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.use}-${row.fg}-${row.bg}`} className="border-t border-line-faint">
                    <td className="h-10 px-3 text-ink-2">{row.use}</td>
                    <td className="px-3">
                      {row.min >= 4.5 ? (
                        <span
                          className="inline-flex h-7 items-center rounded-xs px-2 type-caption"
                          style={{ background: row.bgHex, color: row.fgHex }}
                        >
                          Aa 12.990
                        </span>
                      ) : (
                        // Non-text pair (UI edge, graphic, decorative or exempt): shown as a stroke, not as text.
                        <span
                          aria-hidden="true"
                          className="inline-flex h-7 w-24 items-center justify-center rounded-xs"
                          style={{ background: row.bgHex }}
                        >
                          <span className="block h-0.5 w-16" style={{ background: row.fgHex }} />
                        </span>
                      )}
                    </td>
                    <td className="px-3 text-right tabular-nums text-ink-1">
                      {row.ratio.toFixed(2)}:1
                    </td>
                    <td className="px-3 text-right tabular-nums text-ink-3">{row.min}:1</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Group>
      </Section>

      <Section
        id="prostor"
        title="Prostor i oblik"
        intro="Osnova 4 px, sekcije dišu fluidno (64 → 128 px), sadržaj nikad šire od 1440 px."
      >
        <Group
          title="Razmaci"
          note="Tailwind --spacing: 0.25rem; unutar komponenti 4 / 8 / 12 / 16."
        >
          <ul className="flex flex-col gap-2">
            {SPACING.map(([step, px]) => (
              <li key={step} className="flex items-center gap-4">
                <span className="w-16 type-code-s text-ink-3">{step}</span>
                <span aria-hidden="true" className={`block h-3 rounded-xs bg-accent ${SPACING_WIDTH[step]}`} />
                <span className="type-code-s text-ink-3">{px}</span>
              </li>
            ))}
          </ul>
        </Group>
        <Group
          title="Radijusi"
          note="Mali, meki uglovi na svakoj kutiji. Unutrašnji ugao je spoljni umanjen za razmak. Četvrtasti ostaju samo crteži: ugaone oznake, linije i kote."
        >
          <ul className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-7">
            {RADII.map(([cls, note]) => (
              <li key={cls} className="flex flex-col gap-2">
                <span
                  aria-hidden="true"
                  className={`block h-16 border border-line-strong bg-surface-2 ${cls}`}
                />
                <span className="type-code text-ink-1">{cls}</span>
                <span className="type-caption-s text-ink-3">{note}</span>
              </li>
            ))}
          </ul>
        </Group>
        <Group
          title="Elevacija"
          note="Noć: ivica i svetlo odozgo&nbsp;— osvetljena gornja ivica, a ono što lebdi ima kratku kontaktnu senku. Papir: paneli imaju ivicu, plutajuće stvari meku senku."
        >
          <div className="grid gap-6 md:grid-cols-2">
            <div className="flex flex-col gap-4 rounded-lg border border-line p-6">
              <span className="type-label text-ink-3">Noć</span>
              <div className="panel p-4 type-body-s text-ink-2">
                Nivo 1&nbsp;— panel
              </div>
              <div className="panel-raised p-4 type-body-s text-ink-2">
                Nivo 2&nbsp;— izdignut
              </div>
              <div className="rounded-md border border-edge-overlay bg-surface-3 p-4 type-body-s text-ink-2 shadow-overlay">
                Nivo 3&nbsp;— popover
              </div>
            </div>
            <div data-theme="paper" className="flex flex-col gap-4 rounded-lg p-6">
              <span className="type-label text-ink-3">Papir</span>
              <div className="panel p-4 type-body-s text-ink-2">
                Nivo 1&nbsp;— panel
              </div>
              <div className="panel-raised p-4 type-body-s text-ink-2">
                Nivo 2&nbsp;— izdignut
              </div>
              <div className="rounded-md border border-edge-overlay bg-surface-3 p-4 type-body-s text-ink-2 shadow-overlay">
                Nivo 3&nbsp;— popover
              </div>
            </div>
          </div>
        </Group>
        <Group title="Slojevi (z-index)">
          <ol className="flex flex-wrap gap-2">
            {Z.map(([name, value]) => (
              <li
                key={name}
                className="inline-flex h-8 items-center gap-2 rounded-xs border border-line px-2.5 type-code text-ink-2"
              >
                z-{name} <span className="text-ink-3">{value}</span>
              </li>
            ))}
          </ol>
        </Group>
      </Section>
    </>
  );
}
