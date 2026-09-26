# Prompt Faza 1 — copiază tot textul de mai jos în Claude Code

Înainte de a porni, alege soluția de cookies și completează rândul „ALEGEREA MEA”:

| Variantă | Pro | Contra |
|---|---|---|
| **A. CookieYes** (plan gratuit/ieftin, certificat Google) | Rapid, scanează cookie-urile, Consent Mode v2 integrat | Limite de trafic pe planul gratuit, branding pe banner |
| **B. Cookiebot** (plătit, certificat Google) | Foarte robust juridic, raportare de consimțământ | Cel mai scump; poate încetini puțin pagina |
| **C. Banner propriu** (cod în proiect) | Gratuit, rapid, design identic cu site-ul | Tu răspunzi de corectitudine; nu e certificat Google |

---

Citește `docs/ads-program/REGULI.md`. Începem Faza 1. Branch: `ads/faza-1-site`.

ALEGEREA MEA pentru cookies: [A / B / C]

Folosește agentul `site-dev` pentru toate punctele Fazei 1 din `WORKFLOW.md`, în ordinea:
1. Cookies + Consent Mode v2 (varianta aleasă mai sus)
2. Pagini de încredere + footer (placeholder-e pentru datele firmei — le completez eu)
3. Unificarea terminologiei „mediana 30 de zile” + mesajul de status cu procent
   (propune-mi pragurile înainte de implementare)
4. Landing pages `/reduceri-reale/[categorie]`
5. Redirecționări 301 pentru URL-urile vechi
6. Raport PageSpeed pe mobil

După fiecare punct: commit separat + rezumat scurt.
La final, rulează agentul `policy-reviewer` pe site și oprește-te la POARTA 1.
