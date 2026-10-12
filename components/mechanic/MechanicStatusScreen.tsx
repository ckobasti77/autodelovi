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
import { ApprovalSteps } from "@/components/mechanic/ApprovalSteps";
import { Reveal } from "@/components/reveal/Reveal";
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

type Waiting = Exclude<MechanicStatus, "approved">;

/**
 * What the account can do now. Pending accounts keep buying at retail prices, so the catalog is
 * the next step; a rejected or paused account is settled by talking to us, so contact is.
 */
const COPY: Record<
  Waiting,
  { title: string; body: string; next: { label: string; href: string } }
> = {
  pending: {
    title: "Registracija je primljena",
    body: "Podatke servisa proveravamo u toku radnog dana; kad odobrimo nalog, stiže vam poruka e-poštom sa nivoom rabata i cene na sajtu postaju vaše. Do tada možete da poručujete po maloprodajnim cenama.",
    next: { label: "Pretražite delove", href: ROUTES.parts },
  },
  rejected: {
    title: "Registracija nije odobrena",
    body: "Ako mislite da je greška ili su se podaci promenili, pozovite nas — nalog možemo ponovo da pregledamo.",
    next: { label: "Javite nam se", href: ROUTES.contact },
  },
  suspended: {
    title: "Nalog je pauziran",
    body: "Majstorske cene i odloženo plaćanje su privremeno isključeni. Pozovite nas da proverimo šta treba srediti.",
    next: { label: "Javite nam se", href: ROUTES.contact },
  },
};

/**
 * `/majstor` for accounts that are not (yet) approved mechanics: no profile → registration
 * CTA; pending / rejected / suspended → where the request stands, the next step and how to
 * reach us. Two panels: the answer, and the record it is about.
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
      <Reveal
        as="section"
        eager
        aria-labelledby="ms-title"
        className="flex max-w-[44rem] flex-col items-start gap-5 panel rounded-xl p-5 sm:p-8"
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
      </Reveal>
    );
  }
  if (profile.status === "approved") return null;
  const copy = COPY[profile.status];
  const pending = profile.status === "pending";
  return (
    <section
      aria-labelledby="ms-title"
      className="grid gap-5 lg:grid-cols-12 lg:gap-x-(--gutter)"
      data-testid={TEST_IDS.mechanicStatus}
      data-status={profile.status}
    >
      <Reveal
        eager
        className="flex flex-col items-start gap-5 panel rounded-xl p-5 sm:p-8 lg:col-span-7"
      >
        <Badge tone={MECHANIC_STATUS_TONE[profile.status]} icon={ICON[profile.status]} size="text">
          {MECHANIC_STATUS_LABEL[profile.status]}
        </Badge>
        <h2 id="ms-title" className="type-h2 text-ink-1">
          {copy.title}
        </h2>
        <p className="max-w-[60ch] type-body text-ink-2">{copy.body}</p>
        {profile.rejectionReason ? (
          <p className="max-w-[60ch] panel-inset px-4 py-3 type-body text-ink-1">
            <span className="block type-caption text-ink-3">Razlog</span>
            {profile.rejectionReason}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href={copy.next.href} variant="unstyled">
              {copy.next.label}
            </Link>
          </Button>
          <Button asChild variant="secondary" size="lg">
            <Link href={pending ? ROUTES.account : ROUTES.parts} variant="unstyled">
              {pending ? "Moj nalog" : "Pretražite delove"}
            </Link>
          </Button>
        </div>
        {contacts.length ? (
          <div className="flex w-full flex-col gap-1 border-t border-line pt-4">
            <span className="type-caption text-ink-3">
              {pending ? "Hitno vam treba deo? Javite se odmah." : "Kontakt"}
            </span>
            <ContactActions links={contacts} location="mechanic_status" />
          </div>
        ) : null}
      </Reveal>
      <Reveal
        as="aside"
        eager
        index={1}
        aria-label="Podaci iz registracije"
        className="flex flex-col gap-6 self-start panel p-5 sm:p-6 lg:col-span-5 xl:col-span-4 xl:col-start-9"
      >
        <div className="flex flex-col gap-3">
          <h3 className="type-h4 text-ink-1">Poslati podaci</h3>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-2.5">
            <dt className="type-caption text-ink-3">Firma</dt>
            <dd className="type-body-s text-ink-1">{profile.companyName}</dd>
            <dt className="type-caption text-ink-3">PIB</dt>
            <dd className="type-code text-ink-1">{profile.pib}</dd>
            <dt className="type-caption text-ink-3">Mesto</dt>
            <dd className="type-body-s text-ink-1">{profile.city}</dd>
            <dt className="type-caption text-ink-3">Poslato</dt>
            <dd className="type-body-s tabular-nums text-ink-1">
              {formatDate(profile.submittedAt)}
            </dd>
          </dl>
        </div>
        {pending ? (
          <div className="flex flex-col gap-4 border-t border-line pt-5">
            <h3 className="type-h4 text-ink-1">Šta sledi</h3>
            <ApprovalSteps />
          </div>
        ) : null}
      </Reveal>
    </section>
  );
}
