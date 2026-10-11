# Euromotors Plus by OEM Parts — znak i uputstvo za upotrebu

> Za vlasnika i klijenta. Urađeno u koraku 24 (11.10.2026.). U koraku 25 znak je ugrađen u sajt i radni naziv „SKLOP“ je uklonjen; slike znaka na sajtu su u [`site/`](site/).
> Tabla za prikazivanje klijentu: [`BRAND-BOARD.html`](BRAND-BOARD.html) (otvara se dvoklikom, radi bez interneta) i slika [`BRAND-BOARD.png`](BRAND-BOARD.png).
> Polazni zahtevi: [`BRAND-BRIEF.md`](BRAND-BRIEF.md). Ostali predlozi: [`concepts/README.md`](concepts/README.md).

## 1. Ideja, jednostavnim rečima

Firma se zove **Euromotors Plus**. Kupci i majstori radnju znaju kao **OEM Parts**. Novi znak nosi oba imena, tim redom: ime firme vodi, radnja ga potpisuje.

Znak ima četiri dela:

1. **E** — početno slovo imena, nacrtano kao zagrada otvorena ka imenu. Ima istu debljinu poteza kao slova u reči EUROMOTORS, pa znak i ime izgledaju kao jedna celina. Stari znak je levo od imena imao krug zvezdica; novi na istom mestu ima jedno jasno slovo.
2. **Plus** — narandžast, jedini obojeni deo znaka. Stoji u zagradi kao deo u svom ležištu. Na sajtu narandžasta uvek znači „vaše“ ili „sledeći korak“; u znaku znači deo koji tražite.
3. **Linija** — tanka linija između reči PLUS i potpisa. Stari znak firme je imao liniju sa obe strane reči Plus, a znak radnje liniju ispod reči OEM. Sada je to jedna ista linija.
4. **by OEM Parts** — potpis radnje, precrtan sa dosadašnjeg znaka: puna, široka, nagnuta reč „OEM“ i konturna reč „Parts“. Puna reč i njena kontura izgledaju kao deo i njegov rendgenski snimak, što je i ideja celog sajta.

Šta je namerno izostavljeno: serifno pismo, tamnoplava boja i zvezdice. Krug zvezdica nije zadržan ni u naznaci, jer je dvanaest zvezdica u krugu zaštićen amblem Evropske unije i zavodi za žigove odbijaju znakove koji na njega liče.

## 2. Oblici znaka — koji kada

| Oblik | Datoteka | Kada se koristi | Najmanja visina |
|---|---|---|---|
| **Osnovni** (znak + ime + potpis) | `logo-horizontal-*` | Svuda gde ima mesta: e-pošta, dokumenta, ponude, oglasi, društvene mreže. | 56 px · 14 mm |
| **Za zaglavlje** (bez potpisa) | `logo-header-*` | Zaglavlje sajta, admin, mali formati. Potpis se ne smanjuje ispod čitljivosti, nego se izostavlja. | 28 px · 8 mm |
| **Dvojni** (oba imena iste visine) | `logo-dual-*` | Tabla iznad radnje, vozilo, baner, sajamski pano: tamo gde ljudi treba odmah da prepoznaju OEM Parts. | 48 px · 14 mm |
| **Uspravni** (znak iznad imena) | `logo-stacked-*` | Uski ili skoro kvadratni prostori: nalepnica, kutija, poslednja strana ponude. | 120 px · 30 mm |
| **Samo ime** | `logo-wordmark-*` | Kada znak već stoji pored (npr. uz ikonicu) ili kada je visina mala a širina velika. | 48 px · 12 mm |
| **Znak** | `mark-*` | Ikonica, profilna slika, pečat, ugao dokumenta. | 16 px · 5 mm |
| **Potpis radnje** | `oem-parts-*` | Mesta na kojima stoji samo „OEM Parts“ (npr. Viber profil radnje, vrata lokala). | 40 px · 12 mm |

Ako oblik ne staje u visinu iz tabele, uzima se sledeći manji. Znak se nikad ne precrtava i ne sužava da bi stao.

## 3. Boje

| Nastavak u nazivu | Izgled | Za šta |
|---|---|---|
| `-night` | Svetao znak (`#F1ECE3`), narandžast plus (`#FF6B1A`) | Tamne podloge: sajt, tabla, tamna vozila. |
| `-paper` | Grafitni znak (`#121518`), narandžast plus | Bele i svetle podloge: e-pošta, admin, dokumenta u boji. |
| `-black` | Sve crno | Jednobojna štampa, faks, pečat, graviranje. |
| `-white` | Sve belo | Jednobojno na tamnom ili na fotografiji. |
| `-orange` | Sve narandžasto | Samo na tamnoj podlozi, kada je znak jedini element (npr. majica, nalepnica). |

