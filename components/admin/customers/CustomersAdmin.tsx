"use client";

/**
 * `/admin/kupci` and `/admin/kupci/[id]`: registered customer accounts (segment: all,
 * mechanics, blocked; exact e-mail lookup), detail with orders, inquiries, saved vehicles,
 * the mechanic profile, staff notes, block / unblock (with reason and „Poništi“).
 */
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeftIcon } from "@phosphor-icons/react/dist/ssr";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { compactDate, compactDateTime } from "@/lib/admin/format";
import { formatRSD } from "@/lib/format/money";
import { formatPhone } from "@/lib/format/phone";
import { MECHANIC_STATUS_LABEL, MECHANIC_STATUS_TONE } from "@/lib/i18n/sr/mechanic";
import { convexErrorMessage } from "@/lib/i18n/sr/shop";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";
import { RouteLink } from "@/components/ui/RouteLink";
import { Skeleton, SkeletonRegion } from "@/components/ui/Skeleton";
import { Textarea } from "@/components/ui/Textarea";
import { toast } from "@/components/ui/Toast";
import { ADMIN } from "@/constants/routes";

import { ConfirmDialog, useConfirm } from "../ConfirmDialog";
import { useNowMinute } from "../hooks";
import { useAdminCrumb, useAdminShell } from "../shell/context";
import {
  ActorLabel,
  DefinitionList,
  DemoTag,
  DocNumber,
  InquiryStatusBadge,
  LoadMoreFooter,
  OrderStatusBadge,
  PageHeader,
  SearchField,
  Section,
  SegmentedFilter,
} from "../ui";

type Row = FunctionReturnType<typeof api.customersAdmin.list>["page"][number];

export function CustomersList() {
  const router = useRouter();
  const nowMinute = useNowMinute();
  const [segment, setSegment] = useState<"all" | "mechanics" | "blocked">("all");
  const [email, setEmail] = useState("");
  const lookup = email.includes("@") ? email.trim() : "";
  const { results, status, loadMore } = usePaginatedQuery(
    api.customersAdmin.list,
    lookup ? { email: lookup } : { segment },
    { initialNumItems: 50 },
  );
  const columns = useMemo<ColumnDef<Row, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Kupac",
        cell: ({ row }) => (
          <span className="flex flex-col">
            <span className="flex items-center gap-2 font-medium text-ink-1">
              {row.original.name}
              {row.original.isDemo ? <DemoTag /> : null}
            </span>
            <span className="type-caption text-ink-3">{row.original.email}</span>
          </span>
        ),
      },
      {
        id: "phone",
        header: "Telefon",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="whitespace-nowrap tabular-nums text-ink-2">
            {row.original.phone ? formatPhone(row.original.phone) : "—"}
          </span>
        ),
      },
      {
        id: "type",
        header: "Nalog",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="flex items-center gap-1.5">
            {row.original.mechanicStatus !== "none" ? (
              <Badge tone={MECHANIC_STATUS_TONE[row.original.mechanicStatus]}>
                Majstor · {MECHANIC_STATUS_LABEL[row.original.mechanicStatus]}
              </Badge>
            ) : (
              <span className="text-ink-2">Kupac</span>
            )}
            {row.original.blocked ? <Badge tone="danger">Blokiran</Badge> : null}
          </span>
        ),
      },
      { accessorKey: "orderCount", header: "Porudžbine", meta: { align: "right" } },
      {
        accessorKey: "createdAt",
        header: "Registrovan",
        cell: ({ row }) => (
          <span className="tabular-nums text-ink-2">
            {compactDate(row.original.createdAt, nowMinute)}
          </span>
        ),
      },
    ],
    [nowMinute],
  );
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Kupci"
        description="Registrovani nalozi. Kupci bez naloga (gosti) su u porudžbinama — tražite ih po imenu, telefonu ili e-pošti."
      />
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedFilter
          label="Vrsta naloga"
          value={segment}
          onChange={setSegment}
          options={[
            { value: "all", label: "Svi" },
            { value: "mechanics", label: "Majstori" },
            { value: "blocked", label: "Blokirani" },
          ]}
        />
        <SearchField
          value={email}
          onChange={setEmail}
          label="Pronađi po e-pošti"
          placeholder="tačna e-mail adresa…"
        />
      </div>
      <DataTable
        caption="Kupci"
        columns={columns}
        data={results}
        getRowId={(r) => r._id}
        loading={status === "LoadingFirstPage"}
        onRowOpen={(r) => router.push(ADMIN.customer(r._id))}
        empty={
          <p className="py-10 text-center type-body-s text-ink-2">
            {lookup ? `Nema naloga sa adresom ${lookup}.` : "Nema kupaca u ovom izboru."}
          </p>
        }
      />
      <LoadMoreFooter
        shown={results.length}
        status={status}
        onMore={loadMore}
        forms={["kupac", "kupca", "kupaca"]}
      />
    </div>
  );
}

