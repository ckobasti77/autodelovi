"use client";

/**
 * `/admin/privatnost` (owner): requests under the data-protection law (ZZPL) — access /
 * portability (JSON export of everything stored about one person) and erasure
 * (anonymization). Works for an account (`?kupac=<id>` from the customer page) or for an
 * e-mail address used as a guest. Process: docs/PRIVACY-PROCESS.md.
 */
import { useConvex, useMutation, useQuery } from "convex/react";
import { useState, type FormEvent } from "react";
import { DownloadSimpleIcon, WarningIcon } from "@phosphor-icons/react/dist/ssr";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { downloadText } from "@/lib/admin/format";
import { isValidEmail, normalizeEmail } from "@/lib/domain/identifiers";
import { convexErrorMessage } from "@/lib/i18n/sr/shop";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { toast } from "@/components/ui/Toast";

import { ConfirmDialog, useConfirm } from "../ConfirmDialog";
import { useAdminShell } from "../shell/context";
import { PageHeader, Section } from "../ui";

const PHRASE = "ANONIMIZUJ";

const COUNT_LABEL: Record<string, string> = {
  orders: "Porudžbine",
  inquiries: "Upiti",
  inquiriesKept: "Upiti uz porudžbinu (anonimizovani)",
  inquiriesDeleted: "Obrisani upiti",
  savedVehicles: "Sačuvana vozila",
  favorites: "Omiljeni artikli",
  backInStock: "Obaveštenja o dolasku robe",
  cookieConsents: "Zapisi o kolačićima",
  notifications: "Obaveštenja u nalogu",
  customerNotes: "Beleške osoblja",
  mechanicProfile: "Profil majstora",
  account: "Nalog za prijavu",
};

export function PrivacyAdmin({ userId }: { userId: Id<"users"> | null }) {
  const { viewer } = useAdminShell();
  const convex = useConvex();
  const anonymize = useMutation(api.privacy.anonymize);
  const logExport = useMutation(api.privacy.logExport);
  const customer = useQuery(
    api.customersAdmin.get,
    userId && viewer.isOwner ? { userId } : "skip",
  );
  const confirm = useConfirm();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Record<string, number> | null>(null);

  if (!viewer.isOwner)
    return <p className="type-body text-ink-2">Zahteve za lične podatke obrađuje samo vlasnik.</p>;

  const target = (): { userId?: Id<"users">; email?: string } | null => {
    if (userId) return { userId };
    const clean = normalizeEmail(email);
    if (!isValidEmail(clean)) {
      setError("Upišite ispravnu e-mail adresu.");
      return null;
    }
    return { email: clean };
  };

  const exportData = async (event?: FormEvent) => {
    event?.preventDefault();
    setError(null);
    const args = target();
    if (!args) return;
    setBusy(true);
    try {
      const data = await convex.query(api.privacy.customerData, args);
      await logExport(args);
      downloadText(data.fileName, data.json, "application/json;charset=utf-8");
      setResult(data.counts);
      toast.success("Podaci su preuzeti.");
    } catch (err) {
      setError(convexErrorMessage(err, "Izvoz nije uspeo."));
    } finally {
      setBusy(false);
    }
  };

  const runAnonymize = async () => {
    const args = target();
    if (!args) return;
    const total: Record<string, number> = {};
    // Bounded passes: repeat until the server reports nothing is left.
    for (let pass = 0; pass < 20; pass++) {
      const r = await anonymize({ ...args, confirmPhrase: PHRASE });
      for (const [k, n] of Object.entries(r.counts)) total[k] = (total[k] ?? 0) + n;
      if (r.done) break;
    }
    setResult(total);
    toast.success("Podaci kupca su anonimizovani.");
  };

  const who = userId
    ? customer
      ? `${customer.user.name}${customer.user.email ? ` (${customer.user.email})` : ""}`
      : "izabrani kupac"
    : email.trim() || "kupac";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Privatnost"
        description="Zahtevi kupaca po Zakonu o zaštiti podataka o ličnosti: uvid u podatke i brisanje. Odgovor je dužan u roku od 30 dana."
      />
      <Section title={userId ? "Kupac" : "Kupac bez naloga ili po e-pošti"}>
        <form className="flex max-w-xl flex-col gap-4" onSubmit={exportData}>
          {userId ? (
            <p className="type-body text-ink-1">{who}</p>
          ) : (
            <Field label="E-pošta kupca" error={error}>
              <Input
                type="email"
                autoComplete="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
          )}
          {userId && error ? <p className="type-body-s text-danger">{error}</p> : null}
          <div className="flex flex-wrap gap-3">
            <Button
              type="submit"
              variant="secondary"
              icon={<DownloadSimpleIcon size={18} />}
              disabled={busy}
            >
              Preuzmi sve podatke (JSON)
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={busy}
              onClick={() => {
                setError(null);
                if (!target()) return;
                confirm.ask({
                  title: `Anonimizovati podatke: ${who}?`,
                  description:
                    "Porudžbine ostaju zbog knjigovodstva, ali bez imena, telefona, e-pošte i adrese. Upiti bez porudžbine, fotografije, vozila, omiljeni artikli, pretplate i nalog za prijavu se brišu. Ne može se poništiti.",
                  confirmLabel: "Anonimizuj",
                  danger: true,
                  phrase: PHRASE,
                  onConfirm: runAnonymize,
                });
              }}
            >
              Anonimizuj kupca
            </Button>
          </div>
        </form>
      </Section>
      <Section title="Šta se dešava">
        <ul className="flex max-w-2xl list-disc flex-col gap-2 pl-5 type-body-s text-ink-2">
          <li>
            Izvoz sadrži nalog, profil majstora, porudžbine, upite, vozila, omiljene artikle,
            pretplate i zapise o kolačićima. Pošaljite ga kupcu bezbednim kanalom.
          </li>
          <li>
            Posle anonimizacije kupac više ne može da se prijavi; ako želi da poručuje, pravi novi
            nalog.
          </li>
        </ul>
        <p className="mt-3 flex max-w-2xl items-start gap-2 type-body-s text-ink-2">
          <WarningIcon size={18} className="mt-0.5 shrink-0 text-danger" aria-hidden="true" />
          Podaci firme (naziv, PIB, adresa sedišta) na porudžbinama ostaju — to su podaci pravnog
          lica i deo knjigovodstvene evidencije.
        </p>
      </Section>
      {result ? (
        <Section title="Rezultat">
          <dl className="grid max-w-md grid-cols-[1fr_auto] gap-x-4 gap-y-1 type-body-s">
            {Object.entries(result).map(([k, n]) => (
              <div key={k} className="contents">
                <dt className="text-ink-3">{COUNT_LABEL[k] ?? k}</dt>
                <dd className="tabular-nums">{n}</dd>
              </div>
            ))}
          </dl>
        </Section>
      ) : null}
      <ConfirmDialog {...confirm.props} />
    </div>
  );
}
