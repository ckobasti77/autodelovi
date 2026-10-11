import type { Metadata } from "next";
import Image from "next/image";

import { BLOCK_REVEAL, REVEAL_LINE, REVEAL_TALL_RATIO } from "@/constants/revealConfig";
import { categoryImage } from "@/lib/catalog/types";
import { SiteShell } from "@/components/shell/SiteShell";
import { Reveal, RevealGroup, RevealItem } from "@/components/reveal/Reveal";
import { RevealText } from "@/components/text-reveal/RevealText";
import { RevealMore } from "../_components/RevealMore";

export const metadata: Metadata = {
  title: "Otkrivanje pri skrolovanju",
  description: "Pravilo okidanja, redosled i varijante otkrivanja blokova i teksta.",
  robots: { index: false, follow: false },
};

/** Category renders used as sample cards (names as in the catalog). */
const PARTS = [
  ["kocioni-diskovi", "Kočioni diskovi"],
  ["kocione-plocice", "Kočione pločice"],
  ["kocione-celjusti", "Kočione čeljusti"],
  ["amortizeri-opruge", "Amortizeri i opruge"],
  ["turbina", "Turbina"],
  ["interkuler", "Interkuler"],
  ["alternator", "Alternator"],
  ["anlaser", "Anlaser"],
  ["kvacilo-zamajac", "Kvačilo i zamajac"],
  ["menjac", "Menjač"],
  ["akumulator", "Akumulator"],
  ["farovi", "Farovi"],
] as const;

const FIRST_SCREEN = PARTS.slice(0, 4);
const linePercent = Math.round((1 - REVEAL_LINE) * 100);

function PartCard({ slug, name }: { slug: string; name: string }) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-md border border-line bg-surface-1">
      <div className="relative aspect-[4/3] bg-[radial-gradient(circle_at_50%_45%,var(--color-surface-3),var(--color-surface-1)_70%)]">
        <Image
          src={categoryImage(slug)}
          alt=""
          fill
          sizes="(min-width: 1024px) 22vw, 50vw"
          className="object-contain p-[10%]"
        />
      </div>
      <div className="border-t border-line p-3 sm:p-4">
        <h3 className="type-h4 text-ink-1">{name}</h3>
        <p className="type-code-s text-ink-3">{slug}</p>
      </div>
    </div>
  );
}

/**
 * Reveal lab: every case of the site-wide reveal on one page. The owner sees how blocks and
 * copy arrive; tests/e2e/reveal.spec.ts checks the rule against the same markup.
 */
