"use client";

/**
 * `/admin/pozivnica/[token]` (public, token-guarded, docs/SECURITY.md §D5): shows who the
 * invite is for; the invitee signs in or registers with that e-mail, then accepts. The role
 * is bound server-side only if the account e-mail matches the invite.
 */
import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { api } from "@/convex/_generated/api";
import { convexErrorMessage } from "@/lib/i18n/sr/shop";
import { BrandLink } from "@/components/brand/BrandLink";
import { Button } from "@/components/ui/Button";
import { RouteLink } from "@/components/ui/RouteLink";
import { Skeleton } from "@/components/ui/Skeleton";
import { ADMIN, ROUTES } from "@/constants/routes";

export function InviteAccept({ token }: { token: string }) {
  const info = useQuery(api.staff.inviteInfo, { token });
  const viewer = useQuery(api.users.viewer, {});
  const accept = useMutation(api.staff.acceptInvite);
  const { signOut } = useAuthActions();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const here = ADMIN.invite(token);
  const role = info?.role === "owner" ? "vlasnika" : "zaposlenog";

  let body: React.ReactNode;
  if (info === undefined || viewer === undefined) body = <Skeleton className="h-24 w-full" />;
  else if (info.status === "invalid")
    body = (
      <p className="type-body text-ink-2">
        Pozivnica ne postoji ili je povučena. Zatražite novu od vlasnika radnje.
      </p>
    );
  else if (info.status === "expired")
    body = (
      <p className="type-body text-ink-2">
        Pozivnica je istekla. Zatražite novu od vlasnika radnje.
      </p>
    );
  else if (info.status === "used")
    body = (
      <div className="flex flex-col gap-3">
        <p className="type-body text-ink-2">Pozivnica je već iskorišćena.</p>
        <Button asChild className="self-start">
          <RouteLink href={ADMIN.home}>Otvori administraciju</RouteLink>
        </Button>
      </div>
    );
  else if (!viewer)
    body = (
      <div className="flex flex-col gap-4">
        <p className="type-body text-ink-2">
          Pozivnica za pristup administraciji kao {role} poslata je na{" "}
          <span className="font-semibold text-ink-1">{info.emailMasked}</span>. Prijavite se tom
          adresom, ili napravite nalog ako ga nemate.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <RouteLink href={`${ROUTES.signIn}?next=${encodeURIComponent(here)}`}>
              Prijavi se
            </RouteLink>
          </Button>
          <Button asChild variant="secondary">
            <RouteLink href={`${ROUTES.signUp}?next=${encodeURIComponent(here)}`}>
              Napravi nalog
            </RouteLink>
          </Button>
        </div>
      </div>
    );
  else if (!info.emailMatches)
    body = (
      <div className="flex flex-col gap-4">
        <p className="type-body text-ink-2">
          Prijavljeni ste kao <span className="font-semibold text-ink-1">{viewer.email}</span>, a
          pozivnica je za {info.emailMasked}. Odjavite se i prijavite adresom iz pozivnice.
        </p>
        <Button
          variant="secondary"
          className="self-start"
          onClick={() => void signOut().then(() => router.refresh())}
        >
          Odjavi se
        </Button>
      </div>
    );
  else
    body = (
      <div className="flex flex-col gap-4">
        <p className="type-body text-ink-2">
          Prihvatanjem dobijate pristup administraciji kao {role}. Nalog:{" "}
          <span className="font-semibold text-ink-1">{viewer.email}</span>.
        </p>
        {error ? (
          <p role="alert" className="type-body-s text-danger">
            {error}
          </p>
        ) : null}
        <Button
          className="self-start"
          loading={busy}
          data-testid="admin-invite-accept"
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await accept({ token });
              router.replace(ADMIN.home);
              router.refresh();
            } catch (err) {
              setError(convexErrorMessage(err, "Pozivnica nije prihvaćena."));
              setBusy(false);
            }
          }}
        >
          Prihvati pozivnicu
        </Button>
      </div>
    );

  return (
    <div
      data-theme="paper"
      data-reveal="off"
      className="flex min-h-dvh items-center justify-center bg-bg px-4 py-10 text-ink-1"
    >
      <main
        id="sadrzaj"
        className="flex w-full max-w-lg flex-col gap-6 rounded-md bg-surface-1 p-8 shadow-overlay"
      >
        <BrandLink size="fixed" className="self-start" />
        <h1 className="text-[1.375rem] font-[650] leading-tight">Pozivnica za administraciju</h1>
        {body}
      </main>
    </div>
  );
}
