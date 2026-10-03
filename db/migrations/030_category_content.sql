-- Texte pe categorii (pachetul SEO B, raportul docs/seo/2026-10-04-raport-seo-ai.md).
--
-- Aditivă și idempotentă:
-- 1. Coloane noi pe categories: intro_md (Markdown), faq (JSONB, listă de {q, a}),
--    content_updated_at. Coloana description rămâne neatinsă.
-- 2. Textele inițiale pentru 13 subcategorii + 4 categorii-părinte (fără Sănătate & Naturale —
--    REGULI.md regula 8). Se scriu DOAR dacă categoria există (după slug) și nu are deja text
--    (intro_md IS NULL și faq gol) — o rulare repetată nu suprascrie editările din
--    Admin → Categorii → „text”.
-- 3. Corectură de nume: „Elecrocasnice” → „Electrocasnice” (doar numele afișat; slug-ul și
--    URL-ul rămân, redenumirea slug-ului e decizia D1 a proprietarului).
--
-- Cifrele NU sunt scrise de mână: marcajele {{cat:…}} se înlocuiesc la afișare cu valori live
-- (web/src/lib/category-markers.ts). Fără promisiuni de reduceri (regula 9): textele spun ce
-- constatăm „la momentul actualizării”.

ALTER TABLE categories ADD COLUMN IF NOT EXISTS intro_md TEXT;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS faq JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS content_updated_at TIMESTAMPTZ;

UPDATE categories SET name = 'Electrocasnice' WHERE slug = 'elecrocasnice' AND name = 'Elecrocasnice';
UPDATE menu_items SET label = 'Electrocasnice' WHERE label = 'Elecrocasnice';

-- /c/telefoane-mobile
UPDATE categories SET
  intro_md = $md$Pe această pagină găsești {{cat:produse|telefon mobil|telefoane mobile}} cu ofertă disponibilă acum la {{cat:lista-magazine}}. Cele mai multe modele sunt de la {{cat:branduri-top}}. Prețul median al unui telefon din listă este {{cat:pret-median}}, iar 8 din 10 telefoane costă între {{cat:pret-p10}} și {{cat:pret-p90}}.

La telefoane, același model apare de obicei în mai multe variante de memorie, culoare sau Dual SIM, fiecare cu prețul și istoricul ei. Alege întâi spațiul de stocare de care ai nevoie (memoria nu se poate extinde la majoritatea modelelor), apoi compară variantele modelului între ele: uneori diferența dintre două culori e mai mare decât o reducere.

Pentru fiecare telefon înregistrăm prețul zilnic și îl comparăm cu mediana ultimelor 30 de zile. Numim „reducere reală” doar un preț cu cel puțin {{cat:prag}} sub această mediană; la momentul actualizării constatăm {{cat:reduceri|telefon|telefoane}} în această situație — lista e la [Reduceri reale la telefoane mobile](/reduceri-reale/telefoane-mobile). Detalii despre calcul: [metodologia](/ghiduri/metodologie).$md$,
  faq = jsonb_build_array(
    jsonb_build_object('q', $q$Cât costă un telefon mobil în acest moment?$q$,
                       'a', $a$Prețul median al telefoanelor listate acum este {{cat:pret-median}}: jumătate costă mai puțin, jumătate mai mult. 8 din 10 telefoane au prețul între {{cat:pret-p10}} și {{cat:pret-p90}}. Cifrele se recalculează automat din ofertele disponibile și numără separat fiecare variantă de memorie și culoare.$a$),
    jsonb_build_object('q', $q$Cum îmi dau seama dacă prețul unui telefon e bun acum?$q$,
                       'a', $a$Deschide pagina telefonului și uită-te la verdictul de lângă preț și la graficul pe 90 de zile. Verdictul compară prețul de azi cu mediana ultimelor 30 de zile: „Reducere reală” înseamnă cel puțin {{cat:prag}} sub mediană, „Preț obișnuit” înseamnă aproape de mediană, iar „Mai scump” înseamnă peste ea. Prețul tăiat afișat de magazin nu intră în calcul — ne uităm doar la prețurile înregistrate de noi.$a$),
    jsonb_build_object('q', $q$De ce variantele de culoare ale aceluiași telefon au prețuri diferite?$q$,
                       'a', $a$Magazinele stabilesc prețul separat pentru fiecare variantă (culoare, memorie, Dual SIM), iar stocul diferă de la o culoare la alta. De aceea le urmărim separat, fiecare cu istoricul ei. Dacă nu ții la o anumită culoare, verifică și celelalte variante ale modelului înainte să cumperi.$a$),
    jsonb_build_object('q', $q$Când e cel mai bun moment să cumpăr un telefon?$q$,
                       'a', $a$Nu putem prezice prețurile și nu promitem scăderi. Ce poți face: urmărește graficul modelului dorit și setează o alertă de preț de pe pagina produsului („Anunță-mă când scade prețul”) — primești un mesaj când oricare dintre oferte ajunge la suma aleasă. Prețurile telefoanelor le înregistrăm din {{cat:istoric-de-la}}.$a$),
    jsonb_build_object('q', $q$Pot cumpăra telefonul direct de pe superieftin.ro?$q$,
                       'a', $a$Nu. superieftin.ro este un comparator de prețuri: butonul „Vezi oferta” te duce pe site-ul magazinului, unde verifici prețul final, livrarea și garanția și plasezi comanda. Multe linkuri sunt de afiliere — magazinul ne plătește un comision, fără niciun cost în plus pentru tine.$a$)
  ),
  content_updated_at = now()
WHERE slug = 'telefoane-mobile' AND intro_md IS NULL AND faq = '[]'::jsonb;

