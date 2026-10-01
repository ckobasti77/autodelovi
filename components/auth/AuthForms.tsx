"use client";

/**
 * Registration and password reset (Convex Auth Password provider): same field anatomy and
 * error handling as the sign-in form. Paste is always allowed (WCAG 3.3.8); no cognitive tests.
 *
 * Both forms only work through JavaScript (Convex Auth): `method="post"` keeps the password out
 * of the URL if the browser ever submits them natively, and the submit button stays disabled
 * until hydration (A11Y-04). Text typed before hydration is kept (XB-01).
 */
import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { WarningCircleIcon } from "@phosphor-icons/react/dist/ssr";

import { normalizeEmail } from "@/lib/domain/identifiers";
import { convexErrorMessage, TERMS } from "@/lib/i18n/sr/shop";
import { emailProblem, passwordProblem } from "@/lib/validation/identifiers";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import {
  Field,
  FormNoScript,
  readPrehydrationValues,
  RequiredUnlessOptional,
  useHydrated,
} from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Link } from "@/components/ui/Link";
import { ROUTES } from "@/constants/routes";

const PASSWORD_HELP = "Najmanje 10 znakova, bar jedno slovo i jedna cifra.";
const NO_SCRIPT =
  "Za nalog je potreban JavaScript. Uključite ga u pregledaču, pa osvežite stranicu.";

/** Sign-up fields in form order (error summary, ids). */
const SIGN_UP_IDS = { name: "su-name", email: "su-email", password: "su-password" } as const;
type SignUpField = keyof typeof SIGN_UP_IDS | "terms";

/**
 * Controlled text inputs: hydration leaves what the visitor typed in the DOM, but the next
 * update of the input would reset it to the (empty) state. Adopt the DOM values in the
 * hydration commit (XB-01). On a client-side mount the controls are empty → no-op.
 */
function useAdoptPrehydrationValues<K extends string>(
  ids: Record<K, string>,
  apply: (values: Partial<Record<K, string>>) => void,
) {
  const once = useRef({ ids, apply });
  useLayoutEffect(() => {
    const values = readPrehydrationValues(once.current.ids);
    if (Object.keys(values).length) once.current.apply(values);
  }, []);
}

export function SignUpForm({ next }: { next: string }) {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const hydrated = useHydrated();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<SignUpField, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const summary = useRef<HTMLDivElement>(null);

  useAdoptPrehydrationValues(SIGN_UP_IDS, (v) => {
    if (v.name) setName(v.name);
    if (v.email) setEmail(v.email);
    if (v.password) setPassword(v.password);
  });

  const focusSummary = () => requestAnimationFrame(() => summary.current?.focus());

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const e: Partial<Record<SignUpField, string>> = {};
    if (!name.trim()) e.name = "Upišite ime i prezime.";
    const emailError = emailProblem(email);
    if (emailError) e.email = emailError;
    const pw = passwordProblem(password, email);
    if (pw) e.password = pw;
    if (!terms) e.terms = "Potrebna je saglasnost sa uslovima korišćenja.";
    setErrors(e);
    setFormError(null);
    // A11Y-13: the summary lists every problem and takes focus, as in the mechanic registration.
    if (Object.keys(e).length) return focusSummary();
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
      focusSummary();
    }
  };

  const errorList = (["name", "email", "password", "terms"] as const)
    .map((k) => ({ k, message: errors[k] }))
    .filter((x): x is { k: SignUpField; message: string } => typeof x.message === "string");

  return (
    <form
      method="post"
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-5"
      data-reveal="off"
    >
      <RequiredUnlessOptional>
        <div ref={summary} tabIndex={-1} className="outline-none">
          {errorList.length || formError ? (
            <div role="alert" className="rounded-sm border border-danger bg-danger-subtle p-4">
              <p className="flex items-center gap-2 type-body-s font-semibold text-danger">
                <WarningCircleIcon size={18} aria-hidden="true" />
                {formError ?? "Proverite označena polja:"}
              </p>
              {errorList.length ? (
                <ul className="mt-2 flex flex-col gap-1 pl-6.5 type-body-s">
                  {errorList.map((x) => (
                    <li key={x.k}>
                      <a
                        href={`#${x.k === "terms" ? "su-terms" : SIGN_UP_IDS[x.k]}`}
                        className="text-ink-1 underline decoration-line-strong underline-offset-4"
                      >
                        {x.message}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
        <Field id={SIGN_UP_IDS.name} label="Ime i prezime" error={errors.name}>
          <Input
            name="name"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field id={SIGN_UP_IDS.email} label={TERMS.email} error={errors.email}>
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
        <Field
          id={SIGN_UP_IDS.password}
          label="Lozinka"
          help={PASSWORD_HELP}
          error={errors.password}
        >
          <Input
            name="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            data-testid="signup-password"
          />
        </Field>
        <Checkbox
          id="su-terms"
          checked={terms}
          onCheckedChange={(c) => setTerms(c === true)}
          required
          error={errors.terms}
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
        <Button
          type="submit"
          loading={pending}
          disabled={!hydrated}
          fullWidth
          size="lg"
          data-testid="signup-submit"
        >
          Napravi nalog
        </Button>
        <FormNoScript>{NO_SCRIPT}</FormNoScript>
      </RequiredUnlessOptional>
    </form>
  );
}

export function ResetPasswordForm() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const hydrated = useHydrated();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useAdoptPrehydrationValues({ email: "rp-email" }, (v) => {
    if (v.email) setEmail(v.email);
  });

  const requestCode = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const emailError = emailProblem(email);
    if (emailError) return setError(emailError);
    setPending(true);
    try {
      await signIn("password", { flow: "reset", email: normalizeEmail(email) });
      setStep("code");
    } catch (err) {
      setError(
        convexErrorMessage(
          err,
          "Kod nije poslat. Proverite adresu ili pokušajte za nekoliko minuta.",
        ),
      );
    } finally {
      setPending(false);
    }
  };

  const confirm = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!/^\d{8}$/.test(code.trim())) return setError("Kod ima 8 cifara.");
    const pw = passwordProblem(password, email);
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
      <form
        method="post"
        onSubmit={requestCode}
        noValidate
        className="flex flex-col gap-5"
        data-reveal="off"
      >
        <RequiredUnlessOptional>
          <p className="type-body text-ink-2">
            Upišite e-poštu naloga&nbsp;— poslaćemo kod od 8 cifara (važi 15 minuta).
          </p>
          <Field id="rp-email" label={TERMS.email} error={error}>
            <Input
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Button type="submit" loading={pending} disabled={!hydrated} fullWidth size="lg">
            Pošalji kod
          </Button>
          <FormNoScript>{NO_SCRIPT}</FormNoScript>
        </RequiredUnlessOptional>
      </form>
    );
  }
  return (
    <form
      method="post"
      onSubmit={confirm}
      noValidate
      className="flex flex-col gap-5"
      data-reveal="off"
    >
      <RequiredUnlessOptional>
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
          <Input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Button type="submit" loading={pending} fullWidth size="lg">
          Sačuvaj novu lozinku
        </Button>
        <Button type="button" variant="ghost" onClick={() => setStep("email")}>
          Pošalji novi kod
        </Button>
      </RequiredUnlessOptional>
    </form>
  );
}
