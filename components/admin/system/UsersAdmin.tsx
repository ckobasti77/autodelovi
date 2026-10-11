"use client";

/**
 * `/admin/korisnici` (owner): staff accounts with role, block controls and notification
 * preferences per person, and invites. An invite shows its one-time setup link once, with a
 * copy button — it works without e-mail delivery; in live mode it is also e-mailed.
 */
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { PlusIcon } from "@phosphor-icons/react/dist/ssr";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { compactDate, compactDateTime } from "@/lib/admin/format";
import { ADMIN_COPY, ROLE_LABEL } from "@/lib/i18n/sr/admin";
import { convexErrorMessage } from "@/lib/i18n/sr/shop";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/Toast";
import { ADMIN } from "@/constants/routes";

import { ConfirmDialog, useConfirm } from "../ConfirmDialog";
import { useNowMinute } from "../hooks";
import { useAdminShell } from "../shell/context";
import { NotificationPrefsMatrix } from "../settings/NotificationPrefsMatrix";
import { PageHeader, Section } from "../ui";

const INVITE_STATUS = {
  pending: { label: "Čeka prihvatanje", tone: "info" },
  accepted: { label: "Prihvaćena", tone: "success" },
  revoked: { label: "Povučena", tone: "neutral" },
  expired: { label: "Istekla", tone: "warning" },
} as const;

