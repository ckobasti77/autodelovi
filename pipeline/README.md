# SKLOP — autonomni build pipeline

Ovaj folder pravi ceo sajt bez tebe. `run-pipeline.ps1` pušta 23 Claude Code prompta jedan za drugim (svi na **Opus 5.5**). Svaki korak ima svoj effort, novu ili nastavljenu sesiju i mode (plan / auto / goal). Posle svakog koraka pravi git commit.

## Pokretanje
- Dupli klik na **`START-PIPELINE.cmd`** u root-u projekta.
- Ili iz PowerShell-a u root-u projekta: `powershell -ExecutionPolicy Bypass -File .\pipeline\run-pipeline.ps1`
- Ne zatvaraj prozor. Skripta sama ne da računaru da zaspi dok radi (ekran može da se ugasi).

Pre prvog koraka skripta sama proverava:
- da li je Claude Code ažuriran i ulogovan i da li radi auto mode;
- Node, git i Blender (Blender ne mora da bude otvoren — Claude ga pokreće u pozadini);
- Convex deployment iz `.env.local`;
- kopira sve skillove u `.claude/skills` (GSAP, Three.js, SEO, Text Reveal, Impeccable, Design DNA, UI UX Pro Max, Taste, Motion, 3D scrollytelling, Blender pipeline);
- pravi lokalni admin nalog (`pipeline/env/ADMIN-CREDENTIALS.txt`) i git snapshot.

## Koraci

| # | Korak | Model | Effort | Sesija | Mode |
|---|---|---|---|---|---|
| 01 | Master plan: arhitektura, baza, rute, 3D ugovor, SEO/oglasi | Opus 5.5 | max | NOVA | plan |
| 02 | Plan u docs/ + pravila projekta u CLAUDE.md | Opus 5.5 | high | nastavak #01 | auto |
| 03 | Dizajn pravac i design system (Design DNA, Impeccable, UI UX Pro Max, Taste) | Opus 5.5 | max | NOVA | auto |
| 04 | Frontend temelj: tokeni, fontovi, UI kit, Text Reveal, GSAP | Opus 5.5 | xhigh | nastavak #03 | auto |
| 05 | Convex backend: šema, uloge, katalog, porudžbine, upiti, seed | Opus 5.5 | xhigh | NOVA | auto |
| 06 | Backend mora da prođe sve provere | Opus 5.5 | xhigh | nastavak #05 | goal |
| 07 | 3D plan za Blender | Opus 5.5 | max | NOVA | plan |
| 08 | 3D auto u Blenderu + GLB + posteri + slike delova | Opus 5.5 | max | nastavak #07 | auto |
| 09 | 3D kvalitet do kraja | Opus 5.5 | max | nastavak #08 | goal |
| 10 | 3D na sajtu: rasklapanje na skrol, klik na deo → delovi iz baze | Opus 5.5 | max | NOVA | auto |
| 11 | 3D na sajtu mora da prođe testove i Lighthouse | Opus 5.5 | xhigh | nastavak #10 | goal |
| 12 | Prodavnica: stranice, pretraga po OEM, korpa, porudžbina, VIN upit | Opus 5.5 | xhigh | NOVA | auto |
| 13 | Prodavnica mora da prođe testove | Opus 5.5 | xhigh | nastavak #12 | goal |
| 14 | Portal za majstore: rabat, brza porudžbina, istorija | Opus 5.5 | xhigh | NOVA | auto |
| 15 | Admin panel | Opus 5.5 | xhigh | NOVA | auto |
| 16 | Excel uvoz i izvoz | Opus 5.5 | xhigh | nastavak #15 | auto |
| 17 | Admin + uvoz moraju da prođu testove | Opus 5.5 | xhigh | nastavak #16 | goal |
| 18 | Obaveštenja, mejlovi, automatizacija | Opus 5.5 | xhigh | NOVA | auto |
| 19 | SEO + Google/Meta oglasi + analitika + feedovi | Opus 5.5 | xhigh | NOVA | auto |
| 20 | Bezbednost i Convex audit | Opus 5.5 | xhigh | NOVA | auto |
| 21 | Veliki QA audit, više agenata paralelno | Opus 5.5 | ultracode | NOVA | auto |
| 22 | Popravi sve iz audita | Opus 5.5 | xhigh | nastavak #21 | goal |
| 23 | Predaja: README, GO-LIVE, showcase za klijenta, izveštaj | Opus 5.5 | high | NOVA | auto |