-- /c/laptopuri
UPDATE categories SET
  intro_md = $md$Lista cuprinde {{cat:produse|laptop|laptopuri}} disponibile acum la {{cat:lista-magazine}}, cel mai des de la {{cat:branduri-top}}. Prețul median este {{cat:pret-median}}; 8 din 10 laptopuri costă între {{cat:pret-p10}} și {{cat:pret-p90}}.

Când compari două laptopuri la preț apropiat, pornește de la ce faci pe el. Pentru birou și studiu contează un procesor de generație recentă, cel puțin 16 GB RAM și un SSD; pentru jocuri și editare video, placa video dedicată și sistemul de răcire. Uită-te apoi la ecran (diagonală, rezoluție, rată de reîmprospătare) și la greutate, dacă îl cari zilnic. Atenție la variantele aproape identice: același model apare cu alt cod, cu sau fără Windows, cu altă tastatură sau culoare — și cu alt preț.

Fiecare laptop are pe pagina lui istoricul prețului și mediana ultimelor 30 de zile. La momentul actualizării, {{cat:reduceri|laptop are|laptopuri au}} un preț cu cel puțin {{cat:prag}} sub mediană: [Reduceri reale la laptopuri](/reduceri-reale/laptopuri).$md$,
  faq = jsonb_build_array(
    jsonb_build_object('q', $q$Cât costă un laptop bun?$q$,
                       'a', $a$Depinde de utilizare. Prețul median al laptopurilor listate acum este {{cat:pret-median}}, iar 8 din 10 costă între {{cat:pret-p10}} și {{cat:pret-p90}}. Laptopurile de gaming și cele pentru lucru profesional, cu placă video dedicată, stau de obicei în jumătatea de sus a intervalului; pentru birou, navigare și studiu găsești configurații potrivite și în jumătatea de jos.$a$),
    jsonb_build_object('q', $q$Ce înseamnă „reducere reală” la un laptop?$q$,
                       'a', $a$Un preț cu cel puțin {{cat:prag}} sub mediana prețurilor pe care le-am înregistrat pentru acel laptop în ultimele 30 de zile. Nu folosim prețul tăiat afișat de magazin, ci prețurile observate zilnic. Dacă un laptop are prea puține înregistrări în ultima lună, nu îi dăm un verdict până nu se adună date.$a$),
    jsonb_build_object('q', $q$De ce găsesc același laptop de mai multe ori?$q$,
                       'a', $a$Producătorii lansează același model în mai multe configurații, fiecare cu alt cod de produs: procesor, memorie, SSD, tastatură, sistem de operare sau culoare diferite. Le listăm separat pentru că și prețul, și istoricul lor sunt separate. Compară denumirea completă și codul înainte să decizi.$a$),
    jsonb_build_object('q', $q$Merită să aștept o reducere?$q$,
                       'a', $a$Nu putem ști dacă prețul va scădea. Poți însă vedea cât a variat prețul laptopului în ultimele 90 de zile, pe graficul din pagina lui, și poți seta o alertă de preț: te anunțăm când oricare dintre oferte ajunge la pragul ales. Pentru laptopuri avem istoric din {{cat:istoric-de-la}}.$a$)
  ),
  content_updated_at = now()
WHERE slug = 'laptopuri' AND intro_md IS NULL AND faq = '[]'::jsonb;

-- /c/televizoare
UPDATE categories SET
  intro_md = $md$Aici sunt {{cat:produse|televizor|televizoare}} cu ofertă disponibilă acum la {{cat:lista-magazine}}. Prețul median este {{cat:pret-median}}, iar 8 din 10 televizoare costă între {{cat:pret-p10}} și {{cat:pret-p90}} — intervalul e larg pentru că lista merge de la modele mici, HD, până la OLED-uri de diagonală mare.

Diagonala se alege după distanța de la canapea la ecran și după rezoluție: la un televizor 4K poți sta mai aproape fără să distingi pixelii decât la unul Full HD. Tipul panoului (LED, QLED, Mini LED, OLED) contează mai mult pentru contrast și unghiuri de vizionare decât câțiva inch în plus. În denumire, diagonala apare de obicei în centimetri și în inch (139 cm = 55 inch).

Pentru fiecare televizor înregistrăm zilnic prețul, iar verdictul de pe pagina produsului îl compară cu mediana ultimelor 30 de zile. La momentul actualizării, {{cat:reduceri|televizor are|televizoare au}} prețul cu cel puțin {{cat:prag}} sub mediană: [Reduceri reale la televizoare](/reduceri-reale/televizoare). Pentru montaj pe perete, vezi și [suporturile TV](/c/suport-tv).$md$,
  faq = jsonb_build_array(
    jsonb_build_object('q', $q$Ce diagonală de televizor să aleg?$q$,
                       'a', $a$O regulă orientativă des folosită pentru televizoarele 4K: distanța de vizionare să fie de aproximativ 1–1,5 ori diagonala ecranului. De exemplu, de la circa 2 metri se potrivește un televizor de 55–65 inch. La Full HD, distanța recomandată e mai mare. Ia în calcul și spațiul real: lățimea comodei sau a peretelui, nu doar distanța.$a$),
    jsonb_build_object('q', $q$Cât costă un televizor acum?$q$,
                       'a', $a$Prețul median al televizoarelor listate este {{cat:pret-median}}, iar 8 din 10 costă între {{cat:pret-p10}} și {{cat:pret-p90}}. Prețul crește repede cu diagonala și cu tipul panoului, așa că pentru o comparație corectă pune față în față modele cu aceeași diagonală și același tip de panou.$a$),
    jsonb_build_object('q', $q$Care e diferența dintre LED, QLED, Mini LED și OLED?$q$,
                       'a', $a$LED și QLED folosesc un panou LCD luminat din spate; QLED adaugă un strat de puncte cuantice pentru culori mai saturate. Mini LED are mult mai multe zone de iluminare, deci un contrast mai bun. La OLED fiecare pixel produce propria lumină și se poate stinge complet — de aici negrul profund și unghiurile largi de vizionare; în schimb, luminozitatea maximă e de obicei mai mică decât la modelele Mini LED de top.$a$),
    jsonb_build_object('q', $q$Scad prețurile la televizoare de Black Friday?$q$,
                       'a', $a$Nu facem astfel de promisiuni. Ce poți verifica: graficul pe 90 de zile al modelului care te interesează și verdictul față de mediana pe 30 de zile. Dacă un preț „redus” de Black Friday e doar la nivelul medianei, pagina produsului îl arată ca „Preț obișnuit”. Poți seta și o alertă de preț, ca să fii anunțat când modelul ajunge la suma dorită.$a$)
  ),
  content_updated_at = now()
