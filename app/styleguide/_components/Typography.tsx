import { Group, Section } from "./Section";

const STYLES = [
  {
    cls: "type-display-xl",
    spec: "Archivo Expanded 700 · 36 → 64 px · 1.0 · verzal",
    sample: "Rasklopi auto.",
  },
  {
    cls: "type-display-l",
    spec: "Archivo Expanded 600 · 28 → 44 px · 1.04 · verzal",
    sample: "Kočioni diskovi",
  },
  {
    cls: "type-display-m",
    spec: "Archivo Expanded 600 · 20 → 26 px · 1.1 · verzal",
    sample: "Turbina i usis",
  },
  {
    cls: "type-numeral-xl",
    spec: "Archivo Condensed 600 · 40 → 64 px · tabularne cifre",
    sample: "187",
  },
  { cls: "type-numeral-l", spec: "Archivo Condensed 600 · 30 → 40 px", sample: "12.990" },
  { cls: "type-numeral-m", spec: "Archivo Condensed 600 · 22 → 26 px", sample: "4.290" },
  { cls: "type-numeral-s", spec: "Archivo Condensed 600 · 18 → 20 px", sample: "03 / 07" },
  {
    cls: "type-h1",
    spec: "Public Sans 650 · 26 → 36 px · −0.015em",
    sample: "Kočioni disk prednji, Ø 312 mm",
  },
  {
    cls: "type-h2",
    spec: "Public Sans 650 · 22 → 28 px · −0.01em",
    sample: "Kompatibilnost sa vozilima",
  },
  { cls: "type-h3", spec: "Public Sans 600 · 18 → 20 px", sample: "Dostava i plaćanje" },
  { cls: "type-h4", spec: "Public Sans 600 · 16 px", sample: "Pločice kočnica, prednje" },
  {
    cls: "type-lead",
    spec: "Public Sans 400 · 18 → 20 px · 1.5",
    sample: "Delovi za VW, Audi, Škoda, SEAT i Cupra\u00a0— po OEM broju, vozilu ili broju šasije.",
  },
  {
    cls: "type-body",
    spec: "Public Sans 400 · 16 px · 1.55",
    sample:
      "Pre zamene proverite broj na kućištu turbine. Ako se ne poklapa, pošaljite nam broj šasije i javićemo vam koji deo odgovara.",
  },
  {
    cls: "type-body-s",
    spec: "Public Sans 400 · 14 px · 1.5",
    sample: "Plaćate pouzećem kuriru pri preuzimanju.",
  },
  { cls: "type-caption", spec: "Public Sans 500 · 13 px", sample: "Na stanju · 4 kom." },
  { cls: "type-caption-s", spec: "Public Sans 500 · 12 px", sample: "sa PDV-om" },
  { cls: "type-button", spec: "Public Sans 600 · 15 px", sample: "Dodaj u korpu" },
  {
    cls: "type-label",
    spec: "Public Sans 600 · 11 px · 0.06em · verzal",
    sample: "Status porudžbine",
  },
  { cls: "type-code-l", spec: "Martian Mono 500 · 16 px", sample: "1K0 615 301 AA" },
  { cls: "type-code", spec: "Martian Mono 400 · 13 px", sample: "SK-2026-000187" },
  {
    cls: "type-code-s",
    spec: "Martian Mono 400 · 11 px · 0.04em · verzal",
    sample: "Ø 312 · 4280 mm",
  },
] as const;

export function Typography() {
  return (
    <Section
      id="tipografija"
      title="Tipografija"
      intro="Hijerarhija iz težine, veličine i slova zajedno. Široki verzal za izjave marke, Public Sans za zadatke, Martian Mono samo za kodove i mere."
    >
      <Group
        title="Stilovi"
        note="Klasa type-* nosi porodicu, veličinu, težinu, prored i razmak slova."
      >
        <ul className="flex flex-col divide-y divide-line-faint">
          {STYLES.map((style) => (
            <li key={style.cls} className="grid gap-2 py-5 md:grid-cols-[14rem_1fr] md:gap-8">
              <span className="flex flex-col gap-1">
                <span className="type-code text-ink-1">{style.cls}</span>
                <span className="type-caption-s text-ink-3">{style.spec}</span>
              </span>
              <span className={`${style.cls} text-ink-1`} data-reveal="off">
                {style.sample}
              </span>
            </li>
          ))}
        </ul>
      </Group>
      <Group
        title="Latinica sa dijakritikom"
        note="Sve porodice imaju č ć ž š đ i velika slova (proverilo fontkit)."
      >
        <p className="type-display-l text-ink-1" data-reveal="off">
          Č Ć Ž Š Đ · č ć ž š đ
        </p>
        <p className="type-body text-ink-2" data-reveal="off">
          Đak čuva šešir, žuti ćup i džep&nbsp;— „navodnici“ i crta&nbsp;— bez prekida.
        </p>
        <p className="type-code-l text-ink-1" data-reveal="off">
          0O 1lI 5S 8B · 03L 115 562 · WVWZZZ1KZ8W000001
        </p>
      </Group>
    </Section>
  );
}
