"use client";

/**
 * „Odgovara vašem vozilu“ (§3.6 fitment row, §10.3): the product's fitments against the
 * visitor's selected vehicle (`sk.vehicle.v1`). Icon + words, never colour alone.
 */
import {
  CarIcon,
  CheckCircleIcon,
  QuestionIcon,
  XCircleIcon,
} from "@phosphor-icons/react/dist/ssr";
import { useId } from "react";

import { cn } from "@/lib/cn";
import type { FitmentRow } from "@/lib/catalog/types";
import { openVehiclePicker } from "@/lib/vehicle/picker";
import { useSelectedVehicle, vehicleShortName, type SelectedVehicle } from "@/lib/vehicle/store";
import { Link } from "@/components/ui/Link";
import { ROUTES } from "@/constants/routes";

export type FitVerdict = "fits" | "generation_only" | "choose_generation" | "no" | "universal";

export function fitVerdict(
  vehicle: SelectedVehicle,
  fitments: Pick<FitmentRow, "generationSlug" | "engineSlug" | "modelName">[],
  universal: boolean,
): FitVerdict {
  if (universal) return "universal";
  if (!vehicle.generation) {
    return fitments.some((f) => f.modelName === vehicle.model.name) ? "choose_generation" : "no";
  }
  const rows = fitments.filter((f) => f.generationSlug === vehicle.generation!.slug);
  if (rows.length === 0) return "no";
  if (rows.some((r) => r.engineSlug === null)) return "fits";
  if (!vehicle.engine) return "generation_only";
  return rows.some((r) => r.engineSlug === vehicle.engine!.slug) ? "fits" : "no";
}

export function FitmentBadge({
  fitments,
  universal,
  productSlug,
  className,
}: {
  fitments: FitmentRow[];
  universal: boolean;
  productSlug: string;
  className?: string;
}) {
  const vehicle = useSelectedVehicle();
  const verdictId = useId();
  const base = cn("flex items-start gap-2 rounded-sm px-3 py-2.5 type-body-s", className);
  if (!vehicle) {
    return (
      <button
        type="button"
        onClick={openVehiclePicker}
        className={cn(
          base,
          "w-full cursor-pointer border border-dashed border-control text-left text-ink-2 transition-control hover:border-ink-3 hover:text-ink-1",
        )}
      >
        <CarIcon size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
        <span>Izaberite vozilo da proverimo da li deo odgovara</span>
      </button>
    );
  }
  const verdict = fitVerdict(vehicle, fitments, universal);
  const name = vehicleShortName(vehicle);
  const engine = vehicle.engine ? ` ${vehicle.engine.name}` : "";
  if (verdict === "fits" || verdict === "universal") {
    // „Promeni vozilo“ keeps a control in the badge's place in the Tab order: after a choice
    // made from this badge, focus returns here with the verdict as its description (A11Y-02).
    return (
      <div
        className={cn(base, "flex-col gap-1 bg-success-subtle text-success")}
        data-testid="fitment-badge"
        data-fit="fits"
      >
        <p id={verdictId} className="flex items-start gap-2">
          <CheckCircleIcon size={18} weight="fill" aria-hidden="true" className="mt-0.5 shrink-0" />
          <span>
            {verdict === "universal" ? "Univerzalni deo — odgovara za " : "Odgovara za "}
            <strong className="font-semibold">
              {name}
              {engine}
            </strong>
          </span>
        </p>
        <button
          type="button"
          onClick={openVehiclePicker}
          aria-describedby={verdictId}
          className="ml-6.5 inline-flex min-h-8 cursor-pointer self-start type-caption font-semibold text-ink-1 underline decoration-line-strong underline-offset-4 hover:decoration-accent"
        >
          Promeni vozilo
        </button>
      </div>
    );
  }
  if (verdict === "generation_only" || verdict === "choose_generation") {
    return (
      <div
        className={cn(base, "flex-col gap-1 bg-warning-subtle text-warning")}
        data-testid="fitment-badge"
        data-fit="check"
      >
        <p className="flex items-start gap-2">
          <QuestionIcon size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
          <span>
            {verdict === "generation_only"
              ? `Odgovara za ${name} — proverite oznaku motora`
              : `Za ${vehicle.model.name} izaberite generaciju i motor`}
          </span>
        </p>
        <button
          type="button"
          onClick={openVehiclePicker}
          className="ml-6.5 inline-flex min-h-8 cursor-pointer self-start type-caption font-semibold text-ink-1 underline decoration-line-strong underline-offset-4 hover:decoration-accent"
        >
          {verdict === "generation_only" ? "Izaberite motor" : "Dopunite vozilo"}
        </button>
      </div>
    );
  }
  return (
    <div
      className={cn(base, "flex-col gap-1 bg-danger-subtle text-danger")}
      data-testid="fitment-badge"
      data-fit="no"
    >
      <p className="flex items-start gap-2">
        <XCircleIcon size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
        <span>
          Ne odgovara za {name}
          {engine} prema našim podacima
        </span>
      </p>
      <Link
        href={ROUTES.inquiryWith({ proizvod: productSlug })}
        variant="inline"
        className="ml-6.5 type-caption font-semibold text-ink-1"
      >
        Proverite po broju šasije
      </Link>
    </div>
  );
}
