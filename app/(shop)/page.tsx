import { site } from "@/config/site";
import { HeroSection } from "@/components/three/HeroSection";
import { SystemsIndex } from "@/components/three/SystemsIndex";

/**
 * Home — the 3D hero (step 10) and its server-rendered equivalent „Delovi po sistemima“.
 * Step 12 composes the remaining home sections (ordering steps, categories, mechanics band,
 * trust facts, FAQ, contact strip) around them.
 */
export default function HomePage() {
  const makes = site.brand.makes;
  return (
    <>
      <HeroSection />
      <SystemsIndex />
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
