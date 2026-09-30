"use client";

/** One-click confirmation for back-in-stock unsubscribe (all active alerts of the address). */
import { useMutation } from "convex/react";
import { useState } from "react";
import { CheckCircleIcon, WarningCircleIcon } from "@phosphor-icons/react/dist/ssr";

import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/Button";
import { Link } from "@/components/ui/Link";
import { ROUTES } from "@/constants/routes";

type State = "idle" | "busy" | "done" | "invalid";

export function UnsubscribeForm({ token }: { token: string }) {
  const unsubscribe = useMutation(api.backInStock.unsubscribe);
  const [state, setState] = useState<State>("idle");
  const onClick = async () => {
    setState("busy");
    try {
      const res = await unsubscribe({ token });
      setState(res.ok ? "done" : "invalid");
    } catch {
      setState("invalid");
    }
  };
  if (state === "done")
    return (
      <div role="status" className="flex items-start gap-3" data-testid="unsubscribe-done">
        <CheckCircleIcon
          size={24}
          weight="fill"
          className="shrink-0 text-success"
          aria-hidden="true"
        />
        <p className="type-body text-ink-2">
          Odjavljeni ste. Više vam ne šaljemo poruke „Stiglo je“ za ovu adresu. Novo obaveštenje
          možete uključiti na stranici artikla.
        </p>
      </div>
    );
  if (state === "invalid")
    return (
      <div role="status" className="flex flex-col gap-3">
        <p className="flex items-start gap-3 type-body text-ink-2">
          <WarningCircleIcon size={24} className="shrink-0 text-warning" aria-hidden="true" />
          Link nije ispravan ili je već iskorišćen. Ako i dalje dobijate poruke, javite nam se.
        </p>
        <Link href={ROUTES.contact} variant="standalone">
          Kontakt
        </Link>
      </div>
    );
  return (
    <div className="flex flex-col items-start gap-5">
      <p className="type-body text-ink-2">
        Ne šaljemo vam više poruke „Stiglo je“ za artikle koje ste pratili na ovoj e-adresi.
        Porudžbine i upiti ovo ne menja.
      </p>
      <Button
        loading={state === "busy"}
        onClick={() => void onClick()}
        data-testid="unsubscribe-confirm"
      >
        Odjavi me
      </Button>
    </div>
  );
}