**Mode:**
- **plan** — Claude samo istražuje i piše plan, ništa ne menja. Sledeći korak nastavlja istu sesiju i izvršava plan.
- **auto** — radi sam. Klasifikator odobrava bezbedne akcije umesto tebe, a rizične (produkcija, brisanje van projekta...) blokira.
- **goal** — `/goal`: ne staje dok uslovi nisu dokazani izlazom komandi (build, testovi, Lighthouse...) ili dok ne potroši zadati broj krugova.

**Effort:**
- **max** — planiranje, dizajn i 3D, gde razmišljanje najviše vredi.
- **xhigh** — gradnja.
- **ultracode** — xhigh plus orkestracija više agenata; koristi se za finalni audit.
- **high** — dokumentacija.

Sve je u `steps.json`, a promptovi su u `prompts/`.

## Šta se dešava kad nešto krene naopako
- **Limit (5h ili nedeljni):** skripta pročita kad se limit resetuje, sačeka, proveri da li Claude opet radi i nastavi **istu sesiju** tačno gde je stala.
- **Greška ili zaglavljen proces:** do 3 pokušaja nastavka iste sesije, zatim nova „recovery" sesija koja dijagnostikuje i završi korak. Ako dva koraka zaredom propadnu, pipeline staje (da ne troši limit uzalud).
- **Ugašen računar ili zatvoren prozor:** samo ponovo pokreni `START-PIPELINE.cmd`. Završeni koraci se preskaču, a prekinuti korak nastavlja svoju sesiju.
- Zaostali dev serveri (portovi 3000/3100) se gase između koraka.

## Praćenje
- `pipeline/STATUS.md` — tabela svih koraka, šta radi sada, koliko traje, da li čeka limit.
- `pipeline/logs/` — `pipeline.log`, pun izlaz svakog pokušaja (`NN-MM.jsonl`) i izveštaj svakog koraka (`NN-result.md`).
- Iz Claude aplikacije na telefonu možeš da pitaš „kako napreduje pipeline?" — Claude pročita STATUS.md sa tvog računara.
- Opciono push na telefon: instaliraj aplikaciju **ntfy**, pretplati se na neku svoju nasumičnu temu i pokreni sa `-NtfyTopic tvoja-tema-123`.

## Parametri
| Parametar | Šta radi |
|---|---|
| `-ListSteps` | samo prikaže plan i šta je gotovo |
| `-DryRun` | ispiše tačne komande, ništa ne pokreće |
| `-From 08` | ponovo pokreće od koraka 08 nadalje |
| `-Only 12` | pokreće samo korak 12 |
| `-EffortProfile balanced` | štedi limit: max → xhigh (osim 01, 07, 08), ultracode → xhigh |
| `-EffortProfile lean` | još štedljivije: max → xhigh, xhigh → high |
| `-NtfyTopic ime` | push obaveštenja preko ntfy.sh |
| `-BlenderExe "C:\...\blender.exe"` | ako skripta ne nađe Blender sama |
| `-IfAutoModeUnavailable bypassPermissions` | ako auto mode ne radi na nalogu (bez sigurnosnih provera — koristi svesno) |
| `-NoUpdate` | ne pokreće `claude update` na početku |

## Granice (važi za svaki korak)
- Nema deploy-a u produkciju, push-a na GitHub ni plaćenih servisa.
- Nema brisanja van projekta i nema diranja globalnih podešavanja.
- Tajne ne idu u git. `pipeline/env/`, logovi i stanje su u `.gitignore`.
- Sve što može samo čovek da uradi (API ključevi, domen, pravni tekstovi, pravi podaci firme) završava u `docs/HUMAN-TODO.md`, pa na kraju u `docs/GO-LIVE.md`.

## Šta dobijaš na kraju
- Sajt (Next.js 16 + Convex) sa 3D rasklopivim autom, katalogom, porudžbinama, VIN upitima, portalom za majstore, admin panelom, Excel uvozom, mejlovima, SEO-om i pripremom za Google/Meta oglase.
- Dokumentacija:
  - `docs/PREDAJA.md` — šta je napravljeno i kako se koristi
  - `docs/GO-LIVE.md` — spisak za puštanje uživo
  - `docs/ADS-PLAYBOOK.md` — oglasi
  - `docs/showcase/index.html` — prezentacija za klijenta
  - `pipeline/REPORT.md` — izveštaj po koracima
- Lokalno pokretanje: `npm run dev` → http://localhost:3000, admin na `/admin` (login je u `pipeline/env/ADMIN-CREDENTIALS.txt`).
