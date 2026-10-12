import { landingHref, landingLabel, type LandingLinkData } from "@/lib/seo/landingLinks";
import { Link } from "@/components/ui/Link";

/**
 * Internal links to indexable programmatic landings (SEO-ADS §J5). `show` picks the visible
 * anchor: the vehicle (category pages) or the category (vehicle pages); the accessible name is
 * always the full „{Kategorija} za {vozilo}“.
 */
export function LandingLinks({
  title,
  links,
  show,
  id,
}: {
  title: string;
  links: LandingLinkData[];
  show: "vehicle" | "category";
  id: string;
}) {
  if (links.length === 0) return null;
  return (
    <nav aria-labelledby={id} className="mt-16 border-t border-line pt-8">
      <h2 id={id} className="type-h3 text-ink-1">
        {title}
      </h2>
      <ul className="mt-4 flex flex-wrap gap-2">
        {links.map((l) => (
          <li key={landingHref(l)}>
            <Link
              href={landingHref(l)}
              variant="unstyled"
              className="chip-link"
              {...(show === "vehicle" ? {} : { "aria-label": landingLabel(l) })}
            >
              {show === "vehicle" ? landingLabel(l) : l.categoryName}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
