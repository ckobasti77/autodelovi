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
  inquiryWith: (params: { q?: string; kodovi?: string[]; deo?: string; proizvod?: string }) => {
    const search = new URLSearchParams();
    if (params.q) search.set("q", params.q);
    if (params.kodovi?.length) search.set("kodovi", params.kodovi.join(","));
    if (params.deo) search.set("deo", params.deo);
    if (params.proizvod) search.set("proizvod", params.proizvod);
    const query = search.toString();
    return query ? `/upit?${query}` : "/upit";
  },
  mechanics: "/za-majstore",
  mechanicQuickOrder: (codes: string[]) =>
    `/majstor/brza-porudzbina?kodovi=${encodeURIComponent(codes.join(","))}`,
  signIn: "/prijava",
  signUp: "/registracija",
  forgotPassword: "/zaboravljena-lozinka",
  account: "/nalog",
  accountOrders: "/nalog/porudzbine",
  accountOrder: (number: string) => `/nalog/porudzbine/${encodeURIComponent(number)}`,
  accountInquiries: "/nalog/upiti",
  accountVehicles: "/nalog/vozila",
  accountProfile: "/nalog/profil",
  orderThanks: (token: string) => `/porudzbina/hvala/${token}`,
  orderStatus: (token: string) => `/porudzbina/${token}`,
  orderProforma: (token: string) => `/porudzbina/${token}/predracun`,
  inquiryThanks: (token: string) => `/upit/hvala/${token}`,
  inquiryStatus: (token: string) => `/upit/${token}`,
  vehicleBrand: (brand: string) => `/vozila/${brand}`,
  vehicleModel: (brand: string, model: string) => `/vozila/${brand}/${model}`,
  vehicleGeneration: (brand: string, model: string, generation: string) =>
    `/vozila/${brand}/${model}/${generation}`,
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
  ROUTES.signUp,
  ROUTES.forgotPassword,
  ROUTES.parts,
  "/deo",
  ROUTES.vehicles,
  ROUTES.search,
  ROUTES.cart,
  ROUTES.checkout,
  ROUTES.inquiry,
  ROUTES.account,
  ROUTES.about,
  ROUTES.contact,
  ROUTES.delivery,
  ROUTES.returns,
  ROUTES.terms,
  ROUTES.privacy,
  ROUTES.cookies,
  ROUTES.mechanics,
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
