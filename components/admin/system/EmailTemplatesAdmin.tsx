"use client";

/**
 * `/admin/mejlovi/sabloni` — template gallery: every transactional e-mail rendered live with
 * sample data and the current settings (company, contacts, hours), at desktop or phone width
 * or as plain text, plus „Pošalji probnu poruku“ (log mode: it lands in the outbox).
 */
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { PaperPlaneTiltIcon } from "@phosphor-icons/react/dist/ssr";

import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/cn";
import { missingCompanyFields } from "@/lib/domain/company";
import {
  isTemplateKey,
  TEMPLATE_GROUP_LABEL,
  TEMPLATE_INFO,
  TEMPLATE_KEYS,
  type TemplateGroup,
  type TemplateKey,
} from "@/lib/email/catalog";
import { convexErrorMessage } from "@/lib/i18n/sr/shop";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/Toast";

import { useAdminShell } from "../shell/context";
import { CompanySetupNotice, PageHeader, SegmentedFilter } from "../ui";
import { useUrlFilters } from "../useUrlFilters";
import { emailPreviewHtml } from "@/lib/email/preview";
import { DeliveryBanner, EmailsNav } from "./EmailDelivery";

type View = "desktop" | "phone" | "text";

const VIEW_WIDTH: Record<Exclude<View, "text">, number> = { desktop: 680, phone: 375 };

const GROUPS = Object.keys(TEMPLATE_GROUP_LABEL) as TemplateGroup[];

export function EmailTemplatesAdmin() {
  const [filters, setFilters] = useUrlFilters(["sablon", "prikaz"] as const);
  const key: TemplateKey = isTemplateKey(filters.sablon) ? filters.sablon : "order_received";
  const view: View =
    filters.prikaz === "telefon" ? "phone" : filters.prikaz === "tekst" ? "text" : "desktop";
  const settings = useQuery(api.settings.getAdmin, {});
  const missing = settings ? missingCompanyFields(settings.company) : [];
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="E-pošta"
        description="Svaki šablon sa primerom podataka i vašim podešavanjima (firma, kontakt, radno vreme) — tačno kako ga kupac ili zaposleni vidi."
      />
      <EmailsNav />
      <DeliveryBanner />
      <CompanySetupNotice missing={missing} />
      <div className="grid gap-5 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <nav aria-label="Šabloni" className="flex flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
          {GROUPS.map((group) => (
            <div key={group}>
              <h2 className="mb-1 px-2 type-label uppercase text-ink-3">
                {TEMPLATE_GROUP_LABEL[group]}
              </h2>
              <ul className="flex flex-col">
                {TEMPLATE_KEYS.filter((k) => TEMPLATE_INFO[k].group === group).map((k) => {
                  const active = k === key;
                  return (
                    <li key={k}>
                      <button
                        type="button"
                        aria-current={active ? "true" : undefined}
                        onClick={() => setFilters({ sablon: k })}
                        className={cn(
                          "relative flex w-full cursor-pointer flex-col rounded-sm px-2 py-1.5 text-left transition-control focus-ring-inset",
                          active ? "bg-selected" : "hover:bg-surface-2",
                        )}
                      >
                        {active ? (
                          <span
                            className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-accent"
                            aria-hidden="true"
                          />
                        ) : null}
                        <span
                          className={cn(
                            "type-body-s",
                            active ? "font-semibold text-ink-1" : "text-ink-2",
                          )}
                        >
                          {TEMPLATE_INFO[k].label}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        <TemplatePreview
          templateKey={key}
          view={view}
          onView={(v) =>
            setFilters({ prikaz: v === "desktop" ? null : v === "phone" ? "telefon" : "tekst" })
          }
        />
      </div>
    </div>
  );
}

function TemplatePreview({
  templateKey,
  view,
  onView,
}: {
  templateKey: TemplateKey;
  view: View;
  onView: (v: View) => void;
}) {
  const preview = useQuery(api.emailsAdmin.preview, { key: templateKey });
  const info = TEMPLATE_INFO[templateKey];
  const [height, setHeight] = useState(900);
  return (
    <section
      aria-labelledby="template-title"
      className="min-w-0 panel"
      data-testid="template-preview"
      data-reveal="block"
    >
      <div className="flex flex-col gap-3 border-b border-line-faint p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 id="template-title" className="text-[1rem] font-semibold text-ink-1">
              {info.label}
            </h2>
            <p className="type-caption text-ink-3">Šalje se: {info.trigger}</p>
          </div>
          <SegmentedFilter
            label="Prikaz"
            value={view}
            onChange={onView}
            options={[
              { value: "desktop", label: "Računar" },
              { value: "phone", label: "Telefon" },
              { value: "text", label: "Običan tekst" },
            ]}
          />
        </div>
        {preview ? (
          <dl className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-3 gap-y-1 type-body-s">
            <dt className="text-ink-3">Naslov</dt>
            <dd className="font-semibold text-ink-1">{preview.subject}</dd>
            <dt className="text-ink-3">Pregled</dt>
            <dd className="text-ink-2">{preview.preheader}</dd>
          </dl>
        ) : (
          <Skeleton className="h-10 w-full" />
        )}
        <TestSendForm templateKey={templateKey} />
      </div>
      <div className="overflow-x-auto bg-surface-2 p-4 sm:p-6">
        {preview === undefined ? (
          <Skeleton className="mx-auto h-[600px] w-full max-w-[680px]" />
        ) : preview === null ? (
          <p className="type-body-s text-ink-2">Šablon ne postoji.</p>
        ) : view === "text" ? (
          <pre className="mx-auto max-w-[680px] whitespace-pre-wrap panel p-4 type-code text-ink-1 [overflow-wrap:anywhere]">
            {preview.text}
          </pre>
        ) : (
          <iframe
            key={`${templateKey}-${view}`}
            title={`Pregled šablona: ${info.label}`}
            // Same-origin without scripts: only to measure the height of our own markup.
            sandbox="allow-same-origin"
            srcDoc={emailPreviewHtml(preview.html)}
            onLoad={(e) => {
              const doc = e.currentTarget.contentDocument;
              if (doc) setHeight(Math.max(400, doc.documentElement.scrollHeight));
            }}
            style={{ width: VIEW_WIDTH[view], height }}
            className="mx-auto block max-w-none rounded-md border border-line bg-white"
          />
        )}
      </div>
    </section>
  );
}

function TestSendForm({ templateKey }: { templateKey: TemplateKey }) {
  const { viewer } = useAdminShell();
  const send = useMutation(api.emailsAdmin.sendTest);
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const onSubmit = async () => {
    setBusy(true);
    try {
      const res = await send({ key: templateKey, ...(to.trim() ? { to: to.trim() } : {}) });
      toast.success(
        res.mode === "log"
          ? `Probna poruka je zabeležena u poslatim porukama (režim „Samo zapis“, ${res.to}).`
          : res.mode === "test"
            ? `Probna poruka je predata Resend-u u probnom režimu (${res.to}).`
            : `Probna poruka je poslata na ${res.to}.`,
      );
    } catch (error) {
      toast.error(convexErrorMessage(error, "Probna poruka nije poslata."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        void onSubmit();
      }}
    >
      <Field label="Pošalji probnu poruku na" className="w-full max-w-sm">
        <Input
          type="email"
          inputMode="email"
          autoComplete="email"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder={viewer.email ?? "ime@primer.rs"}
        />
      </Field>
      <Button
        type="submit"
        variant="secondary"
        icon={<PaperPlaneTiltIcon size={18} aria-hidden="true" />}
        loading={busy}
      >
        Pošalji probnu poruku
      </Button>
    </form>
  );
}
