"use client";

import { useState } from "react";
import {
  ArrowRightIcon,
  BellIcon,
  CheckCircleIcon,
  ClockIcon,
  EnvelopeIcon,
  MagnifyingGlassIcon,
  PackageIcon,
  PhoneIcon,
  ShoppingCartSimpleIcon,
  TrashIcon,
  WarningCircleIcon,
  XCircleIcon,
} from "@phosphor-icons/react/dist/ssr";

import { Badge, CountBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Combobox, type ComboboxItem } from "@/components/ui/Combobox";
import { CopyButton } from "@/components/ui/CopyButton";
import { Field } from "@/components/ui/Field";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { Kbd } from "@/components/ui/Kbd";
import { Link } from "@/components/ui/Link";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
import { RadioGroup } from "@/components/ui/Radio";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { Switch } from "@/components/ui/Switch";
import { Textarea } from "@/components/ui/Textarea";
import { Group, Specimen } from "./Section";
import styles from "../styleguide.module.css";

const VARIANTS = ["primary", "secondary", "quiet", "ghost", "danger"] as const;

/** Generic parts taxonomy (not company data) — enough to exercise the combobox. */
const CATEGORIES: ComboboxItem[] = [
  { id: "diskovi", label: "Kočioni diskovi", group: "Kočnice", meta: "44" },
  { id: "plocice", label: "Kočione pločice", group: "Kočnice", meta: "44" },
  { id: "celjusti", label: "Kočione čeljusti", group: "Kočnice" },
  { id: "amortizeri", label: "Amortizeri", group: "Vešanje" },
  { id: "rame", label: "Rame (viljuška)", group: "Vešanje" },
  {
    id: "turbina",
    label: "Turbina (turbopunjač)",
    group: "Motor",
    description: "Pre zamene proverite broj na kućištu turbine.",
  },
  { id: "filter-ulja", label: "Filter ulja", group: "Filteri", meta: "03L 115 562" },
];

const fold = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "dj");