WHERE slug = 'televizoare' AND intro_md IS NULL AND faq = '[]'::jsonb;

-- /c/incarcatoare-cabluri
UPDATE categories SET
  intro_md = $md$Găsești aici {{cat:produse|produs|produse}} — încărcătoare de priză, auto și wireless, cabluri USB-C, Lightning sau micro-USB — disponibile acum la {{cat:lista-magazine}}. Cele mai multe sunt de la {{cat:branduri-top}}. Prețul median este {{cat:pret-median}}; 8 din 10 produse costă între {{cat:pret-p10}} și {{cat:pret-p90}}.

La un încărcător, uită-te la puterea maximă (în wați) și la standardul de încărcare rapidă suportat de dispozitiv: USB Power Delivery (PD) la majoritatea telefoanelor și laptopurilor cu USB-C, plus PPS la multe telefoane Samsung. Un încărcător mai puternic decât suportă telefonul nu îl încarcă mai repede, dar îl poți folosi și pentru tabletă sau laptop. La cabluri contează puterea suportată (60 W, 100 W sau 240 W la USB-C) și lungimea.

Urmărim prețurile zilnic din {{cat:istoric-de-la}}. La momentul actualizării, {{cat:reduceri|produs are|produse au}} prețul cu cel puțin {{cat:prag}} sub mediana pe 30 de zile: [Reduceri reale la încărcătoare și cabluri](/reduceri-reale/incarcatoare-cabluri).$md$,
  faq = jsonb_build_array(
    jsonb_build_object('q', $q$Ce putere trebuie să aibă încărcătorul pentru telefonul meu?$q$,
                       'a', $a$Verifică în specificațiile telefonului puterea maximă de încărcare și standardul suportat (de exemplu USB PD sau PPS). Un încărcător cu aceeași putere sau mai mare și cu același standard încarcă telefonul la viteza lui maximă — telefonul cere doar cât poate primi. Dacă vrei un singur încărcător și pentru laptop, alege-l după puterea cerută de laptop.$a$),
    jsonb_build_object('q', $q$Ce înseamnă GaN la un încărcător?$q$,
                       'a', $a$GaN (nitrură de galiu) este un material semiconductor folosit în locul siliciului. Permite încărcătoare mai mici și mai eficiente la aceeași putere. Nu schimbă viteza de încărcare a telefonului — aceasta depinde de putere și de standardul suportat.$a$),
    jsonb_build_object('q', $q$Contează cablul la încărcarea rapidă?$q$,
                       'a', $a$Da. Un cablu USB-C obișnuit transportă până la 60 W. Pentru 100 W sau 240 W (de obicei laptopuri) ai nevoie de un cablu marcat pentru acea putere, cu cip e-marker. Pentru telefoane, un cablu de 60 W este de regulă suficient.$a$),
    jsonb_build_object('q', $q$Cum verific dacă un încărcător are o reducere reală?$q$,
                       'a', $a$Pe pagina produsului, verdictul compară prețul de azi cu mediana prețurilor din ultimele 30 de zile; „Reducere reală” înseamnă cel puțin {{cat:prag}} sub mediană. La accesoriile ieftine, o diferență mică în lei poate trece pragul, așa că uită-te și la grafic: vezi dacă prețul de azi e mai mic decât tot ce a fost în ultimele luni sau doar puțin sub nivelul obișnuit.$a$)
  ),
  content_updated_at = now()
WHERE slug = 'incarcatoare-cabluri' AND intro_md IS NULL AND faq = '[]'::jsonb;

-- /c/desktop-uri
UPDATE categories SET
  intro_md = $md$Lista cuprinde {{cat:produse|calculator desktop|calculatoare desktop}} disponibile acum la {{cat:lista-magazine}}: sisteme de birou în carcase compacte, PC-uri de gaming și stații pentru lucru. Prețul median este {{cat:pret-median}}, iar 8 din 10 au prețul între {{cat:pret-p10}} și {{cat:pret-p90}}.

Înainte să compari prețuri, verifică ce primești: unele sisteme vin cu Windows instalat și cu tastatură și mouse, altele fără sistem de operare („no OS”), iar diferența se vede în preț. La procesor contează generația, nu doar seria — un Core i5 de acum câțiva ani e mult mai lent decât unul recent. Pentru jocuri, placa video dedicată contează mai mult decât procesorul.

