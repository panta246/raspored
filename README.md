# Raspored radnika

Desktop aplikacija (Electron + React + TypeScript) za pravljenje rasporeda radnika po smjenama
od 12 sati, na više lokacija, sa automatskom rotacijom, ručnim izmjenama, bolovanjima/odmorima,
vještinama, radnim nalozima, statistikom i PDF izvozom.

---

## Šta aplikacija radi

- **Radnici** — dodavanje/izmjena/brisanje, svrstavanje u jednu od 4 grupe (crvena, zelena, plava, ljubičasta).
- **Rotacija smjena** — svaki radnik ide: **PRVA → DRUGA → ODMOR → ODMOR** (ciklus 4 dana).
  Grupe su fazno pomjerene pa svaki dan jedna grupa radi prvu, jedna drugu, dvije odmaraju.
- **Lokacije** — neograničen broj; za svaku se bira **minimum i maksimum** radnika i opcionalno
  **tražene vještine** (npr. lokacija mora imati 1 šefa).
- **Vještine / osobine** — uređiva lista (šef smjene, strani jezik, vozač, pilot, prva pomoć…).
- **Bolovanje / odmor** — radnik se označi (sa opcionalnim opsegom datuma) i automatski se izuzima
  iz daljih kalkulacija dok traje.
- **Generisanje 28 dana** unaprijed, uz fer rotaciju radnika po lokacijama.
- **Ručne izmjene** — svaki radni dan se može mijenjati (premjesti, dodaj, ukloni radnika).
  Ručne izmjene su **zaključane** i preživljavaju ponovno generisanje.
- **Ponovni izračun** — kad se ubaci bolovanje ili promijeni nešto, klik na „Generiši 28 dana"
  ponovo računa raspored, čuvajući ručne izmjene.
- **Radni nalog** — za svakog radnika, za svaki dan, može se upisati poseban tekst zadatka.
- **Statistika** — koliko je puta koji radnik bio na kojoj lokaciji.
- **Šifra** — opcionalna šifra pri pokretanju (postavlja se u Postavkama).
- **PDF** — izvoz cijelog 28-dnevnog rasporeda.
- **Podaci** — čuvaju se lokalno u SQLite bazi na vašem računaru (bez interneta i servera).

---

## Instalacija i pokretanje (potreban Node.js)

1. Instalirajte **Node.js** (verzija 18 ili novija): https://nodejs.org → preuzmite „LTS" i instalirajte.
2. Otpakujte ovaj folder negdje na disk.
3. Otvorite terminal/command prompt **u tom folderu** i pokrenite:

```bash
npm install
```

4. Pokrenite aplikaciju:

```bash
npm start
```

`npm start` automatski izgradi sučelje (React) i otvori aplikaciju kao prozor.
Prvi put nema šifre — samo kliknite **Otvori**.

---

## Razvoj (ako želite dalje razvijati)

Aplikacija je rađena na **React + TypeScript + Tailwind (Vite)**, što je sigurno i ugodno za dalji rad.

```bash
npm run dev        # razvoj sa hot-reload-om (Vite + Electron zajedno)
npm run typecheck  # provjera TypeScript tipova
npm run build      # samo izgradnja sučelja u dist-renderer/
```

Struktura:
- `main.js` — Electron glavni proces (prozor, IPC, PDF izvoz)
- `preload.js` — sigurni most koji izlaže `window.api`
- `src/scheduler.js` — čista logika rasporeda (rotacija, raspodjela) — bez UI-ja, lako se testira
- `src/db.js` — SQLite sloj (sql.js)
- `renderer/src/` — React aplikacija (TypeScript):
  - `App.tsx` — login, navigacija, error boundary
  - `views/` — ekrani (Raspored, Radnici, Lokacije, Vještine, Statistika, Postavke)
  - `components/` — store (podaci) i UI (modal/toast)
  - `lib/schedule.ts` — pomoćne funkcije (rotacija, datumi)
  - `types.ts` — tipovi (uključujući tipiziran `window.api`)

---

## Pravljenje instalera (.exe / .dmg / AppImage)

```bash
npm run dist          # za vaš trenutni operativni sistem
npm run dist:win      # Windows  -> dist/ dobije .exe instaler (NSIS)
npm run dist:mac      # macOS    -> .dmg
npm run dist:linux    # Linux    -> .AppImage
```

Gotov instaler je u folderu **`dist/`**. Napomena: Windows instaler se najpouzdanije pravi na
Windows računaru, mac na macOS-u itd.

---

## Prvo korištenje (preporučeni redoslijed)

1. **Vještine** — provjerite/uredite listu osobina (već su ubačene tipične).
2. **Lokacije** — postavite lokacije, min/max i tražene vještine (već postoji 5 primjera).
3. **Radnici** — dodajte ljude i rasporedite ih u 4 grupe. Za ravnomjernu pokrivenost neka grupe budu
   približno jednake (npr. ~17–18 po grupi za 70 ljudi).
4. **Raspored** → **Generiši 28 dana**.
5. Po potrebi ručno doradite dane, dodajte radne naloge, izvezite **PDF**.

### Savjet o grupama i vještinama
Pošto svaki dan radi samo jedna grupa po smjeni, neka u **svakoj grupi** ima dovoljno ljudi i bar
jedan sa svakom traženom vještinom (npr. šef u svakoj grupi), inače sistem javi upozorenje da ne može
popuniti uslov.

---

## Gdje su podaci

Baza (`raspored.sqlite`) se čuva u sistemskom folderu aplikacije:
- Windows: `%APPDATA%\raspored-radnika`
- macOS: `~/Library/Application Support/raspored-radnika`
- Linux: `~/.config/raspored-radnika`

Za sigurnosnu kopiju, samo kopirajte taj `.sqlite` fajl.
