# Remarketing pentru vizitatori (RLSA) — propunere și pași pentru proprietar

> Aprobat ca direcție de proprietar pe 2026-10-03. Pregătit pe branch-ul `feat/remarketing-vizitatori`.
> **Nimic nu e activ**: codul nu e publicat, iar listele și campaniile nu sunt create.
> Textele legale noi sunt **de verificat de jurist înainte de deploy**.

## De ce

Ferestrele de comision sunt scurte (eMAG 2 zile la telefoane/TV/laptopuri, evoMAG 10 zile; ITGalaxy și
CITGrup 60). Cine a văzut un produs la noi și revine mai târziu direct la magazin nu ne mai aduce
comision. Un click nou pe „Vezi oferta” pornește o fereastră nouă. Scopul: când acel vizitator caută
din nou pe Google, reclama noastră să aibă o șansă mai mare să apară (Search, mod „Observare”).

## Ce trebuia schimbat: consimțământul (regula 7, GDPR)

Până acum `ad_personalization` era **mereu `denied`**. Cu el refuzat, Google nu pune pe nimeni în
listele de remarketing. Dovada din cont: listele GA4 partajate („All Users of Superieftin.ro – GA4”,
„Purchasers…”) există în Google Ads, dar au **0 membri**.

Schimbarea de pe branch:

| | Înainte | După |
|---|---|---|
| Bife în banner | Necesare · Analiză · Publicitate | + **Reclame personalizate** (separată, implicit nebifată, activă doar cu „Publicitate”) |
| `ad_personalization` | mereu `denied` | `granted` DOAR cu „Publicitate” + „Reclame personalizate” |
| „Accept toate” | analiză + publicitate | + reclame personalizate (numite explicit în primul ecran) — **decizie de confirmat cu juristul**; comutator `ACCEPT_ALL_INCLUDES_PERSONALIZATION` în `web/src/lib/consent.ts` |
| Acorduri date înainte | — | rămân valabile; personalizarea e considerată **refuzată** până o bifează omul din „Setări cookies” (nu redeschidem bannerul și nu ștergem gclid-urile — `CONSENT_VERSION` rămâne 2) |
| Conversii offline (Data Manager) | `adPersonalization` DENIED | neschimbat (sunt pentru măsurare, nu remarketing) |

Texte noi în `/cookies` (rând în tabel + secțiunea „Reclame personalizate (remarketing), pe scurt”) și în
`/confidentialitate` (rând în tabel, secțiune nouă, durata în „Cât timp păstrăm datele”). Afirmația
veche „Nu folosim datele pentru reclame personalizate” a fost restrânsă la conversiile offline.

**Pentru jurist:** (1) e acceptabil ca „Accept toate” să includă reclamele personalizate, dat fiind
textul din primul ecran? (2) formularea despre Google ca operator pentru propriile date (linkul
„partner-sites”); (3) durata „cel mult 30 de zile de la ultima vizită” — e adevărată doar după pasul 3
de mai jos.

## Câți oameni ar intra în listă (estimare prudentă)

- GA4 (doar vizitatori cu acord „Analiză”): **~180 utilizatori în ultimele 30 de zile**, ~6/zi; o parte
  ești tu și roboți. Din reclame (`google / cpc`): 8 sesiuni.
- `ad_clicks` pe producție: `has_ad_consent` la ~30 din ~41.000 de rânduri, dar >99% din rânduri sunt
  roboții din 30 sep – 2 oct, deci raportul nu spune nimic despre oameni. După protecția anti-roboți
  (3 oct, după-amiază): 1 click cu acord din ~22 clickuri externe — eșantion prea mic.
- Realist: din vizitatorii umani, **20–40% apasă „Accept toate”** la un banner cu „Refuz” la fel de vizibil.
  Dacă „Accept toate” include personalizarea, lista ar strânge ~**40–100 de membri activi / 30 zile**
  (după ce Google pierde o parte: Safari, blocare de reclame, browsere fără cookie-uri Google).
  Dacă personalizarea se dă DOAR din bifa separată, de obicei 1–5% o aleg → practic **0–5 membri**.
