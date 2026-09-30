"use client";

/**
 * The 3D hero stage — orchestrates everything around the lazily loaded canvas
 * (docs/3D-CONTRACT.md §F6–F8, DESIGN-SYSTEM §7.7–7.10, §10.1):
 *
 * - the SSR poster stays the LCP; after hydration the device tier is read, and the canvas
 *   chunk + GLB start on first intent (pointer over the hero, scroll > 40 px, touch, focus) or
 *   4 s after `load` in idle time; a 2 px hairline shows real download progress;
 * - one ScrollTrigger scrubs the explode progress across the reserved track (CSS sticky, no
 *   pin spacer → no layout shift); stage index, caption, title block and the canvas follow;
 * - first frame ready → 600 ms crossfade poster → canvas (the poster stays underneath for
 *   context loss); the low tier crossfades the assembled/exploded posters instead;
 * - reduced motion: no track, „Rasklopi / Sklopi“ and the stage index cut between states;
 * - selection from the canvas, the parts list, `?deo=` or the test hook opens the part panel
 *   and keeps `?deo=` in the URL; the camera frames the part in the space the panel leaves.
 */
import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap/client";
import { requestScrollTriggerRefresh } from "@/lib/gsap/refresh";
import { useMotionMedia } from "@/lib/gsap/useMotionMedia";
import { onModelProgress, prefetchModel } from "@/lib/three/assets";
import { cameraBlend, currentStage, stageEnd, stageWindows, type Timeline } from "@/lib/three/explode";
import { categoryRevealStage, isPanelSlug } from "@/lib/three/stages";
import { detectTier, quickTier } from "@/lib/three/tier";
import { HERO_COPY } from "@/lib/i18n/sr/hero";
import { DUR, EASE, MEDIA, SHEET } from "@/constants/motion";
import { TEST_IDS } from "@/constants/testIds";
import {
  clearSelection,
  heroStore,
  selectCategory,
  useHeroStore,
  type HeroController,
} from "@/components/three/heroStore";
import { heroDom } from "@/components/three/heroDom";
import { HeroPicture } from "@/components/three/HeroPicture";
import { StageStrip } from "@/components/three/StageStrip";
import { StageCaption } from "@/components/three/StageCaption";
import { HonestyLine, TitleBlock } from "@/components/three/TitleBlock";
import { installTestHooks, tierOverride } from "@/components/three/testHooks";
import { useLatched } from "@/lib/hooks/useLatched";

const HeroCanvas = dynamic(() => import("@/components/three/canvas/HeroCanvas"), {
  ssr: false,
  loading: () => null,
});

// Overlays that nothing shows before an interaction stay out of the first-load JS; `start`
// warms their chunks together with the model, so the first open does not wait on the network.
const loadPanel = () => import("@/components/three/PartPanel");
const loadPartsList = () => import("@/components/three/PartsListDialog");
const PartPanel = dynamic(() => loadPanel().then((m) => m.PartPanel), { ssr: false });
const PartsListDialog = dynamic(() => loadPartsList().then((m) => m.PartsListDialog), { ssr: false });
const HeroCallout = dynamic(() => import("@/components/three/HeroCallout").then((m) => m.HeroCallout), {
  ssr: false,
});

const windowsCache = new Map<Timeline, ReturnType<typeof stageWindows>>();
function windowsFor(timeline: Timeline) {
  let w = windowsCache.get(timeline);
  if (!w) {
    w = stageWindows(timeline);
    windowsCache.set(timeline, w);
  }
  return w;
}

function publishProgress(p: number) {
  const { timeline, stage } = heroStore.getState();
  const next = currentStage(p, windowsFor(timeline));
  heroStore.setState(next !== stage ? { progress: p, stage: next } : { progress: p });
}

/** ScrollTrigger's own refresh flag (set by `_refreshAll` in 3.15; missing from its typings). */
function isRefreshing(): boolean {
  return (ScrollTrigger as unknown as { isRefreshing?: boolean }).isRefreshing === true;
}

function headerHeight(): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--header-h");
  return Number.parseFloat(raw) || 64;
}

const FINE_POINTER = "(hover: hover) and (pointer: fine)";
const INTENT_SCROLL_PX = 40;
const IDLE_AFTER_LOAD_MS = 4000;

