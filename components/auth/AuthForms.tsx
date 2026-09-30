"use client";

/**
 * Registration and password reset (Convex Auth Password provider): same field anatomy and
 * error handling as the sign-in form. Paste is always allowed (WCAG 3.3.8); no cognitive tests.
 */
import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { isValidEmail, normalizeEmail } from "@/lib/domain/identifiers";
import { convexErrorMessage, ERRORS } from "@/lib/i18n/sr/shop";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Link } from "@/components/ui/Link";
import { ROUTES } from "@/constants/routes";

const PASSWORD_HELP = "Najmanje 10 znakova, bar jedno slovo i jedna cifra.";

function passwordError(password: string): string | null {
  if (password.length < 10) return "Lozinka mora imati najmanje 10 znakova.";
  if (!/\p{L}/u.test(password) || !/\d/.test(password)) return "Lozinka mora sadržati bar jedno slovo i jednu cifru.";
  return null;
}

export function SignUpForm({ next }: { next: string }) {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = ERRORS.required("ime i prezime");
    if (!isValidEmail(normalizeEmail(email))) e.email = ERRORS.email;
    const pw = passwordError(password);
    if (pw) e.password = pw;
    if (!terms) e.terms = "Potrebna je saglasnost sa uslovima korišćenja.";
    setErrors(e);
    setFormError(null);
    if (Object.keys(e).length) return;
    setPending(true);
    try {
      await signIn("password", {
        flow: "signUp",
        email: normalizeEmail(email),
        password,
        name: name.trim(),
      });
      router.replace(next);
      router.refresh();
    } catch (error) {
      setPending(false);
      setFormError(
        convexErrorMessage(
          error,
          "Nalog nije napravljen. Ako već imate nalog sa ovom adresom, prijavite se ili promenite lozinku.",
        ),
      );
    }
  };

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5" data-reveal="off">
      <Field label="Ime i prezime" error={errors.name}>
        <Input name="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="E-pošta" error={errors.email}>
        <Input
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          data-testid="signup-email"
        />
      </Field>
      <Field label="Lozinka" help={PASSWORD_HELP} error={errors.password}>
        <Input
          name="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          data-testid="signup-password"
        />
      </Field>
      <div>
        <Checkbox
          checked={terms}
          onCheckedChange={(c) => setTerms(c === true)}
          label={
            <span>
              Prihvatam{" "}
              <Link href={ROUTES.terms} variant="inline" target="_blank">
                uslove korišćenja
              </Link>{" "}
              i{" "}
              <Link href={ROUTES.privacy} variant="inline" target="_blank">
                politiku privatnosti
              </Link>
              .
            </span>
          }
        />
        {errors.terms ? <p className="type-caption text-danger">{errors.terms}</p> : null}
      </div>
      {formError ? (
        <p role="alert" className="rounded-sm border border-danger bg-danger-subtle p-3 type-body-s text-danger">
          {formError}
        </p>
      ) : null}
      <Button type="submit" loading={pending} fullWidth size="lg" data-testid="signup-submit">
        Napravi nalog
      </Button>
    </form>
  );
}

export function ResetPasswordForm() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const requestCode = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!isValidEmail(normalizeEmail(email))) return setError(ERRORS.email);
    setPending(true);
    try {
      await signIn("password", { flow: "reset", email: normalizeEmail(email) });
      setStep("code");
    } catch (err) {
      setError(convexErrorMessage(err, "Kod nije poslat. Proverite adresu ili pokušajte za nekoliko minuta."));
    } finally {
      setPending(false);
    }
  };

  const confirm = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!/^\d{8}$/.test(code.trim())) return setError("Kod ima 8 cifara.");
    const pw = passwordError(password);
    if (pw) return setError(pw);
    setPending(true);
    try {
      await signIn("password", {
        flow: "reset-verification",
        email: normalizeEmail(email),
        code: code.trim(),
        newPassword: password,
      });
      router.replace(ROUTES.account);
      router.refresh();
    } catch (err) {
      setPending(false);
      setError(convexErrorMessage(err, "Kod nije ispravan ili je istekao. Zatražite novi kod."));
    }
  };

  if (step === "email") {
    return (
      <form onSubmit={requestCode} noValidate className="flex flex-col gap-5" data-reveal="off">
        <p className="type-body text-ink-2">Pošaljite adresu naloga; stiže vam kod od 8 cifara, važi 15 minuta.</p>
        <Field label="E-pošta" error={error}>
          <Input type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Button type="submit" loading={pending} fullWidth size="lg">
          Pošalji kod
        </Button>
      </form>
    );
  }
  return (
    <form onSubmit={confirm} noValidate className="flex flex-col gap-5" data-reveal="off">
      <p className="type-body text-ink-2" role="status">
        Ako nalog postoji, kod je poslat na {normalizeEmail(email)}.
      </p>
      <Field label="Kod iz e-pošte">
        <Input
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={8}
          inputClassName="font-mono tracking-widest"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
      </Field>
      <Field label="Nova lozinka" help={PASSWORD_HELP} error={error}>
        <Input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <Button type="submit" loading={pending} fullWidth size="lg">
        Sačuvaj novu lozinku
      </Button>
      <Button type="button" variant="ghost" onClick={() => setStep("email")}>
        Pošalji novi kod
      </Button>
    </form>
  );
}
