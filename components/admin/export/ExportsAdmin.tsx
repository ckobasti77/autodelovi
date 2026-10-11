"use client";

/**
 * `/admin/izvoz` — downloads for staff: products (.xlsx in the import template's columns),
 * orders (.csv, optional date range), customers and mechanics (.csv). Files are generated
 * on the server with the staff member's token.
 */
import { useState } from "react";
import { DownloadSimpleIcon } from "@phosphor-icons/react/dist/ssr";

import { Checkbox } from "@/components/ui/Checkbox";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { ADMIN } from "@/constants/routes";

import { PageHeader, Section } from "../ui";

function DownloadLink({
  href,
  children,
  testId,
}: {
  href: string;
  children: string;
  testId: string;
}) {
  return (
    <a
      href={href}
      download
      data-testid={testId}
      className="inline-flex h-11 items-center gap-2 self-start rounded-sm bg-accent px-4 type-body-s font-semibold text-on-accent transition-control hover:bg-accent-hover active:translate-y-px focus-ring-inverse"
    >
      <DownloadSimpleIcon size={18} aria-hidden="true" />
      {children}
    </a>
  );
}

export function ExportsAdmin() {
  const [demo, setDemo] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const ordersQuery = new URLSearchParams({
    ...(from ? { od: from } : {}),
    ...(to ? { do: to } : {}),
  }).toString();
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Izvoz"
        description="Katalog, porudžbine i kupci u fajlovima koje otvara Excel. CSV fajlovi koriste tačku-zarez i srpska slova."
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Proizvodi (.xlsx)">
          <div className="flex flex-col gap-3">
            <p className="type-body-s text-ink-2">
              Sve kolone iz šablona za uvoz, sa nabavnim cenama i vozilima. Izmenite fajl i uvezite
              ga nazad — prepoznaje se sam.
            </p>
            <Checkbox
              label="Uključi demo artikle"
              checked={demo}
              onCheckedChange={(v) => setDemo(v === true)}
            />
            <DownloadLink
              href={`${ADMIN.exportFile("proizvodi.xlsx")}${demo ? "?demo=1" : ""}`}
              testId="export-products"
            >
              Preuzmi proizvode
            </DownloadLink>
          </div>
        </Section>
        <Section title="Porudžbine (.csv)">
          <div className="flex flex-col gap-3">
            <p className="type-body-s text-ink-2">
              Kupac, firma i PIB, iznosi sa PDV-om, plaćanje, isporuka i izvor. Bez datuma: sve
              porudžbine.
            </p>
            <div className="flex flex-wrap gap-3">
              <Field label="Od">
                <Input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="h-10"
                />
              </Field>
              <Field label="Do">
                <Input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="h-10"
                />
              </Field>
            </div>
            <DownloadLink
              href={`${ADMIN.exportFile("porudzbine.csv")}${ordersQuery ? `?${ordersQuery}` : ""}`}
              testId="export-orders"
            >
              Preuzmi porudžbine
            </DownloadLink>
          </div>
        </Section>
        <Section title="Kupci (.csv)">
          <div className="flex flex-col gap-3">
            <p className="type-body-s text-ink-2">
              Registrovani kupci: kontakt, datum registracije, broj porudžbina i pristanak na
              obaveštenja. Gosti su u izvozu porudžbina.
            </p>
            <DownloadLink href={ADMIN.exportFile("kupci.csv")} testId="export-customers">
              Preuzmi kupce
            </DownloadLink>
          </div>
        </Section>
        <Section title="Majstori (.csv)">
          <div className="flex flex-col gap-3">
            <p className="type-body-s text-ink-2">
              Servisi sa PIB-om, statusom, cenovnim razredom i uslovima odloženog plaćanja.
            </p>
            <DownloadLink href={ADMIN.exportFile("majstori.csv")} testId="export-mechanics">
              Preuzmi majstore
            </DownloadLink>
          </div>
        </Section>
      </div>
    </div>
  );
}