Prețul fiecărui sistem îl înregistrăm zilnic din {{cat:istoric-de-la}}. La momentul actualizării, {{cat:reduceri|calculator are|calculatoare au}} prețul cu cel puțin {{cat:prag}} sub mediana pe 30 de zile: [Reduceri reale la desktop-uri](/reduceri-reale/desktop-uri).$md$,
  faq = jsonb_build_array(
    jsonb_build_object('q', $q$Ce înseamnă „no OS” sau „fără sistem de operare”?$q$,
                       'a', $a$Calculatorul vine fără Windows (sau alt sistem de operare) instalat și licențiat. E mai ieftin, dar dacă ai nevoie de Windows, adaugă la comparație și costul unei licențe. Sistemele care au „Windows 11 Pro” sau „Windows 11 Home” în denumire includ licența.$a$),
    jsonb_build_object('q', $q$Ce înseamnă SFF la un calculator?$q$,
                       'a', $a$Small Form Factor: o carcasă compactă, folosită des în birouri. Ocupă puțin loc pe birou sau sub el, dar are mai puțin spațiu pentru o placă video dedicată sau pentru componente adăugate ulterior.$a$),
    jsonb_build_object('q', $q$Desktop sau laptop pentru birou?$q$,
                       'a', $a$La același preț, un desktop oferă de obicei performanță mai bună și se repară sau se extinde mai ușor (memorie, SSD), dar ai nevoie separat de monitor, tastatură și mouse. Laptopul se potrivește dacă lucrezi și în afara biroului — vezi [laptopurile](/c/laptopuri).$a$),
    jsonb_build_object('q', $q$Cum știu dacă prețul unui calculator e bun acum?$q$,
                       'a', $a$Pe pagina lui vezi verdictul față de mediana ultimelor 30 de zile și graficul pe 90 de zile. „Preț obișnuit” înseamnă că prețul de azi e aproape de mediană; „Reducere reală” înseamnă cel puțin {{cat:prag}} sub ea. Dacă vrei să aștepți, setează o alertă de preț cu suma dorită.$a$)
  ),
  content_updated_at = now()
WHERE slug = 'desktop-uri' AND intro_md IS NULL AND faq = '[]'::jsonb;

-- /c/aspiratoare
UPDATE categories SET
  intro_md = $md$Aici sunt {{cat:produse|aparat|aparate}} disponibile acum la {{cat:lista-magazine}}: aspiratoare verticale fără fir, aspiratoare cu sac sau fără sac, aspiratoare cu spălare și mopuri cu abur. Prețul median este {{cat:pret-median}}; 8 din 10 costă între {{cat:pret-p10}} și {{cat:pret-p90}}.

Tipul aparatului contează mai mult decât puterea scrisă pe cutie. Un aspirator vertical fără fir e comod pentru curățenia de zi cu zi, dar are autonomie și recipient limitate; unul cu fir, cu sac sau fără sac, e mai potrivit pentru suprafețe mari și covoare. Puterea în wați a motorului nu se compară direct între aparatele cu fir și cele cu acumulator — la cele fără fir, producătorii indică adesea puterea de aspirare în „air watts”.

Urmărim prețurile din această categorie din {{cat:istoric-de-la}}; graficul de pe fiecare pagină de produs arată cum a evoluat prețul de atunci, iar verdictul îl compară cu mediana ultimelor 30 de zile.$md$,
  faq = jsonb_build_array(
    jsonb_build_object('q', $q$Aspirator cu sac sau fără sac?$q$,
                       'a', $a$Cu sac: praful rămâne închis în sac, iar golirea e simplă, dar cumperi periodic saci de schimb. Fără sac: nu ai costul sacilor, dar golești recipientul și cureți filtrul mai des. Când compari prețurile, ia în calcul și consumabilele — le găsești la [Accesorii aspiratoare](/c/accesorii-aspiratoare).$a$),
    jsonb_build_object('q', $q$Ce autonomie are un aspirator vertical fără fir?$q$,
                       'a', $a$Depinde de model și de treapta de putere. Autonomia din denumire (de exemplu „60 min”) este de obicei cea de pe treapta minimă; pe treapta maximă scade mult. Compară modelele la aceeași treaptă, după specificațiile producătorului.$a$),
    jsonb_build_object('q', $q$Cum aflu dacă prețul unui aspirator e bun acum?$q$,
                       'a', $a$Pe pagina produsului vezi prețul de azi, graficul pe 90 de zile și verdictul față de mediana ultimelor 30 de zile. „Reducere reală” înseamnă cel puțin {{cat:prag}} sub mediană; la momentul actualizării constatăm {{cat:reduceri|aparat|aparate}} în această situație. Poți seta și o alertă de preț pentru modelul care te interesează.$a$)
  ),
  content_updated_at = now()
WHERE slug = 'aspiratoare' AND intro_md IS NULL AND faq = '[]'::jsonb;

-- /c/baterii-externe
UPDATE categories SET
  intro_md = $md$Lista cuprinde {{cat:produse|baterie externă|baterii externe}} disponibile acum la {{cat:lista-magazine}}, cel mai des de la {{cat:branduri-top}}. Prețul median este {{cat:pret-median}}, iar 8 din 10 costă între {{cat:pret-p10}} și {{cat:pret-p90}}.

Capacitatea în mAh e doar punctul de plecare: o baterie de 10.000 mAh nu încarcă de două ori un telefon cu baterie de 5.000 mAh, pentru că o parte din energie se pierde la conversie — în practică, de obicei între o dată și o dată și jumătate. Uită-te și la puterea de ieșire (în wați), la standardul de încărcare rapidă (USB PD), la numărul de porturi și la greutate.

