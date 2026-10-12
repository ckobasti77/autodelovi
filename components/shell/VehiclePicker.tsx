"use client";

/**
 * Vehicle picker triggers (DESIGN-SYSTEM §9.4). The picker panel itself (Marka → Model →
 * Generacija → Motor) arrives with the vehicle data; these are the two entry points every
 * page uses: the field-like trigger (hero, catalog) and the header chip (slot).
 */
import { useId } from "react";
import { CarIcon, CaretDownIcon, XIcon } from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/cn";
import { TEST_IDS } from "@/constants/testIds";

export type ChosenVehicle = {
  /** Short label, e.g. „Golf VII · 2.0 TDI“. */
  label: string;
  /** Long label for the field, e.g. „VW Golf VII 2.0 TDI (CRLB)“. */
  fullLabel?: string;
};

type TriggerProps = {
  vehicle?: ChosenVehicle | null;
  onOpen: () => void;
  onClear?: () => void;
  className?: string;
};

/** Field-like trigger: label „Vaše vozilo“, 52 px field, clear button behind a divider. */
export function VehicleField({ vehicle, onOpen, onClear, className }: TriggerProps) {
  const labelId = `vf${useId().replace(/:/g, "")}`;
  return (
    <div className={cn("flex flex-col gap-2", className)} data-reveal="off">
      <span className="type-caption text-ink-2 max-sm:sr-only" id={labelId}>
        Vaše vozilo
      </span>
      <div className="flex h-13 items-stretch rounded-sm border border-control bg-surface-2 transition-control hover:border-ink-3">
        <button
          type="button"
          onClick={onOpen}
          aria-describedby={labelId}
          data-testid={TEST_IDS.vehiclePickerTrigger}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-sm px-3 text-left"
        >
          <CarIcon size={20} aria-hidden="true" className="shrink-0 text-ink-2" />
          {vehicle ? (
            <span className="min-w-0 flex-1 truncate text-[0.9375rem] font-semibold text-ink-1">
              {vehicle.fullLabel ?? vehicle.label}
            </span>
          ) : (
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[0.9375rem] font-semibold text-ink-1">Izaberite vozilo</span>
              <span className="truncate type-caption font-normal text-ink-3">
                marka, model, motor
              </span>
            </span>
          )}
          <span className="inline-flex shrink-0 items-center gap-1 text-[0.875rem] font-medium text-ink-3">
            <span className="sr-only xl:not-sr-only">{vehicle ? "Promeni" : "Izaberi"}</span>
            <CaretDownIcon size={16} aria-hidden="true" />
          </span>
        </button>
        {vehicle && onClear ? (
          <button
            type="button"
            onClick={onClear}
            aria-label="Ukloni izabrano vozilo"
            className="inline-flex w-12 shrink-0 cursor-pointer items-center justify-center rounded-l-none rounded-r-[calc(var(--radius-sm)-1px)] border-l border-line text-ink-2 transition-control hover:bg-surface-3 hover:text-ink-1"
          >
            <XIcon size={18} aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Header slot chip. Empty: a filled field-like chip („Izaberite vozilo“). Chosen: accent-subtle
 * with a 1 px accent edge (yours), car icon + label + clear (44 px hits).
 */
export function VehicleChip({ vehicle, onOpen, onClear, className }: TriggerProps) {
  if (!vehicle) {
    return (
      <button
        type="button"
        onClick={onOpen}
        data-testid={TEST_IDS.vehiclePickerTrigger}
        className={cn(
          // A field-like chip, the same family as the header search: filled, quiet edge.
          "inline-flex h-10 cursor-pointer items-center gap-2 rounded-sm border border-line-strong bg-surface-2 px-3 type-button-s text-ink-1 shadow-rest transition-control hover:border-ink-4 hover:bg-surface-3",
          className,
        )}
      >
        <CarIcon size={18} aria-hidden="true" className="text-ink-2" />
        Izaberite vozilo
      </button>
    );
  }
  return (
    <div
      className={cn(
        "inline-flex h-10 items-stretch rounded-sm border border-accent-edge bg-accent-subtle text-ink-1",
        className,
      )}
      data-reveal="off"
    >
      <button
        type="button"
        onClick={onOpen}
        data-testid={TEST_IDS.vehiclePickerTrigger}
        aria-label={`Vozilo: ${vehicle.label}. Promeni vozilo`}
        className="relative inline-flex cursor-pointer items-center gap-2 pl-3 pr-1 type-button-s before:absolute before:inset-x-0 before:-inset-y-1"
      >
        <CarIcon size={18} aria-hidden="true" />
        <span className="max-w-44 truncate">{vehicle.label}</span>
      </button>
      {onClear ? (
        <button
          type="button"
          onClick={onClear}
          aria-label="Ukloni izabrano vozilo"
          className="relative inline-flex w-8 cursor-pointer items-center justify-center text-ink-2 transition-control hover:text-ink-1 before:absolute before:-inset-x-1.5 before:-inset-y-1"
        >
          <XIcon size={14} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