export function CustomerDetail({ userId }: { userId: Id<"users"> }) {
  const { viewer } = useAdminShell();
  const data = useQuery(api.customersAdmin.get, { userId });
  const nowMinute = useNowMinute();
  const addNote = useMutation(api.customersAdmin.addNote);
  const setBlocked = useMutation(api.customersAdmin.setBlocked);
  const confirm = useConfirm();
  const [note, setNote] = useState("");
  useAdminCrumb(data?.user.name ?? null);
  if (data === undefined)
    return (
      <SkeletonRegion>
        <Skeleton className="h-[480px] w-full" />
      </SkeletonRegion>
    );
  if (data === null) return <p className="type-body text-ink-2">Kupac ne postoji.</p>;
  const u = data.user;
  const isCustomer = u.role === "customer";
  return (
    <div className="flex flex-col gap-6">
      <RouteLink
        href={ADMIN.customers}
        className="inline-flex min-h-9 items-center gap-2 self-start type-body-s text-ink-2 hover:text-ink-1"
      >
        <ArrowLeftIcon size={16} aria-hidden="true" /> Kupci
      </RouteLink>
      <PageHeader
        title={u.name}
        description={`Nalog od ${compactDate(u.createdAt, nowMinute)}${u.lastSeenAt ? ` · poslednja aktivnost ${compactDateTime(u.lastSeenAt, nowMinute)}` : ""}`}
        meta={
          <>
            {u.blocked ? <Badge tone="danger">Blokiran</Badge> : null}
            {u.isDemo ? <DemoTag /> : null}
          </>
        }
        actions={
          isCustomer ? (
            u.blocked ? (
              <Button
                variant="secondary"
                onClick={() =>
                  void setBlocked({ userId: u._id, blocked: false }).then(() =>
                    toast.success("Nalog je odblokiran."),
                  )
                }
              >
                Odblokiraj
              </Button>
            ) : (
              <Button
                variant="danger"
                onClick={() =>
                  confirm.ask({
                    title: `Blokirati nalog ${u.name}?`,
                    description:
                      "Kupac više ne može da se prijavi; porudžbine i upiti ostaju u evidenciji.",
                    confirmLabel: "Blokiraj nalog",
                    danger: true,
                    reasonLabel: "Razlog blokade",
                    onConfirm: async (reason) => {
                      await setBlocked({ userId: u._id, blocked: true, reason });
                      toast.success("Nalog je blokiran.", {
                        action: {
                          label: "Poništi",
                          onClick: () => void setBlocked({ userId: u._id, blocked: false }),
                        },
                      });
                    },
                  })
                }
              >
                Blokiraj nalog
              </Button>
            )
          ) : null
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-6">
          <div className="grid grid-cols-3 gap-px border-y border-line bg-line">
            {[
              ["Porudžbine", String(data.stats.orders)],
              ["Ukupno", formatRSD(data.stats.valuePara)],
              ["U toku", String(data.stats.open)],
            ].map(([label, value]) => (
              <div key={label} className="flex flex-col gap-1 bg-bg px-4 py-3">
                <span className="type-caption text-ink-3">{label}</span>
                <span className="font-condensed text-[1.75rem] font-semibold tabular-nums leading-none">
                  {value}
                </span>
              </div>
            ))}
          </div>
          <Section title="Porudžbine">
            {data.orders.length === 0 ? (
              <p className="type-body-s text-ink-2">Kupac još nije poručivao.</p>
            ) : (
              <ul className="-mx-4 divide-y divide-line-faint">
                {data.orders.map((o) => (
                  <li key={o.number}>
                    <RouteLink
                      href={ADMIN.order(o.number)}
                      className="flex items-center gap-3 px-4 py-2 type-body-s hover:bg-surface-2"
                    >
                      <DocNumber number={o.number} />
                      <span className="tabular-nums text-ink-3">
                        {compactDate(o.createdAt, nowMinute)}
                      </span>
                      <span className="ml-auto tabular-nums">{formatRSD(o.totalPara)}</span>
                      <OrderStatusBadge status={o.status} />
                    </RouteLink>
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section title="Upiti">
            {data.inquiries.length === 0 ? (
              <p className="type-body-s text-ink-2">Nema upita.</p>
            ) : (
              <ul className="-mx-4 divide-y divide-line-faint">
                {data.inquiries.map((i) => (
                  <li key={i.number}>
                    <RouteLink
                      href={ADMIN.inquiry(i.number)}
                      className="flex items-center gap-3 px-4 py-2 type-body-s hover:bg-surface-2"
                    >
                      <DocNumber number={i.number} />
                      <span className="min-w-0 flex-1 truncate text-ink-2">{i.summary}</span>
                      <InquiryStatusBadge status={i.status} />
                    </RouteLink>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
        <aside className="flex flex-col gap-6" aria-label="Podaci o kupcu">
          <Section title="Kontakt">
            <DefinitionList
              rows={[
                {
                  label: "E-pošta",
                  value: u.email ? (
                    <a href={`mailto:${u.email}`} className="break-all hover:underline">
                      {u.email}
                    </a>
                  ) : (
                    "—"
                  ),
                },
                {
                  label: "Telefon",
                  value: u.phone ? (
                    <a href={`tel:${u.phone}`} className="tabular-nums hover:underline">
                      {formatPhone(u.phone)}
                    </a>
                  ) : (
                    "—"
                  ),
                },
                {
                  label: "Obaveštenja",
                  value: u.marketingConsent
                    ? "Pristao na ponude e-poštom"
                    : "Samo poruke o porudžbinama",
                },
              ]}
            />
          </Section>
          {data.mechanic ? (
            <Section
              title="Majstor"
              actions={
                <RouteLink
                  href={ADMIN.mechanic(data.mechanic.profileId)}
                  className="type-caption text-accent-text underline-offset-2 hover:underline"
                >
                  Profil i rabat
                </RouteLink>
              }
            >
              <DefinitionList
                rows={[
                  { label: "Servis", value: data.mechanic.companyName },
                  { label: "PIB", value: <span className="type-code">{data.mechanic.pib}</span> },
                  {
                    label: "Status",
                    value: (
                      <Badge tone={MECHANIC_STATUS_TONE[data.mechanic.status]}>
                        {MECHANIC_STATUS_LABEL[data.mechanic.status]}
                      </Badge>
                    ),
                  },
                  { label: "Nivo", value: data.mechanic.tierName ?? "—" },
                  {
                    label: "Odloženo",
                    value: data.mechanic.creditEnabled
                      ? `Da${data.mechanic.creditLimitPara !== null ? `, limit ${formatRSD(data.mechanic.creditLimitPara)}` : ""}`
                      : "Ne",
                  },
                ]}
              />
            </Section>
          ) : null}
          {data.vehicles.length > 0 ? (
            <Section title="Sačuvana vozila">
              <ul className="flex flex-col gap-2 type-body-s">
                {data.vehicles.map((v, i) => (
                  <li key={i}>
                    {v.label}
                    {v.vin ? <span className="type-code-s text-ink-3"> · {v.vin}</span> : null}
                    {v.plate ? <span className="text-ink-3"> · {v.plate}</span> : null}
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
          {viewer.isOwner && isCustomer ? (
            <Section title="Lični podaci">
              <p className="type-body-s text-ink-2">
                Zahtev kupca za uvid ili brisanje podataka (ZZPL).
              </p>
              <RouteLink
                href={ADMIN.privacyFor(u._id)}
                className="mt-2 inline-flex min-h-9 items-center type-body-s text-accent-text underline-offset-2 hover:underline"
              >
                Izvoz ili anonimizacija
              </RouteLink>
            </Section>
          ) : null}
          <Section title="Beleške osoblja">
            <form
              className="flex flex-col gap-3"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await addNote({ userId: u._id, message: note });
                  setNote("");
                } catch (err) {
                  toast.error(convexErrorMessage(err, "Beleška nije sačuvana."));
                }
              }}
            >
              <Textarea
                rows={3}
                maxLength={1000}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                aria-label="Nova beleška o kupcu"
              />
              <Button
                type="submit"
                variant="secondary"
                size="sm"
                className="self-end"
                disabled={!note.trim()}
              >
                Dodaj belešku
              </Button>
            </form>
            {data.notes.length > 0 ? (
              <ul className="mt-4 flex flex-col gap-3 border-t border-line-faint pt-3">
                {data.notes.map((n, i) => (
                  <li key={i} className="type-body-s">
                    <p className="text-ink-1">{n.message}</p>
                    <p className="type-caption text-ink-3">
                      {compactDateTime(n.at, nowMinute)} · <ActorLabel actor={n.actor} />
                    </p>
                  </li>
                ))}
              </ul>
            ) : null}
          </Section>
        </aside>
      </div>
      <ConfirmDialog {...confirm.props} />
    </div>
  );
}
