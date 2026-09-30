/**
 * Spec drawing (DESIGN-SYSTEM §5.7 „dimension lines“): a true-to-data technical sketch of a
 * brake disc — front view with Ø and a side section with the thickness. Only rendered when the
 * product specs carry both values; the numbers are the product's own (instrument truth).
 * Decorative duplicate of the spec table → aria-hidden.
 */
export function discDimensions(
  specs: { label: string; value: string; unit?: string }[],
): { diameter: number; thickness: number } | null {
  const num = (label: RegExp) => {
    const s = specs.find((x) => label.test(x.label));
    const n = s ? Number(s.value.replace(",", ".")) : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const diameter = num(/prečnik/i);
  const thickness = num(/debljina/i);
  return diameter && thickness ? { diameter, thickness } : null;
}

export function SpecDrawing({ diameter, thickness }: { diameter: number; thickness: number }) {
  const R = 104;
  const scale = R / (diameter / 2);
  const t = Math.max(10, thickness * scale);
  const hub = R * 0.42;
  const sideX = 332;
  return (
    <svg viewBox="0 0 440 300" aria-hidden="true" className="h-auto w-full text-ink-3">
      <g stroke="var(--color-line-strong)" strokeWidth="1" fill="none" strokeDasharray="3 3">
        <line x1="150" y1="30" x2="150" y2="270" />
        <line x1="30" y1="150" x2="270" y2="150" />
        <line x1={150 - R} y1="150" x2={150 - R} y2="44" />
        <line x1={150 + R} y1="150" x2={150 + R} y2="44" />
        <line x1={sideX} y1={150 - R} x2={sideX} y2="258" />
        <line x1={sideX + t} y1={150 - R} x2={sideX + t} y2="258" />
      </g>
      <circle cx="150" cy="150" r={R} fill="#262B31" stroke="#8F949A" strokeWidth="1.25" />
      <circle cx="150" cy="150" r={R * 0.78} fill="none" stroke="#4F565E" strokeWidth="1" />
      <circle cx="150" cy="150" r={hub} fill="#343B43" stroke="#B0AAA1" strokeWidth="1.25" />
      {Array.from({ length: 5 }, (_, i) => {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        return (
          <circle
            key={i}
            cx={150 + Math.cos(a) * hub * 0.62}
            cy={150 + Math.sin(a) * hub * 0.62}
            r="5"
            fill="#16191D"
            stroke="#8F949A"
          />
        );
      })}
      <circle cx="150" cy="150" r={hub * 0.34} fill="#16191D" stroke="#8F949A" />
      <rect x={sideX} y={150 - R} width={t} height={R * 2} fill="#262B31" stroke="#8F949A" strokeWidth="1.25" />
      <rect x={sideX - 12} y={150 - hub} width="12" height={hub * 2} fill="#343B43" stroke="#B0AAA1" />
      <g stroke="var(--color-control)" strokeWidth="1" fill="none">
        <line x1={150 - R} y1="50" x2={150 + R} y2="50" />
        <line x1={150 - R - 5} y1="55" x2={150 - R + 5} y2="45" />
        <line x1={150 + R - 5} y1="55" x2={150 + R + 5} y2="45" />
        <line x1={sideX - 18} y1="250" x2={sideX + t + 18} y2="250" />
        <line x1={sideX - 5} y1="255" x2={sideX + 5} y2="245" />
        <line x1={sideX + t - 5} y1="255" x2={sideX + t + 5} y2="245" />
      </g>
      <g
        fill="currentColor"
        fontSize="11"
        letterSpacing="0.04em"
        textAnchor="middle"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        <rect x="116" y="41" width="68" height="16" fill="var(--color-bg)" />
        <text x="150" y="53">{`Ø ${diameter}`}</text>
        <rect x={sideX + t / 2 - 18} y="258" width="36" height="16" fill="var(--color-bg)" />
        <text x={sideX + t / 2} y="270">
          {thickness}
        </text>
        <text x="430" y="292" fontSize="10" textAnchor="end" fill="var(--color-ink-4)">
          mm
        </text>
      </g>
    </svg>
  );
}
