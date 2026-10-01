"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useRef,
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
 * Values typed into server-rendered controls before React hydrated them (XB-01), for controlled
 * inputs: read them in a layout effect of the hydration commit (the DOM still holds what was
 * typed; the controlled input is reset only on its next update) and adopt them into state.
 * Forms built on react-hook-form use useKeepTypedBeforeHydration instead — RHF's register() ref
 * overwrites the DOM inside the commit. Returns only non-empty values; on a client-side
 * navigation the controls are new and empty, so the result is {}.
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

/** A react-hook-form register() result: the field name and its callback ref. */
type Registration<N extends string> = { name: N; ref: (instance: Element | null) => void };

/**
 * XB-01 for react-hook-form text fields. RHF's register() ref writes the default value into the
 * control when it attaches, and a concurrent hydration render can yield to the browser, so keys
 * pressed after that render are only in the DOM when the commit starts. `keep(register("vin"))`
 * wraps the ref: in the hydration commit it reads the DOM value first, then lets RHF attach. The
 * form's layout effect runs after its children's refs in the same commit and passes every
 * captured value to `restore` (setValue) before paint. Later commits capture nothing: re-renders
 * re-attach the same element, and on a client-side navigation the controls start empty.
 * The wrapped controls must commit together with the form (no Suspense boundary in between).
 */
export function useKeepTypedBeforeHydration<N extends string>(
  restore: (name: N, value: string) => void,
) {
  const typed = useRef<Map<N, string> | null>(new Map());
  const onRestore = useEffectEvent(restore);
  useLayoutEffect(() => {
    const captured = typed.current;
    typed.current = null;
    captured?.forEach((value, name) => onRestore(name, value));
  }, []);
  return useCallback(
    <R extends Registration<N>>(registration: R): R => ({
      ...registration,
      ref: (el: Element | null) => {
        const pending = typed.current;
        if (
          pending &&
          (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) &&
          el.value !== ""
        ) {
          pending.set(registration.name, el.value);
        }
        registration.ref(el);
      },
    }),
    [],
  );
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
