# Texte pentru paginile de categorie (`/c/<slug>`)

Textul introductiv și întrebările frecvente ale unei categorii stau în baza de date
(`categories.intro_md`, `faq`, `content_updated_at` — migrația 030) și apar pe `/c/<slug>` **sub
lista de produse**, doar pe pagina 1 fără filtre (și doar dacă categoria are produse disponibile).
Se pot edita din **Admin → Categorii → „text”** sau se pot scrie ca fișiere JSON aici,
`content/categorii/<slug>.json`, importate cu `npm run categorii:import`.

Importul face **exact ce face „Salvează” din admin**: aceeași validare, aceleași coloane. Fișierul
e sursa de adevăr — reimportul suprascrie și un text editat între timp în admin.

## Formatul fișierului — `<slug>.json`

```json
{
  "slug": "monitoare",
  "intro_md": "Pe această pagină găsești {{cat:produse|monitor|monitoare}} la {{cat:lista-magazine}}. ...",
  "faq": [{ "q": "Ce diagonală aleg?", "a": "..." }],
  "review": {
    "facts": [
      { "claim": "Panourile IPS au unghiuri de vizualizare mai bune decât VA",
        "source_type": "web", "source": "https://...", "status": "confirmat" },
      { "claim": "Avem monitoare de la mai multe magazine", "source_type": "db",
        "source": "tabela offers / feed-urile", "status": "confirmat" }
    ],
    "warnings": ["Feed-ul nu precizează rata de refresh la unele modele"]
  }
}
```

| Câmp | Obligatoriu | Reguli |
|---|---|---|
| `slug` | da | slug-ul unei categorii existente și **vizibile** (și părintele vizibil), ca în `/c/<slug>` |
| `intro_md` | da | Markdown, nevid. HTML-ul brut apare ca text; linkurile se scriu explicit (`[text](/c/...)`) — fără linkify |
| `faq` | nu | listă de `{ "q", "a" }`, maxim **6**, ambele completate (rândurile complet goale se ignoră, ca în admin) |
| `review` | da | fișa de verificare — **nu se scrie în DB și nu apare pe site** |

Alte câmpuri (ex. `intro`, `checklist`) sunt eroare — prind greșelile de tipar.

**Marcaje live** (cifrele NU se scriu de mână; se înlocuiesc la fiecare afișare cu valoarea de acum):
`{{cat:produse}}`, `magazine`, `lista-magazine`, `reduceri`, `cu-mediana`, `pret-median`, `pret-p10`,
`pret-p90`, `branduri-top`, `istoric-de-la`, `actualizat`, `prag`. La `produse`, `magazine`,
`reduceri`, `cu-mediana` merge și forma cu substantiv: `{{cat:produse|laptop|laptopuri}}` →
„1 laptop”, „12 laptopuri”, „1.221 de laptopuri”. Sintaxa completă: `web/src/lib/category-markers.ts`.

**Importul refuză** (eroare, nu scrie nimic):
- marcaj necunoscut sau scris greșit (`{{cat:pret-minim}}`, acolade rămase);
- preț sau procent scris de mână („de la 499 lei”, „2499 RON”, „20%”) — folosește marcajele;
- promisiuni („garantat”, „economisești”, „cele mai mici prețuri”, „cel mai ieftin din”… — regula 9);
- afirmații de sănătate („vindecă”, „tratează”, „detoxifică”… — regula 8);
- peste 6 întrebări, întrebare fără răspuns sau invers;
- `[DE VERIFICAT…]` rămas în text;
- categorie inexistentă, ascunsă (ea sau părintele), din **Sănătate & Naturale** sau
  **`farmacie-veterinara`** (REGULI.md, regula 8);
- în `review.facts`: vreun fapt cu `status` diferit de `confirmat`, `source_type` altul decât
  `db`/`web`, sau `web` fără URL `http(s)://`. `facts` poate fi listă goală (text doar cu marcaje);
- același slug de două ori în același import.

