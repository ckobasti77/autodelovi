import {
  HourglassIcon,
  ProhibitIcon,
  SealCheckIcon,
  XCircleIcon,
} from "@phosphor-icons/react/dist/ssr";

import type { ContactLink } from "@/config/site";
import { formatDate } from "@/lib/format/date";
import {
  MECHANIC_STATUS_LABEL,
  MECHANIC_STATUS_TONE,
  type MechanicStatus,
} from "@/lib/i18n/sr/mechanic";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Link } from "@/components/ui/Link";
import { ContactActions } from "@/components/shell/ContactActions";
import { ROUTES } from "@/constants/routes";
import { TEST_IDS } from "@/constants/testIds";

export type StatusProfile = {
  status: MechanicStatus;
  companyName: string;
  pib: string;
  city: string;
  submittedAt: number;
  rejectionReason: string | null;
};

const ICON: Record<MechanicStatus, React.ReactNode> = {
  pending: <HourglassIcon size={14} />,
  approved: <SealCheckIcon size={14} />,
  rejected: <XCircleIcon size={14} />,
  suspended: <ProhibitIcon size={14} />,
};

const COPY: Record<Exclude<MechanicStatus, "approved">, { title: string; body: string }> = {
  pending: {
    title: "Registracija je primljena",
    body: "Podatke servisa proveravamo u toku radnog dana; kad odobrimo nalog, stiže vam poruka e-poštom sa nivoom rabata i cene na sajtu postaju vaše. Do tada možete da poručujete po maloprodajnim cenama.",
  },
  rejected: {
    title: "Registracija nije odobrena",
    body: "Ako mislite da je greška ili su se podaci promenili, pozovite nas — nalog možemo ponovo da pregledamo.",
  },
  suspended: {
    title: "Nalog je pauziran",
    body: "Majstorske cene i odloženo plaćanje su privremeno isključeni. Pozovite nas da proverimo šta treba srediti.",
  },
};

/**
 * `/majstor` for accounts that are not (yet) approved mechanics: no profile → registration
 * CTA; pending / rejected / suspended → what happens next and how to reach us.
 */
export function MechanicStatusScreen({
  profile,
  contacts,
}: {
  profile: StatusProfile | null;
  contacts: ContactLink[];
}) {
  if (!profile) {
    return (
      <section
        aria-labelledby="ms-title"
        className="flex max-w-[44rem] flex-col items-start gap-5"
        data-testid={TEST_IDS.mechanicStatus}
        data-status="none"
      >
        <h2 id="ms-title" className="type-h2 text-ink-1">
          Ovaj nalog nema registrovan servis
        </h2>
        <p className="type-body text-ink-2">
          Majstorski portal — brza porudžbina po OEM brojevima, vaša cena sa rabatom i cenovnik —
          otvara se posle registracije servisa i odobrenja.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href={ROUTES.mechanicsRegister} variant="unstyled">
              Registrujte servis
            </Link>
          </Button>
          <Button asChild variant="secondary" size="lg">
            <Link href={ROUTES.account} variant="unstyled">
              Moj nalog
            </Link>
          </Button>
        </div>
      </section>
    );
  }
  if (profile.status === "approved") return null;
  const copy = COPY[profile.status];
  return (
    <section
      aria-labelledby="ms-title"
      className="grid gap-10 lg:grid-cols-12 lg:gap-x-(--gutter)"
      data-testid={TEST_IDS.mechanicStatus}
      data-status={profile.status}
    >
      <div className="flex flex-col items-start gap-5 lg:col-span-7">
        <Badge tone={MECHANIC_STATUS_TONE[profile.status]} icon={ICON[profile.status]} size="text">
          {MECHANIC_STATUS_LABEL[profile.status]}
        </Badge>
        <h2 id="ms-title" className="type-h2 text-ink-1">
          {copy.title}
        </h2>
        <p className="max-w-[60ch] type-body text-ink-2">{copy.body}</p>
        {profile.rejectionReason ? (
          <p className="max-w-[60ch] border-l border-line-strong pl-4 type-body text-ink-1">
            Razlog: {profile.rejectionReason}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href={ROUTES.parts} variant="unstyled">
              Pretražite delove
            </Link>
          </Button>
          <Button asChild variant="secondary" size="lg">
            <Link href={ROUTES.account} variant="unstyled">
              Moj nalog
            </Link>
          </Button>
        </div>
        <ContactActions links={contacts} location="mechanic_status" />
      </div>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-3 self-start border-t border-line pt-5 lg:col-span-4 lg:col-start-9">
        <dt className="type-caption text-ink-3">Firma</dt>
        <dd className="type-body-s text-ink-1">{profile.companyName}</dd>
        <dt className="type-caption text-ink-3">PIB</dt>
        <dd className="type-code text-ink-1">{profile.pib}</dd>
        <dt className="type-caption text-ink-3">Mesto</dt>
        <dd className="type-body-s text-ink-1">{profile.city}</dd>
        <dt className="type-caption text-ink-3">Poslato</dt>
        <dd className="type-body-s tabular-nums text-ink-1">{formatDate(profile.submittedAt)}</dd>
      </dl>
    </section>
  );
}