- Pragul Google (din dec. 2025, toate rețelele): **minim 100 de utilizatori activi în 30 de zile**. Sub
  prag lista se poate atașa, dar nu influențează nimic. Concluzie: totul e pregătit, dar efectul apare
  abia când traficul crește (ordinul a 1.000+ vizitatori umani pe /p/ pe lună).

## Variante tehnice

**(a) Audiență GA4 legată de Google Ads — RECOMANDAT**
- Pro: folosește tagul existent (G-74GYJN8XLB) și evenimentele care există deja (`view_item`,
  `click_affiliate_link`); excluderea „a dat click spre magazin” e posibilă direct; fără cod nou pe site
  în afară de consimțământ; GA4 adaugă la creare și membrii din ultimele 30 de zile.
- Contra: lista apare în Ads la 24–48 h; condițiile se fac în interfața GA4 (manual).

**(b) Segment de date Google Ads din tagul Google (AW-18476577168)**
- Pro: lista trăiește direct în Google Ads.
- Contra: trebuie adăugat tagul Ads pe site (cod nou, cookie-uri noi `_gcl_*` de descris în politici);
  regulile pe URL nu văd clickul spre magazin (`/go/` e un redirect pe server, fără tag) → ar trebui
  trimis și evenimentul către Ads; dublează ce face deja GA4.

## Pașii tăi (după verificarea juristului și deploy)

**GA4** (analytics.google.com, „Admin” = rotița):

1. **Setări de consimțământ**: Admin → Colectarea datelor → verifică la „Setări consimțământ” că
   proprietatea primește `ad_personalization` (poate dura 1–2 zile după deploy).
2. **Google Signals rămâne OPRIT** (Admin → Colectarea datelor). Nu e necesar pentru remarketing pe
   date first-party cu acord, iar politicile spun că nu îl folosim.
3. **Listele GA4 deja partajate** („All Users”, „Purchasers”): Admin → Audiențe → deschide fiecare →
   durata de apartenență **30 de zile** (sau arhivează-le). Altfel au 540 de zile, iar politicile
   promit maximum 30.
4. **Legătura Google Ads** (Admin → Linkuri de produse → Google Ads): „Publicitate personalizată”
   trebuie să fie **activă** (listele GA4 apar deja în Ads, deci pare activă — verifică).
   Aceasta schimbă recomandarea din `ghid-setari-ga4.md`, pasul 5.
5. **Audiența nouă**: Admin → Afișare date → Audiențe → Audiență nouă → Creează audiență personalizată:
   - Nume: `SE | Produs văzut, fără click 7z`
   - **Include**: eveniment `view_item`, cu condiția pe produs **Categorie articol** (Item category)
     *corespunde expresiei regulate* `^(telefoane-mobile|laptopuri|televizoare|monitoare|desktop-uri|casti)$`
     — listă albă. Motiv: Sănătate & Naturale (Vegis) e categorie sensibilă; politica Google interzice
     reclamele personalizate bazate pe interese de sănătate (și regula 8).
   - **Exclude** → „Exclude temporar utilizatorii când”: eveniment `click_affiliate_link`, număr de
     evenimente > 0 **în orice perioadă de 7 zile** (fereastra de timp a condiției).
   - **Durata de apartenență: 30 de zile.**
   - Verifică în panoul din dreapta că numărul estimat scade când adaugi excluderea, apoi Salvează.
   - *Dacă interfața nu permite fereastra de 7 zile la excludere*: fă două audiențe — `SE | Produs văzut 30z`
     (doar includerea, 30 de zile) și `SE | Click magazin 7z` (`click_affiliate_link`, 7 zile) — și în
     Google Ads un segment combinat „primul ȘI NU al doilea”.

**Google Ads** (după 24–48 h):