export function GalleryControls() {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [qty, setQty] = useState(2);
  const [delivery, setDelivery] = useState("kurir");
  const [notify, setNotify] = useState(true);
  const [loading, setLoading] = useState(false);

  const filtered = query.trim()
    ? CATEGORIES.filter((item) => fold(item.label).includes(fold(query.trim())))
    : [];

  return (
    <>
      <Group
        title="Dugmad"
        note="Jedno primarno po oblasti. Hover 80 ms, pritisak 1 px za 140 ms (sk.snap). Druga kolona prikazuje prsten fokusa."
      >
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            {VARIANTS.map((variant) => (
              <Specimen key={variant} label={`variant="${variant}"`}>
                <Button variant={variant}>
                  {variant === "danger" ? "Otkaži porudžbinu" : "Dodaj u korpu"}
                </Button>
                <Button variant={variant} icon={<ShoppingCartSimpleIcon size={20} />}>
                  U korpu
                </Button>
                <Button variant={variant} disabled>
                  Nedostupno
                </Button>
                <Button variant={variant} loading>
                  Šaljem
                </Button>
              </Specimen>
            ))}
          </div>
          <div className={`flex flex-col gap-4 ${styles.forceFocus}`}>
            {VARIANTS.map((variant) => (
              <Specimen key={variant} label={`${variant} · fokus`}>
                <Button variant={variant} tabIndex={-1}>
                  {variant === "danger" ? "Otkaži porudžbinu" : "Dodaj u korpu"}
                </Button>
              </Specimen>
            ))}
          </div>
        </div>
        <Specimen label='size="sm" | "md" | "lg" | "xl" · trailingIcon · loading bez ikone (širina ostaje ista)'>
          <Button size="sm">Mali</Button>
          <Button size="md">Srednji</Button>
          <Button size="lg">Veliki</Button>
          <Button size="xl" trailingIcon={<ArrowRightIcon size={16} />}>
            Pretraži
          </Button>
          <Button
            variant="secondary"
            loading={loading}
            onClick={() => {
              setLoading(true);
              window.setTimeout(() => setLoading(false), 1600);
            }}
          >
            Klikni za učitavanje
          </Button>
        </Specimen>
        <Specimen label="IconButton · 44 × 44 (sm 36) · obavezno aria-label · brojač">
          <IconButton label="Pretraga" icon={<MagnifyingGlassIcon size={24} />} />
          <IconButton label="Obaveštenja, 3 nova" icon={<BellIcon size={24} />} count={3} />
          <IconButton
            label="Korpa, 12 artikala"
            icon={<ShoppingCartSimpleIcon size={24} />}
            count={12}
          />
          <IconButton label="Ukloni" variant="quiet" icon={<TrashIcon size={20} />} />
          <IconButton label="Pozovite" variant="secondary" icon={<PhoneIcon size={20} />} />
          <IconButton label="Pošalji" variant="primary" icon={<ArrowRightIcon size={20} />} />
          <IconButton label="Učitava se" icon={<BellIcon size={24} />} loading />
          <IconButton label="Nedostupno" icon={<BellIcon size={24} />} disabled />
        </Specimen>
      </Group>

      <Group title="Linkovi">
        <Specimen label="inline · quiet · standalone · spoljni">
          <p className="type-body text-ink-2">
            Pročitajte <Link href="/dostava-i-placanje">uslove dostave</Link> pre porudžbine.
          </p>
          <Link href="/delovi" variant="quiet">
            Svi delovi
          </Link>
          <Link href="/upit" variant="standalone">
            Pošaljite upit
          </Link>
          <Link href="https://www.apr.gov.rs" variant="standalone">
            Registar APR
          </Link>
        </Specimen>
      </Group>

      <Group title="Bedževi i statusi" note="Status nikad samo bojom&nbsp;— uvek ikona i reč.">
        <Specimen label="Badge · tone">
          <Badge tone="accent" icon={<WarningCircleIcon size={14} weight="bold" />}>
            Nova
          </Badge>
          <Badge tone="info" icon={<CheckCircleIcon size={14} weight="bold" />}>
            Potvrđena
          </Badge>
          <Badge tone="info" icon={<PackageIcon size={14} weight="bold" />}>
            Za preuzimanje
          </Badge>
          <Badge tone="success" icon={<CheckCircleIcon size={14} weight="bold" />}>
            Isporučena
          </Badge>
          <Badge tone="warning" icon={<ClockIcon size={14} weight="bold" />}>
            Čeka deo
          </Badge>
          <Badge tone="danger" icon={<XCircleIcon size={14} weight="bold" />}>
            Otkazana
          </Badge>
          <Badge tone="neutral">Završena</Badge>
          <Badge tone="outline" size="text">
            OEM kvalitet
          </Badge>
        </Specimen>
        <Specimen label="CountBadge · Kbd · Spinner">
          <CountBadge count={3} label="3 nepročitana" />
          <CountBadge count={14} label="14 nepročitanih" />
          <span className="type-body-s text-ink-2">
            Pretraga <Kbd>/</Kbd> · Zatvori <Kbd>Esc</Kbd>
          </span>
          <Spinner size={16} label="Učitava se" />
          <Spinner size={20} />
        </Specimen>
      </Group>

      <Group
        title="Polja"
        note="Oznaka iznad, pomoć ili greška ispod (aria-describedby). Provera na napuštanje polja, bez treperenja."
      >
        <div className="grid gap-8 md:grid-cols-2">
          <Field
            label="Ime i prezime"
            help="Kako piše na ličnoj karti&nbsp;— za preuzimanje paketa."
          >
            <Input autoComplete="name" placeholder="npr. Marko Petrović" />
          </Field>
          <Field label="Telefon" error="Unesite broj u obliku 064 123 4567.">
            <Input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              defaultValue="064 12"
              prefix={<PhoneIcon size={20} />}
            />
          </Field>
          <Field label="Broj šasije (VIN)" success="Ispravan oblik · Volkswagen, model 2008.">
            <Input
              defaultValue="WVWZZZ1KZ8W000001"
              inputClassName="font-mono uppercase"
              autoCapitalize="characters"
            />
          </Field>
          <Field label="E-pošta" optional>
            <Input
              type="email"
              autoComplete="email"
              prefix={<EnvelopeIcon size={20} />}
              placeholder="ime@primer.rs"
            />
          </Field>
          <Field label="Količina (onemogućeno)" disabled>
            <Input defaultValue="2" suffix="kom." />
          </Field>
          <Field label="Broj porudžbine (samo za čitanje)">
            <Input readOnly defaultValue="SK-2026-000187" inputClassName="font-mono" />
          </Field>
          <Field label="Napomena za prodavca" optional>
            <Textarea maxLength={1000} placeholder="npr. vozilo je sa LED farovima" />
          </Field>
          <div className="flex flex-col gap-8">
            <Field label="Sortiranje">
              <Select
                defaultValue="popularno"
                options={[
                  { value: "popularno", label: "Najtraženije" },
                  { value: "cena-rastuce", label: "Cena: od najniže" },
                  { value: "cena-opadajuce", label: "Cena: od najviše" },
                  { value: "novo", label: "Najnovije" },
                ]}
              />
            </Field>
            <Field
              label="Kategorija"
              help={
                picked
                  ? `Izabrano: ${picked}`
                  : "Kucajte „ko“ ili „filter“\u00a0— strelice, Enter, Esc."
              }
            >
              <Combobox
                items={filtered}
                inputValue={query}
                onInputValueChange={setQuery}
                onSelect={(item) => {
                  setPicked(item.label);
                  setQuery(item.label);
                }}
                placeholder="Naziv kategorije"
                prefix={<MagnifyingGlassIcon size={20} />}
                empty={<>Nema rezultata za „{query.trim()}“.</>}
              />
            </Field>
          </div>
        </div>
      </Group>

      <Group title="Izbor" note="Cela oznaka je meta od 44 px; strelice pomeraju izbor u grupi.">
        <div className="grid gap-8 md:grid-cols-3">
          <div className="flex flex-col">
            <Checkbox label="Na stanju" meta="128" defaultChecked />
            <Checkbox label="Po porudžbini" meta="42" />
            <Checkbox label="Original VAG" meta="0" disabled />
            <Checkbox label="Sve marke" checked="indeterminate" />
          </div>
          <RadioGroup
            label="Način dostave"
            value={delivery}
            onValueChange={setDelivery}
            options={[
              { value: "kurir", label: "Kurirska služba", description: "1–2 radna dana" },
              { value: "licno", label: "Lično preuzimanje" },
              { value: "posta", label: "Pošta", disabled: true },
            ]}
          />
          <div className="flex flex-col">
            <Switch label="Obavesti me kad stigne" checked={notify} onCheckedChange={setNotify} />
            <Switch label="Kompaktna tabela" description="36 px redovi" />
            <Switch label="Nedostupno" disabled />
          </div>
        </div>
        <Specimen label="QuantityStepper · CopyButton">
          <QuantityStepper
            value={qty}
            onChange={setQty}
            max={4}
            label="Količina: Kočioni disk prednji"
          />
          <span className="type-caption text-ink-3" aria-live="polite">
            {qty} od najviše 4 (na stanju)
          </span>
          <CopyButton
            value="1K0 615 301 AA"
            label="Kopiraj OEM broj 1K0 615 301 AA"
            toastMessage="OEM broj kopiran"
            showValue
          />
          <CopyButton
            value="SK-2026-000187"
            label="Kopiraj broj porudžbine"
            toastMessage="Broj porudžbine kopiran"
          />
        </Specimen>
      </Group>
    </>
  );
}
