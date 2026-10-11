# Euromotors Plus · OEM Parts — Rezervne kopije baze i vraćanje

> Deo dokumentacije sajta Euromotors Plus — indeks: [README](README.md). Tehnički pregled: [SECURITY-AUDIT §6](SECURITY-AUDIT.md). Kod je u gitu, 3D model se pravi iz skripti — kopira se samo **baza (Convex) sa fajlovima** (slike delova, fotografije iz upita).

## 1. Pravljenje kopije

```bash
# iz foldera projekta; --prod = produkcija (bez toga: razvojna baza)
npx convex export --prod --include-file-storage --path backups/euromotors-2026-10-01.zip
```

- ZIP sadrži svaku tabelu kao `<tabela>/documents.jsonl`, fajlove u `_storage/` i podatke komponenti (ograničenja zahteva, Resend).
- To su **pravi lični podaci kupaca**: čuvati samo na mestu kojem imate pristup samo vi (šifrovan disk ili skladište sa dvostrukom potvrdom prijave), nikad u git (folder `backups/` je isključen iz gita), nikad mejlom.
- Convex pravi i svoje kopije (Dashboard → Settings → Snapshots / Backups); ova kopija je dodatna i vaša — ne zavisi od Convex naloga.

## 2. Raspored (preporuka)

| Koliko često | Šta | Čuva se |
|---|---|---|
| **svaki dan** (noću, npr. 03:00) | `npx convex export --prod --include-file-storage` | 14 dana |
| svake nedelje (nedelja) | ista komanda, zasebna fascikla | 8 nedelja |
| prvog u mesecu | ista komanda | 12 meseci |
| **pre svakog većeg zahvata** (veliki uvoz iz Excela sa deaktiviranjem, brisanje demo podataka, promena šeme) | ista komanda | do sledeće mesečne |

Najviše se gubi jedan dan rada (RPO 24 h); u tom slučaju porudžbine iz tog dana imate i u mejlovima „Nova porudžbina“. Za dnevno pokretanje: Windows Task Scheduler na računaru u radnji ili GitHub Actions sa tajnom `CONVEX_DEPLOY_KEY` (produkcijski ključ daje pun pristup bazi — čuvati ga kao najveću tajnu). Posle isteka roka kopiju obrisati (važno i za zahteve za brisanje podataka, PRIVACY-PROCESS §3).

## 3. Provera kopije („vežba vraćanja“) — jednom mesečno

Kopija koja nikad nije vraćena nije proverena kopija.

**A. Brza provera (bez nove baze, 1 minut)** — da li je kopija cela i da li je baza prihvata:

```bash
mkdir backups/provera && tar -xf backups/euromotors-2026-10-01.zip -C backups/provera
npx convex run --prod seed:stats > backups/provera-stats.json
BACKUP_DIR=backups/provera BACKUP_STATS=backups/provera-stats.json npx vitest run tests/unit/backup
```

Test proverava: sve tabele koje imaju podatke su u kopiji, **svaki zapis odgovara današnjoj šemi baze** (znači da bi ga `import` prihvatio), svi fajlovi su tu, broj zapisa po tabeli jednak je stanju baze. Urađeno 30.09.2026. na razvojnoj bazi: 4/4 u redu; namerno pokvaren zapis test odmah prijavi (tabela, zapis, polje).

**B. Pravo vraćanje u probnu bazu (jednom mesečno, 10 minuta)** — dokazuje da se podaci stvarno vraćaju:

1. Napravite privremenu bazu sa trenutnim kodom:
   - sa Convex Pro planom: Dashboard → Settings → Deploy keys → „Preview deploy key“, pa `CONVEX_DEPLOY_KEY=<ključ> npx convex deploy --preview-create vezba-2026-10` (ime novog deploymenta piše u izlazu komande);
   - bez Pro plana: u Dashboardu napravite zaseban besplatan projekat „euromotors-vezba“, u kopiji foldera projekta pokrenite `npx convex dev --once --configure existing` i izaberite taj projekat (ime deploymenta piše u izlazu).
2. Proverite ime deploymenta još jednom — **nikad** ne sme biti produkcija.
3. Vratite kopiju: `npx convex import --deployment <ime> --replace-all backups/euromotors-2026-10-01.zip`
4. Proverite: `npx convex run --deployment <ime> seed:stats` — brojevi moraju biti isti kao u `provera-stats.json`; otvorite nekoliko porudžbina i jednu sliku u Dashboardu tog deploymenta.
5. Obrišite privremeni deployment i lokalne kopije (`backups/provera*`).

Ako bilo koji korak ne uspe, to je najvažniji rezultat vežbe — javiti odmah.

## 4. Vraćanje produkcije (samo u nuždi)

1. Zaustaviti promene: u Admin → Podešavanja isključiti poručivanje (ili privremeno staviti stranicu „radovi“), obavestiti osoblje.
2. **Napraviti kopiju trenutnog stanja** (i pokvarenog) — §1 — da se ništa ne izgubi.
3. Vratiti: `npx convex import --prod --replace-all backups/<izabrana-kopija>.zip`
   - `--replace-all` briše sve što je u bazi posle te kopije: porudžbine i upiti primljeni posle kopije **nestaju** iz baze — prepisati ih ručno iz mejlova „Nova porudžbina“ / „Novi upit“.
   - Kupci prijavljeni posle kopije moraju ponovo da se prijave.
4. Proveriti `seed:stats`, prijavu vlasnika, jednu porudžbinu i sliku; zatim ponovo uključiti poručivanje.
5. Ponoviti anonimizacije primljene posle datuma kopije (PRIVACY-PROCESS §3).

Pre koraka 3 obavezno još jednom proveriti da komanda ide na pravu bazu (`--prod` i ime deploymenta u izlazu komande).
