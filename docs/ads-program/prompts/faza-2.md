# Prompt Faza 2 — copiază tot textul de mai jos în Claude Code

---

Citește `docs/ads-program/REGULI.md` și `docs/ads-program/raport-faza-0.md`.
Începem Faza 2. Branch: `ads/faza-2-tracking`.
Librăria Google Ads aleasă: [completează din Poarta 0]

Folosește agentul `tracking` pentru implementarea completă a Fazei 2 din `WORKFLOW.md`:
1. Modelul de date (migrare) — arată-mi schema înainte de a rula migrarea
2. Captarea ID-urilor Google cu consimțământ (folosește `hasAdConsent()` din Faza 1)
3. Handler-ul `/go/[id]` cu click_id
4. Acțiunea de conversie „Comision Profitshare” + evenimentul secundar „Click spre magazin”
5. Job-ul `tracking:sync` cu mod plan / `--confirm`, idempotent, cu retrageri
6. Programarea zilnică a job-ului în infrastructura noastră (propune variante)

Totul pe contul de test. La final: agentul `policy-reviewer` pe partea de GDPR,
apoi demonstrația end-to-end. Oprește-te la POARTA 2.
