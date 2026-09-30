/**
 * „Gde je broj šasije?“ (§10.7 aside): two plain drawings — the windscreen corner on the
 * driver's side and the registration document with field E — in the X-ray illustration palette.
 * The text beside them carries the information; the drawings are decorative.
 */
export function VinLocator() {
  return (
    <figure className="flex flex-col gap-4">
      <svg viewBox="0 0 320 150" aria-hidden="true" className="h-auto w-full">
        <path d="M18 132 L78 22 H300" fill="none" stroke="#4DB5D6" strokeWidth="1.25" opacity="0.7" />
        <path d="M18 132 H300" stroke="var(--color-line-strong)" strokeWidth="1" />
        <path d="M34 124 L84 34 H292 V124 Z" fill="#9FE9FF" fillOpacity="0.05" stroke="#9FE9FF" strokeWidth="1" strokeOpacity="0.5" />
        <rect x="42" y="98" width="92" height="18" rx="2" fill="#3A2012" stroke="#FF6B1A" strokeWidth="1.25" />
        <text x="88" y="111" textAnchor="middle" fontSize="9" fill="#FFB38A" style={{ fontFamily: "var(--font-mono)" }}>
          WVWZZZ1KZ8W…
        </text>
        <path d="M134 107 H188 V74" fill="none" stroke="#FF6B1A" strokeWidth="1" />
        <circle cx="188" cy="72" r="2.5" fill="#FF6B1A" />
        <text x="196" y="70" fontSize="10" fill="var(--color-ink-3)" style={{ fontFamily: "var(--font-mono)" }}>
          VETROBRAN · VOZAČ
        </text>
      </svg>
      <svg viewBox="0 0 320 130" aria-hidden="true" className="h-auto w-full">
        <rect x="20" y="10" width="280" height="110" rx="4" fill="#16191D" stroke="#8F949A" strokeWidth="1" />
        {[0, 1, 2, 3].map((i) => (
          <line key={i} x1="36" x2="190" y1={34 + i * 18} y2={34 + i * 18} stroke="#4F565E" strokeWidth="1" />
        ))}
        <rect x="200" y="62" width="86" height="22" rx="2" fill="#3A2012" stroke="#FF6B1A" strokeWidth="1.25" />
        <text x="208" y="77" fontSize="10" fill="#FFB38A" style={{ fontFamily: "var(--font-mono)" }}>
          E · 17 zn.
        </text>
        <text x="36" y="108" fontSize="10" fill="var(--color-ink-3)" style={{ fontFamily: "var(--font-mono)" }}>
          SAOBRAĆAJNA DOZVOLA
        </text>
      </svg>
      <figcaption className="flex flex-col gap-2 type-body-s text-ink-2">
        <span>Broj šasije (VIN) ima 17 znakova, bez slova I, O i Q.</span>
        <span>U saobraćajnoj dozvoli je u polju E. Na vozilu je ispod vetrobrana sa strane vozača i na nalepnici na B-stubu.</span>
      </figcaption>
    </figure>
  );
}
