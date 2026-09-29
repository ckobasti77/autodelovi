"use client";

/**
 * Vehicle picker panel (DESIGN-SYSTEM §9.4): Marka → Model → Generacija → Motor with the
 * choices as breadcrumbs; a dialog on desktop (560 px), a bottom sheet on phones. „Ne znam
 * motor“ saves the generation only; „Ne nalazim svoje vozilo“ goes to the inquiry. The choice
 * lands in the shared store (`sk.vehicle.v1`) — header chip, hero field and part panel follow.
 * Backspace steps back.
 */
import { useQuery } from "convex/react";
import { useState, type KeyboardEvent, type ReactNode } from "react";
import { ArrowLeftIcon, CaretRightIcon, MagnifyingGlassIcon } from "@phosphor-icons/react/dist/ssr";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useVehiclePicker } from "@/lib/vehicle/picker";
import { useVehicleStore, type SelectedVehicle } from "@/lib/vehicle/store";
import { ROUTES } from "@/constants/routes";
import { MEDIA } from "@/constants/motion";
import { Dialog } from "@/components/ui/Dialog";
import { Link } from "@/components/ui/Link";
import { Sheet } from "@/components/ui/Sheet";
import { Skeleton, SkeletonRegion } from "@/components/ui/Skeleton";
import { useMediaQuery } from "@/components/ui/motion";

type Brand = { slug: string; name: string };
type Model = { _id: Id<"vehicleModels">; slug: string; name: string };
type Generation = {
  _id: Id<"vehicleGenerations">;
  slug: string;
  name: string;
  code: string | null;
  yearFrom: number;
  yearTo: number | null;
};

const STEP_TITLES = ["Marka", "Model", "Generacija", "Motor"] as const;

function Rows({ children, label }: { children: ReactNode; label: string }) {
  return (
    <ul aria-label={label} className="flex flex-col">
      {children}
    </ul>
  );
}

function Row({
  onClick,
  children,
  meta,
}: {
  onClick: () => void;
  children: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="group flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-xs border-b border-line px-2 py-2.5 text-left transition-control hover:bg-surface-4"
      >
        <span className="min-w-0 flex-1 text-[0.9375rem] font-medium text-ink-1">{children}</span>
        {meta ? <span className="shrink-0 type-caption text-ink-3">{meta}</span> : null}
        <CaretRightIcon size={16} aria-hidden="true" className="shrink-0 text-ink-3 group-hover:text-accent" />
      </button>
    </li>
  );
}

function Loading() {
  return (
    <SkeletonRegion>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-11 w-full" />
        ))}
      </div>
    </SkeletonRegion>
  );
}

function years(g: Generation): string {
  return `${g.yearFrom}–${g.yearTo ?? "danas"}`;
}

