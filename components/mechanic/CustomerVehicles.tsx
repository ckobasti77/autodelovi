"use client";

/**
 * `/majstor/vozila` — customer vehicles (ARCHITECTURE §A4): label (whose car), VIN with a
 * live VAG decode that prefills make / generation, plate and a note; each row links to the
 * catalog filtered for that generation and engine, selects it in the picker, or opens an
 * inquiry with the VIN. Uses `account.savedVehicles` (owner = `ctx.viewer`).
 *
 * The add form is one panel with three field groups (whose car, which car, notes); the saved
 * vehicles are rows of one panel with a quiet „Delovi za ovo vozilo“ per row.
 */
import { useMutation, useQuery } from "convex/react";
import { useMemo, useState, type FormEvent } from "react";
import {
  ArrowRightIcon,
  CarIcon,
  ChatCircleTextIcon,
  CheckIcon,
  PencilSimpleIcon,
  PlusIcon,
  TrashIcon,
} from "@phosphor-icons/react/dist/ssr";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { VehicleTree } from "@/lib/catalog/types";
import { decodeVin, normalizeVin } from "@/lib/domain/vin";
import { convexErrorMessage, ERRORS } from "@/lib/i18n/sr/shop";
import { useVehicleStore } from "@/lib/vehicle/store";
import { Reveal } from "@/components/reveal/Reveal";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { Link } from "@/components/ui/Link";
import { Select } from "@/components/ui/Select";
import { Skeleton, SkeletonRegion } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/Toast";
import { ROUTES } from "@/constants/routes";

type Draft = {
  label: string;
  vin: string;
  brandSlug: string;
  modelSlug: string;
  generationSlug: string;
  engineSlug: string;
  plate: string;
  note: string;
};

const EMPTY: Draft = {
  label: "",
  vin: "",
  brandSlug: "",
  modelSlug: "",
  generationSlug: "",
  engineSlug: "",
  plate: "",
  note: "",
};

