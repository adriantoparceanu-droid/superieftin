# Redesign superieftin.ro — document de design

Data: 5 oct. 2026 · Stare: **validat de proprietar** (brainstorming 4–5 oct. 2026)
Machetă de referință (privată): https://claude.ai/artifact/4K6uhmLSp4XzT8epqiP91s (direcția B, v2)

## 1. De ce

Proprietarul: site-ul „arată amator / ieftin” și „nu se înțelege valoarea”. Valoarea e una singură:
**reducere reală = prețul de azi cu minimum 5% sub mediana ultimelor 30 de zile** (nu „prețul vechi”
tăiat de magazin), plus istoricul prețului. Majoritatea vizitatorilor intră direct pe pagina de produs
(`/p/…`) din Google și din reclame, pe telefon.

## 2. Decizii validate

| Subiect | Decizie |
|---|---|
| Stil | „Retail energic, dar ordonat”; referințe idealo/Geizhals (ordine, densitate) + Keepa (istoric la vedere) |
| Direcție | **B — „Verdict întâi”**; cardurile „Alertă de preț” și „Pe scurt despre preț” în stilul direcției C |
| Identitate | roșul rămâne (rafinat pentru contrast), restul se schimbă: fonturi, nuanțe, **logo nou**, **mod întunecat** (urmează telefonul) |
| Prioritate | pagina de produs pe mobil: primul ecran = verdict + preț + magazin; „Vezi oferta” fix jos |
| Amploare | tot site-ul deodată (public; adminul primește doar tokenii) |
| Fără | bară de navigare tip aplicație jos; promisiuni în texte („garantat”, „economisești”) |
| Alerta de preț | pragul e un **câmp editabil, orice sumă**; peste prețul de azi → avertisment și alerta pleacă imediat (decizia proprietarului, 5 oct.) |

## 3. Sistem de design

### Culori (tokeni CSS pe `:root`, redefiniți în modul întunecat)

| Rol | Luminos | Întunecat |
|---|---|---|
| `--red` (buton „Vezi oferta”, insigna reducere) | `#D42B2B` (alb pe el 5,0:1) | `#D42B2B` |
| `--red-ink` (roșu ca text) | `#B91C22` | `#FF6B61` |
| `--red-tint` / `--red-zone` | `#FDECEC` / roșu 10% | `#3A1517` / roșu 13% |
| `--head` (antet cărbune), `--head-2` | `#15171C`, `#22252C` | `#08090B`, `#17191E` |
| `--ink`, `--ink-2`, `--ink-3` | `#14161A`, `#424854`, `#6A707C` | `#F2F3F5`, `#C3C8D0`, `#9AA1AD` |
| `--bg`, `--surface`, `--surface-2` | `#F4F5F7`, `#FFFFFF`, `#F0F1F4` | `#0E0F12`, `#17191E`, `#1F2228` |
| `--line`, `--line-2` | `#E1E4E9`, `#CDD2D9` | `#2A2E36`, `#3A3F49` |
| `--amber-ink` / `--amber-tint` („Peste obișnuit”) | `#A14A06` / `#FFF3E3` | `#F5A524` / `#2B2112` |
| `--neutral-tint` („Preț obișnuit”) | `#ECEEF2` | `#262A31` |

Roșul vechi `#E53E3E` (4,1:1 cu alb) pica AA pentru text mic. Toate perechile text/fundal trec AA în ambele teme.
Modul întunecat: `@media (prefers-color-scheme: dark)` — site-ul urmează setarea telefonului; fără comutator în UI
(YAGNI; se poate adăuga ulterior).

### Tipografie
- **Archivo** variabil (axa `wdth` 82–92%, greutate 800–900): titluri, verdicte, prețuri, logo — cifre tabulare.
- **Inter** (400–700): text și interfață. Ambele prin `next/font/google`, subset `latin` + `latin-ext` (ș, ț).
- Scară mobil: verdict 30 · preț XL 32 · H1 pagină 22–25 · H2 18 · text 15 · mic 12,5 · etichetă 12 MAJUSCULE.

### Forme și spațiere
Scară de 4 px; margine laterală mobil 14–16 px; raze 6 (insigne) · 10–12 (butoane, câmpuri) · 16 (carduri) · 20 (foaia de filtre).
Butoane ≥ 48 px pe mobil. **Un singur buton plin roșu pe ecran: „Vezi oferta”.**

### Logo
Pătrat roșu rotunjit cu o linie de preț în trepte care coboară sub o linie punctată (mediana) și se oprește
într-un punct („azi”); wordmark „superieftin.ro” în Archivo semi-condensat, „.ro” roșu. Variante: antet închis,
fundal deschis, monocrom, favicon 16/32/64 (`app/icon.svg`).

### Insigna de verdict (pragurile din `lib/discount.ts`, neschimbate)
`< 0,95 × mediană` → **Reducere reală −X%** (roșu plin) · `≤ 1,05` → **Preț obișnuit** (gri) ·
`> 1,05` → **Peste obișnuit +X%** (chihlimbar) · fără istoric suficient → **Monitorizăm prețul** (contur).
Formă + săgeată + cuvânt, nu doar culoare.

## 4. Pagini

