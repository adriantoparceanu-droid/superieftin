# Ciorne de ghiduri scrise de AI

Ghidurile (`/ghiduri/<slug>`) stau în baza de date și se publică din **Admin → Ghiduri**.
Ciornele sunt scrise de AI (Claude) ca fișiere JSON în `content/ghiduri/drafts/<slug>.json`,
importate cu `npm run ghiduri:import` și apoi **verificate și publicate de proprietar** din editor.
Un fișier din `drafts/` nu publică niciodată nimic.

**Excepție — `content/ghiduri/publicate/`** (decizia proprietarului din 2026-10-04): fișierele de
aici au în plus un bloc `publish` și sunt importate **direct ca ghiduri publicate** — vezi
„Publicare directă” mai jos.

## Formatul fișierului — `drafts/<slug>.json`

```json
{
  "slug": "merita-samsung-galaxy-tab-s10",
  "title": "Merită Samsung Galaxy Tab S10 în 2026?",
  "meta_description": "Ce primești, cât costă acum față de mediana 30 de zile și pentru cine merită.",
  "kind": "produs",
  "category_slug": "tablete",
  "summary": "Pe scurt: ...",
  "body_md": "## Ecran\n\nText ... [DE VERIFICAT: luminozitatea maximă]\n\n{{oferte:slug-produs}}\n",
  "faq": [{ "q": "Are slot microSD?", "a": "..." }],
  "product_slugs": ["slug-produs-1", "slug-produs-2"],
  "review": {
    "facts": [
      { "claim": "Ecran 11 inch Dynamic AMOLED 2X", "source_type": "web",
        "source": "https://www.samsung.com/ro/...", "status": "confirmat" },
      { "claim": "Baterie 8000 mAh", "source_type": "db", "source": "feed ITGalaxy / baza noastră",
        "status": "de_verificat", "note": "Feed-ul nu precizează varianta" }
    ],
    "checklist": ["Am verificat specificațiile față de sursele din fișă", "Am citit tot textul"],
    "warnings": ["Feed-ul spune X, producătorul spune Y — am folosit Y"]
  }
}
```

| Câmp | Obligatoriu | Reguli |
|---|---|---|
| `slug` | da | doar `a-z`, `0-9`, `-` (ex. `merita-x`); nu `metodologie`. Unic. |
| `title` | da | H1, max. 200 caractere |
| `meta_description` | da | max. 300 (recomandat ~160) |
| `kind` | da | `produs` („Merită X?”, „X vs Y”) sau `categorie` („Cele mai bune … sub N lei”) |
| `category_slug` | nu | slug existent în `categories` sau `null` |
| `summary` | da | blocul „Pe scurt”, Markdown simplu, **fără** marcaje live |
| `body_md` | da | Markdown (HTML-ul brut apare ca text). Prețuri/procente NU se scriu de mână — doar marcaje live |
| `faq` | nu | listă de `{ "q", "a" }`, ambele completate |
| `product_slugs` | da (poate fi `[]`) | slug-uri din `/p/<slug>`; trebuie să existe în DB; ordinea = poziția |
| `review` | da | fișa de verificare (vezi mai jos) — **nu apare niciodată pe site** |

**Marcaje live** în `body_md` (fiecare pe rând separat; `ref` = slug sau id de produs existent):
`{{oferte:ref}}`, `{{pret:ref}}`, `{{reducere:ref}}`, `{{istoric-pret:ref}}`, `{{comparatie:ref1,ref2}}` (2–6).
Orice alt `{{…}}` e eroare la import.

**Locuri nesigure**: în text se marchează `[DE VERIFICAT: ce anume]`. Publicarea e blocată
(în editor ȘI pe server) cât timp există vreun marcaj în titlu, meta, rezumat, corp sau FAQ.

**`review`** (salvat în `guides.review_notes`, migrația 024):
- `facts` (listă nevidă): `claim`, `source_type` = `db` (baza noastră / feed) sau `web` (atunci `source` e URL http/https),
  `source`, `status` = `confirmat` | `de_verificat`, `note` opțional.
- `checklist` (listă nevidă): pașii pe care proprietarul îi bifează în editor înainte de „Publică”.
- `warnings` (opțional): contradicții între surse, alegeri făcute de AI.

Fără afirmații de sănătate (vindecă, tratează, detoxifică…) — publicarea le blochează (REGULI.md, regula 8).

## Publicare directă — `publicate/<slug>.json`

