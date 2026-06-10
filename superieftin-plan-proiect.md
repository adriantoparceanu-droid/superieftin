# superieftin.ro — Plan de implementare

Acest document este briefing-ul complet al proiectului. Este scris pentru a fi dat lui Claude Code, fază cu fază. **Nu implementa tot documentul deodată** — implementează doar faza cerută explicit de utilizator, în ordine.

---

## 1. Context și obiectiv

**Produs:** agregator de reduceri reale pentru piața din România. Urmărim prețurile produselor la retailerii mari (eMAG, Altex etc.), păstrăm istoricul de preț și arătăm utilizatorilor doar reducerile adevărate (comparate cu istoricul, nu cu „prețul recomandat" umflat). Monetizare prin linkuri de afiliere (Profitshare / 2Performant). Funcție cheie de retenție: alerte de preț pe Telegram.

**Cine implementează:** Claude Code (din Cursor sau terminal), pe baza acestui document. Utilizatorul este antreprenor cu cunoștințe tehnice de bază spre intermediare — explică deciziile importante pe scurt, scrie comentarii clare în cod, nu presupune cunoștințe avansate.

**Mod de lucru:** dezvoltare locală pe Mac, deploy pe VPS doar la go-live (Faza 4). VPS-ul și domeniul NU sunt necesare pentru Fazele 1-3.

---

## 2. Mediile de lucru

### Local (development) — Mac
- **Cod:** Cursor + Claude Code
- **Baze de date:** DBngin cu **PostgreSQL 16** (aceeași versiune majoră ca producția — obligatoriu) și **Redis**
- **Aplicația:** rulează nativ cu `npm run dev` pe `localhost:3000`; workerul rulează ca proces separat (`npm run dev:worker`)
- Docker NU e necesar local pentru development de zi cu zi; `docker compose up` local e doar un test opțional de paritate înainte de deploy

### Producție — VPS (configurat în Faza 4)
- VPS Contabo, Ubuntu 24.04, NVMe
- Totul în Docker Compose: Caddy (SSL automat), web, worker, PostgreSQL 16, Redis
- Domeniul `superieftin.ro` prin Cloudflare DNS

### Cum se face trecerea local → producție
Exclusiv prin variabile de mediu. Codul nu știe și nu trebuie să știe unde rulează:
- local: `DATABASE_URL` arată spre DBngin (`localhost:5432`), `REDIS_URL` spre `localhost:6379`
- producție: aceleași variabile arată spre containerele `postgres` și `redis` din rețeaua Docker

Fluxul de livrare **cod**:
```
Mac (Cursor + Claude Code)                    VPS (producție)
  cod + npm run dev          → git push →  GitHub  → git pull → ./deploy.sh
  test pe localhost:3000                              live pe superieftin.ro
```

### Fluxul de scraping și sincronizare date (situație reală)

**Problema:** IP-ul VPS-ului (datacenter) este blocat de eMAG la nivel CDN (CloudFront returnează 511). Scraping-ul direct de pe VPS nu funcționează.

**Soluție adoptată:** scraping local (IP rezidențial) + sync manual la producție.

```
Mac (IP rezidențial)                          VPS (producție)
  npm run scrape:now (worker local)
  → date în PostgreSQL local
  → ./sync-to-live.sh          →  SSH + pg_dump/psql  →  DB producție
```

**Scripturi:**
- `worker/package.json` → `npm run scrape:now --workspace=worker` — rulează scraping-ul imediat local
- `./sync-to-live.sh` — dump tabele locale (products, offers, price_history) și import pe VPS via SSH

**Când să faci sync:**
- după fiecare sesiune de scraping local (minim o dată la 24h pentru ca mediana să funcționeze)
- după adăugarea de noi categorii sau retaileri
- `./sync-to-live.sh` face totul automat: dump → upload → import → restart web

---

## 3. Reguli generale pentru Claude Code (valabile în toate fazele)

1. **Stack fix — nu îl schimba fără să întrebi:** Next.js (App Router, TypeScript), PostgreSQL 16, Redis 7, BullMQ pentru cozi, Caddy ca reverse proxy în producție, Docker Compose ca definiție a producției.
2. **Aplicația web este stateless.** Niciun stat în memorie sau pe disc local al aplicației: sesiuni, cache și cozi stau în Redis, datele în PostgreSQL. Motiv: scalare orizontală ulterioară fără refactor.
3. **Workerii nu apelează niciodată aplicația web direct** și invers. Comunicarea se face exclusiv prin coada BullMQ (Redis) și prin baza de date.
4. **Toată configurarea prin variabile de mediu** (`.env`), niciodată hardcodată. Menține `.env.example` actualizat la fiecare fază, cu valori implicite pentru setup-ul local (DBngin).
5. **Secretele nu intră în git.** `.env` este în `.gitignore` de la primul commit.
6. **Migrații de bază de date versionate** (folosește `node-pg-migrate` sau migrațiile Prisma — alege una și rămâi consecvent). Nicio modificare manuală de schemă direct în DB. Aceleași migrații rulează local și în producție.
7. **La scraping respectă regulile:** rate limiting per retailer (configurabil, implicit max 1 request / 2 secunde), User-Agent identificabil, retry cu backoff exponențial, oprire automată la rate de eroare peste 50%. Nu ocoli măsuri anti-bot prin metode agresive.
8. **Fiecare fază se termină cu o secțiune „Verificare"** — rulează pașii de verificare și raportează rezultatul utilizatorului.
9. La final de fază, fă commit cu mesaj descriptiv. Nu amesteca fazele în același commit. Proiectul are repository pe GitHub de la Faza 1.

---

## 4. Arhitectura țintă (producție)

```
Vizitatori → Cloudflare (DNS) → Caddy (SSL, rutare) → Next.js (site + API)
                                                            ↓ citire
                                  PostgreSQL  ←  scriere  ← Workeri scraping
                                       ↑                        ↕
                                     Redis (cache + cozi BullMQ + programare joburi)
```

Containere Docker Compose în producție:

| Serviciu   | Rol                                        | Port intern |
|------------|--------------------------------------------|-------------|
| `caddy`    | Reverse proxy, SSL automat Let's Encrypt   | 80/443 (publice) |
| `web`      | Next.js — site public + API                | 3000        |
| `worker`   | Procese BullMQ: scraping, alerte           | —           |
| `postgres` | Baza de date                               | 5432 (doar rețea internă Docker) |
| `redis`    | Cache + cozi                               | 6379 (doar rețea internă Docker) |

**Important pentru securitate:** doar Caddy expune porturi publice. PostgreSQL și Redis nu sunt accesibile din internet — doar pe rețeaua internă Docker.

Local, aceeași arhitectură logică rulează fără Docker: Next.js și workerul ca procese npm, Postgres și Redis din DBngin.

---

## 5. Schema bazei de date

Principiu central: **prețul curent (tabela `offers`) este separat de istoric (tabela `price_history`)**. Tabela de istoric crește masiv și este partiționată pe luni de la început; tabela de oferte rămâne mică și rapidă pentru afișarea site-ului.

```sql
-- Retaileri monitorizați
CREATE TABLE retailers (
    id            SERIAL PRIMARY KEY,
    name          TEXT NOT NULL,              -- "eMAG"
    slug          TEXT NOT NULL UNIQUE,       -- "emag"
    base_url      TEXT NOT NULL,
    scraper_config JSONB NOT NULL DEFAULT '{}', -- selectoare CSS, rate limit etc.
    is_active     BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Produs canonic (independent de retailer)
CREATE TABLE products (
    id            BIGSERIAL PRIMARY KEY,
    name          TEXT NOT NULL,
    slug          TEXT NOT NULL UNIQUE,       -- pentru URL-uri SEO: /p/iphone-15-128gb
    category      TEXT NOT NULL,              -- simplu la început; tabelă separată când e nevoie
    brand         TEXT,
    image_url     TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_products_category ON products (category);

-- Oferta unui produs la un retailer (prețul CURENT)
CREATE TABLE offers (
    id            BIGSERIAL PRIMARY KEY,
    product_id    BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    retailer_id   INT NOT NULL REFERENCES retailers(id),
    url           TEXT NOT NULL,              -- URL-ul produsului la retailer
    affiliate_url TEXT,                       -- linkul de afiliere generat
    current_price NUMERIC(12,2),
    currency      TEXT NOT NULL DEFAULT 'RON',
    in_stock      BOOLEAN NOT NULL DEFAULT true,
    last_checked  TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (product_id, retailer_id)
);
CREATE INDEX idx_offers_product ON offers (product_id);

-- Istoricul de preț (tabela care crește masiv)
-- Partiționare nativă PostgreSQL pe luni, de la început.
CREATE TABLE price_history (
    offer_id      BIGINT NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
    price         NUMERIC(12,2) NOT NULL,
    in_stock      BOOLEAN NOT NULL DEFAULT true,
    recorded_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (offer_id, recorded_at)
) PARTITION BY RANGE (recorded_at);
-- Claude Code: generează automat partițiile lunare (script sau pg_partman)
-- și scrie un job care creează partiția lunii următoare în avans.

-- Utilizatori (minim la început — doar pentru alerte)
CREATE TABLE users (
    id            BIGSERIAL PRIMARY KEY,
    email         TEXT UNIQUE,
    telegram_chat_id TEXT UNIQUE,             -- pentru alerte pe Telegram
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Alerte de preț
CREATE TABLE alerts (
    id            BIGSERIAL PRIMARY KEY,
    user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    offer_id      BIGINT NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
    target_price  NUMERIC(12,2) NOT NULL,     -- "anunță-mă sub X lei"
    is_active     BOOLEAN NOT NULL DEFAULT true,
    triggered_at  TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_alerts_active ON alerts (offer_id) WHERE is_active;
```

Reguli de scriere a datelor:
- Scraperul scrie în `price_history` **doar când prețul s-a schimbat** față de ultima înregistrare (sau o dată pe zi ca heartbeat), nu la fiecare rulare — altfel tabela crește inutil.
- `offers.current_price` și `last_checked` se actualizează la fiecare rulare reușită.

---

## FAZA 1 — Fundația locală: proiect + DB + site minim

> Se lucrează 100% local pe Mac. Nu e nevoie de VPS sau domeniu.

### Pregătire [MANUAL — utilizatorul]
1. În DBngin: pornește un server **PostgreSQL 16** și un server **Redis** (porturile implicite 5432 / 6379).
2. Creează repository gol pe GitHub (`superieftin`).

### Obiectiv
La finalul fazei: `npm run dev` pornește site-ul pe `localhost:3000`, conectat la Postgres-ul din DBngin, cu schema completă aplicată prin migrații.

### Pași (Claude Code)
1. **Structura monorepo:**
   ```
   superieftin/
   ├── web/                  # aplicația Next.js (site + API)
   ├── worker/               # workerii de scraping și alerte (Faza 2)
   ├── db/migrations/
   ├── docker-compose.yml    # definiția PRODUCȚIEI (folosită din Faza 4)
   ├── Caddyfile             # pentru producție
   ├── deploy.sh             # pentru producție
   ├── .env.example
   └── .gitignore            # include .env
   ```
2. **Proiect Next.js** în `web/` (App Router, TypeScript, Tailwind). Pagină principală minimă + endpoint `/api/health` care verifică conexiunea la Postgres și Redis și răspunde JSON cu statusul.
3. **Migrațiile** cu schema completă din secțiunea 5, inclusiv scriptul de creare a partițiilor lunare pentru `price_history`. Comandă npm dedicată: `npm run db:migrate`.
4. **Seed minim:** scriptul `npm run db:seed` inserează primul retailer în `retailers`.
5. **Fișierele de producție** (docker-compose.yml, Caddyfile, deploy.sh) se scriu acum dar NU se folosesc încă — sunt definiția Fazei 4. Compose include healthchecks și volume persistente; Postgres și Redis fără porturi publicate.
6. `.env.example` cu valorile locale implicite (DBngin) — vezi Anexa.
7. Commit inițial + push pe GitHub.

### Verificare Faza 1
- `npm run db:migrate` rulează curat pe Postgres-ul din DBngin; tabelele și partiția lunii curente există
- `localhost:3000` se încarcă; `/api/health` răspunde `{ db: "ok", redis: "ok" }`
- `.env` nu apare în git; repository-ul e pe GitHub

---

## FAZA 2 — Primul scraper (validarea tehnică a afacerii)

> Tot local. **Aceasta e faza cu cel mai mare risc tehnic — dacă datele nu pot fi obținute fiabil, proiectul pivotează aici, ieftin.**

### Obiectiv
Un singur retailer, o singură categorie de produse, date reale care curg în DB-ul local de cel puțin 48h fără intervenție.

### Decizii
- Retailerul și categoria le alege utilizatorul la începutul fazei (recomandare: o categorie cu produse identificabile clar, ex. telefoane sau electrocasnice mici).
- **Verifică întâi dacă retailerul are feed de afiliere cu prețuri** (Profitshare și 2Performant oferă feed-uri de produse pentru afiliați). Un feed oficial e întotdeauna preferabil scrapingului: stabil, legal-clar, fără anti-bot. Scrapingul HTML e fallback-ul, nu prima opțiune.

### Pași (Claude Code)
1. Proces worker în `worker/` (Node.js + TypeScript + BullMQ), pornit local cu `npm run dev:worker`.
2. **Coada `scrape`** cu job programat (repeatable job) la interval configurabil prin env (implicit: la 8 ore). Pentru testare, comandă manuală `npm run scrape:now`.
3. **Pipeline-ul unui job de scraping:**
   - ia lista de URL-uri/feed de procesat pentru retailer
   - extrage: nume produs, preț, stoc, URL, imagine
   - normalizează produsul (slug canonic) → upsert în `products` și `offers`
   - scrie în `price_history` doar la schimbare de preț (vezi regulile din secțiunea 5)
4. **Robustețe obligatorie:** rate limiting (configurabil per retailer în `scraper_config`), retry cu backoff, timeout per request, logging structurat (pino) cu sumar per rulare: câte produse procesate / actualizate / erori.
5. **Monitorizare minimă:** comandă CLI care arată ultima rulare per retailer și rata de erori. Log ERROR dacă o rulare are >50% erori.
6. Comenzi CLI pentru: adăugare URL-uri de monitorizat, listare oferte, ultima actualizare.

### Verificare Faza 2
- `npm run scrape:now` populează corect `products`, `offers`, `price_history`
- Jobul programat rulează automat la intervalul setat (vizibil în loguri)
- Oprirea forțată a unui job nu corupe date (jobul următor reia curat)
- După 48h de rulare locală: istoric de preț cu minim 2 puncte pentru produsele cu preț schimbat

### Notă
IP-ul de acasă și IP-ul de datacenter pot fi tratate diferit de retaileri (anti-bot). Validarea finală a scraperului se reface pe VPS în Faza 4 — nu te mira dacă apar diferențe.

---

## FAZA 3 — Site-ul public (SEO + monetizare)

> Tot local. La final ai produsul complet, gata de pus live.

### Obiectiv
Site indexabil de Google, cu pagini de produs care arată istoricul prețului, și linkuri de afiliere funcționale.

### Pași (Claude Code)
1. **Pagini:**
   - `/` — homepage: top reduceri reale azi (cel mai mare discount față de media ultimelor 30 zile)
   - `/p/[slug]` — pagina de produs: preț curent per retailer, **grafic istoric de preț** (minim 30/90 zile), verdict vizibil: „reducere reală" / „preț umflat înainte de reducere", buton spre retailer prin linkul de afiliere
   - `/c/[categorie]` — listă produse din categorie, sortabilă după mărimea reducerii reale
2. **Logica de „reducere reală"** (nucleul produsului): discount calculat față de mediana prețului pe ultimele 30 de zile, nu față de prețul afișat ca „vechi" de retailer. Implementeaz-o ca funcție separată, testată unitar.
3. **Randare pentru SEO:** paginile de produs și categorie randate pe server (SSG cu revalidare incrementală — ISR — la 1h). Nu SPA client-side.
4. **SEO automat per pagină — cerință centrală a fazei.** Nimic din SEO nu se scrie manual; totul se generează din datele din DB, prin șabloane. Concret:
   - **Homepage:** title și description proprii, optimizate pe intenția principală („reduceri reale", „cel mai ieftin"), actualizate dinamic cu data/numărul de oferte active.
   - **Pagini de produs (`/p/[slug]`):** title generat din șablon — `{Nume produs} — cel mai mic preț: {preț} lei | superieftin.ro`; description generată din șablon cu prețul curent, discountul real și numărul de retaileri comparați. Implementate prin `generateMetadata()` din Next.js, deci se actualizează la fiecare revalidare ISR odată cu prețul.
   - **Pagini de categorie (`/c/[categorie]`):** title/description din șablon cu numele categoriei și numărul de produse.
   - **Date structurate:** schema.org `Product` + `Offer` (cu preț, valută, stoc) pe paginile de produs — eligibil pentru rich results cu preț în Google; `BreadcrumbList` pe produs și categorie; `ItemList` pe paginile de categorie.
   - **Open Graph + Twitter cards** generate automat per pagină (titlu, description, imaginea produsului) — pentru distribuire pe social media.
   - **URL canonic** pe fiecare pagină (evită conținut duplicat între variante de URL).
   - **Linking intern automat:** pagina de produs leagă spre categoria sa și spre produse similare; homepage leagă spre categorii — Google descoperă paginile noi prin crawl, nu doar prin sitemap.
   - **sitemap.xml generat automat** din DB (toate produsele și categoriile active, cu `lastmod`), regenerat zilnic; robots.txt care exclude `/go/` și `/api/`.
5. **Linkuri de afiliere:** câmpul `affiliate_url` populat la nivel de ofertă; redirect prin `/go/[offer_id]` ca să poți număra click-urile (tabelă simplă `click_events` sau increment în Redis).
6. **Cache:** rezultatele query-urilor grele (top reduceri, agregări de istoric) cache-uite în Redis cu TTL 15-60 min.
7. **Feed de produse (format Google Shopping):** endpoint `/feeds/products.xml` care generează automat, din DB, feedul XML în formatul Google Merchant Center (specificația „product data"). Cerințe:
   - Atribute per produs: `g:id` (offer_id), `g:title`, `g:description`, `g:link` (pagina de produs de pe superieftin.ro), `g:image_link`, `g:price` (cu valută, ex. `2499.00 RON`), `g:availability` (din `in_stock`), `g:condition` (new), `g:brand`; `g:gtin`/`g:mpn` dacă există în date, altfel `g:identifier_exists: false`.
   - **Actualizare automată:** feedul se generează la cerere direct din DB (deci reflectă mereu prețul curent), cu cache Redis de max 1h — Google îl preia prin „scheduled fetch" zilnic de la acest URL, fără upload manual.
   - La cataloage mari: paginare sau generare în fișier static regenerat de worker după fiecare rulare de scraping.
   - Același feed e reutilizabil pentru Facebook/Instagram Catalog și alte comparatoare.
   - **Notă de politică (pentru utilizator, nu pentru cod):** Merchant Center standard cere ca pagina de destinație să permită cumpărarea directă — un site de afiliere intră de regulă prin programul CSS (Comparison Shopping Services) din UE, nu prin contul standard. Feedul se construiește acum; înscrierea în Merchant Center/CSS e o decizie de business separată, de verificat la momentul respectiv.
8. Design simplu, rapid, mobile-first. Viteza percepută contează pentru SEO (Core Web Vitals).

### Verificare Faza 3
- Lighthouse: Performance și SEO peste 90 pe pagina de produs
- Graficul de preț afișează datele reale din `price_history`
- `/go/[offer_id]` redirecționează corect și înregistrează click-ul
- sitemap.xml valid, paginile au schema.org Product + BreadcrumbList valide (test cu Rich Results Test)
- Title și description se generează corect din șabloane pe o pagină de produs nouă, fără intervenție manuală
- Open Graph funcțional: linkul unei pagini de produs afișează preview corect (titlu + imagine) la partajare
- Fiecare pagină are URL canonic; `/go/` și `/api/` sunt excluse în robots.txt
- `/feeds/products.xml` se generează valid (validare cu un validator de feed Google Shopping), conține prețurile curente din DB și se actualizează după o rulare de scraping care schimbă un preț

---

## FAZA 4 — Go live: VPS + domeniu + deploy

> Abia acum intră în joc VPS-ul și domeniul. Claude Code rulează prin SSH pe server (sau utilizatorul execută comenzile ghidat). Pașii marcați **[MANUAL]** îi face utilizatorul.

### 4.1 [MANUAL] Pași făcuți de utilizator înainte
1. VPS Contabo activ (Ubuntu 24.04, NVMe), acces root prin SSH.
2. Cont Cloudflare → domeniul `superieftin.ro` adăugat → nameserverele Cloudflare setate la registrar.
3. În Cloudflare, recorduri DNS: `A @ → IP-ul VPS-ului` și `A www → IP-ul VPS-ului`, ambele **DNS only** (norișor gri) până la emiterea certificatului SSL.

### 4.2 Securizarea serverului (Claude Code)
1. Creează un utilizator non-root `deploy` cu drepturi sudo; mută cheia SSH; dezactivează autentificarea cu parolă și login-ul root direct în `sshd_config`. **Atenție: testează conexiunea nouă într-o sesiune separată înainte de a o închide pe cea curentă.**
2. Configurează firewall-ul UFW: permite doar 22 (SSH), 80, 443. Activează.
3. Instalează și activează `fail2ban` cu configurarea implicită pentru SSH.
4. Activează actualizările de securitate automate (`unattended-upgrades`).

### 4.3 Instalare Docker (Claude Code)
1. Docker Engine + Docker Compose plugin din repository-ul oficial Docker (nu din apt-ul Ubuntu, care e în urmă).
2. Utilizatorul `deploy` în grupul `docker`.
3. Verificare: `docker run hello-world` funcționează ca `deploy`.

### 4.4 Deploy (Claude Code)
1. `git clone` al repository-ului în `/home/deploy/superieftin`.
2. Creează `.env` de producție pe server (parole noi, generate, pentru Postgres; URL-urile interne Docker: `postgres:5432`, `redis:6379`).
3. `docker compose up -d` — Caddy obține automat certificatul Let's Encrypt. Dacă emiterea eșuează, verifică împreună cu utilizatorul că recordurile DNS sunt pe „DNS only" în Cloudflare și că propagarea NS s-a încheiat.
4. Rulează migrațiile în containerul web, apoi seed-ul de retaileri.
5. Pornește scrapingul și confirmă prima rulare reușită **de pe IP-ul serverului** (vezi nota din Faza 2 despre anti-bot).

### Verificare Faza 4
- `https://superieftin.ro` se încarcă cu lacăt SSL valid
- `/api/health` răspunde `{ db: "ok", redis: "ok" }` în producție
- `docker compose ps` — toate serviciile healthy
- O rulare de scraping completă reușită de pe server
- `./deploy.sh` (git pull + build + up) funcționează pentru update-uri viitoare

### După verificare [MANUAL]
1. În Cloudflare: comută recordurile pe „Proxied" (norișor portocaliu) pentru protecție DDoS și cache, și setează SSL/TLS mode pe **Full (strict)**.
2. Google Search Console: adaugă domeniul, trimite sitemap.xml.

### Opțional (recomandat după primele deploy-uri manuale)
GitHub Actions: workflow care la push pe `main` intră prin SSH pe VPS și rulează `./deploy.sh`. Deploy automat la fiecare push.

---

## FAZA 5 — Alerte de preț pe Telegram (retenție)

> Se dezvoltă local, se livrează prin deploy-ul deja funcțional.

### Obiectiv
Utilizatorii se pot abona la „anunță-mă când produsul X scade sub Y lei" și primesc mesaj pe Telegram. Motivul alegerii Telegram în loc de email la început: gratuit, fără infrastructură de email (SPF/DKIM/reputație), engagement mult mai mare.

### Pași (Claude Code)
1. **Bot Telegram** (token în env; pentru development se folosește un bot separat de test) cu comenzi: `/start` (înregistrează `telegram_chat_id` și creează user), `/alerta <link sau căutare> <preț>`, `/alertele_mele`, `/sterge <id>`.
2. Pe site, pe pagina de produs: buton „Alertă de preț" care deschide botul cu deep link (`t.me/botname?start=offer_<id>`).
3. **Worker de alerte:** după fiecare rulare de scraping reușită, jobul `check-alerts` compară prețurile noi cu alertele active și trimite notificările. Marchează `triggered_at`, dezactivează alerta (sau o lasă activă la alegerea userului).
4. Rate limiting la trimitere (limitele API-ului Telegram) și deduplicare: o alertă nu se trimite de două ori pentru același prag.

### Verificare Faza 5
- Flux complet end-to-end: creezi alertă din bot → scraperul aduce preț sub prag → primești mesajul în Telegram
- Alerta nu se retrimite la următoarea rulare

---

## FAZA 6 — Hardening și pregătire de creștere (după primii utilizatori)

Nu implementa nimic de aici până nu există trafic real. Listată doar ca direcție:

1. **Backup automat PostgreSQL:** `pg_dump` zilnic + upload extern (Backblaze B2 / Hetzner Storage Box). Testează restaurarea, nu doar backup-ul.
2. **Monitorizare:** Uptime Kuma (self-hosted, gratuit) pentru uptime + alerting; opțional Grafana/Prometheus mai târziu.
3. **Al doilea retailer, apoi al treilea** — abia acum se generalizează scraperul (config-driven din `scraper_config`), nu înainte. Generalizarea prematură pe un singur exemplu produce abstracții greșite.
4. **Scalare istoric:** dacă `price_history` depășește ~50M rânduri sau query-urile de grafic încetinesc: activează extensia TimescaleDB pe tabela existentă.
5. **Scalare workeri:** dacă scrapingul nu mai încape în fereastra de timp, rulează containere `worker` suplimentare (eventual pe un al doilea VPS ieftin conectat la același Redis prin rețea privată).
6. **Email ca al doilea canal de alerte** (Resend/Postmark) abia când există cerere.

---

## Anexă — Variabile de mediu

`.env.example` (valori implicite = setup-ul LOCAL cu DBngin):

```env
# Mediu
NODE_ENV=development
DOMAIN=localhost:3000

# PostgreSQL — local: DBngin (implicit fără parolă pe localhost)
DATABASE_URL=postgresql://postgres@localhost:5432/superieftin

# Redis — local: DBngin
REDIS_URL=redis://localhost:6379

# Scraping
SCRAPE_INTERVAL_HOURS=8
SCRAPE_RATE_LIMIT_MS=2000

# Telegram (Faza 5) — local se folosește un bot de test separat
TELEGRAM_BOT_TOKEN=

# Afiliere (Faza 3)
AFFILIATE_NETWORK=profitshare
AFFILIATE_ID=
```

`.env` de PRODUCȚIE (creat pe VPS în Faza 4 — diferențele):

```env
NODE_ENV=production
DOMAIN=superieftin.ro
POSTGRES_USER=superieftin
POSTGRES_PASSWORD=<parolă generată, NU cea din exemplu>
POSTGRES_DB=superieftin
DATABASE_URL=postgresql://superieftin:<parola>@postgres:5432/superieftin
REDIS_URL=redis://redis:6379
TELEGRAM_BOT_TOKEN=<botul de producție>
```

---

## Cum folosești documentul (instrucțiuni pentru utilizator)

1. Pune acest fișier în rădăcina proiectului local; Claude Code îl citește la începutul fiecărei sesiuni.
2. Cere fazele pe rând: *„Citește superieftin-plan-proiect.md și implementează Faza 1"* — apoi verifici, apoi Faza 2, și tot așa.
3. Nu trece la faza următoare până nu trec toate punctele de la „Verificare".
4. VPS-ul și domeniul devin necesare abia la Faza 4 — până atunci totul rulează pe Mac cu DBngin.
5. Orice abatere de la plan (librărie diferită, schemă modificată) cere-i lui Claude Code să o justifice și actualizează acest document, ca el să rămână sursa de adevăr.
