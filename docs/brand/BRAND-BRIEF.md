# Brand brief — Euromotors Plus by OEM Parts

> Step 24 (2026-10-11). Input for the logo work in `docs/brand/`. Sources: `pipeline/BRIEF.md`, `docs/design/DESIGN-SYSTEM.md` („Rendgen“), the two current logos in `docs/brand/source/`. Owner-facing summary (Serbian): [LOGO.md](LOGO.md). Decisions: `docs/DECISIONS.md` D299–D306.

## 1. Who they are

A parts dealer in Serbia selling **genuine and OEM-quality parts for the Volkswagen Group** — Volkswagen, Audi, Škoda, SEAT, Cupra. Two kinds of buyers:

- **Mechanics and workshops** (repeat buyers, on a phone in the workshop) — they order by OEM number, want their own price and a fast answer.
- **Car owners** (often arriving from an ad or search) — they want to know: does it fit, is it in stock, how much, when.

The shop is independent. It is not an authorised dealer or service partner of any VAG brand, and the identity must never suggest that it is.

## 2. The two names

| Name | What it is | Who knows it |
|---|---|---|
| **Euromotors Plus** | The company — the legal entity on invoices, pro-forma invoices, contracts and the bank account. | Suppliers, accountants, companies that buy on invoice. |
| **OEM Parts** | The shop name — what is on people's phones, what mechanics say when they recommend the shop. | Car owners and mechanics. This is the name with recognition. |

Relationship: **„Euromotors Plus by OEM Parts“** — the company name leads, the shop name signs it. The new identity has to hold both without looking like two logos glued together: someone who knows *OEM Parts* must recognise it at a glance, and someone reading an invoice must see *Euromotors Plus*.

The working name „SKLOP“ was a placeholder from the product brief and disappears in step 25.

### What the current logos give us

| Logo | Keep | Drop |
|---|---|---|
| `source/euromotors-plus-current.jpg` (navy serif wordmark, „PLUS“ between two rules, small-caps „OEM PARTS“, partial ring of hand-drawn stars) | The hierarchy *Euromotors › Plus › OEM Parts*; the rule as a separating device; one graphic sign beside the name; the open ring shape (it leaves room for the name). | The generic serif; uneven clip-art stars; navy as the only colour; the empty canvas around the mark; the lack of a small-size version. |
| `source/oem-parts-current.webp` (white bold italic „OEM“, a thin rule, an outlined italic „Parts“ right-aligned under it, on black) | The **grammar**: solid bold italic word → hairline rule → outlined italic „Parts“ set smaller and to the right. Wide, squarish letterforms. White on dark. | Low resolution, uneven outline weight, no vector original. |

## 3. What the mark must say

1. **Genuine quality** — the part is what the number says it is. Exact, not decorated.
2. **European** — parts for European cars, from European suppliers. A nod, not a flag.
3. **Precise** — built on a grid, one stroke logic, nothing approximate. It should look as if it could be milled.
4. **Trustworthy** — calm, sturdy, legible; no tuning-shop drama, no discount-sticker energy.
5. **Modern** — at home next to the „Rendgen“ interface: graphite night field `#0D0F11`, warm ink `#F1ECE3`, one signal orange `#FF6B1A`, Archivo wide capitals, hairlines and measured ornament.

Voice of the brand (from the product brief): an experienced mechanic talking to a colleague. The logo should sound the same — short and sure.

## 4. Where it lives

| Place | Constraint |
|---|---|
| Site header on the night field | 28–40 px tall, next to navigation; must stay legible at 28 px and on a 360 px wide phone. |
| Favicon | 16 px (also 32 and 48). One shape, pixel-snapped, recognisable in a row of tabs. |
| App icon / PWA / apple-touch-icon | 180, 192, 512 px, maskable safe zone (80 %). |
| E-mail header | On white, 2× PNG (clients block SVG), survives dark-mode inversion. |
| Admin (paper theme) | On `#FFFFFF` / `#F3F4F5`, small (sidebar, login). |
| Documents and print | Predračun, otpremnica: one colour, black on white, laser printer, stamp. |
| Shop sign | Cut vinyl or illuminated letters: closed shapes, no hairline thinner than the cutter can hold, works in one colour. |
| Van | Large, seen for two seconds in traffic: the name first. |
| Social avatar | 1000 × 1000, cropped to a circle by the platform. |

Consequences: a **responsive system** (full lockup → wordmark → compact mark), every element also solid in one colour, and nothing that depends on a gradient, a shadow or a second colour to be understood.

## 5. What to avoid

- **Shapes and colours of the VAG brands:** the VW roundel and VW blue, the four Audi rings (and any row of interlocked rings), the Škoda winged arrow and green, the SEAT „S“ and copper, the Cupra tribal triangle. No ring-with-letters composition that could be mistaken for a car badge.
- **Anything that suggests an official dealer or service partner:** no „authorized“, „official“, „genuine parts“ as a claim inside the logo, no shield or badge in the style of a manufacturer's partner sign.
- **Clip-art stars** and any effect that breaks in one colour: gradients, glows, bevels, drop shadows, thin overlapping transparencies.
- **The EU emblem:** twelve gold five-pointed stars in a circle on blue. It is a protected emblem (Article 6ter of the Paris Convention) and trademark offices refuse marks that contain or imitate it. An abstract nod to „Euro“ is fine; a circle of stars is not. No blue-and-gold pairing either.
- **Competitor clichés in the Serbian parts market:** a gear with a wrench, a piston, a car silhouette, a chequered flag, red-and-black „racing“ type.
- **Generic interface symbols** used unchanged (a plain plus in a circle reads as an „add“ button on our own site).
- **Typography that fights the site:** serifs, script, sci-fi display faces.

## 6. How concepts are judged

Each concept gets 1–5 on six criteria (weights in brackets):

1. Legibility at 16 px (×3)
2. One-colour reproduction (×2)
3. Distinctiveness from competitors and from the VAG brands (×2)
4. Fit with „Rendgen“ (×2)
5. Memorability (×2)
6. How clearly it carries both names (×3)

The best two or three then go through a design critique before one is chosen (`docs/brand/concepts/README.md`).

## 7. Deliverables

Lockups (horizontal, stacked, wordmark, compact mark) × colour variants (night, paper, one-colour black, one-colour white, orange on dark where it suits) as optimised SVG, PNG 1×/2×/4× and vector PDF; favicon set; e-mail header; social avatar; a brand board for the client; usage rules for the owner. Paths: `public/brand/` (web) and `docs/brand/export/` (owner's kit).
