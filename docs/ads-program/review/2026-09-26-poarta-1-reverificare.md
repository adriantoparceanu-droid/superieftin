# Re-verificare restrânsă Poarta 1 — live (policy-reviewer)

Data: 2026-09-26 (~20:54 UTC) · Țintă: https://www.superieftin.ro · Referință: `2026-09-26-faza-1-reaudit.md`

**Verdict: PASS — Poarta 1 închisă.** N1 și N2 închise pe live; nicio regresie, niciun blocant nou.

## N1 — textul de consimțământ (ÎNCHIS)
- Textul bannerului din JS-ul live coincide cu `CookieBanner.tsx` de pe `main` (commit 49f8c6e).
- „Publicitate” menționează Google Ads **și bannerele partenerului Profitshare de pe prima pagină**, care își setează propriile cookie-uri. Afirmația e adevărată: `AdConsentGate` apare doar în `app/page.tsx` și afișează bannerele doar cu `hasAdConsent()` (și ecran ≥1024 px).
- „Analiză” nu mai spune „anonim” („statistici agregate, cu un identificator de vizitator în cookie”).
- Consimțământ v2 activ (`v === 2`): alegerile din v1 sunt cerute din nou.
- „Accept toate” / „Refuz toate” au aceeași greutate vizuală; retragerea acordului e posibilă din „Setări cookies” (subsol, `/cookies`, `/confidentialitate`).

## N2 — Cloudflare în politică (ÎNCHIS)
- `/confidentialitate`, „Cui transmitem date”: Cloudflare, Inc. — rol (protecție, livrare), date (IP, pagina, browserul), transfer SUA (Cadrul UE–SUA).
- Coerent cu `/cookies`; Cloudflare nu setează cookie-uri (fără `Set-Cookie` pe `/` și `/cookies`).

## Consent Mode v2 / regresii
- `consent default` cu toate cele 4 semnale `denied` + `ads_data_redaction`, `beforeInteractive`, înainte de `gtag.js` (`afterInteractive`; `<link rel="preload">` nu execută).
- Niciun cookie setat de server înainte de alegere; niciun „DE COMPLETAT”.

## Neblocant
- Emailul apare ca „[email protected]” (Cloudflare Email Obfuscation) — invizibil fără JS. Recomandare: dezactivare Email Obfuscation din Cloudflare sau afișare altfel.
- R10–R19 nereverificate (conform cerinței); nimic nou blocant observat.
