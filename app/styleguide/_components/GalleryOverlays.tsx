"use client";

import { useState } from "react";
import {
  ArrowCounterClockwiseIcon,
  DotsThreeIcon,
  PrinterIcon,
  QuestionIcon,
  TrashIcon,
} from "@phosphor-icons/react/dist/ssr";

import { Button } from "@/components/ui/Button";
import { Dialog, DialogClose } from "@/components/ui/Dialog";
import { IconButton } from "@/components/ui/IconButton";
import { Menu } from "@/components/ui/Menu";
import { Sheet } from "@/components/ui/Sheet";
import { StockBadge } from "@/components/ui/StockBadge";
import { toast } from "@/components/ui/Toast";
import { Tooltip } from "@/components/ui/Tooltip";
import { Group, Specimen } from "./Section";

export function GalleryOverlays() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [columns, setColumns] = useState({ izvor: true, placanje: true });

  return (
    <>
      <Group
        title="Dijalog"
        note="Scrim 220 ms, panel se podiže 8 px za 240 ms (sk.out), odlazi za 160 ms (sk.in). Fokus ulazi u dijalog i vraća se na okidač."
      >
        <Specimen label="Dialog · alertdialog · nepovratna radnja blokira Esc dok traje">
          <Dialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            role="alertdialog"
            dismissible={!busy}
            title="Otkazati porudžbinu SK-2026-000187?"
            description="Kupac dobija e-poruku o otkazivanju. Radnja se ne može poništiti."
            trigger={
              <Button variant="danger" icon={<TrashIcon size={20} />}>
                Otkaži porudžbinu
              </Button>
            }
            footer={
              <>
                <DialogClose asChild>
                  <Button variant="secondary" disabled={busy}>
                    Nazad
                  </Button>
                </DialogClose>
                <Button
                  variant="danger"
                  loading={busy}
                  onClick={() => {
                    setBusy(true);
                    window.setTimeout(() => {
                      setBusy(false);
                      setConfirmOpen(false);
                      toast.success("Porudžbina je otkazana", {
                        description: "SK-2026-000187 · kupac je obavešten.",
                      });
                    }, 1200);
                  }}
                >
                  Otkaži porudžbinu
                </Button>
              </>
            }
          />
        </Specimen>
      </Group>

      <Group
        title="Panel (drawer / donji panel)"
        note="Od 1024 px desni panel (x 24 px + providnost, 360 ms); ispod toga donji panel koji se vuče za ručku: 42 % / 92 %, zatvara se ispod 25 % ili brzim potezom naniže."
      >
        <Specimen label="Sheet modal (korpa, filteri) · Sheet non-modal (3D panel dela)">
          <Sheet
            title="Filteri"
            description="Rezultati se ažuriraju odmah."
            trigger={<Button variant="secondary">Otvori filtere</Button>}
            footer={
              <>
                <Button fullWidth>Prikaži 48 rezultata</Button>
                <Button variant="ghost" fullWidth>
                  Poništi
                </Button>
              </>
            }
          >
            <div className="flex flex-col gap-4 type-body-s text-ink-2">
              <p>Grupe filtera su harmonike: Vozilo, Dostupnost, Proizvođač.</p>
              <StockBadge status="in_stock" quantity={4} />
              <StockBadge status="on_order" leadTime="3–5 dana" />
            </div>
          </Sheet>
          <Sheet
            open={panelOpen}
            onOpenChange={setPanelOpen}
            modal={false}
            size="md"
            initialSnap="peek"
            belowHeader
            title="Kočioni diskovi"
            header={
              <span className="type-caption font-normal text-ink-3">
                Stranica ostaje aktivna iza panela
              </span>
            }
            trigger={<Button variant="quiet">Panel dela (bez zatamnjenja)</Button>}
          >
            <p className="type-body-s text-ink-2">
              Bez scrima: automobil ostaje vidljiv i interaktivan dok je panel otvoren.
            </p>
          </Sheet>
        </Specimen>
      </Group>

      <Group
        title="Obaveštenja (toast)"
        note="Dole desno (telefon: dole u sredini), najviše 3; greške ostaju dok se ne zatvore."
      >
        <Specimen label="toast.success · info · warning · error · sa radnjom">
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              toast.success("Dodato u korpu", { description: "Kočioni disk prednji, Ø 312 mm" })
            }
          >
            Uspeh
          </Button>
          <Button variant="secondary" size="sm" onClick={() => toast.info("OEM broj kopiran")}>
            Info
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              toast.warning("Na stanju je još 1 kom.", {
                description: "Količina u korpi je smanjena.",
              })
            }
          >
            Upozorenje
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              toast.error("Porudžbina nije poslata", {
                description: "Proverite vezu i pokušajte ponovo.",
                action: { label: "Pokušaj ponovo", onClick: () => toast.info("Šaljem ponovo…") },
              })
            }
          >
            Greška
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              toast.success("Dodato u korpu", {
                action: { label: "Pogledaj korpu", href: "/korpa" },
              })
            }
          >
            Sa linkom
          </Button>
        </Specimen>
      </Group>

      <Group title="Tooltip i meni">
        <Specimen label="Tooltip (400 ms, dopuna&nbsp;— nikad jedini izvor) · Menu (Radix, strelice + kucanje)">
          <Tooltip content="Original VAG: deo sa logom proizvođača vozila.">
            <IconButton label="Šta znači Original VAG?" icon={<QuestionIcon size={20} />} />
          </Tooltip>
          <Menu
            trigger={
              <IconButton
                label="Radnje za SK-2026-000187"
                variant="quiet"
                size="sm"
                icon={<DotsThreeIcon size={20} weight="bold" />}
              />
            }
            items={[
              {
                label: "Štampaj predračun",
                icon: <PrinterIcon size={18} />,
                onSelect: () => toast.info("Predračun je spreman za štampu"),
              },
              {
                label: "Otpremnica",
                icon: <PrinterIcon size={18} />,
                onSelect: () => toast.info("Otpremnica je spremna za štampu"),
              },
              { type: "separator" },
              {
                label: "Vrati na prethodni status",
                icon: <ArrowCounterClockwiseIcon size={18} />,
                onSelect: () => undefined,
              },
              {
                label: "Otkaži porudžbinu",
                icon: <TrashIcon size={18} />,
                danger: true,
                onSelect: () => setConfirmOpen(true),
              },
            ]}
          />
          <Menu
            trigger={
              <Button variant="secondary" size="sm">
                Kolone
              </Button>
            }
            align="start"
            items={[
              { type: "label", label: "Prikaži kolone" },
              {
                type: "checkbox",
                label: "Izvor",
                checked: columns.izvor,
                onCheckedChange: (v) => setColumns((c) => ({ ...c, izvor: v })),
              },
              {
                type: "checkbox",
                label: "Plaćanje · dostava",
                checked: columns.placanje,
                onCheckedChange: (v) => setColumns((c) => ({ ...c, placanje: v })),
              },
            ]}
          />
        </Specimen>
      </Group>
    </>
  );
}