Urmărim prețurile zilnic din {{cat:istoric-de-la}}. La momentul actualizării, {{cat:reduceri|baterie are|baterii au}} prețul cu cel puțin {{cat:prag}} sub mediana pe 30 de zile: [Reduceri reale la baterii externe](/reduceri-reale/baterii-externe).$md$,
  faq = jsonb_build_array(
    jsonb_build_object('q', $q$Ce capacitate de baterie externă îmi trebuie?$q$,
                       'a', $a$Pentru o încărcare completă a unui telefon pe zi, o baterie de 10.000 mAh este de obicei suficientă și rămâne ușoară. Pentru mai multe încărcări, pentru tabletă sau laptop, ai nevoie de capacitate mai mare (20.000 mAh sau peste) și de o putere de ieșire mai mare. Capacitatea livrată efectiv e mai mică decât cea de pe etichetă, din cauza pierderilor la conversie.$a$),
    jsonb_build_object('q', $q$Pot lua bateria externă în avion?$q$,
                       'a', $a$De regulă, bateriile externe sunt permise doar în bagajul de mână, nu în cel de cală, iar companiile aeriene limitează capacitatea, exprimată în Wh (frecvent 100 Wh fără aprobare specială). Verifică regulile companiei cu care zbori. Conversia: Wh = mAh × tensiunea nominală (de obicei 3,6–3,7 V) / 1000.$a$),
    jsonb_build_object('q', $q$Poate o baterie externă să încarce un laptop?$q$,
                       'a', $a$Doar dacă laptopul se încarcă prin USB-C și dacă bateria are o ieșire USB-C Power Delivery cu puterea cerută de laptop (de obicei între 45 și 100 W). Puterea maximă a fiecărei ieșiri apare în denumire sau în specificații.$a$)
  ),
  content_updated_at = now()
WHERE slug = 'baterii-externe' AND intro_md IS NULL AND faq = '[]'::jsonb;

-- /c/suport-tv
UPDATE categories SET
  intro_md = $md$Aici sunt {{cat:produse|suport TV|suporturi TV}} disponibile acum la {{cat:lista-magazine}}: suporturi de perete fixe, înclinabile sau articulate, suporturi de tavan și standuri mobile, cel mai des de la {{cat:branduri-top}}. Prețul median este {{cat:pret-median}}; 8 din 10 costă între {{cat:pret-p10}} și {{cat:pret-p90}}.

Trei lucruri decid dacă un suport se potrivește: standardul VESA (distanța dintre găurile de prindere din spatele televizorului, de exemplu 200×200 sau 400×400 mm), greutatea maximă suportată și intervalul de diagonale. Le găsești în manualul televizorului și în denumirea suportului. Un suport articulat permite rotirea ecranului, dar ține televizorul mai departe de perete decât unul fix.

Urmărim prețurile zilnic din {{cat:istoric-de-la}}; la momentul actualizării, {{cat:reduceri|suport are|suporturi au}} prețul cu cel puțin {{cat:prag}} sub mediana pe 30 de zile ([Reduceri reale la suporturi TV](/reduceri-reale/suport-tv)). Dacă încă alegi televizorul, vezi [televizoarele](/c/televizoare).$md$,
  faq = jsonb_build_array(
    jsonb_build_object('q', $q$Cum aflu ce standard VESA are televizorul meu?$q$,
                       'a', $a$Caută „VESA” în manualul sau în fișa tehnică a televizorului; e exprimat în milimetri (distanța pe orizontală × pe verticală între găurile de prindere). Poți și măsura singur distanța dintre cele patru găuri filetate din spatele televizorului. Suportul trebuie să accepte exact acel format.$a$),
    jsonb_build_object('q', $q$Suport fix, înclinabil sau articulat?$q$,
                       'a', $a$Fix: televizorul stă aproape de perete, montajul e simplu, iar prețul e de obicei mai mic. Înclinabil: util când televizorul e montat sus, deasupra nivelului ochilor. Articulat (cu braț): poți orienta ecranul spre zone diferite ale camerei, dar ai nevoie de un perete rezistent, pentru că brațul solicită mai mult prinderile.$a$),
    jsonb_build_object('q', $q$Ce greutate trebuie să suporte suportul?$q$,
                       'a', $a$Cel puțin greutatea televizorului fără picior (din fișa tehnică), cu o marjă de siguranță. Contează și peretele: pe gips-carton prinderea se face în profile sau cu dibluri speciale, conform instrucțiunilor suportului.$a$)
  ),
  content_updated_at = now()
WHERE slug = 'suport-tv' AND intro_md IS NULL AND faq = '[]'::jsonb;

-- /c/componente-pc-server
UPDATE categories SET
  intro_md = $md$Categoria cuprinde {{cat:produse|produs|produse}} pentru calculatoare, servere și camere tehnice, disponibile acum la {{cat:lista-magazine}}: dulapuri și accesorii de rack, HDD-uri și SSD-uri, procesoare, surse și controlere. Prețul median este {{cat:pret-median}}, iar 8 din 10 produse costă între {{cat:pret-p10}} și {{cat:pret-p90}} — intervalul e larg pentru că lista merge de la accesorii mărunte la procesoare de server.

Înainte de comandă, verifică compatibilitatea: socketul procesorului cu placa de bază, interfața discurilor (SATA, SAS, NVMe) și formatul lor (2,5 sau 3,5 inch), iar la echipamentele de rack înălțimea în unități (U) și adâncimea dulapului. Procesoarele marcate „Tray” vin fără cutie și, de regulă, fără cooler.

