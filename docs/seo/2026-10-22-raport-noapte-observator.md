# Raport de noapte — Observatorul reducerilor reale (21–22 oct. 2026)

**Pe scurt:** repoziționarea e live pe producție. superieftin.ro se prezintă acum ca „Observatorul reducerilor reale din România”, cu trei secțiuni noi: tracker Black Friday, indice lunar de prețuri și „Când să cumperi”. Regula de index „are poveste” e activă. Toate testele au trecut și logurile nu arată nicio eroare.

Documente: design `docs/plans/2026-10-21-observator-repozitionare-design.md`, plan `docs/plans/2026-10-21-observator-repozitionare-plan.md`.

## Ce s-a făcut

Trei piste lucrate în paralel de agenții `site-dev`, unite în `main` și verificate împreună: worker 233 de teste, web 166 de teste, TypeScript fără erori, build reușit, lint fără probleme noi.

| Pistă | Ce e nou pe site | Migrație |
|---|---|---|
| A — index „are poveste” | Un `/p/` intră în Google doar dacă are ≥ 2 magazine cu preț SAU ≥ 3 schimbări de preț în 60 de zile (pe lângă regula din 5 oct.). Variantele de culoare primesc canonical spre pagina principală a grupului. | 035 |
| B — tracker Black Friday | `/black-friday-2026`: până pe 1 nov. explică metoda și arată reducerile reale de azi. Din 1 nov. compară zilnic cu mediana înghețată pe octombrie: % reduceri reale, reduceri „umflate” (doar agregat pe categorie, fără nume de magazine), grafic, top. Pe `/p/` apare, în fereastră, rândul „prețul a urcat cu X% în cele 14 zile dinainte”. | 036 |
| C — indice + repoziționare | `/indice` + edițiile lunare, `/cand-sa-cumperi` + paginile pe categorie, homepage cu titlu nou, `/despre`, `llms.txt`, meniu (desktop + mobil), subsol, sitemap, legături din `/c/`. | 037 |

## Deploy

- `./deploy.sh` web + worker la 22:25: migrațiile 035, 036, 037 aplicate, containerele pornite, site → 200 (commit `f17766e`).
- Bug găsit după deploy și reparat: `/api/revalidate` nu golea cache-ul paginilor noi. Efectul: `/cand-sa-cumperi/laptopuri` a rămas 404 în cache, pentru că fusese citită înainte de calcul. Reparat în `030358e`, deploy web la 22:30, verificat.
- Pe prod am calculat edițiile retroactive ale indicelui pentru iul., aug. și sep. 2026, marcate pe pagină „calculat retroactiv”, plus „Când să cumperi”: 40 de categorii, istoric 12 iun. – 18 oct.
- Am trimis 27 de adrese noi către IndexNow (Bing/Yandex); răspuns 202, adică acceptat.
- `git push origin main` făcut; GitHub e identic cu producția.

## Cifre de pe producție

**Index `/p/`** (raport `seo:index-report`, 21 oct., 22:26):

| | Pagini |
|---|---|
| Indexabile cu regula veche (5 oct.) | 4.341 |
| Indexabile cu „are poveste” | **2.023** |
| Pierdute (scoase doar de „fără poveste”) | 2.318 |

| Categorie-părinte | înainte | acum |
|---|---|---|
| Telefoane & Accesorii | 2.066 | 1.205 |
| Laptopuri & Calculatoare | 1.447 | 314 |
| TV & Audio | 828 | 504 |

- Laptopurile scad cel mai mult: CITGrup refurbished are un singur magazin, iar prețurile se schimbă rar.
- Petmart lipsește încă din index: produsele au intrat pe 3 oct., deci nu au încă 30 de zile de istoric. Primele vor trece pragul în jurul datei de 2 nov., dacă au și „poveste”.
- Canonical pe variante: 0 pagini până la feed-sync-ul de la 04:00. Rezultatul e la finalul acestui raport.

**Indicele (retroactiv):** coș stabil de ~24.000 de produse, 6 magazine, 13–16 categorii. Variația mediană pe categorie e **0%** în toate lunile: majoritatea produselor nu-și schimbă prețul de la o lună la alta. Informația utilă e în coloanele „Mai ieftine” (ex. septembrie: încărcătoare & cabluri 26%, telefoane mobile 19%), „Cu reducere reală” (999 de produse în septembrie) și „Cele mai mari scăderi”. Cifra e onestă, dar rămâne puțin spectaculoasă (vezi „De decis”).

## Ce se întâmplă singur de acum

- **Zilnic, 04:00, feed-sync:** se recalculează schimbările de preț și canonical-ul pe variante, iar trackerul BF scrie în log că suntem înainte de eveniment.
- **1 nov., 04:00:** se calculează o singură dată mediana de referință pentru 2–31 oct. și apar primele cifre pe `/black-friday-2026`.
- **1 nov., 05:00:** ediția din octombrie a indicelui apare automat, prima ediție „live”, nu retroactivă.
- **În fiecare luni, 05:30:** se recalculează „Când să cumperi”.
- **2 dec.:** ultima zi măsurată; din 3 dec. pagina BF devine arhivă.

## De decis / de făcut de tine

1. **Cloudflare (din interfață, 5 min):** GPTBot și ClaudeBot primesc încă 403. Recomand să-i deblochezi, măcar pentru `/indice*`, `/cand-sa-cumperi*`, `/black-friday-2026`, `/ghiduri*`. Fără asta ChatGPT și Claude nu pot cita observatorul.
2. **Search Console:** „Solicită indexarea” pentru `/black-friday-2026`, `/indice`, `/indice/2026-09`, `/cand-sa-cumperi`, `/cand-sa-cumperi/televizoare`, `/cand-sa-cumperi/telefoane-mobile`, `/cand-sa-cumperi/laptopuri`. Retrimite `sitemap.xml`. Contează înainte de Black Friday.
3. **Pragul „are poveste” a tăiat indexul la jumătate (4.341 → 2.023).** Așa a fost decis, dar dacă vrei mai puțin agresiv, cea mai simplă relaxare e ≥ 2 schimbări de preț în loc de 3. Spune-mi și rulez raportul cu pragul nou înainte de schimbare.
4. **Indicele arată 0% peste tot.** Variante: (a) îl lăsăm onest așa, iar valoarea vine din „Mai ieftine” și din top; (b) titlul ediției pune în față „X% din produse s-au ieftinit” în locul medianei. Recomand (b): e o schimbare mică de text, tot adevărată.
5. **Promovare externă** (singurul lucru pe care nu-l poate face codul): când apar cifrele BF (din 2 nov.), un post pe r/Romania sau pe forumul softpedia cu link spre tracker. Linkurile externe sunt ce scoate un site din penalizare.

## Riscuri de urmărit

- Afișările pot scădea temporar din cauza indexului mai mic. E un cost asumat. Recuperarea după un spam update durează de obicei luni; nu există o dată promisă.
- Jobul „Când să cumperi” a durat ~1 min pe prod; indicele ~17 s pe lună. E acceptabil, dar de urmărit în loguri.
- Dacă worker-ul e oprit pe 1 nov., referința BF se poate calcula și mai târziu din aceeași fereastră, cu excepția ofertelor eMAG șterse între timp. Comanda de recuperare e în `CLAUDE.md`.
- Grupurile de variante cu prețuri foarte diferite (~90 local) pot ascunde o configurație diferită; Google poate ignora canonical-ul. Nu e periculos, dar de urmărit.

## Verificarea după feed-sync-ul de la 04:00

_(completată mai jos după rulare)_
