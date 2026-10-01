"use client";

/**
 * Confirmation for destructive or irreversible staff actions (DESIGN-SYSTEM §9.14):
 * explicit verb on the button, optional required reason, optional typed phrase for owner
 * actions („OBRIŠI DEMO“). „Odustani“ is locked while the action runs — except when the
 * connection is lost (FLOW-19): the write is queued and replays on reconnect, so the dialog
 * says so and can be closed („Zatvori“); a later failure still reaches staff as a toast.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";

import { convexErrorMessage } from "@/lib/i18n/sr/shop";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { toast } from "@/components/ui/Toast";

import { useConnectionLost } from "./hooks";

export type ConfirmOptions = {
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  /** Label of a required reason field (min 3 characters). */
  reasonLabel?: string;
  /** Exact phrase the user must type. */
  phrase?: string;
  onConfirm: (reason: string) => Promise<unknown> | unknown;
};

export function ConfirmDialog({
  open,
  onOpenChange,
  options,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: ConfirmOptions | null;
}) {
  return (
    <Dialog
      open={open && options !== null}
      onOpenChange={onOpenChange}
      title={options?.title ?? ""}
      role="alertdialog"
      size="sm"
    >
      {options ? (
        <Body key={options.title} options={options} close={() => onOpenChange(false)} />
      ) : null}
    </Dialog>
  );
}

function Body({ options, close }: { options: ConfirmOptions; close: () => void }) {
  const [reason, setReason] = useState("");
  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { lost } = useConnectionLost();
  const waiting = busy && lost;
  // Closed while the write waited for the connection: a later failure becomes a toast.
  const detached = useRef(false);
  useEffect(() => {
    detached.current = false;
    return () => {
      detached.current = true;
    };
  }, []);
  const reasonOk = !options.reasonLabel || reason.trim().length >= 3;
  const phraseOk = !options.phrase || phrase.trim() === options.phrase;

  const hasInputs = Boolean(options.reasonLabel || options.phrase);
  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await options.onConfirm(reason.trim());
      close();
    } catch (err) {
      const message = convexErrorMessage(err, "Radnja nije izvršena. Pokušajte ponovo.");
      if (detached.current) toast.error(message);
      else setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (reasonOk && phraseOk && !busy) void run();
      }}
    >
      {options.description ? (
        <div className="type-body-s text-ink-2">{options.description}</div>
      ) : null}
      {options.reasonLabel ? (
        <Field label={options.reasonLabel} required markRequired>
          <Textarea
            rows={3}
            maxLength={300}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            autoFocus
          />
        </Field>
      ) : null}
      {options.phrase ? (
        <Field
          label={
            <>
              Za potvrdu upišite: <span className="type-code">{options.phrase}</span>
            </>
          }
          required
        >
          <Input
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            autoComplete="off"
            autoFocus
          />
        </Field>
      ) : null}
      <p role="status" className={waiting ? "type-body-s text-ink-2" : "sr-only"}>
        {waiting
          ? "Nema veze sa serverom. Radnja čeka i biće izvršena čim se veza vrati; prozor možete zatvoriti."
          : ""}
      </p>
      {error ? (
        <p role="alert" className="type-body-s text-danger">
          {error}
        </p>
      ) : null}
      <div className="flex flex-col-reverse gap-3 border-t border-line pt-4 sm:flex-row sm:justify-end">
        {/* Without inputs, Enter confirms a safe action; a destructive one starts on „Odustani“. */}
        <Button
          type="button"
          variant="secondary"
          onClick={close}
          disabled={busy && !lost}
          autoFocus={!hasInputs && options.danger}
        >
          {waiting ? "Zatvori" : "Odustani"}
        </Button>
        <Button
          type="submit"
          variant={options.danger ? "danger" : "primary"}
          loading={busy}
          disabled={!reasonOk || !phraseOk}
          autoFocus={!hasInputs && !options.danger}
        >
          {waiting ? "Čeka vezu…" : options.confirmLabel}
        </Button>
      </div>
    </form>
  );
}

/** `const confirm = useConfirm(); confirm({...})` + `<ConfirmDialog {...confirm.props} />`. */
export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [open, setOpen] = useState(false);
  return {
    ask: (o: ConfirmOptions) => {
      setOptions(o);
      setOpen(true);
    },
    props: { open, onOpenChange: setOpen, options },
  };
}
