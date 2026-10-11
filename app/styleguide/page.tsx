import type { Metadata } from "next";
import {
  ArrowCounterClockwiseIcon,
  ArrowRightIcon,
  ArrowSquareOutIcon,
  BellIcon,
  CarIcon,
  CarProfileIcon,
  ChatCircleTextIcon,
  CheckIcon,
  CopyIcon,
  CubeIcon,
  EnvelopeIcon,
  FileXlsIcon,
  ListBulletsIcon,
  ListIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  PhoneIcon,
  PrinterIcon,
  QuestionIcon,
  ShoppingCartSimpleIcon,
  SlidersHorizontalIcon,
  StorefrontIcon,
  TruckIcon,
  UploadIcon,
  UserCircleIcon,
  WhatsappLogoIcon,
  XIcon,
} from "@phosphor-icons/react/dist/ssr";

import { site } from "@/config/site";
import { SiteShell } from "@/components/shell/SiteShell";
import { LogoHeader, LogoLockup, LogoMark } from "@/components/brand/Logo";
import { RevealText } from "@/components/text-reveal/RevealText";
import { Group, Section } from "./_components/Section";
import { Tokens } from "./_components/Tokens";
import { Typography } from "./_components/Typography";
import { MotionLab, StaggerDemo } from "./_components/MotionLab";
import { FlexLineSample, LcpRevealDemo } from "./_components/RevealDemo";
import { GalleryControls } from "./_components/GalleryControls";
import { GalleryOverlays } from "./_components/GalleryOverlays";
import { GalleryData } from "./_components/GalleryData";
import { GalleryShell } from "./_components/GalleryShell";

export const metadata: Metadata = {
  title: "Stilski vodič",
  description: "Tokeni, tipografija, pokret i komponente dizajn sistema.",
  robots: { index: false, follow: false },
};

const TOC = [
  ["marka", "Marka"],
  ["boje", "Boje"],
  ["tipografija", "Tipografija"],
  ["prostor", "Prostor i oblik"],
  ["ikone", "Ikone"],
  ["pokret", "Pokret"],
  ["otkrivanje", "Otkrivanje teksta"],
  ["kontrole", "Kontrole i polja"],
  ["slojevi", "Slojevi"],
  ["podaci", "Podaci i navigacija"],
  ["okvir", "Okvir sajta"],
] as const;

const ICONS = [
  ["MagnifyingGlass", "pretraga", MagnifyingGlassIcon],
  ["ShoppingCartSimple", "korpa", ShoppingCartSimpleIcon],
  ["UserCircle", "nalog", UserCircleIcon],
  ["List", "meni", ListIcon],
  ["X", "zatvori", XIcon],
  ["Car", "vozilo", CarIcon],
  ["CarProfile", "vozilo (profil)", CarProfileIcon],
  ["SlidersHorizontal", "filteri", SlidersHorizontalIcon],
  ["ListBullets", "lista delova", ListBulletsIcon],
  ["Cube", "rasklopi", CubeIcon],
  ["Copy", "kopiraj", CopyIcon],
  ["Check", "kopirano", CheckIcon],
  ["Phone", "telefon", PhoneIcon],
  ["ChatCircleText", "Viber / upit", ChatCircleTextIcon],
  ["WhatsappLogo", "WhatsApp", WhatsappLogoIcon],
  ["Envelope", "e-pošta", EnvelopeIcon],
  ["MapPin", "adresa", MapPinIcon],
  ["Question", "upit", QuestionIcon],
  ["Truck", "dostava", TruckIcon],
  ["Storefront", "preuzimanje", StorefrontIcon],
  ["Bell", "obavesti me", BellIcon],
  ["Printer", "štampa", PrinterIcon],
  ["Upload", "otpremi", UploadIcon],
  ["FileXls", "Excel", FileXlsIcon],
  ["ArrowCounterClockwise", "vrati", ArrowCounterClockwiseIcon],
  ["ArrowSquareOut", "spoljni link", ArrowSquareOutIcon],
  ["ArrowRight", "dalje", ArrowRightIcon],
] as const;

const LONG_COPY =
  "Kada pasus pređe šezdeset reči, ne deli se na reči nego se pojavljuje kao celina: providnost i podizanje od šest piksela za petsto milisekundi. Tako dugačak tekst ne treperi reč po reč i ne zamara oko, a opet stiže istim ritmom kao i ostatak stranice. Ovo pravilo važi za pravne stranice, česta pitanja i opise delova, gde je tekst duži od jednog pogleda, a čitalac želi da odmah počne da čita.";