Prețurile le înregistrăm zilnic din {{cat:istoric-de-la}}; la momentul actualizării, {{cat:reduceri|produs are|produse au}} prețul cu cel puțin {{cat:prag}} sub mediana pe 30 de zile.$md$,
  faq = jsonb_build_array(
    jsonb_build_object('q', $q$Ce înseamnă „Tray” la un procesor?$q$,
                       'a', $a$Varianta „Tray” e livrată fără cutia de retail și, de obicei, fără cooler; e destinată celor care asamblează sisteme. Garanția și condițiile pot diferi față de varianta „Box”, așa că verifică pe site-ul magazinului.$a$),
    jsonb_build_object('q', $q$HDD SAS sau SATA?$q$,
                       'a', $a$SAS este interfața folosită în servere, cu controlere dedicate. Un disc SAS nu funcționează pe un port SATA obișnuit, în schimb un disc SATA se poate conecta de obicei la un controler SAS. Verifică ce suportă serverul sau controlerul tău înainte să cumperi.$a$),
    jsonb_build_object('q', $q$Ce înseamnă 1U sau 22U la echipamentele de rack?$q$,
                       'a', $a$U (unitatea de rack) măsoară înălțimea: 1U = 44,45 mm. Un dulap de 22U are loc pentru echipamente care însumează 22 de unități. Lățimea standard este de 19 inch, iar adâncimea dulapului trebuie să fie mai mare decât cea a celui mai adânc echipament, plus spațiu pentru cabluri.$a$)
  ),
  content_updated_at = now()
WHERE slug = 'componente-pc-server' AND intro_md IS NULL AND faq = '[]'::jsonb;

-- /c/folii-protectie-telefon
UPDATE categories SET
  intro_md = $md$Lista cuprinde {{cat:produse|folie de protecție|folii de protecție}} pentru telefoane, disponibile acum la {{cat:lista-magazine}}, cel mai des de la {{cat:branduri-top}}. Prețul median este {{cat:pret-median}}; 8 din 10 folii costă între {{cat:pret-p10}} și {{cat:pret-p90}}.

Folia se alege după modelul exact al telefonului, nu după diagonală: decupajele pentru cameră și senzori diferă chiar între modele din aceeași serie. Apoi alegi tipul: sticlă securizată (rigidă, se simte ca ecranul original), folie flexibilă (urmărește mai bine marginile curbate) sau folie „privacy”, care întunecă ecranul privit din lateral. „Full glue” înseamnă că folia se lipește pe toată suprafața, iar „full cover” că acoperă ecranul până la margini.

Urmărim prețurile zilnic din {{cat:istoric-de-la}}; la momentul actualizării, {{cat:reduceri|folie are|folii au}} prețul cu cel puțin {{cat:prag}} sub mediana pe 30 de zile.$md$,
  faq = jsonb_build_array(
    jsonb_build_object('q', $q$Ce înseamnă folie „privacy”?$q$,
                       'a', $a$O folie cu filtru care lasă ecranul vizibil doar din față; privit din lateral, pare întunecat. E utilă în transportul în comun sau la birou, dar reduce puțin luminozitatea percepută, așa că s-ar putea să mărești luminozitatea ecranului.$a$),
    jsonb_build_object('q', $q$Se potrivește folia cu husa mea?$q$,
                       'a', $a$Nu întotdeauna. Unele huse apasă pe marginile foliei și o pot dezlipi în timp. Foliile „case friendly” sunt puțin mai mici decât ecranul tocmai pentru a lăsa loc husei. Dacă ai deja o husă, caută această mențiune în denumire sau în descrierea de pe site-ul magazinului.$a$),
    jsonb_build_object('q', $q$De ce folii de același tip au prețuri foarte diferite?$q$,
                       'a', $a$Prețul diferă după material, marcă, conținutul pachetului (unele includ o ramă de aplicare sau două bucăți) și magazin. Pe pagina fiecărei folii vezi prețul de azi față de mediana ultimelor 30 de zile, ca să știi dacă e prețul ei obișnuit, nu doar dacă e ieftină în comparație cu altele.$a$)
  ),
  content_updated_at = now()
WHERE slug = 'folii-protectie-telefon' AND intro_md IS NULL AND faq = '[]'::jsonb;

-- /c/hrana-uscata
UPDATE categories SET
  intro_md = $md$În această categorie sunt {{cat:produse|produs|produse}} de hrană uscată pentru câini și pisici, disponibile acum la {{cat:lista-magazine}}. Prețul median al unui produs este {{cat:pret-median}}, iar 8 din 10 costă între {{cat:pret-p10}} și {{cat:pret-p90}}.

La hrana uscată, prețul pe pachet spune puțin: același sortiment se vinde de obicei în mai multe gramaje, de la pungi de câteva sute de grame la saci de peste 10 kg. Ca să compari corect, împarte prețul la numărul de kilograme. Sacul mare iese de regulă mai ieftin pe kilogram, dar merită doar dacă animalul acceptă hrana și o terminați înainte de data expirării. Alege întâi după specie, etapa de viață (junior, adult, senior) și talie, apoi după preț.

Urmărim prețurile din această categorie din {{cat:istoric-de-la}}. Pentru că istoricul e încă scurt, mediana pe 30 de zile se formează treptat, iar verdictul de pe pagina produsului se bazează la început pe puține zile.$md$,
  faq = jsonb_build_array(
    jsonb_build_object('q', $q$Cum compar prețul a două pachete de hrană cu gramaj diferit?$q$,
                       'a', $a$Calculează prețul pe kilogram: prețul pachetului împărțit la greutatea lui în kilograme. Greutatea apare în denumirea produsului (de exemplu „1,5 kg” sau „400 g”). Compară apoi doar produse pentru aceeași specie și aceeași etapă de viață.$a$),
    jsonb_build_object('q', $q$Merită să cumpăr sacul cel mai mare?$q$,
                       'a', $a$Pe kilogram, sacii mari sunt de obicei mai ieftini, dar diferența contează doar dacă hrana se consumă înainte de expirare și se păstrează bine închisă, ferită de umezeală. Pentru o hrană pe care animalul nu a mai mâncat-o, un pachet mic e o alegere mai prudentă.$a$),
    jsonb_build_object('q', $q$Cum funcționează istoricul de preț la hrana pentru animale?$q$,
                       'a', $a$Înregistrăm prețul fiecărui produs zilnic, din {{cat:istoric-de-la}}. Mediana apare după ce există cel puțin două prețuri în ultimele 30 de zile, iar verdictul „Reducere reală” doar când prețul de azi e cu cel puțin {{cat:prag}} sub ea. La momentul actualizării, {{cat:cu-mediana|produs are|produse au}} deja mediană, iar {{cat:reduceri|produs îndeplinește|produse îndeplinesc}} condiția de reducere reală.$a$),
    jsonb_build_object('q', $q$De unde vin prețurile?$q$,
                       'a', $a$Din ofertele publicate de {{cat:lista-magazine}}, preluate automat. Butonul „Vezi oferta” te duce pe site-ul magazinului, unde verifici prețul final, costul livrării și disponibilitatea înainte de comandă.$a$)
  ),
  content_updated_at = now()