Boja podloge sajta je `#0D0F11`. Narandžasta je u znaku uvek samo na plusu (osim u varijanti `-orange`, gde je ceo znak u jednoj boji).

Za štampu u boji nisu date Pantone i CMYK vrednosti: njih treba izabrati sa štamparom, sa fizičkog uzorka, prema `#FF6B1A` i `#0D0F11` (videti „Otvorene stavke“).

## 4. Pravila

**Slobodan prostor.** Oko znaka sa svake strane ostaje prazan prostor širine jednog plusa (devet jedinica mreže; kod osnovnog znaka to je oko 40 % njegove visine). U tom prostoru nema teksta, ivica ni drugih znakova.

**Najmanje veličine** su u tabeli u odeljku 2. Na ekranu ispod 32 px koristi se posebno crtana ikonica (`favicon.ico`), a ne smanjen vektorski znak.

**Dozvoljeno:** znak na tamnoj ili beloj podlozi, u jednoj boji, samo znak kad nema mesta za ime, dvojni znak na tabli i vozilu.

**Nije dozvoljeno:**

- razvlačiti, sabijati, okretati ili naginjati znak;
- menjati boje ili bojiti plus drugom bojom;
- dodavati senku, sjaj, okvir ili konturu;
- stavljati znak na narandžastu, šarenu ili fotografsku podlogu bez dovoljnog kontrasta;
- premeštati delove (znak je uvek levo od imena, potpis uvek desno ispod);
- kucati ime drugim pismom pored znaka ili menjati tekst potpisa;
- zatvarati plus u krug ili kvadrat i koristiti plus sam, bez zagrade;
- koristiti osnovni znak ispod 56 px visine (tada ide oblik za zaglavlje);
- stavljati znak uz znakove proizvođača vozila (VW, Audi, Škoda, SEAT, Cupra) tako da izgleda kao da je radnja njihov ovlašćeni partner.

**U tekstu** se ime piše „Euromotors Plus“ (ne „Euromotors+“), a radnja „OEM Parts“.

## 5. Datoteke

### Za sajt — `public/brand/`

| Datoteka | Šta je |
|---|---|
| `logo-horizontal-{night,paper,black,white,orange}.svg` | Osnovni znak. |
| `logo-header-…svg` | Znak za zaglavlje (bez potpisa). |
| `logo-dual-…svg` | Dvojni znak. |
| `logo-stacked-…svg` | Uspravni znak. |
| `logo-wordmark-…svg` | Samo ime sa potpisom. |
| `mark-…svg` | Znak. |
| `oem-parts-…svg` | Potpis radnje. |
| `icon.svg` | Ikonica na tamnoj pločici (vektor, 512). |
| `favicon.ico` | Ikonica za karticu pregledača: 16, 32 i 48 px, crtane piksel po piksel. |
| `favicon-16.png`, `favicon-32.png`, `favicon-48.png` | Iste tri ikonice pojedinačno. |
| `apple-touch-icon.png` | 180 × 180, za početni ekran iPhone-a. |
| `icon-192.png`, `icon-512.png` | Ikonice aplikacije (zaobljena pločica). |
| `icon-maskable-192.png`, `icon-maskable-512.png` | Ikonice za Android, znak unutar bezbedne zone. |
| `email-header@2x.png` | Zaglavlje e-pošte na beloj: 954 × 176 px, prikazuje se u veličini 477 × 88. |
| `social-avatar.png` | Profilna slika 1000 × 1000 (mreže je same seku u krug). |

Sve SVG datoteke sadrže samo krive: nema teksta, ugrađenih pisama ni slika. Osnovni znak ima oko 12 KB.

### Komplet za štampu i saradnike — `docs/brand/export/`

| Fascikla | Sadržaj |
|---|---|
| `svg/` | Isti SVG-ovi kao za sajt (35 datoteka). Za dizajnere, štampare i izradu table. |
| `png/` | Svaki oblik u svakoj boji u tri veličine: osnovna, `@2x` i `@4x` (105 datoteka, providna podloga). Za Word, Excel, Viber, društvene mreže. |
| `pdf/` | Vektorski PDF svakog oblika u svakoj boji (35 datoteka). Svetle varijante su na tamnoj podlozi sa slobodnim prostorom, da se vide kad se otvore; `-paper` i `-black` su bez podloge. Za štampu. |
| `icons/` | Kopija ikonica, zaglavlja e-pošte i profilne slike. |
| `manifest.json` | Spisak svih datoteka sa dimenzijama. |

