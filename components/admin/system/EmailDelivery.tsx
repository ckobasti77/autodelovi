"use client";

/**
 * Shared pieces of Admin → E-pošta: the sub-navigation (Poruke · Šabloni) and the delivery
 * banner that states, in words, what happens to a message right now (log / test / live) and
 * what is missing before real sending.
 */
import { useQuery } from "convex/react";
import { usePathname } from "next/navigation";
import { InfoIcon, WarningIcon } from "@phosphor-icons/react/dist/ssr";

import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/cn";
import { EMAIL_MODE_LABEL } from "@/lib/i18n/sr/admin";
import { RouteLink } from "@/components/ui/RouteLink";
import { Skeleton } from "@/components/ui/Skeleton";
import { ADMIN } from "@/constants/routes";

import { useAdminShell } from "../shell/context";

const MODE_SENTENCE = {
  log: "Poruke se samo beleže ovde — ništa ne odlazi kupcima ni osoblju.",
  test: "Poruke idu kroz Resend u probnom režimu, na adresu delivered@resend.dev — ne stižu stvarnim primaocima.",
  live: "Poruke se šalju stvarnim primaocima.",
} as const;

export function EmailsNav() {
  const pathname = usePathname();
  const items = [
    { href: ADMIN.emails, label: "Poruke" },
    { href: ADMIN.emailTemplates, label: "Šabloni i probne poruke" },
  ];
  return (
    <nav aria-label="E-pošta" className="-mt-2 mb-5 flex gap-1 border-b border-line">
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <RouteLink
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px inline-flex h-10 items-center border-b-2 px-3 type-body-s transition-control focus-ring-inset",
              active
                ? "border-accent font-semibold text-ink-1"
                : "border-transparent text-ink-2 hover:text-ink-1",
            )}
          >
            {item.label}
          </RouteLink>
        );
      })}
    </nav>
  );
}

export function DeliveryBanner() {
  const config = useQuery(api.emailsAdmin.config, {});
  const { viewer } = useAdminShell();
  if (config === undefined) return <Skeleton className="mb-4 h-16 w-full" />;
  const downgraded = config.requested !== config.effective;
  const warn = config.effective === "log" || config.warnings.length > 0;
  return (
    <div
      role="status"
      className={cn(
        "mb-4 flex gap-3 rounded-md border px-4 py-3",
        warn ? "border-warning/40 bg-warning-subtle" : "border-line bg-surface-1",
      )}
      data-testid="email-delivery-banner"
    >
      {warn ? (
        <WarningIcon size={20} className="mt-0.5 shrink-0 text-warning" aria-hidden="true" />
      ) : (
        <InfoIcon size={20} className="mt-0.5 shrink-0 text-info" aria-hidden="true" />
      )}
      <div className="flex min-w-0 flex-col gap-1 type-body-s">
        <p className="text-ink-1">
          <span className="font-semibold">Režim slanja: {EMAIL_MODE_LABEL[config.effective]}.</span>{" "}
          {MODE_SENTENCE[config.effective]}
          {downgraded
            ? ` Traženo je „${EMAIL_MODE_LABEL[config.requested]}“, ali nešto nedostaje:`
            : ""}
        </p>
        {config.warnings.length ? (
          <ul className="list-disc pl-5 text-ink-2">
            {config.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        ) : null}
        <p className="text-ink-3">
          {config.from ? (
            <>
              Pošiljalac: <span className="text-ink-2">{config.from}</span>
              {" · "}
            </>
          ) : null}
          {config.replyTo ? (
            <>
              Odgovori idu na: <span className="text-ink-2">{config.replyTo}</span>
              {" · "}
            </>
          ) : null}
          {viewer.isOwner ? (
            <RouteLink
              href={ADMIN.settingsTab("obavestenja")}
              className="text-accent-text underline underline-offset-2"
            >
              Promenite režim slanja
            </RouteLink>
          ) : (
            "Režim menja vlasnik u podešavanjima."
          )}
        </p>
      </div>
    </div>
  );
}
