# Prompt Faza 0 — copiază tot textul de mai jos în Claude Code

---

Citește `docs/ads-program/REGULI.md` și `docs/ads-program/WORKFLOW.md`.
Începem Faza 0. Lucrează pe branch-ul `ads/faza-0-verificare`.

Folosește agentul `tracking` pentru:
1. Analiza modului în care proiectul construiește acum linkurile Profitshare (găsește codul).
2. Verificarea documentației API Profitshare și un apel real de citire: parametru de
   tracking propriu (subID) — acceptat în link? întors în lista de comisioane?
3. Statusurile comisioanelor și întârzierea tipică până la aprobare.
4. Script de generare a refresh token-ului OAuth (eu mă loghez în browser cu contul
   Google care are acces la contul de reclame). Salvează doar în `.env`, nu afișa token-ul.
5. Test de conexiune la Google Ads API pe contul real: o citire + o scriere `validate_only`
   (regula 4), fără developer token
   (vezi `docs/ads-program/GHID-CONECTARE-GOOGLE-ADS.md`).
   Dacă lipsesc variabile, listează-le și spune-mi pas cu pas de unde le iau.
6. Variantele de librărie pentru Google Ads API, cu pro/contra pentru stack-ul nostru.
7. Cum e instalat GA4 acum și ce evenimente există pe clickurile `/go/`.

Scrie tot în `docs/ads-program/raport-faza-0.md` și oprește-te la POARTA 0.
Nu scrie cod de producție în această fază. Așteaptă alegerile mele.
