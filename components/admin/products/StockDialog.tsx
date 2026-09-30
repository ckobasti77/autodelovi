"use client";

/**
 * Stock change with a reason (brief §5: every change with reason and actor → stock log):
 * receipt / correction (count) / return / manual; enter the new quantity or a ± change.
 */
import { useMutation } from "convex/react";
import { useState } from "react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { STOCK_REASON_LABEL } from "@/lib/i18n/sr/admin";
import { convexErrorMessage } from "@/lib/i18n/sr/shop";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { RadioGroup } from "@/components/ui/Radio";
import { Select } from "@/components/ui/Select";
import { toast } from "@/components/ui/Toast";

type Reason = "receipt" | "correction" | "return" | "manual";

export function StockDialog({
  open,
  onOpenChange,
  productId,
  sku,
  current,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  productId: Id<"products">;
  sku: string;
  current: number;
}) {
  const adjust = useMutation(api.catalog.productsAdmin.adjustStock);
  const [mode, setMode] = useState<"delta" | "set">("delta");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState<Reason>("receipt");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const n = Number(value.replace(",", "."));
  const delta = value.trim() && Number.isInteger(n) ? (mode === "delta" ? n : n - current) : null;
  const after = delta !== null ? current + delta : null;
  const valid = delta !== null && delta !== 0 && after !== null && after >= 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => !busy && onOpenChange(v)}
      title={`Promena stanja — ${sku}`}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
            Odustani
          </Button>
          <Button
            loading={busy}
            disabled={!valid}
            onClick={async () => {
              if (!valid || delta === null) return;
              setBusy(true);
              try {
                const res = await adjust({
                  productId,
                  delta,
                  reason,
                  ...(note.trim() ? { note: note.trim() } : {}),
                });
                toast.success(`${sku}: stanje ${current} → ${res.stockQty} kom.`);
                setValue("");
                setNote("");
                onOpenChange(false);
              } catch (err) {
                toast.error(convexErrorMessage(err, "Stanje nije promenjeno."));
              } finally {
                setBusy(false);
              }
            }}
          >
            Sačuvaj stanje
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="type-body-s text-ink-2">
          Trenutno na stanju:{" "}
          <span className="font-semibold tabular-nums text-ink-1">{current} kom.</span>
        </p>
        <RadioGroup
          label="Kako upisujete"
          value={mode}
          onValueChange={(v) => setMode(v as "delta" | "set")}
          options={[
            { value: "delta", label: "Promena (+ prijem, − otpis)" },
            { value: "set", label: "Novo stanje (popis)" },
          ]}
        />
        <Field
          label={mode === "delta" ? "Promena u komadima" : "Novo stanje u komadima"}
          error={after !== null && after < 0 ? "Stanje ne može biti manje od nule." : undefined}
        >
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            inputMode="numeric"
            placeholder={mode === "delta" ? "npr. 10 ili -2" : String(current)}
            suffix="kom."
            autoFocus
          />
        </Field>
        <Field label="Razlog">
          <Select
            value={reason}
            onChange={(e) => setReason(e.target.value as Reason)}
            options={(["receipt", "correction", "return", "manual"] as const).map((r) => ({
              value: r,
              label: STOCK_REASON_LABEL[r],
            }))}
          />
        </Field>
        <Field label="Napomena" optional help="npr. broj prijemnice ili dobavljač">
          <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
        </Field>
        {after !== null && after >= 0 && delta !== 0 ? (
          <p className="type-body-s text-ink-2">
            Posle promene:{" "}
            <span className="font-semibold tabular-nums text-ink-1">{after} kom.</span> (
            {delta! > 0 ? "+" : ""}
            {delta})
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}
