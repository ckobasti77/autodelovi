"use client";

/**
 * „Javi mi kad stigne“ (§11.5): e-mail + consent, honeypot. The e-mail itself is sent by the
 * notifications step when stock returns; here the subscription is stored.
 */
import { useMutation } from "convex/react";
import { useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { BellIcon, CheckCircleIcon, WarningCircleIcon } from "@phosphor-icons/react/dist/ssr";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { convexErrorMessage, TERMS } from "@/lib/i18n/sr/shop";
import { emailProblem } from "@/lib/validation/identifiers";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import {
  Field,
  readPrehydrationValues,
  RequiredUnlessOptional,
  useHydrated,
} from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Honeypot } from "@/components/forms/Honeypot";
import { TEST_IDS } from "@/constants/testIds";

const EMAIL_ID = "bis-email";

export function BackInStockForm({
  productId,
  productName,
}: {
  productId: string;
  productName: string;
}) {
  const subscribe = useMutation(api.backInStock.subscribe);
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const hydrated = useHydrated();
  const emailInput = useRef<HTMLInputElement>(null);
  const consentBox = useRef<HTMLButtonElement>(null);

  // XB-01: an address typed before hydration stays (the controlled input would reset it).
  useLayoutEffect(() => {
    const typed = readPrehydrationValues({ email: EMAIL_ID }).email;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of the pre-hydration DOM value
    if (typed) setEmail(typed);
  }, []);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const value = email.trim().toLowerCase();
    setError(null);
    setConsentError(null);
    setServerError(null);
    // A11Y-08: focus moves to the field that needs fixing, which announces its message.
    const problem = emailProblem(value);
    if (problem) {
      setError(problem);
      emailInput.current?.focus();
      return;
    }
    if (!consent) {
      setConsentError("Potrebna je saglasnost da vam pošaljemo obaveštenje.");
      consentBox.current?.focus();
      return;
    }
    setBusy(true);
    try {
      const result = await subscribe({
        productId: productId as Id<"products">,
        email: value,
        consent,
        honeypot,
      });
      setDone(
        result.status === "in_stock"
          ? "Artikal je u međuvremenu stigao — možete ga dodati u korpu."
          : result.status === "already"
            ? `Već ste prijavljeni. Javićemo vam na ${value} kad stigne.`
            : `Javićemo vam na ${value} kad stigne.`,
      );
    } catch (err) {
      setServerError(convexErrorMessage(err, "Prijava nije sačuvana. Pokušajte ponovo."));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <p
        role="status"
        className="flex items-start gap-2 rounded-xs bg-success-subtle px-3 py-3 type-body-s text-success"
        data-testid="back-in-stock-done"
      >
        <CheckCircleIcon size={18} weight="fill" aria-hidden="true" className="mt-0.5 shrink-0" />
        {done}
      </p>
    );
  }

  return (
    <form
      id="obavestenje"
      method="post"
      onSubmit={onSubmit}
      noValidate
      data-testid={TEST_IDS.backInStockForm}
      className="relative flex scroll-mt-24 flex-col gap-3 rounded-sm border border-line bg-surface-1 p-4"
      aria-label={`Obaveštenje o dolasku: ${productName}`}
    >
      <RequiredUnlessOptional>
        <p className="type-body-s font-semibold text-ink-1">Javi mi kad stigne</p>
        <Field id={EMAIL_ID} label={TERMS.email} error={error}>
          <Input
            ref={emailInput}
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ime@primer.rs"
          />
        </Field>
        <Checkbox
          ref={consentBox}
          checked={consent}
          onCheckedChange={(v) => setConsent(v === true)}
          label="Pošaljite mi jedno obaveštenje kad artikal stigne."
          required
          error={consentError}
        />
        {serverError ? (
          <p
            role="alert"
            className="flex items-start gap-1.5 type-caption text-danger"
            data-reveal="off"
          >
            <WarningCircleIcon size={16} aria-hidden="true" className="mt-px shrink-0" />
            <span>{serverError}</span>
          </p>
        ) : null}
        <Honeypot value={honeypot} onChange={setHoneypot} />
        <Button
          type="submit"
          variant="secondary"
          icon={<BellIcon size={20} />}
          loading={busy}
          disabled={!hydrated}
          className="self-start"
        >
          Obavesti me
        </Button>
      </RequiredUnlessOptional>
    </form>
  );
}
