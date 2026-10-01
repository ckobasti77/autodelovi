"use client";

/**
 * Mobile contact bar (FLOW-12, SF-14): „Pozovite · Viber · Upit“ pinned to the bottom of the
 * viewport below 1024 px, shown while the visitor scrolls back up. Only channels with data in
 * settings appear (the inquiry form always exists). ShopChrome decides when it is wanted (scroll
 * direction, route, consent banner) and loads this module on the first show, so neither GSAP
 * nor the bar is part of the first load.
 *
 * While visible it registers its height as a bottom inset, so focused controls scroll above it;
 * while hidden it is `inert` (no tab stops off screen).
 */
import { useRef } from "react";
import {
  ChatCircleTextIcon,
  EnvelopeSimpleIcon,
  PhoneIcon,
} from "@phosphor-icons/react/dist/ssr";

import { RouteLink } from "@/components/ui/RouteLink";
import { ROUTES } from "@/constants/routes";
import { DUR, EASE } from "@/constants/motion";
import { useBottomInset } from "@/lib/dom/bottomInset";
import { gsap, prefersReducedMotion, useGSAP } from "@/lib/gsap/client";

export type StickyContactChannel = { channel: "phone" | "viber"; href: string };

const item =
  "flex min-h-12 flex-1 items-center justify-center gap-2 type-body-s font-semibold text-ink-1 transition-control active:bg-surface-2";

export function StickyContactBar({
  channels,
  visible,
}: {
  channels: StickyContactChannel[];
  visible: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useBottomInset(ref, visible);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const reduce = prefersReducedMotion();
      if (visible) {
        gsap.fromTo(
          el,
          reduce ? { opacity: 0, yPercent: 0 } : { yPercent: 110, opacity: 1 },
          {
            yPercent: 0,
            opacity: 1,
            duration: reduce ? DUR.quick : DUR.panel,
            ease: EASE.out,
          },
        );
      } else {
        gsap.to(el, {
          ...(reduce ? { opacity: 0 } : { yPercent: 110 }),
          duration: reduce ? DUR.quick : DUR.panelExit,
          ease: EASE.in,
        });
      }
    },
    { dependencies: [visible], scope: ref },
  );

  const phone = channels.find((c) => c.channel === "phone");
  const viber = channels.find((c) => c.channel === "viber");

  return (
    <div
      ref={ref}
      data-reveal="off"
      data-contact-location="sticky-bar"
      data-testid="sticky-contact-bar"
      inert={!visible}
      aria-hidden={!visible || undefined}
      className="fixed inset-x-0 bottom-0 z-sticky border-t border-line-strong bg-bg-raised pb-[env(safe-area-inset-bottom)] lg:hidden"
      style={{ transform: "translateY(110%)" }}
    >
      <nav aria-label="Brz kontakt" className="flex divide-x divide-line px-page">
        {phone ? (
          <a href={phone.href} className={item}>
            <PhoneIcon size={20} aria-hidden="true" className="text-accent" />
            Pozovite
          </a>
        ) : null}
        {viber ? (
          <a href={viber.href} className={item}>
            <ChatCircleTextIcon size={20} aria-hidden="true" className="text-ink-2" />
            Viber
          </a>
        ) : null}
        <RouteLink href={ROUTES.inquiry} className={item}>
          <EnvelopeSimpleIcon size={20} aria-hidden="true" className="text-ink-2" />
          Upit
        </RouteLink>
      </nav>
    </div>
  );
}