Același format, plus:

```json
"publish": { "author_slug": "adrian", "reviewer_slug": "echipa-superieftin" }
```

(`guide_authors.slug`: „Scris de” Adrian, „Verificat de” Echipa Superieftin.ro). Importul refuză
publicarea (eroare, nu scrie nimic) dacă: autorul = verificatorul, lipsește meta/corpul, există
afirmații de sănătate (regula 8, aceeași listă ca `findHealthClaims` din web), există
`[DE VERIFICAT` în titlu/meta/rezumat/corp/FAQ, vreun fapt din `review.facts` nu e `confirmat`,
sau apare un preț scris de mână („1.299 lei”, „2499 RON”). Produsele fără ofertă disponibilă
acum sunt doar **avertisment** în plan (pe pagină ar apărea „indisponibil”) — preferă magazine
cu feed stabil (evomag, ITGalaxy), nu eMAG scanat.

Fișierul e sursa de adevăr: reimportul **actualizează și un ghid publicat** (o editare făcută
între timp în admin se pierde), dar numai dacă ceva diferă — altfel „NESCHIMBAT” și nu se atinge
nimic (nici `updated_at`). `published_at` rămâne data primei publicări. După COMMIT, scriptul
cheamă `POST $SITE_URL/api/revalidate/ghiduri` (cu `REVALIDATE_SECRET`): `revalidatePath` pe
ghid, `/ghiduri` și `/p/` legate + ping IndexNow — același efect ca „Publică” din admin. Dacă
apelul eșuează, ghidurile noi apar oricum (ISR), cele vechi se reîmprospătează în ≤ 15 min
(`/p/` ≤ 1 h); imediat: `docker compose up -d --force-recreate web`. `--no-revalidate` sare
pasul (folosește-l local: `.env`-ul local are `SITE_URL` de producție).

## Import

Implicit **plan** (arată ce ar face, nu scrie). Scrierea cere `--confirm`. Dacă un singur fișier
are erori, nu se scrie niciunul. Upsert după `slug`: o ciornă existentă se **suprascrie**
(inclusiv modificările făcute în editor), un ghid **publicat** nu se atinge niciodată (e sărit
cu mesaj — retrage-l din admin dacă vrei să-l reimporți). Autor: „Echipa Superieftin.ro”,
verificator: „Adrian”, `status = draft`, `generated_by = claude`.

Local (din `worker/`, citește `DATABASE_URL` din `.env`):

```bash
cd worker
npm run ghiduri:import -- ../content/ghiduri/drafts                 # plan, tot directorul
npm run ghiduri:import -- ../content/ghiduri/drafts --confirm       # scrie
npm run ghiduri:import -- ../content/ghiduri/drafts/merita-x.json --confirm
```

Producție (scriptul e compilat în imaginea worker; fișierul se trimite pe **stdin** cu `-`,
deci nu trebuie copiat în container — `-T` e obligatoriu pentru stdin):

```bash
# ghidurile de publicat (toate odată, ca listă JSON pe stdin; fără jq: node -e)
node -e 'const fs=require("fs"),d="content/ghiduri/publicate/";console.log(JSON.stringify(fs.readdirSync(d).filter(f=>f.endsWith(".json")).sort().map(f=>JSON.parse(fs.readFileSync(d+f,"utf8")))))' \
  | ssh superieftin@13.140.163.156 'cd /home/superieftin/app && docker compose exec -T worker node worker/dist/scripts/import-guide-drafts.js -'
# planul arată bine → același lucru cu „- --confirm”

# de pe calculatorul local, direct:
ssh superieftin@13.140.163.156 'cd /home/superieftin/app && docker compose exec -T worker node worker/dist/scripts/import-guide-drafts.js -' < content/ghiduri/drafts/merita-x.json
# după ce planul arată bine, adaugă --confirm după „-”
# mai multe fișiere deodată: stdin acceptă și o listă JSON
jq -s . content/ghiduri/drafts/*.json | ssh superieftin@13.140.163.156 'cd /home/superieftin/app && docker compose exec -T worker node worker/dist/scripts/import-guide-drafts.js - --confirm'
```

Cerință: imaginea worker de pe prod trebuie să conțină scriptul (deploy după acest commit) și
migrația 024 aplicată (`docker compose --profile tools build migrate && docker compose --profile tools run --rm migrate`).
Slug-urile de produs se validează față de baza în care imporți — un produs care există local
poate lipsi pe prod.