export default function StyleguidePage() {
  return (
    <SiteShell>
      <div className="px-page">
        <div className="grid gap-10 py-12 xl:grid-cols-[13rem_minmax(0,1fr)] xl:gap-16">
          <nav aria-label="Sadržaj vodiča" className="hidden xl:block">
            <ul className="sticky top-[calc(var(--header-h)+2rem)] flex flex-col gap-1 type-body-s">
              {TOC.map(([id, label]) => (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    className="inline-flex min-h-8 items-center text-ink-2 underline decoration-transparent underline-offset-4 transition-control hover:text-ink-1 hover:decoration-line-strong"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="min-w-0">
            <header className="flex flex-col gap-4 pb-6">
              <RevealText as="h1" className="type-display-xl text-ink-1">
                Stilski vodič
              </RevealText>
              <RevealText as="p" className="max-w-[62ch] type-lead text-ink-2">
                Tokeni, tipografija, pokret i komponente sistema „Rendgen“&nbsp;— živi primerci iz
                koda. Izvor istine je docs/design/DESIGN-SYSTEM.md.
              </RevealText>
            </header>

            <Section
              id="marka"
              title="Marka"
              intro="Znak: slovo E nacrtano kao zagrada koja drži plus, uz ime i potpis radnje. Narandžast je samo plus."
            >
              <div className="grid gap-6 md:grid-cols-3">
                <div className="flex aspect-[4/3] items-center justify-center corner-ticks text-ink-1">
                  <LogoMark className="h-28 w-auto" />
                </div>
                <div className="flex aspect-[4/3] items-center justify-center rounded-md border border-line bg-bg-raised px-6 text-ink-1">
                  <LogoHeader className="h-auto w-full max-w-[17rem]" />
                </div>
                <div
                  data-theme="paper"
                  className="flex aspect-[4/3] items-center justify-center rounded-md px-6 text-ink-1"
                >
                  <LogoHeader className="h-auto w-full max-w-[17rem]" />
                </div>
              </div>
              <div className="flex justify-center overflow-hidden rounded-md border border-line bg-bg-raised px-6 py-10 text-ink-1">
                <LogoLockup variant="stacked" className="h-auto w-full max-w-[21.5rem] md:hidden" />
                <LogoLockup className="hidden h-14 w-auto md:block" />
              </div>
              <p className="type-body-s text-ink-3">
                Oblik sa potpisom „by OEM Parts“ traži najmanje 56&nbsp;px visine; ispod toga ide
                oblik za zaglavlje (najmanje 28&nbsp;px), a u najmanjem prostoru samo znak. U tekstu
                se ime piše „{site.brand.name}“, a radnja „{site.brand.alternateName}“.
              </p>
            </Section>

            <Tokens />
            <Typography />

            <Section
              id="ikone"
              title="Ikone"
              intro="Phosphor, regular, boja iz teksta. 16 uz sitan tekst, 20 u dugmadi i poljima, 24 u zaglavlju, 32 u praznim stanjima."
            >
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
                {ICONS.map(([name, use, Icon]) => (
                  <li
                    key={name}
                    className="flex items-center gap-3 panel p-3"
                  >
                    <Icon size={24} aria-hidden="true" className="shrink-0 text-ink-1" />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate type-code-s normal-case text-ink-2">{name}</span>
                      <span className="truncate type-caption-s text-ink-3">{use}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Section>

            <Section
              id="pokret"
              title="Pokret"
              intro="GSAP je jedini motor animacija. Samo transform, providnost i zamućenje; smanjeno kretanje dobija trenutna stanja."
            >
              <MotionLab />
              <Group
                title="Lista (stagger)"
                note="≤ 30 ms po stavci, ≤ 360 ms ukupno, podizanje 8 px; gsap.matchMedia daje krajnje stanje uz smanjeno kretanje."
              >
                <StaggerDemo />
              </Group>
            </Section>

            <Section
              id="otkrivanje"
              title="Otkrivanje teksta"
              intro="Svaki red teksta stiže reč po reč, nasumičnim redom, dok ulazi u ekran. Niko ga ne uključuje ručno&nbsp;— dovoljna je obična semantička oznaka."
            >
              <Group
                title="Iznad pregiba (LCP)"
                note="RevealText: podela na serveru, CSS animacija od prvog kadra, bez čekanja na JavaScript."
              >
                <LcpRevealDemo />
              </Group>
              <Group
                title="Ispod pregiba (globalno)"
                note="Naslovi, pasusi, stavke liste i opisi&nbsp;— skripta ih otkriva kad pređu 15 % visine ekrana."
              >
                <div className="flex max-w-[70ch] flex-col gap-5">
                  <h4 className="type-h3 text-ink-1">Kako se poručuje bez plaćanja unapred</h4>
                  <p className="type-body text-ink-2">
                    Pošaljete porudžbinu, mi proverimo stanje i potvrdimo je telefonom ili porukom,
                    a paket plaćate kuriru pri preuzimanju.
                  </p>
                  <ul className="flex list-disc flex-col gap-2 pl-5 type-body text-ink-2">
                    <li>Broj dela upišite kako god ga imate.</li>
                    <li>Ako niste sigurni, pošaljite broj šasije.</li>
                    <li>Majstori vide svoju cenu posle prijave.</li>
                  </ul>
                  <blockquote className="border-l border-accent pl-4 type-lead text-ink-1">
                    Pre zamene proverite broj na kućištu turbine.
                  </blockquote>
                  <p className="type-body text-ink-2">{LONG_COPY}</p>
                  <FlexLineSample />
                  <p className="type-body text-ink-2" data-reveal="off">
                    Ovaj pasus ima data-reveal=&quot;off&quot; i vidljiv je odmah&nbsp;— izuzetak za
                    navigaciju, forme i žive vrednosti.
                  </p>
                </div>
              </Group>
            </Section>

            <Section
              id="kontrole"
              title="Kontrole i polja"
              intro="Sva stanja iz dizajn sistema: podrazumevano, hover, fokus, pritisnuto, onemogućeno, učitavanje, greška."
            >
              <GalleryControls />
            </Section>

            <Section
              id="slojevi"
              title="Slojevi"
              intro="Dijalozi, paneli, obaveštenja, tooltip i meniji&nbsp;— ulaze i izlaze istim putem, preko GSAP-a."
            >
              <GalleryOverlays />
            </Section>

            <Section
              id="podaci"
              title="Podaci i navigacija"
              intro="Cene, stanje, kartice, putanje, stranice, koraci, tabovi, prazna stanja i administratorska tabela."
            >
              <GalleryData />
            </Section>

            <Section
              id="okvir"
              title="Okvir sajta"
              intro="Zaglavlje i podnožje su oko ove stranice; ovde su delovi koji se ubacuju u njih."
            >
              <GalleryShell />
            </Section>
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