function PickerBody({ onDone }: { onDone: () => void }) {
  const setVehicle = useVehicleStore((s) => s.setVehicle);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [model, setModel] = useState<Model | null>(null);
  const [generation, setGeneration] = useState<Generation | null>(null);
  const [filter, setFilter] = useState("");

  const brands = useQuery(api.catalog.vehicles.brands, {});
  const models = useQuery(api.catalog.vehicles.models, brand ? { brandSlug: brand.slug } : "skip");
  const generations = useQuery(
    api.catalog.vehicles.generations,
    model ? { modelId: model._id } : "skip",
  );
  const engines = useQuery(
    api.catalog.vehicles.engines,
    generation ? { generationId: generation._id } : "skip",
  );

  const step = !brand ? 0 : !model ? 1 : !generation ? 2 : 3;

  const back = () => {
    setFilter("");
    if (generation) setGeneration(null);
    else if (model) setModel(null);
    else if (brand) setBrand(null);
  };

  const save = (engine: SelectedVehicle["engine"]) => {
    if (!brand || !model) return;
    setVehicle({
      brand: { slug: brand.slug, name: brand.name },
      model: { slug: model.slug, name: model.name },
      generation: generation
        ? {
            slug: generation.slug,
            name: generation.name,
            yearFrom: generation.yearFrom,
            yearTo: generation.yearTo,
          }
        : null,
      engine,
    });
    onDone();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (event.key === "Backspace" && target.tagName !== "INPUT" && step > 0) {
      event.preventDefault();
      back();
    }
  };

  const crumbs = [brand?.name, model?.name, generation?.name].filter(Boolean) as string[];
  const visibleModels = (models ?? []).filter((m) =>
    m.name.toLocaleLowerCase("sr").includes(filter.trim().toLocaleLowerCase("sr")),
  );

  return (
    <div className="flex flex-col gap-4" onKeyDown={onKeyDown} data-reveal="off">
      <div className="flex min-h-11 items-center gap-2">
        {step > 0 ? (
          <button
            type="button"
            onClick={back}
            className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xs text-ink-2 transition-control hover:bg-surface-4 hover:text-ink-1"
            aria-label="Nazad"
          >
            <ArrowLeftIcon size={20} aria-hidden="true" />
          </button>
        ) : null}
        <p className="min-w-0 flex-1 type-caption text-ink-3">
          <span className="type-label uppercase text-ink-2">
            {step + 1}/4 · {STEP_TITLES[step]}
          </span>
          {crumbs.length ? <span className="ml-2 text-ink-1">{crumbs.join(" › ")}</span> : null}
        </p>
      </div>

      {step === 0 ? (
        brands === undefined ? (
          <Loading />
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {brands.map((b) => (
              <button
                key={b.slug}
                type="button"
                onClick={() => setBrand({ slug: b.slug, name: b.name })}
                className="flex h-14 cursor-pointer items-center justify-center rounded-xs border border-control bg-surface-2 px-3 text-[0.9375rem] font-semibold text-ink-1 transition-control hover:border-accent hover:bg-surface-4"
              >
                {b.name}
              </button>
            ))}
          </div>
        )
      ) : null}

      {step === 1 ? (
        models === undefined ? (
          <Loading />
        ) : (
          <>
            {models.length > 8 ? (
              <label className="flex h-11 items-center gap-2 rounded-xs border border-control bg-surface-2 px-3 focus-within:border-accent">
                <MagnifyingGlassIcon size={18} aria-hidden="true" className="text-ink-3" />
                <span className="sr-only">Pretraži modele</span>
                <input
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Model"
                  className="h-full min-w-0 flex-1 bg-transparent text-base text-ink-1 outline-none placeholder:text-ink-3"
                />
              </label>
            ) : null}
            <Rows label="Modeli">
              {visibleModels.map((m) => (
                <Row key={m._id} onClick={() => setModel(m)}>
                  {m.name}
                </Row>
              ))}
            </Rows>
          </>
        )
      ) : null}

      {step === 2 ? (
        generations === undefined ? (
          <Loading />
        ) : (
          <Rows label="Generacije">
            {generations.map((g) => (
              <Row
                key={g._id}
                onClick={() => setGeneration(g)}
                meta={
                  <>
                    {years(g)}
                    {g.code ? <span className="ml-2 type-code text-ink-2">{g.code}</span> : null}
                  </>
                }
              >
                {g.name}
              </Row>
            ))}
          </Rows>
        )
      ) : null}

      {step === 3 ? (
        engines === undefined ? (
          <Loading />
        ) : (
          <Rows label="Motori">
            {engines.map((e) => (
              <Row
                key={e._id}
                onClick={() => save({ slug: e.slug, name: e.name, codes: e.codes })}
                meta={<span className="type-code text-ink-2">{e.codes.join(", ")}</span>}
              >
                {e.name}
                <span className="ml-2 type-caption text-ink-3">{e.powerHp} KS</span>
              </Row>
            ))}
            <Row onClick={() => save(null)}>Ne znam motor</Row>
          </Rows>
        )
      ) : null}

      <Link href={ROUTES.inquiry} variant="standalone" className="self-start">
        Ne nalazim svoje vozilo
      </Link>
    </div>
  );
}

export function VehiclePickerDialog() {
  const open = useVehiclePicker((s) => s.open);
  const setOpen = useVehiclePicker((s) => s.setOpen);
  const desktop = useMediaQuery(MEDIA.desktop);
  const body = open ? <PickerBody onDone={() => setOpen(false)} /> : null;

  if (desktop) {
    return (
      <Dialog open={open} onOpenChange={setOpen} size="md" title="Izaberite vozilo">
        {body}
      </Dialog>
    );
  }
  return (
    <Sheet open={open} onOpenChange={setOpen} side="bottom" title="Izaberite vozilo" initialSnap="full">
      {body}
    </Sheet>
  );
}
