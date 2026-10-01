"use client";

import {
  createContext,
  useContext,
  useId,
  useSyncExternalStore,
  type AriaAttributes,
  type ReactNode,
} from "react";
import { WarningCircleIcon, CheckCircleIcon } from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/cn";

type FieldContextValue = {
  id: string;
  describedBy: string | undefined;
  invalid: boolean;
  /** Announced as required (aria-required). */
  required: boolean;
  /** `required` was passed explicitly → the native attribute is set as well. */
  nativeRequired: boolean;
  disabled: boolean;
};

const FieldContext = createContext<FieldContextValue | null>(null);

/**
 * Shop forms mark the optional fields („nije obavezno“), so every other field is required.
 * Inside this provider a <Field> without `optional` is announced as required (aria-required,
 * not the native attribute, so the browser never shows its own validation bubble). Admin
 * forms mark required fields instead (DS §12.1.4) and do not use it.
 */
const RequiredByDefaultContext = createContext(false);

export function RequiredUnlessOptional({ children }: { children: ReactNode }) {
  return <RequiredByDefaultContext.Provider value>{children}</RequiredByDefaultContext.Provider>;
}

const noopSubscribe = () => () => {};

/**
 * False in the server render and during hydration, true once React owns the page. Submit
 * buttons of forms that cannot work without JavaScript stay disabled until then, so a submit
 * before hydration never becomes a native form submission (A11Y-04).
 */
export function useHydrated() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

/**
 * Shown only without JavaScript, next to a submit button that stays disabled until hydration:
 * these forms send through Convex and cannot work as a plain HTML submission (A11Y-04).
 */
export function FormNoScript({ children }: { children: ReactNode }) {
  return (
    <noscript>
      <p className="flex items-start gap-1.5 type-body-s text-ink-2" data-reveal="off">
        <WarningCircleIcon size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-warning" />
        <span>{children}</span>
      </p>
    </noscript>
  );
}

/**
 * Values typed into server-rendered controls before React hydrated them (XB-01). Call it in a
 * useState initializer: the hydration render runs before any ref attaches, so the DOM still
 * holds what the visitor typed (react-hook-form's ref writes the default value back at commit;
 * a controlled input is reset on its next update). Apply the result in a layout effect, never
 * in render — derived text would no longer match the server HTML. Returns only non-empty
 * values; on a client-side navigation the controls do not exist yet, so the result is {}.
 */
export function readPrehydrationValues<K extends string>(
  ids: Record<K, string>,
): Partial<Record<K, string>> {
  if (typeof document === "undefined") return {};
  const out: Partial<Record<K, string>> = {};
  for (const key of Object.keys(ids) as K[]) {
    const el = document.getElementById(ids[key]);
    if ((el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) && el.value !== "") {
      out[key] = el.value;
    }
  }
  return out;
}

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
    "aria-required": (props.required ?? field?.required) || undefined,
    required: props.required ?? (field?.nativeRequired || undefined),
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
  /** Also sets the native `required` attribute. Inside <RequiredUnlessOptional> every field
   * without `optional` is announced as required anyway. */
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
  const requiredByDefault = useContext(RequiredByDefaultContext);

  return (
    <FieldContext.Provider
      value={{
        id,
        describedBy: hasMessage ? messageId : undefined,
        invalid: Boolean(error),
        required: required || markRequired || (requiredByDefault && !optional),
        nativeRequired: required,
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
