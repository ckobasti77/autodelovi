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
  mechanicsRegister: "/za-majstore/registracija",
  mechanicsThanks: "/za-majstore/hvala",
  mechanicPortal: "/majstor",
  mechanicQuickOrderPage: "/majstor/brza-porudzbina",
  mechanicQuickOrder: (codes: string[]) =>
    `/majstor/brza-porudzbina?kodovi=${encodeURIComponent(codes.join(","))}`,
  mechanicOrders: "/majstor/porudzbine",
  mechanicOrder: (number: string) => `/majstor/porudzbine/${encodeURIComponent(number)}`,
  mechanicInquiries: "/majstor/upiti",
  mechanicFavorites: "/majstor/omiljeno",
  mechanicVehicles: "/majstor/vozila",
  mechanicPriceList: "/majstor/cenovnik",
  mechanicPriceListDownload: (categorySlugs: string[]) =>
    `/majstor/cenovnik/preuzmi?kategorije=${encodeURIComponent(categorySlugs.join(","))}`,
  mechanicProfile: "/majstor/profil",
  adminMechanics: "/admin/majstori",
  adminMechanic: (id: string) => `/admin/majstori/${id}`,
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
  unsubscribe: (token: string) => `/obavestenja/odjava/${token}`,
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

/**
 * Pages that open with their own search field: the header's search field steps back there
 * while the page is at its top (components/shell/HeaderSearch).
 */
export const OWN_SEARCH_ROUTES: readonly string[] = [ROUTES.home, ROUTES.search];

/** Admin routes (docs/ROUTES.md §B2). */
export const ADMIN = {
  home: "/admin",
  orders: "/admin/porudzbine",
  order: (number: string) => `/admin/porudzbine/${encodeURIComponent(number)}`,
  orderProforma: (number: string) => `/admin/porudzbine/${encodeURIComponent(number)}/predracun`,
  orderDeliveryNote: (number: string) =>
    `/admin/porudzbine/${encodeURIComponent(number)}/otpremnica`,
  inquiries: "/admin/upiti",
  inquiry: (number: string) => `/admin/upiti/${encodeURIComponent(number)}`,
  products: "/admin/proizvodi",
  productNew: "/admin/proizvodi/novi",
  product: (id: string) => `/admin/proizvodi/${id}`,
  categories: "/admin/kategorije",
  vehicles: "/admin/vozila",
  manufacturers: "/admin/proizvodjaci",
  stock: "/admin/lager",
  customers: "/admin/kupci",
  customer: (id: string) => `/admin/kupci/${id}`,
  mechanics: "/admin/majstori",
  mechanic: (id: string) => `/admin/majstori/${id}`,
  tiers: "/admin/cenovni-razredi",
  settings: "/admin/podesavanja",
  settingsTab: (tab: string) => `/admin/podesavanja?tab=${tab}`,
  users: "/admin/korisnici",
  audit: "/admin/revizija",
  privacy: "/admin/privatnost",
  privacyFor: (userId: string) => `/admin/privatnost?kupac=${userId}`,
  emails: "/admin/mejlovi",
  emailTemplates: "/admin/mejlovi/sabloni",
  searches: "/admin/pretrage",
  sources: "/admin/izvori",
  notifications: "/admin/obavestenja",
  imports: "/admin/uvoz",
  importHistory: "/admin/uvoz/istorija",
  importBatch: (id: string) => `/admin/uvoz/${id}`,
  /** Route handlers (downloads) — plain links, never prefetched. */
  importTemplate: "/admin/uvoz/sablon",
  importReport: (id: string) => `/admin/uvoz/${id}/izvestaj`,
  exports: "/admin/izvoz",
  exportFile: (
    kind:
      "proizvodi.xlsx" | "porudzbine.csv" | "kupci.csv" | "majstori.csv" | "offline-konverzije.csv",
  ) => `/admin/izvoz/${kind}`,
  invite: (token: string) => `/admin/pozivnica/${token}`,
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
  ROUTES.mechanicPortal,
  "/ponuda",
  "/admin",
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
