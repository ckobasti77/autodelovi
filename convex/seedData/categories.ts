/**
 * Category SEO copy for the seed (Serbian, ekavian). Slugs, labels and systems come from
 * `lib/catalog/taxonomy.ts`; this file adds what the part does, when it is replaced and a
 * workshop tip. `buildIntro` assembles an 80–180-word intro from them.
 */
import { CATEGORIES, SUBCATEGORIES } from "../../lib/catalog/taxonomy";

type Copy = { what: string; when: string; tip: string; short: string };

// prettier-ignore
export const CATEGORY_COPY: Record<string, Copy> = {
  "motor": { what: "Blok motora i glava nose sve ostale delove motora: klipove, bregaste osovine, ventile i zaptivke.", when: "Delovi glave i bloka traže se posle pregrevanja, pucanja dihtunga glave ili potrošnje ulja koja ne prestaje posle zamene semeringa.", tip: "Pre narudžbine proverite kod motora na bloku ili u saobraćajnoj dozvoli — isti model ima više motora.", short: "Glave, zaptivke glave, ventili i delovi bloka." },
  "turbina": { what: "Turbina koristi izduvne gasove da ubaci više vazduha u motor; bez nje dizel i TSI motori gube snagu.", when: "Zvižduk, plavi dim, ulje u interkuleru ili greška pritiska punjenja znače da turbinu treba proveriti.", tip: "Uz novu turbinu uvek menjajte ulje, filter ulja i dovodnu cev ulja — prljavo ulje ubija i novu.", short: "Nove i reparirane turbine, setovi za montažu." },
  "interkuler": { what: "Interkuler hladi vazduh posle turbine, pa motor dobija gušći vazduh i više snage.", when: "Pukao interkuler ili crevo daje gubitak snage, dim i grešku niskog pritiska punjenja.", tip: "Ako je turbina bacala ulje, interkuler i creva operite ili zamenite pre nove turbine.", short: "Interkuleri, creva i obujmice." },
  "usisna-grana": { what: "Usisna grana i kućište filtera vode vazduh od filtera do cilindara.", when: "Pukla grana, zaglavljene klapne ili naprsli priključci daju neravan rad i grešku mešavine.", tip: "Na TDI motorima proverite i klapne usisne grane — čest uzrok greške P2015.", short: "Usisne grane, klapne i kućišta filtera." },
  "brizgaljke-pumpa-goriva": { what: "Brizgaljke i pumpa goriva doziraju gorivo pod pritiskom; od njih zavise potrošnja, snaga i dim.", when: "Težak start, crni dim, kucanje ili greška na brizgaljki znače proveru dozne i rashodne količine.", tip: "Kod zamene brizgaljki na TDI motoru uvek stavite nove bakarne podloške i vijke.", short: "Brizgaljke, pumpe visokog pritiska, podloške." },
  "zupcasti-kais-vodena-pumpa": { what: "Set zupčastog kaiša drži bregastu osovinu u koraku sa radilicom; vodena pumpa je obično u istom poslu.", when: "Menja se po intervalu proizvođača ili odmah ako kaiš ima pukotine, a pumpa curi ili šumi.", tip: "Kaiš, zatezač, vodilice i vodenu pumpu menjajte zajedno — posao je isti, a kvar skup.", short: "Setovi kaiša sa vodenom pumpom i zatezačima." },
  "kais-alternatora": { what: "Kaiš alternatora pokreće alternator, pumpu servo upravljača i kompresor klime.", when: "Škripa na hladno, ispucali žlebovi ili zatezač koji lupa znače zamenu.", tip: "Uz kaiš proverite zatezač i remenicu radilice — dotrajala remenica cepa novi kaiš.", short: "Rebrasti kaiševi, zatezači i remenice." },
  "alternator": { what: "Alternator puni akumulator i napaja elektriku dok motor radi.", when: "Lampica akumulatora, slabo svetlo ili prazan akumulator posle vožnje ukazuju na alternator ili regulator.", tip: "Pre zamene izmerite napon punjenja na polovima akumulatora: oko 14 V pri radu je ispravno.", short: "Alternatori, regulatori i remenice." },
  "anlaser": { what: "Anlaser okreće motor pri paljenju.", when: "Klik bez okretanja, sporo okretanje ili zvuk mlevenja pri startu znače proveru anlasera.", tip: "Prvo proverite akumulator i masu — slab kontakt često liči na neispravan anlaser.", short: "Anlaseri i automati anlasera." },
  "paljenje-grejaci": { what: "Svećice i bobine pale smešu kod benzinaca, a grejači pomažu hladan start dizela.", when: "Preskakanje, trzanje pri ubrzanju ili težak start na hladno znače proveru paljenja ili grejača.", tip: "Bobine na TSI motorima menjajte po grešci konkretnog cilindra, a svećice uvek u kompletu.", short: "Svećice, bobine i grejači." },
  "karter-dihtunzi": { what: "Karter drži ulje, pumpa ulja ga razvodi, a dihtunzi i semerinzi zaptivaju motor.", when: "Curenje ulja, udaren karter ili lampica pritiska ulja traže zamenu.", tip: "Vijak kartera i podlošku menjajte pri svakoj zameni ulja — jeftino je, a sprečava curenje.", short: "Karteri, pumpe ulja, dihtunzi i semerinzi." },
  "egr-ventil": { what: "EGR ventil vraća deo izduvnih gasova u usis i smanjuje emisiju azota.", when: "Gubitak snage, dim i greške protoka EGR-a znače zaprljan ili neispravan ventil.", tip: "Na dizelima sa EGR hladnjakom proverite i hladnjak — curenje rashladne tečnosti je čest pratilac.", short: "EGR ventili, hladnjaci i zaptivke." },
  "nosaci-motora": { what: "Nosači motora i menjača drže agregat i guše vibracije.", when: "Udarci pri kretanju, vibracije u leru ili pokidana guma znače zamenu nosača.", tip: "Na DSG menjačima zamenite i nosač menjača kada menjate nosač motora — rade u paru.", short: "Nosači motora, menjača i obrtni nosači." },
  "dpf-katalizator": { what: "DPF zadržava čađ dizela, a katalizator pretvara štetne gasove.", when: "Česta regeneracija, lampica DPF-a ili gubitak snage znače zapušen filter.", tip: "Pre zamene DPF-a proverite senzor pritiska i EGR — zapušen filter je često posledica, a ne uzrok.", short: "DPF filteri, katalizatori i montažni setovi." },
  "auspuh": { what: "Auspuh vodi izduvne gasove i utišava motor preko srednjeg i zadnjeg lonca.", when: "Glasniji rad, lupkanje ispod vozila ili progoreo lonac znače zamenu.", tip: "Uz lonce uzmite nove obujmice i gumene nosače — stari retko izdrže demontažu.", short: "Lonci, cevi, obujmice i gumeni nosači." },
  "hladnjak-ventilator": { what: "Hladnjak i ventilator odvode toplotu iz motora.", when: "Pregrevanje, curenje tečnosti ili ventilator koji se ne uključuje traže proveru.", tip: "Posle zamene hladnjaka odzračite sistem po uputstvu — vazdušni džep daje lažno pregrevanje.", short: "Hladnjaci motora, ventilatori i poklopci." },
  "termostat-creva": { what: "Termostat drži radnu temperaturu motora, a creva vode tečnost kroz sistem.", when: "Motor se sporo zagreva, temperatura skače ili creva cure — vreme je za termostat i creva.", tip: "Koristite samo rashladnu tečnost propisanu normom (G12/G13) i ne mešajte vrste.", short: "Termostati, kućišta i creva hlađenja." },
  "klima": { what: "Kompresor i kondenzator klime hlade vazduh u kabini.", when: "Klima ne hladi, kompresor ne uključuje ili se čuje zujanje — proverite punjenje i kompresor.", tip: "Pri zameni kompresora obavezno menjajte sušač i ispirajte sistem.", short: "Kompresori, kondenzatori i sušači." },
  "kvacilo-zamajac": { what: "Kvačilo prenosi snagu na menjač, a dvomaseni zamajac guši vibracije motora.", when: "Proklizavanje, trzanje pri kretanju ili lupkanje u leru znače proveru kvačila i zamajca.", tip: "Na dizelima menjajte zamajac zajedno sa kvačilom ako je zazor van tolerancije proizvođača.", short: "Setovi kvačila, dvomaseni zamajci, potisni ležajevi." },
  "menjac": { what: "Menjač prenosi snagu na točkove; DSG menjači imaju mehatroniku i dvostruko kvačilo.", when: "Trzanje, kašnjenje ubacivanja ili lampica menjača traže dijagnostiku.", tip: "Ulje DSG menjača menjajte po intervalu — većina kvarova mehatronike počinje od starog ulja.", short: "Delovi menjača, filteri i ulja za DSG." },
  "poluosovine": { what: "Poluosovine i homokinetički zglobovi prenose snagu od menjača do točkova.", when: "Kliktanje pri skretanju ili pocepana manžetna znače zglob ili celu poluosovinu.", tip: "Pocepanu manžetnu zamenite odmah — zglob bez masti propada za nekoliko stotina kilometara.", short: "Poluosovine, zglobovi i manžetne." },
  "amortizeri-opruge": { what: "Amortizeri i opruge drže točak na putu i vozilo stabilnim u krivini.", when: "Ljuljanje, duži put kočenja ili curenje ulja sa amortizera znače zamenu.", tip: "Amortizere menjajte u paru na istoj osovini, uz nove ležajeve i gumice.", short: "Amortizeri, opruge i ležajevi amortizera." },
  "ramena-selen-blokovi": { what: "Ramena i selen blokovi drže geometriju točka.", when: "Lupkanje na neravninama, povlačenje u stranu ili neravnomerno trošenje gume znače proveru.", tip: "Posle zamene ramena obavezno uradite reglažu trapa.", short: "Ramena, selen blokovi i kugle." },
  "spone-stabilizatori": { what: "Spone povezuju letvu volana sa točkovima, a štangle stabilizatora smanjuju naginjanje.", when: "Zazor u volanu ili tupo lupkanje preko ležećih policajaca znače spone ili štangle.", tip: "Štangle stabilizatora pritežite dok je vozilo na točkovima, inače gumice brzo pucaju.", short: "Spone, krajevi spona i štangle stabilizatora." },
  "letva-volana": { what: "Letva volana pretvara okretanje volana u zakretanje točkova.", when: "Zazor, curenje ulja ili tvrd volan traže proveru letve.", tip: "Kod elektromehaničke letve proverite softver i senzor momenta pre zamene.", short: "Letve volana i manžetne." },
  "lezaj-glavcina": { what: "Ležaj točka i glavčina nose točak i omogućavaju mu da se okreće bez otpora.", when: "Brujanje koje raste sa brzinom ili zazor točka znače zamenu ležaja.", tip: "Glavčine sa ABS prstenom montirajte pravilno okrenute — inače ABS javlja grešku.", short: "Ležajevi točka i glavčine." },
  "kocioni-diskovi": { what: "Kočioni diskovi zajedno sa pločicama pretvaraju kretanje u toplotu i zaustavljaju vozilo.", when: "Vibracije pri kočenju, ivica na disku ili debljina ispod minimalne znače zamenu.", tip: "Diskove menjajte u paru i uvek sa novim pločicama; proverite prečnik diska (npr. 288 ili 312 mm).", short: "Prednji i zadnji diskovi, puni i ventilirani." },
  "kocione-plocice": { what: "Kočione pločice pritiskaju disk i zaustavljaju vozilo.", when: "Škripa, lampica pločica ili debljina obloge ispod 3 mm znače zamenu.", tip: "Proverite broj na čeljusti ili prečnik diska — isti model ima više sistema kočnica.", short: "Prednje i zadnje pločice, senzori habanja." },
  "kocione-celjusti": { what: "Kočiona čeljust pritiska pločice na disk pomoću klipa.", when: "Vozilo vuče u stranu, disk se greje ili klip curi — čeljust treba servis ili zamenu.", tip: "Zadnje čeljusti sa elektronskom ručnom zahtevaju dijagnostiku za servisni položaj.", short: "Čeljusti, setovi za reparaciju i klipovi." },
  "abs-senzori": { what: "ABS senzori mere brzinu svakog točka za ABS i ESP.", when: "Lampice ABS i ESP ili greška jednog točka znače proveru senzora i kabla.", tip: "Pre zamene očistite senzor i prsten — rđa na prstenu daje istu grešku.", short: "ABS senzori prednji i zadnji." },
  "akumulator": { what: "Akumulator pokreće anlaser i čuva elektriku dok motor ne radi.", when: "Sporo paljenje ujutru ili vozilo sa start-stop sistemom koje isključuje funkciju znači slab akumulator.", tip: "Na vozilima sa start-stop sistemom ugradite EFB ili AGM akumulator i registrujte ga dijagnostikom.", short: "Akumulatori, EFB i AGM." },
  "farovi": { what: "Farovi osvetljavaju put i čine vozilo vidljivim.", when: "Pukao stakleni deo, zamućen far ili neispravan nosač znače zamenu.", tip: "Proverite da li vozilo ima halogene, ksenon ili LED farove — nisu zamenljivi.", short: "Farovi, sijalice i nosači." },
  "stop-svetla": { what: "Stop svetla pokazuju kočenje i položaj vozila otpozadi.", when: "Pukla maska ili vlaga u svetlu traže zamenu.", tip: "Karavan i limuzina istog modela često imaju različita stop svetla.", short: "Stop svetla i nosači sijalica." },
  "senzori": { what: "Lambda, parking i temperaturni senzori šalju podatke računaru motora i vozaču.", when: "Greška u memoriji, povećana potrošnja ili parking senzor koji stalno pišti znače proveru senzora.", tip: "Lambda sondu birajte po položaju (pre ili posle katalizatora) i broju žica.", short: "Lambda sonde, parking i temperaturni senzori." },
  "hauba": { what: "Hauba štiti motorni prostor i deo je karoserije.", when: "Posle udara ili korozije haubu menjate ili ispravljate.", tip: "Uz haubu proverite bravu, šarke i sajlu — posle udara često stradaju i one.", short: "Haube i delovi za montažu." },
  "branici": { what: "Branici prvi primaju udarac i nose maske, svetla i senzore.", when: "Pukao branik ili polomljeni nosači traže zamenu.", tip: "Proverite da li branik ima otvore za parking senzore i prskalice farova.", short: "Prednji i zadnji branici, nosači i maske." },
  "blatobrani": { what: "Blatobrani štite točkove i oblikuju prednji deo vozila.", when: "Udar ili korozija na ivici luka znače zamenu.", tip: "Plastične podbranike menjajte zajedno sa limom ako su oštećeni.", short: "Blatobrani i podbranici." },
  "vrata": { what: "Vrata nose bravu, podizač stakla, staklo i obloge.", when: "Posle udara ili korozije donjeg dela vrata se menjaju ili repariraju.", tip: "Podizači stakla dolaze kao levi ili desni, prednji ili zadnji — proverite pre narudžbine.", short: "Vrata, brave i podizači stakala." },
  "retrovizori": { what: "Retrovizori daju pogled unazad; savremeni imaju grejanje, žmigavac i električno sklapanje.", when: "Polomljeno kućište ili staklo traže zamenu dela ili celog retrovizora.", tip: "Proverite broj pinova konektora — opcije retrovizora se razlikuju po opremi.", short: "Retrovizori, stakla i kućišta." },
  "stakla": { what: "Stakla štite putnike i nose senzore kiše i kamere.", when: "Pukotina u vidnom polju vozača znači zamenu vetrobrana.", tip: "Vetrobrani se razlikuju po nosaču senzora kiše i kamere — navedite opremu u upitu.", short: "Vetrobrani, zadnja i bočna stakla." },
  "brisaci": { what: "Brisači čiste staklo i daju vidljivost po kiši.", when: "Tragovi, škripa ili preskakanje metlica znače zamenu.", tip: "Metlice menjajte u paru i proverite tip nosača (hook ili pin).", short: "Metlice brisača i motori brisača." },
  "felne-gume": { what: "Felne i gume su jedina veza vozila sa putem.", when: "Dubina šare ispod 3 mm za zimu ili 1,6 mm za leto, ili oštećenje boka znače zamenu.", tip: "Proverite dimenziju, indeks nosivosti i ET felne u saobraćajnoj ili na postojećoj gumi.", short: "Felne, gume i vijci točkova." },
  "filteri": { what: "Filteri čuvaju motor i kabinu od prljavštine: ulje, vazduh, gorivo i vazduh za kabinu.", when: "Menjaju se na svakom redovnom servisu, a filter goriva dizela i ranije ako vozilo trokira.", tip: "Filter ulja menjajte pri svakoj zameni ulja, a filter goriva prema preporuci za motor.", short: "Filteri ulja, vazduha, goriva i kabine." },
  "ulja-tecnosti": { what: "Ulja i tečnosti podmazuju, hlade i prenose pritisak u motoru, menjaču i kočnicama.", when: "Ulje motora menjate po servisnom intervalu, kočionu tečnost na dve godine.", tip: "Birajte ulje po VW normi (npr. 504 00/507 00), ne samo po viskozitetu.", short: "Motorna ulja, ulja za menjač, kočiona i rashladna tečnost." },
  "filter-ulja": { what: "Filter ulja zadržava čestice iz motornog ulja.", when: "Menja se pri svakoj zameni ulja.", tip: "Uz uložak filtera uvek idu nove zaptivke kućišta.", short: "Filteri ulja i ulošci." },
  "filter-vazduha": { what: "Filter vazduha zadržava prašinu pre usisa.", when: "Menja se na servisu ili ranije ako vozite po prašini.", tip: "Zapušen filter vazduha podiže potrošnju i čađ na dizelima.", short: "Filteri vazduha motora." },
  "filter-goriva": { what: "Filter goriva štiti pumpu visokog pritiska i brizgaljke.", when: "Menja se po intervalu ili kada motor gubi snagu pod opterećenjem.", tip: "Posle zamene na dizelu odzračite sistem pre paljenja.", short: "Filteri goriva za dizel i benzin." },
  "filter-kabine": { what: "Filter kabine prečišćava vazduh koji ulazi u kabinu.", when: "Menja se jednom godišnje ili kada se oseti miris iz ventilacije.", tip: "Filter sa aktivnim ugljem zadržava i mirise i gasove.", short: "Filteri kabine i sa aktivnim ugljem." },
};

