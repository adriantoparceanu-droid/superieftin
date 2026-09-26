# Ghid: conectarea proiectului la Google Ads API (și GA4)

> Actualizat pentru procesul Google valabil din **9 septembrie 2026**.

## Ce s-a schimbat (de ce nu găsești developer token-ul)

Google a eliminat developer token-ul. Nivelul de acces la API aparține acum
**proiectului Google Cloud** care deține credențialele OAuth, nu contului MCC.
Pagina „API Center” din MCC mai e folosită doar pentru API-ul de conversii în aplicații
mobile — de aceea vezi acel formular. Nu îl completa.

Nivelurile de acces:

| Nivel | Ce permite | Cum îl obții |
|---|---|---|
| Test | Doar conturi de test | Automat, când activezi API-ul |
| Explorer | Conturi reale, 2.880 operațiuni/zi. **Fără Keyword Planner** | Cerere din Cloud Console, aprobare automată |
| Basic | Conturi reale, 15.000 operațiuni/zi, inclusiv Keyword Planner | Brand verification + cerere, aprobare automată în câteva minute |
| Standard | Nelimitat | Audit manual — nu ai nevoie |

Pentru superieftin.ro: **Explorer** ajunge pentru campanii și conversii.
**Basic** e necesar doar pentru research-ul cu volume reale de căutare.

MCC-ul nu mai e obligatoriu tehnic, dar îl păstrăm: e util să ai contul de reclame
sub el și să separi accesul.

---

## Pasul 1 — Proiectul Google Cloud (10 min)

1. Intră pe https://console.cloud.google.com cu același cont Google cu care ai MCC-ul.
2. Sus, lângă logo → selectorul de proiecte → **New project**.
   Nume: `superieftin-ads`. Creează.
3. **Facturare:** Billing → leagă un cont de facturare **plătit**.
   De ce: Google are o problemă cunoscută — proiectele pe Free Trial sau fără facturare
   activă sunt respinse automat la cererile Explorer/Basic. Google Ads API în sine nu
   costă nimic. Opțional: setează o alertă de buget de 5 EUR ca liniște.

## Pasul 2 — Activează API-urile (2 min)

APIs & Services → **Library** → caută și apasă **Enable** pe:
- **Google Ads API** → proiectul primește automat acces Test
- **Google Analytics Data API** și **Google Analytics Admin API** (pentru Faza 4)

## Pasul 3 — Ecranul de consimțământ OAuth (10 min)

Meniu → **Google Auth Platform** (fost „OAuth consent screen”):
1. **Branding:** nume aplicație `superieftin.ro Ads`, email de suport, pagina principală
   `https://www.superieftin.ro`, domeniu autorizat `superieftin.ro`.
   Link-ul de politică de confidențialitate îl adaugi după Faza 1.
2. **Audience:** tip **External**, apoi **Publish app** → status **In production**.
   De ce: în modul „Testing”, refresh token-ul expiră după 7 zile și scripturile se opresc.
3. La prima autentificare vei vedea avertismentul „aplicație neverificată” — normal pentru
   o aplicație folosită doar de tine. Apeși „Advanced” → continui.

## Pasul 4 — Credențialele OAuth (3 min)

Google Auth Platform → **Clients** → **Create client**:
- Tip: **Desktop app**, nume: `superieftin-claude-code`
- Copiază **Client ID** și **Client secret** în `.env`:
  ```
  GOOGLE_ADS_CLIENT_ID=...
  GOOGLE_ADS_CLIENT_SECRET=...
  ```
- Dacă descarci fișierul JSON, ține-l **în afara folderului proiectului**.

## Pasul 5 — Refresh token (Claude Code face asta)

În Faza 0, Claude Code creează un script care deschide browserul. Te loghezi cu contul
Google care are acces la MCC și aprobi. Scriptul salvează `GOOGLE_ADS_REFRESH_TOKEN` în `.env`.

## Pasul 6 — Conturile Google Ads

**Contul real de reclame** (dacă nu există deja):
MCC → Conturi → **+** → Creează cont nou.
- Moneda: **RON**, fus orar: **București**.
  Atenție: moneda și fusul orar **nu se mai pot schimba** după creare.
- Nu adăuga campanii și nici card încă.