### Pagina de produs `/p/[slug]` (prioritatea 1)
1. Antet cărbune (meniu · logo · căutare), breadcrumb, miniatură + marcă + titlu.
2. **Cardul de verdict**: „MERITĂ ACUM?”, verdict în cuvinte + procent (mare, culoarea stării), fraza
   „Prețul de azi e cu X% sub mediana pe 30 de zile (Y lei).”, prețul mare + magazinul.
   **Termometrul**: bară min–mediană–max pe 30 de zile, zona de reducere hașurată (≥5% sub mediană),
   zona chihlimbar (>5% peste), marcaj „Azi · X lei”. Subsol: „Verificat azi, HH:MM” + „Cum calculăm?”.
3. Ofertele pe magazine (cea mai ieftină evidențiată, procentul față de mediană per magazin, „Vezi oferta”).
4. Istoricul prețului: grafic în trepte, fereastra de 30 de zile umbrită, mediana punctată, zona de reducere,
   punctul „azi”, file 30/90 zile, atingere = prețul zilei. Titlul respectă regula `historyPartialSince`.
5. **Alertă de preț** (stil C): titlu cu clopoțel, câmp „Pragul tău” precompletat cu pragul propus
   (5% sub min(preț azi, mediană), rotunjit în jos), mesaj live sub câmp; Telegram / Email.
6. **Pe scurt despre preț** (stil C): 3 rânduri cu iconiță, generate strict din date — poziția prețului de
   azi în perioada urmărită, ultima schimbare, diferența dintre magazine.
7. Specificații, produse similare, subsol.
8. **Bara fixă de jos** (mobil): preț + verdict scurt · clopoțel (sare la alertă) · „Vezi oferta” (prin `AffiliateLink`).
   Înlocuiește bara existentă din `PriceAlert.tsx` (o singură bară), cu `env(safe-area-inset-bottom)`.
Desktop: 3 coloane (imagine + specificații · verdict + termometru · oferte lipicioase cu alerta); dedesubt graficul
lângă „Pe scurt”.

### Categorie `/c/[categorie]` (și `/t/`, `/cautare`, `/reduceri-reale/…`)
Antet + titlu + „N produse · M cu reducere reală azi”; bara lipicioasă Filtre / Sortare; filtrele active ca jetoane;
nota de metodă; **listă densă pe rânduri** (mobil): insignă, nume pe 2 rânduri, preț + mediană, magazin + nr. magazine,
mini-termometru. Desktop: coloana de filtre existentă (restilizată) + grilă de carduri. Panoul „Filtre” existent
(`MobileFilters`) devine foaie de jos stilizată ca în machetă.

### Homepage
Hero cărbune: „Merită acum? Vezi prețul față de ultimele 30 de zile.”, fraza metodei, căutare mare, cifre live
(produse urmărite, magazine, reduceri reale azi). Legenda celor 3 verdicte. „Reduceri reale azi” (grilă 2 col.),
categorii, ghiduri.

### Antet, meniu, subsol
Mobil: antet cărbune; meniul = panou pe tot ecranul cu căutare, scurtătura roșie „Reduceri reale azi”, acordeon
pe 2 niveluri (un părinte deschis) cu numărul de produse, linkuri (Ghiduri, Cum calculăm, Alertele mele, Despre),
taguri Refurbished / Second Hand. Desktop: antet cărbune + bară de categorii cu meniu derulant. Subsol cărbune.

### Restul
Ghiduri, pagini legale, alerte (confirmare/gestionare/dezabonare), banner cookies, 404: aceiași tokeni și fonturi,
fără restructurare.

## 5. Date noi necesare
- **`offer_price_stats.min_30d` / `max_30d`** (migrația 032), calculate de worker împreună cu mediana
  (`lib/price-stats.ts`). Termometrul și mini-termometrele le citesc prin `JOIN offer_price_stats` —
  **niciodată** agregări pe `price_history` la cerere (regula din CLAUDE.md; CPU la valuri de roboți).
- Până la prima recalculare după deploy, coloanele sunt NULL → termometrul nu se afișează (fallback curat).

## 6. Constrângeri care NU se schimbă
- SEO: URL-uri, canonical, `robots`, JSON-LD (`Product`/`AggregateOffer`, breadcrumb; `offers.availability`
  e citit de `ads:validate`/`ads-guard`), sitemap, 410/noindex.
- Reclame: textul „Reducere reală” și procentul rămân vizibile pe `/p/` când e cazul (le verifică garda);
  fără promisiuni; afirmații doar din date.
- `/go/` doar prin `AffiliateLink`; consimțământ (Consent Mode, banner) neschimbat; GA4 (`click_affiliate_link`,
  `price_alert_click`, `view_item`) neschimbat.
- Alerta: aceleași fluxuri Telegram/email; se relaxează doar regula „pragul sub prețul de azi”
  (web: formular + `/api/alerte-email`; worker: `checkTarget` din bot) — peste prețul de azi alerta pleacă la
  următoarea verificare.

## 7. Riscuri
- Bara fixă + tastatura (formularul de email) + bannerul de cookies pe iOS → testat la 390 px.
- Fonturile variabile cresc greutatea → doar `latin-ext`, `display: swap`.
- Modul întunecat atinge toate componentele (inclusiv cele din ghiduri) → verificare vizuală pe fiecare tip de pagină.
- Garda de reclame pune campaniile pe pauză dacă landing-ul nu mai arată „Reducere reală” → `ads:guard` (fără `--confirm`) după deploy.