Validarea textului e copia celei din admin (`worker/src/lib/category-texts.ts` ↔
`web/src/lib/category-markers.ts`, cu un test care le compară — modifică-le împreună).

Scrie ce **constatăm** („la momentul actualizării”), nu ce promitem. Fără reduceri promise.

## Import

Implicit **plan** — arată pentru fiecare fișier: `CREEAZĂ` (categoria n-are text),
`ACTUALIZEAZĂ` (cu data ultimei salvări și lungimea textului / nr. de FAQ vechi → nou) sau
`NESCHIMBAT` (identic — nu se atinge nimic, nici `content_updated_at`). Scrierea cere `--confirm`.
**Totul sau nimic**: un singur fișier cu erori → nu se scrie niciunul; scrierea e într-o tranzacție.
Dacă textul unei categorii a fost salvat din admin între plan și scriere, importul se oprește
(ROLLBACK) — rulează din nou planul.

După COMMIT, scriptul cheamă `POST $SITE_URL/api/revalidate/categorii` (header
`x-revalidate-secret: $REVALIDATE_SECRET`, corp `{"slugs": [...]}`), care **expiră imediat**
cache-ul textului (`revalidateTag('category-content', { expire: 0 })`) + `revalidatePath('/c/<slug>')`.
Fără acest pas, `/c/` arată textul vechi până la 1 h (cache-ul `getCategoryContent`) — vezi
„Cache gotcha” în CLAUDE.md. Dacă apelul eșuează: așteaptă ≤ 1 h sau
`docker compose up -d --force-recreate web`. `--no-revalidate` sare pasul (folosește-l local:
`.env`-ul local are `SITE_URL` de producție; pentru serverul local:
`SITE_URL=http://localhost:3000 npm run categorii:import -- … --confirm`).

Local (din `worker/`, citește `DATABASE_URL` din `.env`):

```bash
cd worker
npm run categorii:import -- ../content/categorii                                  # plan, tot directorul
npm run categorii:import -- ../content/categorii --confirm --no-revalidate        # scrie
npm run categorii:import -- ../content/categorii/monitoare.json --confirm --no-revalidate
```

Producție (scriptul e compilat în imaginea worker; JSON-ul se trimite pe **stdin** cu `-` —
un obiect sau o listă; `-T` e obligatoriu pentru stdin):

```bash
# toate fișierele odată, ca listă JSON (fără jq: node -e)
node -e 'const fs=require("fs"),d="content/categorii/";console.log(JSON.stringify(fs.readdirSync(d).filter(f=>f.endsWith(".json")).sort().map(f=>JSON.parse(fs.readFileSync(d+f,"utf8")))))' \
  | ssh superieftin@13.140.163.156 'cd /home/superieftin/app && docker compose exec -T worker node worker/dist/scripts/import-category-texts.js -'
# planul arată bine → același lucru cu „- --confirm”

# un singur fișier
ssh superieftin@13.140.163.156 'cd /home/superieftin/app && docker compose exec -T worker node worker/dist/scripts/import-category-texts.js -' < content/categorii/monitoare.json
```

Cerințe pe prod: imaginea **worker** cu scriptul și imaginea **web** cu ruta
`/api/revalidate/categorii` (deploy web + worker după acest commit); containerul worker are deja
`SITE_URL` + `REVALIDATE_SECRET` (le folosește și importul de ghiduri). Slug-urile se validează
față de baza în care imporți — o categorie care există pe prod poate lipsi local (ex. subcategoriile
Petmart din migrația 031).

## Texte în așteptare — `in-asteptare/`

Importul citește doar fișierele `.json` direct din directorul dat (nu intră în subdirectoare).
`in-asteptare/` ține textele gata scrise care NU trebuie încă publicate — ex. `monitoare.json`
(10 oct. 2026): categoria avea workstation-uri și calculatoare în loc de monitoare (reparat de
migrația 034); textul se publică după ce monitoarele reale sunt mapate în categorie (Admin → Mapare:
„microsoft refurbished” CITGrup, monitoarele evomag din desktop-uri). Mută fișierul înapoi în
`content/categorii/` și rulează importul.