const COMMON =
  "U katalogu tražite po OEM ili kataloškom broju, po vozilu (marka, model, generacija, motor) ili po proizvođaču; uz svaki deo piše kvalitet (original VAG, OEM ili aftermarket), cena sa PDV-om i stanje. Ako niste sigurni koji deo odgovara, pošaljite broj šasije (VIN) kroz upit i proverićemo umesto vas.";

export function buildIntro(slug: string): string {
  const copy = CATEGORY_COPY[slug];
  if (!copy) return COMMON;
  return `${copy.what} ${copy.when} ${copy.tip} ${COMMON}`;
}

/**
 * The category SEO texts seeded until step 22. They are no longer seeded (SEO-03): the page
 * builds title and description from the name and live counts. Kept only so the migration
 * `seed:clearSeededCategorySeo` can recognise (and clear) values nobody has edited.
 */
export function legacySeoTitle(label: string): string {
  return `${label} za VW, Audi, Škoda, SEAT i Cupra`;
}

export function legacySystemSeoDescription(label: string): string {
  return `${label}: delovi za VW, Audi, Škoda, SEAT i Cupra — pretraga po OEM broju i vozilu, cene sa PDV-om i stanje.`;
}

export function legacySeoDescription(label: string, slug: string): string {
  const short = CATEGORY_COPY[slug]?.short ?? "";
  const text =
    `${label} za VAG vozila: pretraga po OEM broju i vozilu, cene sa PDV-om i stanje. ${short}`.trim();
  return text.length > 160 ? `${text.slice(0, 157).trimEnd()}…` : text;
}

/** Every leaf category has copy (checked by the seed test). */
export function missingCopy(): string[] {
  return [...CATEGORIES.map((c) => c.slug), ...SUBCATEGORIES.map((s) => s.slug)].filter(
    (slug) => !CATEGORY_COPY[slug],
  );
}
