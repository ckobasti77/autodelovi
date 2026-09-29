import { ArrowRightIcon } from "@phosphor-icons/react/dist/ssr";

import { site } from "@/config/site";
import { typographer } from "@/lib/format/nbsp";
import { ROUTES } from "@/constants/routes";
import { TEST_IDS } from "@/constants/testIds";
import { SearchBox } from "@/components/shell/SearchBox";
import { RevealText } from "@/components/text-reveal/RevealText";
import { Link } from "@/components/ui/Link";
import { HeroVehicleField } from "@/components/vehicle/VehicleBindings";
import { HeroPicture } from "@/components/three/HeroPicture";
import { HeroStage } from "@/components/three/HeroStage";

/**
 * Home hero (DESIGN-SYSTEM §10.1, docs/3D-CONTRACT.md §F7.1) — server-rendered: the LCP-safe
 * statement, OEM search (plain GET form without JS), the vehicle field, the inquiry link and
 * the assembled poster; the 3D stage around it is a client island that loads the canvas later.
 *
 * ≥ 1024 px the copy column (1–5) is sticky over the stage for the whole explode; below that
 * the copy comes first and the stage follows (statement → search → vehicle → stage).
 */
export function HeroSection() {
  const makes = site.brand.makes;
  const lead = typographer(
    `Delovi za ${makes.slice(0, -1).join(", ")} i ${makes[makes.length - 1]} — tražite po OEM broju, po vozilu ili klikom na deo.`,
  );
  return (
    <section aria-labelledby="home-title" className="relative isolate" data-testid="home-hero">
      <div className="lg:grid lg:grid-cols-1 lg:grid-rows-1">
        <div className="relative z-[3] px-page pb-8 pt-8 sm:pt-10 lg:pointer-events-none lg:sticky lg:top-header lg:col-start-1 lg:row-start-1 lg:self-start lg:pb-24 lg:pt-[clamp(1.5rem,6vh,4.5rem)] lg:hero-frame">
          <div className="lg:grid lg:grid-cols-12 lg:gap-x-(--gutter)">
            <div
              id="hero-copy"
              className="flex max-w-[34rem] flex-col gap-5 lg:pointer-events-auto lg:col-span-5 lg:max-w-[30rem] xl:max-w-[32rem]"
            >
              <RevealText as="h1" id="home-title" className="type-display-xl text-ink-1">
                {"Rasklopi\nauto.\nNađi deo."}
              </RevealText>
              <RevealText as="p" className="max-w-[42ch] type-lead text-ink-2 hero-short:hidden">
                {lead}
              </RevealText>
              <SearchBox variant="hero" testId={TEST_IDS.heroSearchInput} className="mt-1" />
              <HeroVehicleField />
              <Link
                href={ROUTES.inquiry}
                variant="standalone"
                className="self-start"
                icon={<ArrowRightIcon size={14} />}
              >
                Nemate broj? Pošaljite broj šasije
              </Link>
            </div>
          </div>
        </div>
        <div className="lg:col-start-1 lg:row-start-1">
          <HeroStage
            poster={<HeroPicture state="assembled" priority testId="hero-poster-image" />}
          />
        </div>
      </div>
    </section>
  );
}