Štamparu i firmi koja pravi tablu šalju se **PDF ili SVG**, nikad PNG.

### Pregledi

| Datoteka | Šta je |
|---|---|
| `docs/brand/BRAND-BOARD.html` / `.png` | Tabla za klijenta. |
| `docs/brand/renders/logo-system-night.png`, `logo-system-paper.png` | Svi oblici na tamnoj i na beloj. |
| `docs/brand/renders/logo-one-colour.png` | Jednobojne varijante. |
| `docs/brand/renders/logo-small-sizes.png` | Male veličine i ikonice. |

## 6. Pisma i licence

| Gde | Pismo | Autor | Licenca |
|---|---|---|---|
| EUROMOTORS, PLUS | **Archivo**, težina 800, širina 125 (Expanded) | Omnibus-Type | SIL Open Font License 1.1 |
| by, OEM, Parts | **Saira**, kurziv, širina 125 (Expanded), prošireno i dodatno nagnuto | Omnibus-Type | SIL Open Font License 1.1 |

Oba pisma su slobodna za komercijalnu upotrebu i za pravljenje znaka. U znaku su slova pretvorena u krive i dorađena (razmaci između slova, širina i nagib potpisa, kontura reči Parts), pa datoteke znaka ne zavise od pisma. Isto pismo Archivo već nosi naslove na sajtu.

## 7. Drugi predlozi

Nacrtano je sedam pravaca; svaki je ocenjen po čitljivosti na 16 piksela, štampi u jednoj boji, prepoznatljivosti, uklapanju u sajt, pamtljivosti i tome koliko jasno nosi oba imena. Izabran je pravac „E-plus“ i dorađen posle nezavisne kritike. Najbolji od ostalih, ako klijent želi da vidi još:

- **Izvučen plus** (`concepts/sheets/k7-izvucen-plus.png`) — ime se završava znakom plusa kojem je gornji krak izvučen. Kraće i smelije, ali reč „Plus“ više nije ispisana.
- **Etiketa** (`concepts/sheets/k6-etiketa.png`) — znak kao etiketa na kutiji dela. Dobro za pakovanje i tabele, slabo kao znak: narandžasta pločica sa plusom liči na dugme „dodaj“.
- **Pečat** (`concepts/sheets/k5-pecat.png`) — okrugli pečat sa OEM Parts u sredini. Može da posluži kao nalepnica na kutiji.

Ceo spisak sa ocenama i razlozima: [`concepts/README.md`](concepts/README.md); kritika: [`concepts/CRITIQUE.md`](concepts/CRITIQUE.md).

## 8. Otvorene stavke (za vlasnika i klijenta)

- **Potvrda klijenta** da je znak prihvaćen i da reč „by“ odgovara odnosu firme i radnje. Ako ne odgovara, dvojni znak (bez „by“) može da postane osnovni.
- **Provera žiga** pre registracije i pre izrade table: pretraga sličnih znakova u Zavodu za intelektualnu svojinu Republike Srbije i u bazi TMview, najbolje preko zastupnika. Ova provera nije urađena.
- **Boje za štampu**: Pantone i CMYK sa štamparom, sa probnim otiskom.
- **Stari znakovi**: ako postoje vektorske datoteke dosadašnjih znakova, sačuvati ih u `docs/brand/source/`.

## 9. Za programera

Znak se ne crta ručno. Sve nastaje iz skripti:

```
node scripts/brand/logo/build.mjs     # public/brand i docs/brand/export
node scripts/brand/logo/site.mjs      # ono što sajt koristi: components/brand/logoPaths.ts, app/icon.svg, favicon.ico, apple-icon.png
node scripts/brand/logo/verify.mjs    # 11 provera (čistoća SVG-a, debljine, razmaci, ikonice, PDF)
node scripts/brand/logo/renders.mjs   # docs/brand/renders
node scripts/brand/logo/board.mjs     # BRAND-BOARD.html i .png
node scripts/brand/logo/concepts.mjs  # predlozi u docs/brand/concepts
```

Geometrija i sve mere su u `scripts/brand/logo/logo.mjs` (mreža, debljine, razmaci, najmanje veličine). Promena se radi tamo, pa se sve ponovo izgradi: prvo `build.mjs`, zatim `site.mjs`.

Na sajtu se znak koristi samo preko komponenti u `components/brand/` (`BrandLink`, `LogoHeader`, `LogoLockup`, `LogoMark`). Koji oblik stoji gde i u kojoj veličini: `docs/design/DESIGN-SYSTEM.md` §2.4. Slike za pregled prave `scripts/brand/site/shots.mjs`, `email.mjs` i `favicon.mjs`.
