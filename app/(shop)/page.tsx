import { ArrowRightIcon } from "@phosphor-icons/react/dist/ssr";

import { site } from "@/config/site";
import { typographer } from "@/lib/format/nbsp";
import { ROUTES } from "@/constants/routes";
import { TEST_IDS } from "@/constants/testIds";
import { BrandMark } from "@/components/shell/BrandMark";
import { SearchBox } from "@/components/shell/SearchBox";
import { RevealText } from "@/components/text-reveal/RevealText";
import { Link } from "@/components/ui/Link";

/**
 * Home — branded placeholder until the 3D hero lands (steps 07–11): the statement, the OEM
 * search and the inquiry entry, with the lifted-part mark standing in for the X-ray stage.
 */
export default function HomePage() {
  const makes = site.brand.makes;
  return (
    <>
      <section className="px-page" aria-labelledby="home-title">
        <div className="grid gap-12 py-10 sm:py-14 lg:min-h-[min(calc(100dvh-var(--header-h)),880px)] lg:grid-cols-12 lg:content-center lg:gap-x-(--gutter) lg:py-16">
          <div className="flex flex-col gap-6 lg:col-span-6 xl:col-span-5">
            <RevealText as="h1" id="home-title" className="type-display-xl text-ink-1">
              {"Rasklopi\nauto.\nNađi deo."}
            </RevealText>
            <RevealText as="p" className="max-w-[42ch] type-lead text-ink-2">
              {typographer(
                `Delovi za ${makes.slice(0, -1).join(", ")} i ${makes[makes.length - 1]} — po OEM broju, vozilu ili broju šasije.`,
              )}
            </RevealText>
            <SearchBox variant="hero" testId={TEST_IDS.heroSearchInput} className="mt-2" />
            <Link
              href={ROUTES.inquiry}
              variant="standalone"
              className="self-start"
              icon={<ArrowRightIcon size={14} />}
            >
              Nemate broj? Pošaljite broj šasije
            </Link>
          </div>

          <div
            aria-hidden="true"
            className="hidden aspect-[4/3] items-center justify-center corner-ticks text-ink-1 lg:col-span-6 lg:col-start-7 lg:flex xl:col-span-7 xl:col-start-6"
          >
            <BrandMark size={220} />
          </div>
        </div>
      </section>

      <section className="border-t border-line px-page py-10" aria-label="Marke vozila">
        <ul className="flex flex-wrap items-center gap-x-8 gap-y-3 type-display-m text-ink-3">
          {makes.map((make) => (
            <li key={make}>{make}</li>
          ))}
        </ul>
      </section>
    </>
  );
}
