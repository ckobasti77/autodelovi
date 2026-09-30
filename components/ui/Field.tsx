"use client";

import { createContext, useContext, useId, type AriaAttributes, type ReactNode } from "react";
import { WarningCircleIcon, CheckCircleIcon } from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/cn";

type FieldContextValue = {
  id: string;
  describedBy: string | undefined;
  invalid: boolean;
  required: boolean;
  disabled: boolean;
};

const FieldContext = createContext<FieldContextValue | null>(null);

/** Props a control inside <Field> should spread (id, aria-describedby, aria-invalid, …). */
export function useFieldControl(props: {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: AriaAttributes["aria-invalid"];
  required?: boolean;
  disabled?: boolean;
}) {
  const field = useContext(FieldContext);
  const describedBy =
    [props["aria-describedby"], field?.describedBy].filter(Boolean).join(" ") || undefined;
  const invalid =
    props["aria-invalid"] === true || props["aria-invalid"] === "true" || field?.invalid === true;
  return {
    id: props.id ?? field?.id,
    "aria-describedby": describedBy,
    "aria-invalid": invalid || undefined,
    required: props.required ?? field?.required,
    disabled: props.disabled ?? field?.disabled,
    invalid,
  };
}

export type FieldProps = {
  label: ReactNode;
  /** Help text under the control (13 px ink-3). Replaced by the error when there is one. */
  help?: ReactNode;
  /** Error message — rendered with an icon, linked via aria-describedby, sets aria-invalid. */
  error?: ReactNode;
  /** Positive confirmation where a check is meaningful (e.g. „PIB je ispravan“). */
  success?: ReactNode;
  required?: boolean;
  /** Marks the field „nije obavezno“ next to the label (we mark optional, not required). */
  optional?: boolean;
  /** Marks the field „(obavezno)“ (admin forms, where most fields are optional — DS §12.1.4). */
  markRequired?: boolean;
  disabled?: boolean;
  /** Visually hide the label (it stays the accessible name). Use rarely — labels stay visible. */
  hideLabel?: boolean;
  id?: string;
  className?: string;
  children: ReactNode;
};

/**
 * Field (§9.2): label above (13 px 500 ink-2, always visible) → control → help or error.
 * Validation messages appear instantly, without motion.
 */
export function Field({
  label,
  help,
  error,
  success,
  required = false,
  optional = false,
  markRequired = false,
  disabled = false,
  hideLabel = false,
  id: idProp,
  className,
  children,
}: FieldProps) {
  const autoId = useId();
  const id = idProp ?? `f${autoId.replace(/:/g, "")}`;
  const messageId = `${id}-msg`;
  const hasMessage = Boolean(error || success || help);

  return (
    <FieldContext.Provider
      value={{
        id,
        describedBy: hasMessage ? messageId : undefined,
        invalid: Boolean(error),
        required,
        disabled,
      }}
    >
      <div className={cn("flex flex-col gap-2", className)} data-invalid={error ? "" : undefined}>
        <label htmlFor={id} className={cn("type-caption text-ink-2", hideLabel && "sr-only")}>
          {label}
          {optional ? <span className="font-normal text-ink-3"> (nije obavezno)</span> : null}
          {markRequired ? <span className="font-normal text-ink-3"> (obavezno)</span> : null}
        </label>
        {children}
        {error ? (
          <p
            id={messageId}
            className="flex items-start gap-1.5 type-caption text-danger"
            data-reveal="off"
          >
            <WarningCircleIcon size={16} aria-hidden="true" className="mt-px shrink-0" />
            <span>{error}</span>
          </p>
        ) : success ? (
          <p
            id={messageId}
            className="flex items-start gap-1.5 type-caption text-success"
            data-reveal="off"
          >
            <CheckCircleIcon size={16} aria-hidden="true" className="mt-px shrink-0" />
            <span>{success}</span>
          </p>
        ) : help ? (
          <p id={messageId} className="type-caption font-normal text-ink-3" data-reveal="off">
            {help}
          </p>
        ) : null}
      </div>
    </FieldContext.Provider>
  );
}
