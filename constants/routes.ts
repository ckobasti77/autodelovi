/** Public routes (docs/ROUTES.md §B1). Build links from here, never from string literals. */
export const ROUTES = {
  home: "/",
  parts: "/delovi",
  category: (slug: string) => `/delovi/${slug}`,
  product: (slug: string) => `/deo/${slug}`,
  vehicles: "/vozila",
  search: "/pretraga",
  searchFor: (q: string) => `/pretraga?q=${encodeURIComponent(q)}`,
  cart: "/korpa",
  checkout: "/porudzbina",
  inquiry: "/upit",
  inquiryWith: (params: { q?: string; kodovi?: string[] }) => {
    const search = new URLSearchParams();
    if (params.q) search.set("q", params.q);
    if (params.kodovi?.length) search.set("kodovi", params.kodovi.join(","));
    const query = search.toString();
    return query ? `/upit?${query}` : "/upit";
  },
  mechanics: "/za-majstore",
  mechanicQuickOrder: (codes: string[]) =>
    `/majstor/brza-porudzbina?kodovi=${encodeURIComponent(codes.join(","))}`,
  signIn: "/prijava",
  account: "/nalog",
  about: "/o-nama",
  contact: "/kontakt",
  delivery: "/dostava-i-placanje",
  returns: "/reklamacije-i-povrat",
  terms: "/uslovi-koriscenja",
  privacy: "/politika-privatnosti",
  cookies: "/kolacici",
  styleguide: "/styleguide",
} as const;

/** Primary navigation (header, mobile menu). */
export const PRIMARY_NAV = [
  { href: ROUTES.parts, label: "Delovi" },
  { href: ROUTES.vehicles, label: "Vozila" },
  { href: ROUTES.mechanics, label: "Za majstore" },
  { href: ROUTES.inquiry, label: "Upit po broju šasije" },
] as const;

/**
 * Routes whose pages exist in the app today. Links to anything else render normally but do
 * not prefetch (a prefetch of a missing route is a 404 in production and a console error).
 * Add a path here in the step that ships its page.
 */
export const LIVE_ROUTES: ReadonlySet<string> = new Set<string>([
  ROUTES.home,
  ROUTES.styleguide,
  ROUTES.signIn,
]);

/** True when the path (query and hash ignored) belongs to a shipped page. */
export function isLiveRoute(href: string): boolean {
  const path = href.split(/[?#]/)[0] || "/";
  if (LIVE_ROUTES.has(path)) return true;
  for (const route of LIVE_ROUTES) {
    if (route !== "/" && path.startsWith(`${route}/`)) return true;
  }
  return false;
}