**Contul de test** (pentru dezvoltare fără risc):
Urmează ghidul oficial „Test accounts” din documentația Google Ads API: creezi un cont
manager de test și un cont client sub el. Conturile de test nu afișează reclame și nu
cer facturare. Claude Code poate să te ghideze pas cu pas în Faza 0.

**ID-urile în `.env`** (fără liniuțe, ex. `1234567890`):
```
GOOGLE_ADS_LOGIN_CUSTOMER_ID=     # MCC-ul real
GOOGLE_ADS_CUSTOMER_ID_PROD=      # contul real de reclame
GOOGLE_ADS_CUSTOMER_ID_TEST=      # contul client de test
```
Pentru contul de test, login customer ID-ul e managerul de test — Claude Code îl gestionează
prin `ADS_ENV=test`.

## Pasul 7 — Acces Explorer (2 min, după ce testul pe contul de test funcționează)

1. Deschide pagina **Google Ads API Overview** din Cloud Console
   (https://console.cloud.google.com/google/ads-apis/overview), cu proiectul selectat.
2. Verifică: nivel curent **Test**.
3. Extinde **Upgrade access level** → nivelul următor **Explorer** → **Apply for access**.
4. De obicei se aprobă automat.

## Pasul 8 — Acces Basic (după Faza 1, pentru Keyword Planner)

Condiție: pagina de Confidențialitate e publicată pe site.
1. Verifică domeniul `superieftin.ro` în Google Search Console cu același cont Google.
2. Google Auth Platform → Branding: completează link-ul de confidențialitate, apoi
   pornește **brand verification**.
3. După verificare: Google Ads API Overview → Upgrade access level → **Basic** → Apply.
   Aprobarea e automată, în câteva minute.

## Erori frecvente

| Eroare | Ce înseamnă | Soluție |
|---|---|---|
| `CLOUD_PROJECT_NOT_APPROVED_FOR_PRODUCTION` | Proiectul are doar acces Test | Pasul 7 (Explorer) |
| Cerere Explorer/Basic respinsă imediat | Proiect pe Free Trial sau fără facturare activă | Pasul 1, punctul 3 |
| `AUTHORIZATION_ERROR` pe contul real, după upgrade | Problemă cunoscută la Google, în curs de rezolvare | Temporar: proiect Cloud nou și cerere Explorer din nou |
| Scripturile nu mai merg după o săptămână | Aplicația OAuth e în modul „Testing” | Pasul 3, punctul 2 |
| `USER_PERMISSION_DENIED` | Login customer ID greșit | Verifică ID-ul MCC din `.env` |

## Securitate
- `.env` și fișierele JSON de credențiale nu intră niciodată în Git.
- În Cloud Console → IAM, doar tu ca Owner. Google trimite acolo anunțurile obligatorii
  despre API — păstrează un email pe care îl citești.

---

## GA4

### Acum (1 minut, manual)
GA4 → Admin → Colectarea datelor și modificarea lor → **Păstrarea datelor** →
**14 luni** → Salvează. Implicit sunt doar 2 luni; fără asta pierzi istoricul util pentru research.

### Faza 2 (Claude Code + tu)
Agentul `tracking` adaugă evenimentul `click_affiliate_link` în cod și scrie
`ghid-setari-ga4.md` cu setările pe care le faci manual în GA4.

### Faza 4 — acces pentru agenți, doar citire
1. Instalează Google Cloud CLI (`gcloud`) și `pipx`.
2. Autentificare, doar cu drept de citire:
   ```
   gcloud auth application-default login \
     --scopes https://www.googleapis.com/auth/analytics.readonly,https://www.googleapis.com/auth/cloud-platform \
     --client-id-file=CALEA_CATRE_CLIENT_JSON
   ```
3. Adaugă serverul MCP oficial în Claude Code:
   ```
   claude mcp add analytics-mcp --scope user \
     -e "GOOGLE_APPLICATION_CREDENTIALS=CALEA_CATRE_CREDENTIALE_JSON" \
     -e "GOOGLE_PROJECT_ID=superieftin-ads" \
     -- pipx run analytics-mcp
   ```
4. Test: „Listează proprietățile GA4 la care ai acces.”
5. Pune ID-ul proprietății în `.env` ca `GA4_PROPERTY_ID`.
