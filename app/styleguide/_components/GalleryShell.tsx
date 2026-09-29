"use client";

import { useState } from "react";

import { toast } from "@/components/ui/Toast";
import { SearchBox } from "@/components/shell/SearchBox";
import { VehicleChip, VehicleField } from "@/components/shell/VehiclePicker";
import { Group, Specimen } from "./Section";

const SAMPLE = { label: "Golf VII · 2.0 TDI", fullLabel: "VW Golf VII 2.0 TDI (CRLB)" };

export function GalleryShell() {
  const [vehicle, setVehicle] = useState<typeof SAMPLE | null>(SAMPLE);
  const open = () =>
    toast.info("Izbor vozila", { description: "Marka → Model → Generacija → Motor" });

  return (
    <>
      <Group
        title="Pretraga po broju"
        note="Obična GET forma ka /pretraga; sa JS kombo-lista, nedavne pretrage i prepoznavanje liste brojeva (probajte da nalepite dva broja)."
      >
        <SearchBox variant="hero" className="max-w-[640px]" />
      </Group>
      <Group
        title="Vozilo"
        note="Polje u heroju i čip u zaglavlju&nbsp;— sam izbor stiže sa podacima o vozilima."
      >
        <div className="grid gap-8 md:grid-cols-2">
          <Specimen label="VehicleField · izabrano / prazno">
            <div className="flex w-full flex-col gap-6">
              <VehicleField vehicle={vehicle} onOpen={open} onClear={() => setVehicle(null)} />
              <VehicleField vehicle={null} onOpen={open} />
            </div>
          </Specimen>
          <Specimen label="VehicleChip · izabrano / prazno">
            <VehicleChip
              vehicle={vehicle ?? SAMPLE}
              onOpen={open}
              onClear={() => setVehicle(null)}
            />
            <VehicleChip vehicle={null} onOpen={() => setVehicle(SAMPLE)} />
          </Specimen>
        </div>
      </Group>
    </>
  );
}
