"use client";

/**
 * Password field (§9.2) with the two affordances a password needs: a „Prikaži“ / „Sakrij“
 * toggle inside the frame (a word, not an eye — it says what it does; 4 px inside the 6 px
 * field) and a Caps Lock note in the help line. Paste is never blocked (WCAG 3.3.8).
 * Everything else is `Field` + `Input`: an id, a react-hook-form registration or a test id
 * passes straight through to the `<input>`.
 */
import { useState, type KeyboardEvent, type ReactNode } from "react";

import { Field } from "@/components/ui/Field";
import { Input, type InputProps } from "@/components/ui/Input";

type PasswordFieldProps = Omit<InputProps, "type" | "suffix" | "prefix" | "id"> & {
  /** Field id (also the anchor of an error summary link). */
  id?: string;
  label: ReactNode;
  help?: ReactNode;
  error?: ReactNode;
  required?: boolean;
};

export function PasswordField({
  id,
  label,
  help,
  error,
  required,
  onKeyDown,
  onKeyUp,
  onBlur,
  ...input
}: PasswordFieldProps) {
  const [shown, setShown] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const readCapsLock = (event: KeyboardEvent<HTMLInputElement>) =>
    setCapsLock(event.getModifierState?.("CapsLock") ?? false);

  return (
    <Field
      {...(id ? { id } : {})}
      label={label}
      error={error}
      required={required ?? false}
      help={
        capsLock ? <span className="font-medium text-warning">Uključen je Caps Lock.</span> : help
      }
    >
      <Input
        {...input}
        type={shown ? "text" : "password"}
        className="pr-1"
        onKeyDown={(event) => {
          readCapsLock(event);
          onKeyDown?.(event);
        }}
        onKeyUp={(event) => {
          readCapsLock(event);
          onKeyUp?.(event);
        }}
        onBlur={(event) => {
          setCapsLock(false);
          onBlur?.(event);
        }}
        suffix={
          <button
            type="button"
            aria-label={shown ? "Sakrij lozinku" : "Prikaži lozinku"}
            onClick={() => setShown((value) => !value)}
            className="inline-flex h-9 min-w-[4.25rem] cursor-pointer items-center justify-center rounded-xs px-2 type-caption font-semibold text-ink-2 transition-control hover:bg-surface-3 hover:text-ink-1"
          >
            {shown ? "Sakrij" : "Prikaži"}
          </button>
        }
      />
    </Field>
  );
}
