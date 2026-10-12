"use client";

/**
 * E-mail + password sign-in (Convex Auth). Registration and reset live in AuthForms.tsx.
 * Sign-in only works through JavaScript: `method="post"` keeps the password out of the URL if
 * the browser ever submits natively, and the button stays disabled until hydration (A11Y-04).
 * The inputs are uncontrolled (FormData), so text typed before hydration survives.
 */
import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { WarningCircleIcon } from "@phosphor-icons/react/dist/ssr";

import { TEST_IDS } from "@/constants/testIds";
import { ROUTES } from "@/constants/routes";
import { PasswordField } from "@/components/auth/PasswordField";
import { Button, type ButtonVariant } from "@/components/ui/Button";
import { Field, FormNoScript, useHydrated } from "@/components/ui/Field";
import { Link } from "@/components/ui/Link";
import { TERMS } from "@/lib/i18n/sr/shop";
import { Input } from "@/components/ui/Input";

const ERROR_ID = "si-error";

export function SignInForm({ next }: { next: string }) {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(false);
  const hydrated = useHydrated();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFailed(false);
    setPending(true);
    const formData = new FormData(event.currentTarget);
    formData.set("flow", "signIn");
    try {
      await signIn("password", formData);
      router.replace(next);
      router.refresh();
    } catch {
      setFailed(true);
      setPending(false);
    }
  }

  // The server never says which of the two was wrong, so both fields point at one message.
  const invalid = failed ? { "aria-invalid": true, "aria-describedby": ERROR_ID } : {};

  return (
    <form
      method="post"
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-5"
      data-reveal="off"
    >
      {failed ? (
        <div
          id={ERROR_ID}
          role="alert"
          data-testid={TEST_IDS.authError}
          className="rounded-md border border-danger bg-danger-subtle p-4"
        >
          <p className="flex items-start gap-2 type-body-s font-semibold text-danger">
            <WarningCircleIcon size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
            Pogrešna adresa e-pošte ili lozinka.
          </p>
          <p className="mt-1 pl-6.5 type-body-s text-ink-1">
            Proverite podatke i pokušajte ponovo. Ako se lozinke ne sećate,{" "}
            <Link href={ROUTES.forgotPassword} variant="inline">
              postavite novu
            </Link>
            .
          </p>
        </div>
      ) : null}
      <Field label={TERMS.email} required>
        <Input
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          data-testid={TEST_IDS.authEmail}
          {...invalid}
        />
      </Field>
      <div className="flex flex-col gap-2">
        <PasswordField
          label="Lozinka"
          required
          name="password"
          autoComplete="current-password"
          data-testid={TEST_IDS.authPassword}
          {...invalid}
        />
        <p className="type-body-s">
          <Link href={ROUTES.forgotPassword} variant="inline">
            Zaboravljena lozinka
          </Link>
        </p>
      </div>
      <Button
        type="submit"
        size="lg"
        loading={pending}
        disabled={!hydrated}
        fullWidth
        data-testid={TEST_IDS.authSubmit}
      >
        Prijavi se
      </Button>
      <FormNoScript>
        Za prijavu je potreban JavaScript. Uključite ga u pregledaču, pa osvežite stranicu.
      </FormNoScript>
    </form>
  );
}

export function SignOutButton({
  variant = "secondary",
  className,
}: {
  /** `secondary` beside a primary; `quiet` where it stands on its own (profile pages). */
  variant?: ButtonVariant;
  className?: string;
}) {
  const { signOut } = useAuthActions();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <Button
      variant={variant}
      loading={pending}
      className={className}
      data-testid={TEST_IDS.authSignOut}
      onClick={async () => {
        setPending(true);
        await signOut();
        router.refresh();
        setPending(false);
      }}
    >
      Odjavi se
    </Button>
  );
}