6. Unelte → Biblioteca partajată → Manager de segmente → „Segmentele tale de date”: găsește lista,
   notează **ID-ul** (în URL, `userListId=…`) și verifică „Eligibilă pentru Search”.
7. Trimite ID-ul agentului `ads-builder`, care adaugă în YAML-ul campaniei:
   ```yaml
   audiences:
     mode: OBSERVATION
     segments:
       - name: "SE | Produs văzut, fără click 7z"
         user_list_id: "<ID>"
         bid_modifier: 1.25
   ```
   Apoi: `ads:validate` → policy-reviewer (hash nou, PASS nou) → `ads:apply -- --confirm` (validate_only)
   → scrierea reală doar cu acordul tău (`ADS_ENV=prod`, `--prod`). Campaniile rămân cum sunt (PAUSED/ENABLED).
8. După 30 de zile: Google Ads → campania → Audiențe → compară CPC, CTR, conversii pentru membri vs restul.

## Durata listei și ajustarea de licitare

| Magazin | Fereastră click | Reclame Google Ads permise? |
|---|---|---|
| eMAG | 2 zile (telefoane/TV/laptopuri), 15 restul | NU (interzis PPC) |
| evoMAG | 10 zile | doar cu acord scris |
| ITGalaxy | 60 de zile | da |
| CITGrup | 60 de zile | da (feed oprit acum) |

- **Durata apartenenței: 30 de zile.** E ciclul tipic de decizie la electronice și depășește
  ferestrele scurte (2–10 zile): cine revine în 30 de zile pornește prin noi o fereastră nouă. Peste
  30 de zile interesul scade, iar politica promite maximum 30.
- **Excluderea după click: 7 zile.** În primele zile după „Vezi oferta” fereastra e încă deschisă la
  majoritatea magazinelor, deci un click plătit nou ar fi bani dați pe ceva deja al nostru. 7 zile e
  compromisul între 2 (eMAG) și 10 (evoMAG); la ITGalaxy (60) e prudent.
- **Ajustare: +25% în Observare**, nu Direcționare (Targeting ar opri reclamele pentru toți ceilalți).
  `ads:validate` refuză în afara -50%…+50% și orice CPC × ajustare peste plafonul din guardrails
  (3 lei; ex. Samsung pliabile 1,30 → 1,63 lei). Revizuire după ≥100 de clickuri din listă: dacă
  rata de click spre magazin a membrilor e ≥1,5× restul, poți urca spre +40%; dacă nu, înapoi la 0%.
- La `MAXIMIZE_CLICKS` Google poate ignora ajustarea (lista rămâne utilă pentru observare).

## Display / Demand Gen spre /p/ (de studiat, NU acum)

- Același consimțământ și același prag de 100; volumul nu-l susține acum.
- `ads/config/guardrails.yaml` permite doar Search (`display: false`); codul `ads:*` creează doar Search.
  Ar cere decizia ta + extinderea codului (alt tip de campanie, anunțuri cu imagini).
- Remarketingul dinamic cere feed în Merchant Center → interzis pentru afiliere (regula Shopping).
- eMAG și Vexio interzic PPC (inclusiv Display): paginile /p/ promovate trebuie să aibă ofertă
  ITGalaxy/CITGrup, iar anunțul nu poate numi magazinul.
- Concluzie: întâi Search în Observare; Display doar după ce lista trece constant de câteva sute.

## Riscuri

- **Listă prea mică** (cel mai probabil): nimic nu se întâmplă; costul e zero.
- **Juridic**: „Accept toate” care include personalizarea; textele noi nevăzute de jurist.
- **Cookie-uri Google**: după deploy verifică în DevTools (Application → Cookies) ce setează Google cu
  bifa activă și ajustează tabelul din `/cookies` dacă apare ceva nedescris.
- **Categorie sensibilă**: dacă audiența ar include Sănătate & Naturale, Google o poate respinge și
  încalcă regula 8 — de aceea lista albă de categorii.
- **Listele GA4 vechi (540 de zile)** încep să se umple după deploy — pasul 3 e obligatoriu.