WHERE slug = 'hrana-uscata' AND intro_md IS NULL AND faq = '[]'::jsonb;

-- /c/hrana-umeda
UPDATE categories SET
  intro_md = $md$Aici sunt {{cat:produse|produs|produse}} de hrană umedă pentru câini și pisici — conserve, plicuri și caserole — disponibile acum la {{cat:lista-magazine}}. Prețul median al unui produs este {{cat:pret-median}}; 8 din 10 costă între {{cat:pret-p10}} și {{cat:pret-p90}}. Diferențele mari vin din ambalare: un plic individual și un bax de mai multe bucăți sunt produse separate, cu prețuri separate.

Ca să compari, uită-te la gramajul din denumire și la numărul de bucăți din pachet, apoi calculează prețul pe 100 g sau pe bucată. Baxurile au adesea un preț pe bucată mai mic decât plicurile vândute individual, dar verifică pe fiecare produs, nu presupune.

Prețurile din această categorie le urmărim din {{cat:istoric-de-la}}; graficul și mediana pe 30 de zile se completează pe măsură ce trec zilele. Pentru hrana uscată, vezi [Hrană uscată](/c/hrana-uscata).$md$,
  faq = jsonb_build_array(
    jsonb_build_object('q', $q$Cum calculez prețul pe bucată la un bax de hrană umedă?$q$,
                       'a', $a$Împarte prețul baxului la numărul de bucăți din denumire („12x85 g” înseamnă 12 plicuri a câte 85 g). Pentru a compara gramaje diferite, calculează prețul pe 100 g: prețul împărțit la greutatea totală în grame, înmulțit cu 100.$a$),
    jsonb_build_object('q', $q$Pot compara la preț hrana umedă cu hrana uscată?$q$,
                       'a', $a$Nu direct. Hrana umedă conține mult mai multă apă, așa că la aceeași greutate are mai puțină substanță uscată. Compară prețurile în interiorul aceleiași categorii, pe 100 g sau pe bucată, între produse pentru aceeași specie și etapă de viață.$a$),
    jsonb_build_object('q', $q$Cum funcționează istoricul de preț aici?$q$,
                       'a', $a$Înregistrăm zilnic prețul fiecărui produs, din {{cat:istoric-de-la}}. Pe pagina produsului vezi graficul, iar după ce există cel puțin două prețuri în ultimele 30 de zile, și mediana lor. Verdictul „Reducere reală” apare doar când prețul de azi e cu cel puțin {{cat:prag}} sub această mediană; la momentul actualizării, {{cat:reduceri|produs îndeplinește|produse îndeplinesc}} condiția.$a$)
  ),
  content_updated_at = now()
WHERE slug = 'hrana-umeda' AND intro_md IS NULL AND faq = '[]'::jsonb;

-- /c/jucarii-pet
UPDATE categories SET
  intro_md = $md$Aici sunt {{cat:produse|jucărie|jucării}} pentru câini și pisici, disponibile acum la {{cat:lista-magazine}}: mingi, frânghii, jucării de ros, de pluș sau interactive. Jumătate dintre ele costă sub {{cat:pret-median}}, iar 8 din 10 au prețul între {{cat:pret-p10}} și {{cat:pret-p90}}.

Mărimea jucăriei trebuie potrivită cu talia animalului — o minge prea mică pentru un câine mare poate fi înghițită — iar materialul, cu felul în care se joacă: cauciucul dur rezistă mai bine la ros decât plușul sau sfoara. Dimensiunea apare de obicei în denumire, în centimetri.

Urmărim prețurile acestor produse din {{cat:istoric-de-la}}. Pe pagina fiecărei jucării vezi prețul de azi și graficul, iar după ce se adună destule zile, și comparația cu mediana pe 30 de zile.$md$,
  faq = jsonb_build_array(
    jsonb_build_object('q', $q$Ce jucărie e potrivită pentru un câine care roade tot?$q$,
                       'a', $a$Caută jucării din cauciuc dur sau termoplastic, fără părți mici care se pot desprinde, și alege mărimea după talia câinelui. Jucăriile de pluș și cele din sfoară se uzează mai repede la ros. Materialul și dimensiunile le găsești în denumire și în descrierea de pe site-ul magazinului.$a$),
    jsonb_build_object('q', $q$Cum găsesc jucăriile pentru pisici?$q$,
                       'a', $a$Denumirea produsului spune de obicei dacă jucăria e pentru câini, pentru pisici sau pentru ambele. Pentru pisici, cele mai multe sunt jucării interactive (undițe, laser, mingi cu clopoțel) și jucării mici, de pluș. Poți folosi și căutarea de pe site, de exemplu „jucărie pisică”.$a$),
    jsonb_build_object('q', $q$Cum aflu dacă prețul unei jucării e bun?$q$,
                       'a', $a$Pe pagina fiecărui produs vezi prețul de azi, magazinul și graficul prețului din {{cat:istoric-de-la}} încoace. Când există destule înregistrări în ultimele 30 de zile, apare și verdictul față de mediană: „Reducere reală” înseamnă cel puțin {{cat:prag}} sub ea.$a$)
  ),
  content_updated_at = now()
