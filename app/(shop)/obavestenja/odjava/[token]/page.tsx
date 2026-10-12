import type { Metadata } from "next";
import { BellSlashIcon } from "@phosphor-icons/react/dist/ssr";

import { privateMetadata } from "@/lib/seo/metadata";
import { Link } from "@/components/ui/Link";
import { Reveal } from "@/components/reveal/Reveal";
import { RevealText } from "@/components/text-reveal/RevealText";
import { UnsubscribeForm } from "@/components/notifications/UnsubscribeForm";
import { ROUTES } from "@/constants/routes";

export const metadata: Metadata = {
  ...privateMetadata("Odjava obaveštenja"),
  referrer: "no-referrer",
};

/**
 * `/obavestenja/odjava/[token]` — link from the „Stiglo je“ e-mail. The token is the
 * capability; the page asks for one click (mail scanners open links, they do not click).
 * Composed like the other status pages: the drawing frame with its glyph, the title, the one
 * action in a panel, and a way on — never a dead end after the click.
 */
export default async function UnsubscribePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <div className="px-page pb-(--space-section) pt-10 lg:pt-16">
      <div className="flex max-w-[40rem] flex-col gap-5">
        <div
          aria-hidden="true"
          className="corner-ticks flex h-28 w-full max-w-60 items-center justify-center text-ink-3"
        >
          <BellSlashIcon size={40} />
        </div>
        <RevealText as="h1" className="type-h1 text-ink-1">
          Odjava obaveštenja
        </RevealText>
        <Reveal eager className="panel p-4 sm:p-6">
          <UnsubscribeForm token={token} />
        </Reveal>
        <ul className="flex flex-wrap gap-x-6 gap-y-1" data-reveal="off">
          <li>
            <Link href={ROUTES.parts} variant="standalone" className="min-h-11">
              Svi delovi
            </Link>
          </li>
          <li>
            <Link href={ROUTES.contact} variant="standalone" className="min-h-11">
              Kontakt
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );
}