export function HeroStage({ poster }: { poster: ReactNode }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);
  const posterRef = useRef<HTMLDivElement>(null);
  const explodedRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const hairlineRef = useRef<HTMLSpanElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<ScrollTrigger | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [announce, setAnnounce] = useState("");

  const tier = useHeroStore((s) => s.tier);
  const status = useHeroStore((s) => s.status);
  const reduced = useHeroStore((s) => s.reducedMotion);
  const hasSelection = useHeroStore((s) => s.selected !== null);
  const panelMounted = useLatched(hasSelection);
  const listMounted = useLatched(listOpen);
  const calloutMounted = useLatched(status === "ready");
  // Posters carry the explode whenever the canvas cannot: the low tier, context loss, and the
  // seconds while the model downloads (the exploded poster follows the scroll progress).
  const posterMode = tier === "low" || status === "loading" || status === "lost" || status === "failed";
  const explodedWanted = useHeroStore((s) => s.progress > 0.01);
  const explodedMounted = useLatched(posterMode && explodedWanted);
  const showCanvas =
    (tier === "high" || tier === "mid") && (status === "loading" || status === "ready" || status === "lost");

  // ---------------------------------------------------------------- DOM registry
  useEffect(() => {
    heroDom.stage = mediaRef.current;
    heroDom.media = mediaRef.current;
    heroDom.strip = stripRef.current;
    heroDom.copy = document.getElementById("hero-copy");
    return () => {
      heroDom.stage = null;
      heroDom.media = null;
      heroDom.strip = null;
      heroDom.copy = null;
    };
  }, []);

  // ---------------------------------------------------------------- tier, pointer
  // Only the cheap signals here; the WebGL2 probe (a throwaway context, tens of ms on a phone)
  // waits for `start` so it never lands in the hydration task.
  useEffect(() => {
    const fine = window.matchMedia(FINE_POINTER);
    const early = tierOverride() ?? quickTier();
    heroStore.setState(early ? { tier: early, finePointer: fine.matches } : { finePointer: fine.matches });
    const onPointer = () => heroStore.setState({ finePointer: fine.matches });
    fine.addEventListener("change", onPointer);
    return () => fine.removeEventListener("change", onPointer);
  }, []);

  // ---------------------------------------------------------------- start on intent / idle
  useEffect(() => {
    if (tier === "low") return;
    if (heroStore.getState().status !== "idle") return;
    const hero = trackRef.current?.closest("section") ?? trackRef.current;
    let started = false;
    let idleHandle = 0;
    let timer = 0;

    const start = () => {
      if (started) return;
      started = true;
      cleanup();
      const resolved = tier ?? detectTier();
      if (resolved !== tier) heroStore.setState({ tier: resolved });
      if (resolved === "low") return;
      void prefetchModel(resolved).catch(() => heroStore.setState({ status: "failed" }));
      void loadPanel();
      void loadPartsList();
      heroStore.setState({ status: "loading" });
      setAnnounce(HERO_COPY.loading);
    };
    const onScroll = () => {
      if (window.scrollY > INTENT_SCROLL_PX) start();
    };
    const scheduleIdle = () => {
      timer = window.setTimeout(() => {
        const w = window as Window & { requestIdleCallback?: Window["requestIdleCallback"] };
        if (w.requestIdleCallback) idleHandle = w.requestIdleCallback(start, { timeout: 2000 });
        else start();
      }, IDLE_AFTER_LOAD_MS);
    };
    function cleanup() {
      hero?.removeEventListener("pointerover", start);
      hero?.removeEventListener("touchstart", start);
      hero?.removeEventListener("focusin", start);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("load", scheduleIdle);
      window.clearTimeout(timer);
      if ("cancelIdleCallback" in window) window.cancelIdleCallback(idleHandle);
    }

    const deepLink = new URLSearchParams(window.location.search).get("deo");
    if ((deepLink && isPanelSlug(deepLink)) || window.scrollY > INTENT_SCROLL_PX) {
      start();
      return;
    }
    hero?.addEventListener("pointerover", start, { passive: true });
    hero?.addEventListener("touchstart", start, { passive: true });
    hero?.addEventListener("focusin", start);
    window.addEventListener("scroll", onScroll, { passive: true });
    // Idle start only where a fine pointer exists (desktop class). A touch device starts on its
    // first touch or scroll in the hero: the poster is a complete picture, and the ~2 MB
    // download plus the GPU setup should not land on a phone that never touches the stage.
    if (window.matchMedia(FINE_POINTER).matches) {
      if (document.readyState === "complete") scheduleIdle();
      else window.addEventListener("load", scheduleIdle, { once: true });
    }
    return cleanup;
  }, [tier]);

  // ---------------------------------------------------------------- download hairline
  useEffect(() => {
    if (status !== "loading") return;
    const line = hairlineRef.current;
    if (!line) return;
    line.style.opacity = "1";
    return onModelProgress((fraction) => {
      line.style.transform = `scaleX(${Math.max(0.02, fraction * 0.92)})`;
    });
  }, [status]);

  // ---------------------------------------------------------------- scroll → progress
  useMotionMedia(
    ({ motionOk, desktop }) => {
      const timeline: Timeline = desktop ? "desktop" : "mobile";
      heroStore.setState({ timeline, reducedMotion: !motionOk });
      const track = trackRef.current;
      if (!track || !motionOk) {
        triggerRef.current = null;
        publishProgress(heroStore.getState().progress);
        return;
      }
      const proxy = { p: 0 };
      const tween = gsap.fromTo(
        proxy,
        { p: 0 },
        {
          p: 1,
          ease: "none",
          // A refresh measures with the page scrolled to 0 and then restores the progress
          // silently: its transient renders must not reach the store (the scene would show the
          // assembled car mid-track); the restored value is published once it is done.
          onUpdate: () => {
            if (!isRefreshing()) publishProgress(proxy.p);
          },
          scrollTrigger: {
            trigger: track,
            start: () => `top ${headerHeight()}px`,
            end: "bottom bottom",
            scrub: 0.6,
          },
        },
      );
      const onRefreshed = () => publishProgress(proxy.p);
      ScrollTrigger.addEventListener("refresh", onRefreshed);
      triggerRef.current = tween.scrollTrigger ?? null;
      return () => {
        ScrollTrigger.removeEventListener("refresh", onRefreshed);
        triggerRef.current = null;
      };
    },
    { scope: trackRef },
  );

  // ---------------------------------------------------------------- controller
  useEffect(() => {
    const dipCanvas = () => {
      const canvas = canvasRef.current;
      if (canvas && heroStore.getState().status === "ready") {
        gsap.fromTo(canvas, { opacity: 0.35 }, { opacity: 1, duration: 0.2, ease: "none" });
      }
    };
    const controller: HeroController = {
      goToProgress(p, opts) {
        const trigger = triggerRef.current;
        const target = Math.min(Math.max(p, 0), 1);
        if (!trigger) {
          publishProgress(target);
          dipCanvas();
          return;
        }
        const y = trigger.start + target * (trigger.end - trigger.start);
        if (opts?.instant || heroStore.getState().reducedMotion) {
          gsap.killTweensOf(window, "scrollTo");
          // Through ScrollTrigger: it caches scroll positions per frame, so a plain
          // window.scrollTo would leave this update reading the old position.
          trigger.scroll(y);
          ScrollTrigger.update();
          trigger.getTween()?.progress(1);
          publishProgress(target);
          return;
        }
        gsap.to(window, {
          scrollTo: { y, autoKill: true },
          duration: DUR.camera,
          ease: EASE.inOut,
          overwrite: true,
        });
      },
      revealCategory(slug, opts) {
        const stage = categoryRevealStage(slug);
        if (stage === null) return;
        const { timeline, progress, reducedMotion } = heroStore.getState();
        const end = stageEnd(stage, windowsFor(timeline));
        if (progress < end - 1e-3) controller.goToProgress(end, opts);
        if (reducedMotion || !triggerRef.current) {
          trackRef.current?.scrollIntoView({ block: "nearest" });
        }
      },
    };
    heroStore.setState({ controller });
    return () => heroStore.setState({ controller: null });
  }, []);

  // ---------------------------------------------------------------- poster ↔ canvas
  useGSAP(
    () => {
      const canvas = canvasRef.current;
      const posterEl = posterRef.current;
      const line = hairlineRef.current;
      if (!canvas || !posterEl) return;
      const duration = reduced ? 0.2 : DUR.stage;
      if (status === "ready") {
        if (line) {
          gsap.to(line, { scaleX: 1, duration: 0.2, ease: EASE.out });
          gsap.to(line, { opacity: 0, duration: 0.3, delay: 0.25, ease: EASE.in });
        }
        gsap.to(canvas, { opacity: 1, duration, ease: EASE.inOut });
        gsap.to(posterEl, {
          opacity: 0,
          duration,
          ease: EASE.inOut,
          onComplete: () => requestScrollTriggerRefresh(),
        });
        setAnnounce("");
      } else if (status === "lost" || status === "failed") {
        gsap.to(canvas, { opacity: 0, duration: 0.2, ease: "none" });
        gsap.to(posterEl, { opacity: 1, duration: 0.2, ease: "none" });
        if (line) gsap.set(line, { opacity: 0 });
        setAnnounce("");
      }
    },
    { dependencies: [status, reduced] },
  );

  // Poster mode: the exploded poster crossfades with the explode progress.
  useEffect(() => {
    if (!posterMode || !explodedMounted) return;
    const apply = () => {
      const el = explodedRef.current;
      if (el) el.style.opacity = String(cameraBlend(heroStore.getState().progress));
    };
    apply();
    return heroStore.subscribe((state, prev) => {
      if (state.progress !== prev.progress) apply();
    });
  }, [posterMode, explodedMounted]);

  // Scrim behind the copy while a part is selected (desktop).
  useEffect(() => {
    return heroStore.subscribe((state, prev) => {
      if (state.selected === prev.selected) return;
      const scrim = scrimRef.current;
      if (!scrim) return;
      gsap.to(scrim, {
        opacity: state.selected ? 1 : 0,
        duration: state.reducedMotion ? 0 : 0.3,
        ease: EASE.inOut,
        overwrite: true,
      });
    });
  }, []);

  // ---------------------------------------------------------------- in view
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const observer = new IntersectionObserver(
      ([entry]) => heroStore.setState({ inView: entry?.isIntersecting ?? true }),
      { rootMargin: "100px 0px" },
    );
    observer.observe(track);
    return () => observer.disconnect();
  }, []);

  // ---------------------------------------------------------------- selection: URL + framing
  useEffect(() => {
    const freeArea = () => {
      const media = mediaRef.current;
      if (!media) return null;
      const rect = media.getBoundingClientRect();
      if (window.matchMedia(MEDIA.desktop).matches) {
        const copy = heroDom.copy?.getBoundingClientRect();
        const left = copy ? Math.max(0, copy.right - rect.left) : rect.width * 0.4;
        const drawer = window.innerWidth >= 1280 ? 480 : 440;
        const right = Math.max(left + 160, rect.width - drawer);
        const bottom = rect.height - (heroDom.strip?.offsetHeight ?? 72);
        return { x: (left + right) / 2, y: bottom * 0.54, h: bottom };
      }
      const sheetTop = window.innerHeight * (1 - SHEET.peek) - rect.top;
      const visible = Math.max(120, Math.min(rect.height, sheetTop));
      return { x: rect.width / 2, y: visible * 0.55, h: visible };
    };

    const sync = () => {
      const { selected } = heroStore.getState();
      heroStore.setState({ freeArea: selected ? freeArea() : null });
      const url = new URL(window.location.href);
      const current = url.searchParams.get("deo");
      if (selected && current !== selected) url.searchParams.set("deo", selected);
      else if (!selected && current) url.searchParams.delete("deo");
      else return;
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    };
    const onResize = () => {
      if (heroStore.getState().selected) heroStore.setState({ freeArea: freeArea() });
    };
    window.addEventListener("resize", onResize);
    const unsubscribe = heroStore.subscribe((state, prev) => {
      if (state.selected !== prev.selected) sync();
    });
    return () => {
      unsubscribe();
      window.removeEventListener("resize", onResize);
    };
  }, []);

  // ---------------------------------------------------------------- deep link
  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get("deo");
    if (!slug || !isPanelSlug(slug)) return;
    const frame = requestAnimationFrame(() => {
      ScrollTrigger.refresh();
      selectCategory(slug, "deeplink");
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  // ---------------------------------------------------------------- test hooks
  useEffect(() => installTestHooks(), []);

  const onStage = (stage: number) => {
    const { controller, timeline } = heroStore.getState();
    controller?.goToProgress(stageEnd(stage, windowsFor(timeline)));
  };
  const onToggle = () => {
    const { controller, progress } = heroStore.getState();
    if (progress >= 0.5) clearSelection();
    controller?.goToProgress(progress >= 0.5 ? 0 : 1);
  };

  return (
    <>
      <div ref={trackRef} className="hero-track relative" data-testid="hero-track">
        <div className="hero-frame sticky top-header flex flex-col overflow-hidden">
          <div className="relative min-h-0 flex-1 lg:absolute lg:inset-0">
            <div
              ref={mediaRef}
              role="img"
              aria-label={HERO_COPY.canvasLabel}
              tabIndex={-1}
              // Focus lands here when a panel opened from the car closes; a keyboard user sees it.
              className="absolute inset-0 focus-ring-inset"
            >
              <div ref={posterRef} className="absolute inset-0" data-testid={TEST_IDS.heroPoster}>
                {poster}
                {/* Stays mounted once used, so the poster → canvas crossfade never flashes the
                    assembled car under an exploded scene. */}
                {explodedMounted ? (
                  <div ref={explodedRef} className="absolute inset-0" style={{ opacity: 0 }}>
                    <HeroPicture state="exploded" />
                  </div>
                ) : null}
              </div>
              <div
                ref={canvasRef}
                aria-hidden="true"
                data-testid={TEST_IDS.heroCanvas}
                data-status={status}
                className="absolute inset-0"
                style={{ opacity: 0 }}
              >
                {showCanvas && (tier === "high" || tier === "mid") ? <HeroCanvas tier={tier} /> : null}
              </div>
            </div>

            {/* Selection zooms the scene under the copy column: keep the copy legible. */}
            <div
              ref={scrimRef}
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 hidden bg-[linear-gradient(90deg,var(--color-bg)_0%,var(--color-bg)_30%,transparent_50%)] lg:block"
              style={{ opacity: 0 }}
            />
            {calloutMounted ? <HeroCallout /> : null}

            {/* Drawing furniture — phones: caption on top, honesty line at the bottom;
                ≥ 1024 px: a 12-column overlay, the stage frame on columns 6–12. */}
            <div className="pointer-events-none absolute inset-0 px-page lg:grid lg:grid-cols-12 lg:grid-rows-1 lg:gap-x-(--gutter)">
              <div
                aria-hidden="true"
                className="hidden corner-ticks lg:col-span-7 lg:col-start-6 lg:row-start-1 lg:mb-[5.5rem] lg:mt-4 lg:block"
              />
              <StageCaption className="relative z-[1] pt-4 lg:col-span-4 lg:col-start-6 lg:row-start-1 lg:self-start lg:pl-6 lg:pt-8" />
              <div className="hidden lg:col-span-4 lg:col-start-9 lg:row-start-1 lg:self-start lg:justify-self-end lg:pr-4 lg:pt-8 min-[90rem]:block">
                <TitleBlock className="w-[22rem]" />
              </div>
              <HonestyLine className="absolute inset-x-(--pad) bottom-2 truncate lg:static lg:col-span-7 lg:col-start-6 lg:row-start-1 lg:mb-[6.25rem] lg:self-end lg:pr-4 lg:text-right min-[90rem]:hidden" />
            </div>

            <span
              ref={hairlineRef}
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 origin-left scale-x-0 bg-accent opacity-0"
            />
          </div>

          <div
            ref={stripRef}
            className="relative z-[4] bg-bg px-page pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1 lg:absolute lg:inset-x-0 lg:bottom-0 lg:bg-transparent lg:pb-2"
          >
            <StageStrip onStage={onStage} onToggle={onToggle} onOpenList={() => setListOpen(true)} />
          </div>
        </div>
      </div>

      {listMounted ? <PartsListDialog open={listOpen} onOpenChange={setListOpen} /> : null}
      {panelMounted ? <PartPanel /> : null}
      <span role="status" aria-live="polite" className="sr-only">
        {announce}
      </span>
    </>
  );
}
