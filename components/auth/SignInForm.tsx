"use client";

/**
 * Minimal e-mail + password sign-in (step 05 proves the Convex Auth round trip on Next 16;
 * step 12 builds the full auth pages: registration, reset, error summary).
 */
import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { TEST_IDS } from "@/constants/testIds";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";

export function SignInForm({ next }: { next: string }) {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

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
      setError("Pogrešan e-mail ili lozinka. Proverite podatke i pokušajte ponovo.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5" data-reveal="off">
      <Field label="E-mail" required>
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
      <Button type="submit" loading={pending} fullWidth data-testid={TEST_IDS.authSubmit}>
        Prijavi se
      </Button>
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
