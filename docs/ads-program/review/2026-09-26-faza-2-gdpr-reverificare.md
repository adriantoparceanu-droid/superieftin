# Poarta 2 — GDPR, re-verificare restrânsă (policy-reviewer)

Data: 2026-09-26 · Țintă: `ads/faza-2-tracking` la `cdac70d` (diff `b9723d9..HEAD`), local.

**Verdict: FAIL — un blocant (B5, doar text).** B1–B4 (+R3, R5, R7 din verdictul anterior) închise în cod.

## Blocant
- **B5** — `/confidentialitate`: „IP-ul… nu o salvăm și nu o scriem în jurnale” (`page.tsx:142-144`) și „Dacă refuzi, nu păstrăm
  identificatorul deloc” (`:107`, `:119`) sunt absolute, dar aceeași pagină declară jurnale tehnice (IP, pagina cerută) păstrate
  „de regulă câteva săptămâni” (`:40`, `:178`) + Cloudflare (`:159-161`); Nginx/CloudPanel (`docker-compose.yml:2`) loghează
  URL-ul complet (inclusiv `?gclid=`) și IP-ul la `POST /api/consent/withdraw`. Fix: „aplicația nu o salvează; ca orice cerere,
  apare în jurnalele tehnice ale serverului și Cloudflare” + precizarea jurnalelor la refuz.

## Închise
B1 (doar memorie, nimic după refuz, curățare legacy) · B2+R5 (`adPersonalization`/`ad_personalization` mereu refuzat; v2 corect
păstrat — prelucrare restrânsă) · B3+R3+R7 (migrația 022, `ad_click_at` plafonat, purge în `finally`, fereastră după
`COALESCE`, `last_error` mascat) · B4 (endpoint validat, fără potrivire pe NULL, 204, fără loguri cu ID, beacon înainte de ștergere).

## Recomandări neblocante
- R1 alertă Telegram dacă `tracking-sync` n-a reușit >48h (ștergerea zilnică ~90 zile + 1).
- R2 (ferm) expirarea acordului → `notifyWithdraw()` înainte de `clearAdClickCookie()` (`AdClickCapture.tsx:75`).
- R3 `consent_id` aleatoriu în `se_consent` salvat în `ad_clicks` → retragere pentru toate clickurile dispozitivului.
- R4 reîncărcare cu același gclid în URL păstrează `ts`-ul vechi (altfel „90 zile de la clickul pe reclamă” poate fi depășit).
- R5 `rate-limit.ts` să folosească doar `cf-connecting-ip` / IP-ul de la Nginx, nu `x-forwarded-for` brut.
- R6 `withdraw/route.ts` verifică `content-length` ≤ 2000 înainte de citirea corpului.
- R7 (proprietar, VPS) `log_format` Nginx fără query string sau cu gclid mascat; logrotate 7–14 zile.
- R8 Google Ads Data Processing Terms + setările de acord UE (manual, proprietar).
- R9 după deploy: cu „Analiză” acordat și „Publicitate” refuzat, `dl` din GA4 `collect` fără gclid întreg.

Deploy: `build migrate` → `run --rm migrate` (021 + 022) → web + worker.

---

## Re-verificare B5 (commit `4304d88`) — **PASS**

Cele 4 locuri (`/confidentialitate:107-110, 122-127, 150-154`, `/cookies:78-81`) pomenesc acum jurnalele tehnice ale
serverului și Cloudflare („de regulă câteva săptămâni”, doar pentru securitate), coerent cu `:40`, `:169-170`, `:188`.
Nicio altă afirmație absolută rămasă; „Înainte să alegi: nu stocăm nimic pe dispozitiv” e corectă (strict dispozitivul).
Commit-ul atinge doar text JSX.

**Poarta 2 — partea GDPR: PASS.** Neblocant: se poate adăuga „conform politicii Cloudflare” la durata jurnalelor Cloudflare.
Recomandările R1–R9 de mai sus rămân deschise.
