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

import { TEST_IDS } from "@/constants/testIds";
import { Button } from "@/components/ui/Button";
import { Field, FormNoScript, useHydrated } from "@/components/ui/Field";
import { TERMS } from "@/lib/i18n/sr/shop";
import { Input } from "@/components/ui/Input";

export function SignInForm({ next }: { next: string }) {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const hydrated = useHydrated();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const formData = new FormData(event.currentTarget);
    formData.set("flow", "signIn");
    try {
      await signIn("password", formData);
      router.replace(next);
      router.refresh();
    } catch {
      setError("Pogrešna adresa e-pošte ili lozinka. Proverite podatke i pokušajte ponovo.");
      setPending(false);
    }
  }

  return (
    <form
      method="post"
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-5"
      data-reveal="off"
    >
      <Field label={TERMS.email} required>
        <Input
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          data-testid={TEST_IDS.authEmail}
        />
      </Field>
      <Field label="Lozinka" required error={error ?? undefined}>
        <Input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          data-testid={TEST_IDS.authPassword}
        />
      </Field>
      {error ? (
        <p role="alert" className="sr-only" data-testid={TEST_IDS.authError}>
          {error}
        </p>
      ) : null}
      <Button
        type="submit"
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

export function SignOutButton() {
  const { signOut } = useAuthActions();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <Button
      variant="secondary"
      loading={pending}
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