export default function RevealLabPage() {
  return (
    <SiteShell>
      <div className="px-page pb-24">
        <header className="flex min-h-[calc(100svh+6rem)] flex-col gap-8 pt-10">
          <div className="flex flex-col gap-4">
            <RevealText as="h1" className="type-display-l text-ink-1">
              Otkrivanje pri skrolovanju
            </RevealText>
            <RevealText as="p" className="max-w-[62ch] type-lead text-ink-2">
              {`Blok se pojavljuje kad njegova sredina pređe liniju na ${linePercent} % visine ekrana. Tekst stiže reč po reč, kartice jedna za drugom.`}
            </RevealText>
          </div>

          <RevealGroup
            as="ul"
            data-testid="reveal-eager"
            className="grid grid-cols-2 gap-3 sm:gap-(--gutter) lg:grid-cols-4"
          >
            {FIRST_SCREEN.map(([slug, name], index) => (
              <RevealItem as="li" key={slug} eager index={index}>
                <PartCard slug={slug} name={name} />
              </RevealItem>
            ))}
          </RevealGroup>

          <dl className="grid max-w-[46rem] grid-cols-2 gap-x-(--gutter) gap-y-4 border-t border-line pt-6 sm:grid-cols-4">
            <div>
              <dt className="type-label text-ink-3">Linija</dt>
              <dd className="type-numeral-s text-ink-1" data-reveal="off">
                {linePercent}&nbsp;%
              </dd>
            </div>
            <div>
              <dt className="type-label text-ink-3">Trajanje</dt>
              <dd className="type-numeral-s text-ink-1" data-reveal="off">
                {BLOCK_REVEAL.default.durationMs}&nbsp;ms
              </dd>
            </div>
            <div>
              <dt className="type-label text-ink-3">Razmak</dt>
              <dd className="type-numeral-s text-ink-1" data-reveal="off">
                {BLOCK_REVEAL.default.stepMs}&nbsp;ms
              </dd>
            </div>
            <div>
              <dt className="type-label text-ink-3">Visok blok</dt>
              <dd className="type-numeral-s text-ink-1" data-reveal="off">
                &gt;&nbsp;{Math.round(REVEAL_TALL_RATIO * 100)}&nbsp;%
              </dd>
            </div>
          </dl>
        </header>

        <section
          aria-labelledby="lab-solo"
          className="flex flex-col gap-6 border-t border-line py-16"
        >
          <h2 id="lab-solo" className="type-display-m text-ink-1">
            Jedan blok
          </h2>
          <p className="max-w-[62ch] type-body text-ink-2">
            Naslov i pasus stižu reč po reč. Blok ispod stiže kao celina: providnost i kratko
            podizanje, jednom, bez vraćanja kad se stranica skroluje nagore.
          </p>
          <Reveal
            data-testid="reveal-solo"
            className="flex max-w-[46rem] flex-col gap-2 rounded-md border border-line bg-surface-1 p-5"
          >
            <h3 className="type-h4 text-ink-1">Ne nalazite deo?</h3>
            <p className="type-body-s text-ink-2">
              Pošaljite broj šasije i šta vam treba. Tekst u bloku stiže zajedno sa blokom.
            </p>
          </Reveal>
        </section>

        <section
          aria-labelledby="lab-grid"
          className="flex flex-col gap-6 border-t border-line py-16"
        >
          <h2 id="lab-grid" className="type-display-m text-ink-1">
            Mreža kartica
          </h2>
          <p className="max-w-[62ch] type-body text-ink-2">
            Kartice koje zajedno pređu liniju čine jednu grupu: pojavljuju se red po red, sleva
            nadesno.
          </p>
          <RevealGroup
            as="ul"
            data-testid="reveal-grid"
            className="grid grid-cols-2 gap-3 sm:gap-(--gutter) lg:grid-cols-4"
          >
            {PARTS.map(([slug, name]) => (
              <RevealItem as="li" key={slug}>
                <PartCard slug={slug} name={name} />
              </RevealItem>
            ))}
          </RevealGroup>
        </section>

        <section
          aria-labelledby="lab-tall"
          className="flex flex-col gap-6 border-t border-line py-16"
        >
          <h2 id="lab-tall" className="type-display-m text-ink-1">
            Visok blok
          </h2>
          <Reveal
            data-testid="reveal-tall"
            className="flex min-h-[90svh] flex-col justify-between rounded-lg border border-line bg-bg-raised p-6"
          >
            <p className="max-w-[52ch] type-body text-ink-2">
              Blok viši od {Math.round(REVEAL_TALL_RATIO * 100)}&nbsp;% ekrana ne čeka svoju
              sredinu: pojavljuje se čim mu gornja ivica pređe liniju.
            </p>
            <p className="type-code-s text-ink-3">kraj visokog bloka</p>
          </Reveal>
        </section>

        <section
          aria-labelledby="lab-cv"
          className="cv-auto flex flex-col gap-6 border-t border-line py-16"
        >
          <h2 id="lab-cv" className="type-display-m text-ink-1">
            Odloženo iscrtavanje
          </h2>
          <p className="max-w-[62ch] type-body text-ink-2">
            Odeljak koji pregledač iscrtava tek kad se približi ekranu otkriva se isto kao i ostali.
          </p>
          <RevealGroup
            as="ul"
            data-testid="reveal-cv"
            className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-(--gutter)"
          >
            {PARTS.slice(4, 7).map(([slug, name]) => (
              <RevealItem as="li" key={slug} className="panel p-4">
                <h3 className="type-h4 text-ink-1">{name}</h3>
                <p className="type-code-s text-ink-3">{slug}</p>
              </RevealItem>
            ))}
          </RevealGroup>
        </section>

        <section
          aria-labelledby="lab-more"
          className="flex flex-col gap-6 border-t border-line py-16"
        >
          <h2 id="lab-more" className="type-display-m text-ink-1">
            Naknadno dodate stavke
          </h2>
          <p className="max-w-[62ch] type-body text-ink-2">
            Filteri, sledeća strana i „prikaži još“ dodaju stavke posle učitavanja. I one stižu
            jedna za drugom.
          </p>
          <RevealMore items={PARTS.slice(7).map(([slug, name]) => ({ slug, name }))} />
        </section>

        <section
          aria-labelledby="lab-lite"
          data-theme="paper"
          data-reveal-tone="lite"
          className="flex flex-col gap-4 rounded-lg border border-line p-6"
        >
          <h2 id="lab-lite" className="type-h3 text-ink-1">
            Lakša varijanta za administraciju
          </h2>
          <RevealGroup
            as="ul"
            data-testid="reveal-lite"
            className="flex flex-col divide-y divide-line-faint rounded-md border border-line bg-surface-1"
          >
            {PARTS.slice(0, 5).map(([slug, name]) => (
              <RevealItem
                as="li"
                key={slug}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <span className="type-body-s text-ink-1">{name}</span>
                <span className="type-code-s text-ink-3">{slug}</span>
              </RevealItem>
            ))}
          </RevealGroup>
        </section>
      </div>
    </SiteShell>
  );
}
