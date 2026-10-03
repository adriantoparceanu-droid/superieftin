# Reguli program Google Ads — superieftin.ro

> Fișier importat din CLAUDE.md. Aceste reguli au prioritate pentru orice task legat de
> reclame, tracking, consimțământ sau dashboard-ul de ads.

## Context business
- superieftin.ro este un comparator de prețuri cu linkuri de afiliere Profitshare
  (majoritatea ofertelor) și 2Performant (evomag). Nu vindem direct.
  Venitul = comisioane din aceste rețele.
- Propunerea de valoare: reducere reală = preț actual cu minim 5% sub MEDIANA ultimelor 30 de zile.
- Google Shopping NU este permis pentru acest model (politica Merchant Center interzice
  linkurile de afiliere în afara programului CSS). Folosim doar campanii Search.
- Retaileri actuali (lista poate crește; sursa de adevăr e tabela `retailers`):
  - Profitshare: CITGrup, ITGalaxy, ForIT, Vexio, Vegis, eMAG (scanat local, linkuri
    afiliate Profitshare — ~86% din oferte; restul nu aduc comision)
  - 2Performant: evomag
  - Vegis = categoria Sănătate & Naturale → exclus din reclame (regula 8)
- Reclamele trimit DOAR spre oferte cu `affiliate_url` (fără link afiliat = cost fără venit).

## Reguli de siguranță (NU se negociază)
1. **Nicio campanie nu se activează automat.** Orice campanie, grup de anunțuri sau anunț
   nou se creează cu status `PAUSED`. Activarea o face proprietarul manual.
2. **Plafoanele din `ads/config/guardrails.yaml` sunt limite dure.** Scripturile refuză
   orice buget peste ele. Nu modifica fișierul de guardrails fără cerere explicită.
3. **Dry-run implicit.** Orice script care scrie în Google Ads rulează implicit în mod
   `plan` (arată ce ar schimba). Scrierea reală cere `--confirm`.
4. **Validare înainte de scriere (fără MCC — decizia proprietarului, 2026-09-26).** Nu avem cont
   Manager, deci nici conturi de test Google. `ADS_ENV=test` = fiecare cerere de scriere către
   contul real se trimite cu **`validate_only: true`**: Google verifică tot (structură, politici,
   limite), dar NU aplică nimic. Codul nou rulează întâi așa. Scrierea reală cere `ADS_ENV=prod`
   + flag-ul `--prod` + `--confirm` (regula 3). Citirile (rapoarte) sunt permise în ambele moduri.
   Accesul la contul real cere nivelul **Explorer** pe proiectul Google Cloud.
5. **Secretele stau doar în `.env`.** Niciodată în cod, commit-uri, loguri sau rapoarte.
6. **Nu șterge și nu rescrie regulile existente din CLAUDE.md.** Adăugările de documentare
   cerute de secțiunea „Întreținerea acestui fișier” (rută nouă, migrație, comandă nouă)
   sunt permise și obligatorii, în același commit cu modificarea.
7. **Consimțământ (GDPR):** `gclid`, `gbraid`, `wbraid` se salvează și se trimit la Google
   DOAR dacă utilizatorul a acordat `ad_storage` și `ad_user_data`. Fără consimțământ,
   clickul se înregistrează anonim (fără ID-uri Google).
8. **Categoria Sănătate & Naturale este exclusă din reclame** până la o decizie explicită
   a proprietarului. Nicio afirmație de sănătate (vindecă, tratează, detoxifică etc.).
9. **Afirmațiile din anunțuri trebuie să fie adevărate pe landing page** în momentul
   publicării (ex: „-40%” în anunț = -40% față de mediană, vizibil pe pagină).
10. **`policy-reviewer` trebuie să dea PASS** înainte de orice `ads:apply --confirm`.
11. **Dashboard-ul nu poate activa campanii** și nu poate depăși guardrails. Poate doar
    pune pe pauză și ajusta bugete în limite.

## Variabile de mediu așteptate (.env)
```
ADS_ENV=test
# NOTĂ: din 9 sept. 2026 developer token-ul NU mai e folosit. Nivelul de acces
# (Test / Explorer / Basic) aparține proiectului Google Cloud care deține OAuth client-ul.
# Folosește versiuni recente ale librăriilor, care nu cer developer token.
GOOGLE_ADS_CLIENT_ID=
GOOGLE_ADS_CLIENT_SECRET=
GOOGLE_ADS_REFRESH_TOKEN=
GOOGLE_ADS_LOGIN_CUSTOMER_ID=      # gol — nu folosim MCC (se completează doar dacă apare unul)
GOOGLE_ADS_CUSTOMER_ID_PROD=2760086909   # contul de reclame, fără liniuțe (nu e secret)
PROFITSHARE_API_USER=
PROFITSHARE_API_KEY=
ADMIN_DASHBOARD_PASSWORD=          # sau integrarea cu auth-ul existent
GA4_PROPERTY_ID=                   # din Faza 4, pentru citire prin MCP
```

## Google Analytics 4 — rolul lui
- Profitshare și 2Performant = sursa de adevăr pentru bani. Google Ads = sursa pentru cost.
- GA4 = comportament: DE CE un cuvânt cheie pierde bani (bounce, viteză, pagină slabă).
- Evenimentul GA4 `click_affiliate_link` se importă în Google Ads DOAR ca conversie SECUNDARĂ.
  Conversia principală rămâne „Comision afiliere” (fost „Comision Profitshare”, redenumită cu
  acordul proprietarului pe 2026-10-03 — comisioanele Profitshare + 2Performant; aceeași acțiune,
  ID 7799099014). Altfel Google numără dublu.
- Accesul agenților la GA4 este DOAR citire (MCP oficial, scope `analytics.readonly`).
  Setările GA4 le face proprietarul manual.

## Stil de lucru
- Proprietarul are nivel începător–intermediar: comentarii clare în română, care explică
  „de ce”, nu doar „ce”. Fără abstracțiuni inutile.
- Respectă stack-ul și convențiile existente (detectează-le din cod, nu presupune).
- Când există mai multe variante tehnice importante, prezintă 2–3 variante cu pro/contra
  și AȘTEAPTĂ alegerea proprietarului. Nu decide singur deciziile de arhitectură.
- Fiecare fază lucrează pe un branch separat: `ads/faza-X-descriere`.
- La final de task: rezumat scurt (ce s-a schimbat, ce trebuie verificat manual, riscuri).

## Comenzi standard (create în Faza 3, cu nume adaptate la package manager-ul proiectului)
- `ads:validate` — verifică fișierele YAML (limite caractere, bugete, URL-uri care răspund 200)
- `ads:plan` — arată diferențele dintre YAML și contul Google Ads (nu scrie nimic)
- `ads:apply --confirm` — publică modificările (orice element nou = PAUSED)
- `ads:report` — trage performanța + comisioanele și scrie în `ads/reports/`
- `tracking:sync` — sincronizează conversiile Profitshare + 2Performant → Google Ads

## Agenți disponibili
Vezi `.claude/agents/`. Delegă fiecare task agentului responsabil:
site-dev, tracking, market-research, ads-builder, policy-reviewer, ads-analyst.
Workflow-ul complet: `docs/ads-program/WORKFLOW.md`.