WHERE slug = 'jucarii-pet' AND intro_md IS NULL AND faq = '[]'::jsonb;

-- /c/animale-de-companie
UPDATE categories SET
  intro_md = $md$Hrană și jucării pentru câini și pisici: {{cat:produse|produs disponibil|produse disponibile}} acum la {{cat:lista-magazine}}, împărțite în [hrană uscată](/c/hrana-uscata), [hrană umedă](/c/hrana-umeda) și [jucării](/c/jucarii-pet). Prețul median al unui produs din toată categoria este {{cat:pret-median}}.

La hrană, compară prețul pe kilogram sau pe bucată, nu pe pachet: același sortiment se vinde în gramaje foarte diferite. Pentru produsele pe care le cumperi regulat, o alertă de preț te scutește să verifici zilnic.

Urmărim prețurile din această categorie din {{cat:istoric-de-la}}. Istoricul se construiește zi de zi: pe pagina fiecărui produs vezi graficul, iar mediana pe 30 de zile apare după ce se adună cel puțin două prețuri în ultima lună.$md$,
  faq = jsonb_build_array(
    jsonb_build_object('q', $q$Cum sunt anunțat când scade prețul la hrana pe care o cumpăr des?$q$,
                       'a', $a$Pe pagina produsului apasă „Anunță-mă când scade prețul” și alege suma dorită. Primești un mesaj când oricare dintre ofertele produsului ajunge la acea sumă sau sub ea. Alerta rămâne activă și după primul mesaj, așa că e utilă pentru produsele cumpărate lunar.$a$),
    jsonb_build_object('q', $q$De ce unele produse nu au încă verdict de preț?$q$,
                       'a', $a$Verdictul compară prețul de azi cu mediana ultimelor 30 de zile, iar mediana cere cel puțin două prețuri înregistrate în acest interval. Am început să urmărim categoria în {{cat:istoric-de-la}}; la momentul actualizării, {{cat:cu-mediana|produs are|produse au}} deja mediană.$a$),
    jsonb_build_object('q', $q$De unde vin prețurile și cât de des se actualizează?$q$,
                       'a', $a$Din ofertele publicate de {{cat:lista-magazine}}, preluate automat în fiecare zi. O ofertă care nu a mai fost confirmată în ultimele 3 zile sau care nu mai e în stoc nu mai apare pe site.$a$)
  ),
  content_updated_at = now()
WHERE slug = 'animale-de-companie' AND intro_md IS NULL AND faq = '[]'::jsonb;

-- /c/telefoane-accesorii
UPDATE categories SET
  intro_md = $md$Telefoane & Accesorii adună {{cat:produse|produs disponibil|produse disponibile}} acum la {{cat:lista-magazine}}: [telefoane mobile](/c/telefoane-mobile), [încărcătoare și cabluri](/c/incarcatoare-cabluri), [baterii externe](/c/baterii-externe), [folii de protecție](/c/folii-protectie-telefon) și alte accesorii. Alege o subcategorie ca să vezi doar ce te interesează.

Pentru fiecare produs înregistrăm prețul zilnic și îl comparăm cu mediana ultimelor 30 de zile; „reducere reală” înseamnă un preț cu cel puțin {{cat:prag}} sub această mediană. La momentul actualizării, în toată categoria constatăm {{cat:reduceri|astfel de produs|astfel de produse}}. Cum calculăm: [metodologia](/ghiduri/metodologie).$md$,
  faq = '[]'::jsonb,
  content_updated_at = now()
WHERE slug = 'telefoane-accesorii' AND intro_md IS NULL AND faq = '[]'::jsonb;

-- /c/laptopuri-calculatoare
UPDATE categories SET
  intro_md = $md$Laptopuri & Calculatoare cuprinde {{cat:produse|produs disponibil|produse disponibile}} acum la {{cat:lista-magazine}}. Alege [laptopuri](/c/laptopuri) dacă ai nevoie de mobilitate, [desktop-uri](/c/desktop-uri) pentru birou sau jocuri și [componente PC & server](/c/componente-pc-server) dacă îți asamblezi sau extinzi singur sistemul.

Fiecare produs are pe pagina lui graficul prețului și verdictul față de mediana ultimelor 30 de zile. La momentul actualizării, în toată categoria constatăm {{cat:reduceri|produs|produse}} cu prețul cu cel puțin {{cat:prag}} sub mediană.$md$,
  faq = '[]'::jsonb,
  content_updated_at = now()
WHERE slug = 'laptopuri-calculatoare' AND intro_md IS NULL AND faq = '[]'::jsonb;

-- /c/tv-audio
UPDATE categories SET
  intro_md = $md$TV & Audio cuprinde {{cat:produse|produs disponibil|produse disponibile}} acum la {{cat:lista-magazine}}: [televizoare](/c/televizoare), [suporturi TV](/c/suport-tv) și produse audio. Dacă cumperi televizor și suport de perete împreună, verifică întâi standardul VESA și greutatea televizorului — suportul trebuie să le accepte pe amândouă.

Prețurile le înregistrăm zilnic și le comparăm cu mediana ultimelor 30 de zile. La momentul actualizării, în toată categoria constatăm {{cat:reduceri|produs|produse}} cu prețul cu cel puțin {{cat:prag}} sub mediană.$md$,
  faq = '[]'::jsonb,
  content_updated_at = now()
WHERE slug = 'tv-audio' AND intro_md IS NULL AND faq = '[]'::jsonb;