export function UsersAdmin() {
  const { viewer } = useAdminShell();
  const users = useQuery(api.staff.listUsers, {});
  const invites = useQuery(api.staff.listInvites, viewer.isOwner ? {} : "skip");
  const setRole = useMutation(api.staff.setRole);
  const setBlocked = useMutation(api.staff.setBlocked);
  const revoke = useMutation(api.staff.revokeInvite);
  const confirm = useConfirm();
  const nowMinute = useNowMinute();
  const [inviting, setInviting] = useState(false);
  const [prefsFor, setPrefsFor] = useState<{ id: Id<"users">; name: string } | null>(null);

  if (!viewer.isOwner)
    return <p className="type-body text-ink-2">Korisnike i pozivnice uređuje samo vlasnik.</p>;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Korisnici"
        description="Ko ima pristup administraciji. Vlasnik vidi sve i menja podešavanja; zaposleni rade porudžbine, upite i katalog."
        actions={
          <Button icon={<PlusIcon size={18} />} onClick={() => setInviting(true)}>
            Pozovi zaposlenog
          </Button>
        }
      />
      <Section title="Nalozi osoblja">
        {!users ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <div className="-mx-4 overflow-x-auto">
            <table className="w-full border-collapse text-cell">
              <caption className="sr-only">Nalozi osoblja</caption>
              <thead>
                <tr className="border-b border-line text-left type-label uppercase text-ink-3">
                  <th scope="col" className="px-4 py-2">
                    Ime
                  </th>
                  <th scope="col" className="px-2 py-2">
                    Uloga
                  </th>
                  <th scope="col" className="px-2 py-2">
                    Poslednja aktivnost
                  </th>
                  <th scope="col" className="px-4 py-2 text-right">
                    Pristup
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u._id} className="border-b border-line-faint">
                    <td className="px-4 py-2">
                      <span className="flex flex-col">
                        <span className="font-medium">
                          {u.name}
                          {u.isSelf ? <span className="text-ink-3"> (vi)</span> : null}
                        </span>
                        <span className="type-caption text-ink-3">{u.email}</span>
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      {u.isSelf ? (
                        ROLE_LABEL[u.role]
                      ) : (
                        <div className="w-40">
                          <Select
                            size="sm"
                            aria-label={`Uloga, ${u.name}`}
                            value={u.role}
                            onChange={(e) => {
                              const role = e.target.value as "owner" | "staff" | "customer";
                              confirm.ask({
                                title: `Promeniti ulogu za ${u.name}?`,
                                description:
                                  role === "customer"
                                    ? "Nalog gubi pristup administraciji i postaje običan kupac."
                                    : role === "owner"
                                      ? "Vlasnik menja podešavanja, cenovne razrede, korisnike i briše demo podatke."
                                      : "Zaposleni radi porudžbine, upite i katalog, bez podešavanja.",
                                confirmLabel: "Promeni ulogu",
                                onConfirm: () => setRole({ userId: u._id, role }),
                              });
                            }}
                            options={[
                              { value: "staff", label: ROLE_LABEL.staff },
                              { value: "owner", label: ROLE_LABEL.owner },
                              { value: "customer", label: "Bez pristupa (kupac)" },
                            ]}
                          />
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-2 tabular-nums text-ink-2">
                      {u.lastSeenAt ? compactDateTime(u.lastSeenAt, nowMinute) : "—"}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <span className="inline-flex flex-wrap items-center justify-end gap-2">
                        {!u.blocked ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setPrefsFor({ id: u._id as Id<"users">, name: u.name })}
                          >
                            Obaveštenja
                          </Button>
                        ) : null}
                        {u.isSelf ? null : u.blocked ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => void setBlocked({ userId: u._id, blocked: false })}
                          >
                            Odblokiraj
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() =>
                              confirm.ask({
                                title: `Blokirati ${u.name}?`,
                                description: "Nalog odmah gubi pristup; može se odblokirati.",
                                confirmLabel: "Blokiraj",
                                danger: true,
                                onConfirm: async () => {
                                  await setBlocked({ userId: u._id, blocked: true });
                                  toast.success(`${u.name} je blokiran.`, {
                                    action: {
                                      label: "Poništi",
                                      onClick: () =>
                                        void setBlocked({ userId: u._id, blocked: false }),
                                    },
                                  });
                                },
                              })
                            }
                          >
                            Blokiraj
                          </Button>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
      <Section title="Pozivnice">
        {!invites ? (
          <Skeleton className="h-24 w-full" />
        ) : invites.length === 0 ? (
          <p className="type-body-s text-ink-2">Još nema pozivnica.</p>
        ) : (
          <ul className="-mx-4 divide-y divide-line-faint">
            {invites.map((i) => (
              <li key={i._id} className="flex flex-wrap items-center gap-3 px-4 py-2 type-body-s">
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{i.email}</span>
                  <span className="text-ink-3">
                    {" "}
                    · {ROLE_LABEL[i.role]} · poslao {i.createdByName}{" "}
                    {compactDate(i.createdAt, nowMinute)}
                    {i.status === "pending"
                      ? ` · važi do ${compactDate(i.expiresAt, nowMinute)}`
                      : ""}
                  </span>
                </span>
                <Badge tone={INVITE_STATUS[i.status].tone}>{INVITE_STATUS[i.status].label}</Badge>
                {i.status === "pending" ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      confirm.ask({
                        title: `Povući pozivnicu za ${i.email}?`,
                        description: "Link prestaje da radi. Uvek možete poslati novu pozivnicu.",
                        confirmLabel: "Povuci pozivnicu",
                        danger: true,
                        onConfirm: () => revoke({ inviteId: i._id as Id<"staffInvites"> }),
                      })
                    }
                  >
                    Povuci
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Section>
      {inviting ? <InviteDialog onClose={() => setInviting(false)} /> : null}
      {prefsFor ? (
        <PrefsDialog userId={prefsFor.id} name={prefsFor.name} onClose={() => setPrefsFor(null)} />
      ) : null}
      <ConfirmDialog {...confirm.props} />
    </div>
  );
}

function PrefsDialog({
  userId,
  name,
  onClose,
}: {
  userId: Id<"users">;
  name: string;
  onClose: () => void;
}) {
  const prefs = useQuery(api.notifications.preferencesFor, { userId });
  const save = useMutation(api.notifications.setPreferencesFor);
  return (
    <Dialog
      open
      onOpenChange={(v) => !v && onClose()}
      title={`Obaveštenja — ${name}`}
      description="Šta ova osoba dobija u aplikaciji i e-poštom. Izmene se čuvaju odmah."
      footer={<Button onClick={onClose}>Gotovo</Button>}
    >
      {prefs === undefined ? (
        <Skeleton className="h-48 w-full" />
      ) : prefs === null ? (
        <p className="type-body-s text-ink-2">Ovaj nalog nema pristup administraciji.</p>
      ) : (
        <NotificationPrefsMatrix
          prefs={prefs}
          who={`, ${name}`}
          onChange={(next) =>
            void save({ userId, ...next })
              .then(() => toast.success(ADMIN_COPY.saved))
              .catch((err: unknown) =>
                toast.error(convexErrorMessage(err, ADMIN_COPY.genericError)),
              )
          }
        />
      )}
    </Dialog>
  );
}

function InviteDialog({ onClose }: { onClose: () => void }) {
  const create = useMutation(api.staff.createInvite);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"staff" | "owner">("staff");
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [emailed, setEmailed] = useState(false);
  return (
    <Dialog
      open
      onOpenChange={(v) => !v && !busy && onClose()}
      title={link ? "Pozivnica je napravljena" : "Pozovi zaposlenog"}
      footer={
        link ? (
          <Button onClick={onClose}>Gotovo</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Odustani
            </Button>
            <Button
              loading={busy}
              disabled={!email.includes("@")}
              onClick={async () => {
                setBusy(true);
                try {
                  const res = await create({ email, role });
                  setLink(`${window.location.origin}${ADMIN.invite(res.token)}`);
                  setEmailed(res.emailed);
                } catch (err) {
                  toast.error(convexErrorMessage(err, "Pozivnica nije napravljena."));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Napravi pozivnicu
            </Button>
          </>
        )
      }
    >
      {link ? (
        <div className="flex flex-col gap-3">
          <p className="type-body-s text-ink-2">
            {emailed ? (
              <>
                Pozivnica je poslata e-poštom na{" "}
                <span className="font-semibold text-ink-1">{email}</span>. Link možete poslati i
                sami (Viber, SMS).
              </>
            ) : (
              <>
                Pošaljite ovaj link osobi na{" "}
                <span className="font-semibold text-ink-1">{email}</span> (Viber, SMS, e-pošta).
              </>
            )}{" "}
            Link se prikazuje samo sada i važi 7 dana. Osoba se registruje ili prijavi tom adresom i
            prihvati pozivnicu.
          </p>
          <div className="flex items-center gap-2 rounded-sm border border-line bg-surface-2 p-2">
            <code
              className="min-w-0 flex-1 break-all type-code-s normal-case"
              data-testid="admin-invite-link"
            >
              {link}
            </code>
            <CopyButton value={link} label="Kopiraj link" />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Field label="E-pošta zaposlenog">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
          </Field>
          <Field label="Uloga">
            <Select
              value={role}
              onChange={(e) => setRole(e.target.value as "staff" | "owner")}
              options={[
                { value: "staff", label: "Zaposleni" },
                { value: "owner", label: "Vlasnik (sve dozvole)" },
              ]}
            />
          </Field>
        </div>
      )}
    </Dialog>
  );
}
