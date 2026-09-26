# Workflow — de la site pregătit la campanii profitabile

Fiecare fază se termină cu o POARTĂ: Claude Code se oprește, prezintă checklist-ul,
iar proprietarul aprobă înainte de faza următoare. Nu se sare peste porți.

```
Faza 0  Verificare & conturi ──► Faza 1  Site ──► Faza 2  Tracking
                                                        │
Faza 4  Dashboard & optimizare ◄── Faza 3  Research + campanii
```

Fazele 1 și 2 pot rula în paralel după Poarta 0 (agenți diferiți, fișiere diferite),
dar Faza 2 depinde de bannerul de cookies din Faza 1 pentru testul final.

---

## Faza 0 — Verificare și conturi (1–3 zile)
**Cine:** proprietarul (conturi) + agentul `tracking` (verificare API)

Proprietarul face (ghid pas cu pas: `docs/ads-program/GHID-CONECTARE-GOOGLE-ADS.md`):
- [x] Cont Google Ads Manager (MCC)
- [ ] Contul real de reclame, legat sub MCC (fără campanii încă)
- [ ] Proiect Google Cloud cu facturare activă (nu Free Trial)
- [ ] Google Ads API activat în proiect → acces Test automat
- [ ] Ecran de consimțământ OAuth publicat „In production” + OAuth client (Desktop app)
- [ ] Cerere acces Explorer (din Google Ads API Overview, în Cloud Console)
- [ ] Cont manager de TEST + un cont client de test sub el
- [ ] Datele API Profitshare în `.env`
- [ ] GA4: retenția datelor pe 14 luni (Admin → Colectarea datelor → Păstrarea datelor)
- [ ] Mai târziu, după Faza 1: brand verification → cerere acces Basic
      (necesar pentru Keyword Planner în research)

Claude Code (agent `tracking`) verifică:
- [ ] Linkurile Profitshare acceptă un parametru de tracking propriu (subID)?
- [ ] API-ul Profitshare întoarce acel parametru în lista de comisioane?
- [ ] Ce statusuri au comisioanele și după cât timp se aprobă/resping?
- [ ] Ce date ai despre rata de comision pe magazin/categorie?
- [ ] Conexiunea la Google Ads API funcționează pe contul de test

**POARTA 0:** raport `docs/ads-program/raport-faza-0.md`.
Dacă Profitshare NU întoarce subID-ul → decidem împreună metoda alternativă de potrivire.

---

## Faza 1 — Site pregătit pentru reclame (3–7 zile)
**Cine:** `site-dev`, verificat de `policy-reviewer`

- [ ] **DECIZIE PROPRIETAR: soluția de cookies** (vezi promptul faza-1)
- [ ] Banner cookies + Google Consent Mode v2 (implicit tot `denied`, actualizare la accept)
- [ ] Pagini: Despre noi, Contact (firmă, CUI, email), Confidențialitate, Termeni, Cookies
- [ ] Linkuri către ele în footer, pe toate paginile
- [ ] Terminologie unificată: „mediana 30 de zile” peste tot (azi apare și „Medie 30z”)
- [ ] Mesaj de status corect pe pagina de produs (sub / în jurul / peste mediană, cu %)
- [ ] Landing pages pentru reclame: `/reduceri-reale/[categorie]` — doar produse cu
      reducere validată, sortate după % reducere
- [ ] Specificații cheie pe produsele din categoriile promovate (dacă feed-ul le conține)
- [ ] Redirecționări 301 pentru URL-urile vechi WooCommerce încă indexate (/shop/ etc.)
- [ ] Verificare PageSpeed mobil: homepage, o categorie, un produs

**POARTA 1:** policy-reviewer dă PASS pe site + rezultate PageSpeed.

---

## Faza 2 — Tracking conversii reale (3–5 zile)
**Cine:** `tracking`, verificat de `policy-reviewer` (partea GDPR)

- [ ] Captare `gclid`/`gbraid`/`wbraid` la aterizare (doar cu consimțământ)
- [ ] `/go/[id]` generează `click_id`, îl salvează și îl trimite la Profitshare
- [ ] Tabele `ad_clicks` + `affiliate_conversions`
- [ ] Job zilnic `tracking:sync`: Profitshare → potrivire → upload conversii offline
- [ ] Ajustare automată pentru comisioanele respinse (retragere)
- [ ] Acțiune de conversie „Comision Profitshare” în Google Ads
- [ ] Eveniment GA4 `click_affiliate_link` (magazin, produs, categorie, preț, % reducere),
      importat în Google Ads ca conversie SECUNDARĂ (nu folosită la licitare)
- [ ] În GA4 (manual, după ghidul generat de tracking): `click_affiliate_link` ca eveniment cheie,
      dimensiuni personalizate, filtru trafic intern, legătură GA4 ↔ Google Ads
- [ ] Test end-to-end pe contul de test

**POARTA 2:** demonstrație: click → comision → conversie vizibilă în contul de test.

---

## Faza 3 — Research + primele campanii (3–5 zile)
**Cine:** `market-research` → proprietar → `ads-builder` → `policy-reviewer` → proprietar

- [ ] ads-builder creează comenzile `ads:validate`, `ads:plan`, `ads:apply`
- [ ] market-research: raport cu top oportunități (scor de profit, nu doar volum)
- [ ] **DECIZIE PROPRIETAR:** alegi 2–3 direcții din raport
- [ ] ads-builder scrie campaniile YAML
- [ ] policy-reviewer: PASS
- [ ] `ads:plan` → verifici → `ads:apply --confirm` (totul PAUSED)
- [ ] Activezi manual în Google Ads

**POARTA 3:** campaniile există în contul real, PAUSED, verificate de tine.

---

## Faza 4 — Dashboard + optimizare (după 1–2 săptămâni de date)
**Cine:** `site-dev` (dashboard), `ads-analyst` (săptămânal)

- [ ] Conectare GA4 prin MCP oficial, doar citire (vezi ghidul, secțiunea GA4)
- [ ] Legătură GA4 ↔ Search Console (termeni organici pentru research)
- [ ] `/admin/ads` protejat cu autentificare
- [ ] Vedere: cost vs. comision (ROAS, profit) pe campanie / grup / cuvânt cheie / categorie
- [ ] Acțiuni sigure: pauză, ajustare buget în limitele guardrails
- [ ] Lista propunerilor analistului cu „Aprob” / „Resping”
- [ ] Rutina: `ads:report` → ads-analyst → propuneri → aprobare → ads-builder aplică

**POARTA 4:** dashboard funcțional cu date reale.

---

## Rutina după lansare
- **Zilnic (automat):** `tracking:sync`
- **Săptămânal:** promptul `faza-4-rutina-saptamanala.md`
- **Înainte de sezoane:** research nou (Black Friday — pregătire din octombrie, Crăciun,
  back to school în august)
