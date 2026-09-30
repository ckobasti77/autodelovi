"use client";

/**
 * „Javi mi kad stigne“ (§11.5): e-mail + consent, honeypot. The e-mail itself is sent by the
 * notifications step when stock returns; here the subscription is stored.
 */
import { useMutation } from "convex/react";
import { useState, type FormEvent } from "react";
import { BellIcon, CheckCircleIcon } from "@phosphor-icons/react/dist/ssr";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { isValidEmail } from "@/lib/domain/identifiers";
import { convexErrorMessage, ERRORS } from "@/lib/i18n/sr/shop";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Honeypot } from "@/components/forms/Honeypot";
import { TEST_IDS } from "@/constants/testIds";

export function BackInStockForm({ productId, productName }: { productId: string; productName: string }) {
  const subscribe = useMutation(api.backInStock.subscribe);
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const value = email.trim().toLowerCase();
    setError(null);
    setConsentError(null);
    if (!isValidEmail(value)) {
      setError(ERRORS.email);
      return;
    }
    if (!consent) {
      setConsentError("Potrebna je saglasnost da vam pošaljemo obaveštenje.");
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
      setError(convexErrorMessage(err, "Prijava nije sačuvana. Pokušajte ponovo."));
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
      onSubmit={onSubmit}
      noValidate
      data-testid={TEST_IDS.backInStockForm}
      className="relative flex scroll-mt-24 flex-col gap-3 rounded-sm border border-line bg-surface-1 p-4"
      aria-label={`Obaveštenje o dolasku: ${productName}`}
    >
      <p className="type-body-s font-semibold text-ink-1">Javi mi kad stigne</p>
      <Field label="E-pošta" error={error}>
        <Input
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ime@primer.rs"
        />
      </Field>
      <div>
        <Checkbox
          checked={consent}
          onCheckedChange={(v) => setConsent(v === true)}
          label="Pošaljite mi jedno obaveštenje kad artikal stigne."
          aria-invalid={consentError ? true : undefined}
        />
        {consentError ? (
          <p className="type-caption text-danger" role="alert">
            {consentError}
          </p>
        ) : null}
      </div>
      <Honeypot value={honeypot} onChange={setHoneypot} />
      <Button type="submit" variant="secondary" icon={<BellIcon size={20} />} loading={busy} className="self-start">
        Obavesti me
      </Button>
    </form>
  );
}