function AddVehicleForm({ tree, onDone }: { tree: VehicleTree; onDone: () => void }) {
  const add = useMutation(api.account.addSavedVehicle);
  const [d, setD] = useState<Draft>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof Draft, string>>>({});
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<Draft>) => setD((prev) => ({ ...prev, ...patch }));

  const brand = tree.find((b) => b.brand.slug === d.brandSlug);
  const model = brand?.models.find((m) => m.model.slug === d.modelSlug);
  const generation = model?.generations.find((g) => g.slug === d.generationSlug);
  const engines = useQuery(
    api.catalog.vehicles.engines,
    generation ? { generationId: generation._id } : "skip",
  );

  const decoded = useMemo(() => {
    const n = normalizeVin(d.vin);
    return n.length >= 3 ? decodeVin(n) : null;
  }, [d.vin]);

  /** A newly valid VIN prefills make / model / generation (all stay editable). */
  const onVin = (vin: string) => {
    const next = decodeVin(normalizeVin(vin));
    const patch: Partial<Draft> = { vin };
    if (next.validation.valid && next.normalized !== normalizeVin(d.vin)) {
      const hit = next.wmi.make ? tree.find((b) => b.brand.name === next.wmi.make) : undefined;
      if (hit) {
        Object.assign(patch, {
          brandSlug: hit.brand.slug,
          modelSlug: "",
          generationSlug: "",
          engineSlug: "",
        });
        if (next.modelCode) {
          for (const m of hit.models) {
            const g = m.generations.find((gen) => gen.vinModelCodes.includes(next.modelCode!));
            if (g) {
              patch.modelSlug = m.model.slug;
              patch.generationSlug = g.slug;
              break;
            }
          }
        }
      }
    }
    set(patch);
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const e: Partial<Record<keyof Draft, string>> = {};
    if (d.vin.trim() && !decoded?.validation.valid) e.vin = ERRORS.vin;
    if (!d.brandSlug) e.brandSlug = "Izaberite marku.";
    if (!d.label.trim() && !d.plate.trim())
      e.label = "Upišite mušteriju ili tablice, da biste znali čije je vozilo.";
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await add({
        brandSlug: d.brandSlug,
        ...(d.modelSlug ? { modelSlug: d.modelSlug } : {}),
        ...(d.generationSlug ? { generationSlug: d.generationSlug } : {}),
        ...(d.engineSlug ? { engineSlug: d.engineSlug } : {}),
        ...(d.label.trim() ? { label: d.label.trim() } : {}),
        ...(d.vin.trim() ? { vin: normalizeVin(d.vin) } : {}),
        ...(d.plate.trim() ? { plate: d.plate.trim() } : {}),
        ...(d.note.trim() ? { note: d.note.trim() } : {}),
      });
      toast.success("Vozilo je sačuvano.");
      setD(EMPTY);
      onDone();
    } catch (error) {
      toast.error(convexErrorMessage(error, "Vozilo nije sačuvano."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={(e) => void onSubmit(e)}
      noValidate
      aria-labelledby="cv-add-title"
      className="flex flex-col gap-5 panel-raised p-4 sm:p-6"
    >
      <h2 id="cv-add-title" className="type-h4 text-ink-1">
        Novo vozilo mušterije
      </h2>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Mušterija ili oznaka" help="Npr. „Petrović — Golf“" error={errors.label}>
          <Input value={d.label} maxLength={60} onChange={(e) => set({ label: e.target.value })} />
        </Field>
        <Field
          label="Broj šasije (VIN)"
          optional
          error={errors.vin}
          help={
            decoded?.validation.valid
              ? [
                  decoded.wmi.make ?? decoded.wmi.manufacturer,
                  decoded.model?.model,
                  decoded.modelYear ? `model ${decoded.modelYear}?` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : `${normalizeVin(d.vin).length} / 17 znakova`
          }
        >
          <Input
            value={d.vin}
            maxLength={20}
            autoComplete="off"
            spellCheck={false}
            inputClassName="font-mono uppercase tracking-wider"
            onChange={(e) => onVin(e.target.value)}
          />
        </Field>
      </div>
      <div className="grid gap-5 border-t border-line pt-5 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Marka" error={errors.brandSlug}>
          <Select
            placeholder="Izaberite"
            value={d.brandSlug}
            options={tree.map((b) => ({ value: b.brand.slug, label: b.brand.name }))}
            onChange={(e) =>
              set({ brandSlug: e.target.value, modelSlug: "", generationSlug: "", engineSlug: "" })
            }
          />
        </Field>
        <Field label="Model">
          <Select
            placeholder={brand ? "Izaberite" : "Prvo marku"}
            disabled={!brand}
            value={d.modelSlug}
            options={(brand?.models ?? []).map((m) => ({
              value: m.model.slug,
              label: m.model.name,
            }))}
            onChange={(e) => set({ modelSlug: e.target.value, generationSlug: "", engineSlug: "" })}
          />
        </Field>
        <Field label="Generacija">
          <Select
            placeholder={model ? "Izaberite" : "Prvo model"}
            disabled={!model}
            value={d.generationSlug}
            options={(model?.generations ?? []).map((g) => ({
              value: g.slug,
              label: `${g.name} · ${g.yearFrom}–${g.yearTo ?? ""}`,
            }))}
            onChange={(e) => set({ generationSlug: e.target.value, engineSlug: "" })}
          />
        </Field>
        <Field label="Motor" optional>
          <Select
            placeholder={generation ? "Izaberite" : "Prvo generaciju"}
            disabled={!generation || !engines}
            value={d.engineSlug}
            options={(engines ?? []).map((en) => ({
              value: en.slug,
              label: `${en.name}${en.codes.length ? ` · ${en.codes.slice(0, 3).join(", ")}` : ""}`,
            }))}
            onChange={(e) => set({ engineSlug: e.target.value })}
          />
        </Field>
      </div>
      <div className="grid gap-5 border-t border-line pt-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Field label="Tablice" optional>
          <Input
            value={d.plate}
            maxLength={16}
            inputClassName="uppercase"
            onChange={(e) => set({ plate: e.target.value })}
          />
        </Field>
        <Field label="Napomena" optional help="Šta je menjano, šta sledeće treba proveriti.">
          <Input value={d.note} maxLength={200} onChange={(e) => set({ note: e.target.value })} />
        </Field>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={busy} icon={<CheckIcon size={20} />}>
          Sačuvaj vozilo
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Odustani
        </Button>
      </div>
    </form>
  );
}

type SavedVehicle = NonNullable<ReturnType<typeof useSavedVehicles>>[number];

function useSavedVehicles() {
  return useQuery(api.account.savedVehicles, {});
}

function VehicleRow({ v }: { v: SavedVehicle }) {
  const remove = useMutation(api.account.removeSavedVehicle);
  const update = useMutation(api.account.updateSavedVehicle);
  const setVehicle = useVehicleStore((s) => s.setVehicle);
  const [editing, setEditing] = useState(false);
  const [plate, setPlate] = useState(v.plate ?? "");
  const [note, setNote] = useState(v.note ?? "");
  const vehicle = [v.brandName, v.generationName ?? v.modelName, v.engineName]
    .filter(Boolean)
    .join(" ");
  const catalogHref =
    v.brandSlug && v.modelSlug && v.generationSlug
      ? ROUTES.vehicleGeneration(v.brandSlug, v.modelSlug, v.generationSlug) +
        (v.engineSlug ? `?motor=${v.engineSlug}` : "")
      : v.brandSlug && v.modelSlug
        ? ROUTES.vehicleModel(v.brandSlug, v.modelSlug)
        : v.brandSlug
          ? ROUTES.vehicleBrand(v.brandSlug)
          : null;
  const select = () => {
    if (!v.brandSlug || !v.modelSlug || !v.brandName || !v.modelName) return;
    setVehicle({
      brand: { slug: v.brandSlug, name: v.brandName },
      model: { slug: v.modelSlug, name: v.modelName },
      generation:
        v.generationSlug && v.generationName && v.generationYears
          ? {
              slug: v.generationSlug,
              name: v.generationName,
              yearFrom: v.generationYears.from,
              yearTo: v.generationYears.to,
            }
          : null,
      engine:
        v.engineSlug && v.engineName
          ? { slug: v.engineSlug, name: v.engineName, codes: v.engineCodes }
          : null,
    });
    toast.success(`Izabrano vozilo: ${vehicle}. Katalog prikazuje delove koji mu odgovaraju.`);
  };

  return (
    <li className="grid gap-x-4 gap-y-3 p-4 sm:px-5 md:grid-cols-[minmax(0,1fr)_auto]">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="type-body font-semibold text-ink-1">{v.label ?? vehicle}</span>
        {v.label ? <span className="type-body-s text-ink-2">{vehicle}</span> : null}
        <span className="flex flex-wrap gap-x-4 gap-y-1">
          {v.vin ? <span className="type-code text-ink-2">{v.vin}</span> : null}
          {v.plate && !editing ? <span className="type-code text-ink-2">{v.plate}</span> : null}
        </span>
        {v.note && !editing ? <p className="type-body-s text-ink-3">{v.note}</p> : null}
        {editing ? (
          <form
            className="mt-2 grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)_auto] sm:items-end"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await update({ id: v.id as Id<"savedVehicles">, plate, note });
                setEditing(false);
              } catch (error) {
                toast.error(convexErrorMessage(error, "Izmena nije sačuvana."));
              }
            }}
          >
            <Field label="Tablice">
              <Input
                value={plate}
                maxLength={16}
                inputClassName="uppercase"
                onChange={(e) => setPlate(e.target.value)}
              />
            </Field>
            <Field label="Napomena">
              <Input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
            </Field>
            <Button type="submit" variant="quiet">
              Sačuvaj
            </Button>
          </form>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-1 self-start md:justify-end">
        {catalogHref ? (
          <Button
            asChild
            variant="quiet"
            size="sm"
            trailingIcon={<ArrowRightIcon size={16} />}
            className="max-lg:h-11"
          >
            <Link href={catalogHref} variant="unstyled" onClick={select}>
              Delovi za ovo vozilo
            </Link>
          </Button>
        ) : null}
        <Button
          asChild
          variant="ghost"
          size="sm"
          icon={<ChatCircleTextIcon size={16} />}
          className="max-lg:h-11"
        >
          <Link
            href={ROUTES.inquiryWith({ q: [v.vin, vehicle].filter(Boolean).join(" · ") })}
            variant="unstyled"
            aria-label={`Upit za ${v.label ?? vehicle}`}
          >
            Upit
          </Link>
        </Button>
        <IconButton
          label={`Izmeni tablice i napomenu: ${v.label ?? vehicle}`}
          icon={<PencilSimpleIcon size={18} />}
          variant="ghost"
          onClick={() => setEditing((x) => !x)}
        />
        <IconButton
          label={`Ukloni vozilo ${v.label ?? vehicle}`}
          icon={<TrashIcon size={18} />}
          variant="ghost"
          onClick={() =>
            remove({ id: v.id as Id<"savedVehicles"> }).catch((e) =>
              toast.error(convexErrorMessage(e, "Vozilo nije uklonjeno.")),
            )
          }
        />
      </div>
    </li>
  );
}

export function CustomerVehicles({ tree }: { tree: VehicleTree }) {
  const rows = useSavedVehicles();
  const [adding, setAdding] = useState(false);
  return (
    <div className="flex flex-col gap-5" data-reveal="off">
      {adding ? (
        <AddVehicleForm tree={tree} onDone={() => setAdding(false)} />
      ) : (
        <Button
          icon={<PlusIcon size={20} />}
          onClick={() => setAdding(true)}
          className="self-start"
        >
          Dodaj vozilo mušterije
        </Button>
      )}
      {rows === undefined ? (
        <SkeletonRegion>
          <div className="flex flex-col divide-y divide-line panel">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="grid gap-x-4 gap-y-3 p-4 sm:px-5 md:grid-cols-[minmax(0,1fr)_auto]"
              >
                <span className="flex flex-col gap-2.5">
                  <Skeleton className="h-5 w-56 max-w-full" />
                  <Skeleton className="h-4 w-40 max-w-full" />
                  <Skeleton className="h-4 w-64 max-w-full" />
                </span>
                <Skeleton className="h-11 w-72 max-w-full lg:h-9" />
              </div>
            ))}
          </div>
        </SkeletonRegion>
      ) : rows.length === 0 ? (
        adding ? null : (
          <EmptyState align="start" icon={<CarIcon size={40} />} className="py-4">
            Sačuvajte vozila mušterija sa brojem šasije i tablicama — delovi za njih su onda na
            jedan klik.
          </EmptyState>
        )
      ) : (
        <Reveal eager index={1} className="panel">
          <ul className="flex flex-col divide-y divide-line">
            {rows.map((v) => (
              <VehicleRow key={v.id} v={v} />
            ))}
          </ul>
        </Reveal>
      )}
    </div>
  );
}
