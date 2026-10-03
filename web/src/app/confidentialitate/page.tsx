import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage, Todo } from '@/components/LegalPage'
import { COMPANY } from '@/lib/company'

export const metadata: Metadata = {
  title: 'Politica de confidențialitate',
  description: 'Ce date colectează superieftin.ro, de ce, cât timp le păstrăm și ce drepturi ai.',
  alternates: { canonical: '/confidentialitate' },
}

// ATENTIE: textul descrie ce face REAL codul. Cand se schimba colectarea de date (tracking nou,
// formular nou, alt furnizor), actualizeaza pagina + data de mai jos.
// Text redactat fara jurist — recomandat sa fie verificat inainte de lansarea reclamelor.
// Sectiunile despre reclamele personalizate (parte din „Publicitate”, 3 oct 2026) sunt NOI — de verificat de jurist inainte de deploy.
export default function ConfidentialitatePage() {
  const privacyEmail = COMPANY.privacyEmail ?? COMPANY.email
  return (
    <LegalPage title="Politica de confidențialitate" updated="3 octombrie 2026">
      <p>
        Această politică explică ce date prelucrează superieftin.ro, în ce scop și ce drepturi ai,
        conform Regulamentului (UE) 2016/679 (GDPR).
      </p>

      <h2>Cine este operatorul</h2>
      <p>
        {COMPANY.name ?? <Todo>denumire firmă</Todo>}, CUI {COMPANY.cui ?? <Todo>CUI</Todo>},
        cu sediul în {COMPANY.address ?? <Todo>adresa sediului</Todo>}. Pentru orice cerere legată
        de date personale: {privacyEmail
          ? <a href={`mailto:${privacyEmail}`}>{privacyEmail}</a>
          : <Todo>email GDPR</Todo>}.
      </p>

      <h2>Ce date prelucrăm</h2>
      <table>
        <thead>
          <tr><th>Ce</th><th>De ce</th><th>Temei legal</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Jurnale tehnice ale serverului</strong> (adresă IP, browser, pagina cerută, ora)</td>
            <td>Funcționarea și securitatea site-ului</td>
            <td>Interes legitim</td>
          </tr>
          <tr>
            <td><strong>Clickuri spre magazine</strong>: oferta accesată, ora și un cod aleatoriu de click</td>
            <td>
              Statistici despre ce oferte sunt utile. Codul de click (fără date despre tine) este
              transmis rețelei de afiliere, ca să putem vedea dacă un click a dus la o comandă.
            </td>
            <td>Interes legitim</td>
          </tr>
          <tr>
            <td><strong>Termenii căutați pe site</strong> (doar textul căutării și numărul de rezultate)</td>
            <td>Îmbunătățirea căutării și a catalogului</td>
            <td>Interes legitim</td>
          </tr>
          <tr>
            <td><strong>Alegerea ta despre cookie-uri</strong> (cookie-ul <code>se_consent</code>)</td>
            <td>Să nu te întrebăm la fiecare vizită</td>
            <td>Obligație legală (dovada consimțământului)</td>
          </tr>
          <tr>
            <td><strong>Google Analytics 4</strong>: pagini vizitate, dispozitiv, țară, interacțiuni</td>
            <td>Statistici agregate de utilizare</td>
            <td>Consimțământ (categoria „Analiză”)</td>
          </tr>
          <tr>
            <td>
              <strong>Google Ads</strong>: identificatorul clickului pe reclama Google cu care ai ajuns pe site
              (<code>gclid</code>, <code>gbraid</code> sau <code>wbraid</code>), păstrat în cookie-ul{' '}
              <code>se_gclid</code> și asociat codului de click spre magazin; dacă ai cumpărat, trimitem la
              Google Ads, ca „conversie offline”, doar identificatorul, valoarea comisionului nostru în lei,
              ora și ID-ul comenzii (detalii mai jos)
            </td>
            <td>Legăm o eventuală comandă de reclama care a adus vizita, ca să măsurăm dacă reclamele
              noastre aduc cumpărături reale</td>
            <td>Consimțământ (categoria „Publicitate”)</td>
          </tr>
          <tr>
            <td><strong>Bannere de afiliere Profitshare</strong> (doar pe desktop): pagina vizitată,
              browserul, rezoluția ecranului, cookie-uri Profitshare</td>
            <td>Afișarea bannerelor partenerilor</td>
            <td>Consimțământ (categoria „Publicitate”); fără acord, bannerele nu se încarcă</td>
          </tr>
          <tr>
            <td>
              <strong>Reclame personalizate (remarketing)</strong>: din datele Google Analytics, faptul că ai
              văzut pagini de produs pe site și dacă ai mers spre un magazin; Google te recunoaște prin
              cookie-urile sale de publicitate
            </td>
            <td>Să îți arătăm din nou reclamele noastre în Google (de exemplu, când cauți din nou un produs),
              timp de cel mult 540 de zile (aproximativ 18 luni) de la vizită</td>
            <td>Consimțământ (categoria „Publicitate”, acordat începând cu 3 octombrie 2026)</td>
          </tr>
          <tr>
            <td><strong>Alerte de preț pe Telegram</strong>: ID-ul conversației, numele de utilizator și prenumele din Telegram, alertele setate</td>
            <td>Să îți trimitem alertele cerute</td>
            <td>Executarea serviciului cerut de tine</td>
          </tr>
          <tr>
            <td><strong>Alerte de preț pe email</strong>: adresa de email, produsele și pragurile alese,
              momentul cererii (acordul din formular), momentul confirmării din email, momentul ultimului
              email de alerte și, pentru alertele trimise, prețul și magazinul constatate</td>
            <td>Să îți trimitem alertele cerute (cel mult un email pe zi, cu toate produsele care au ajuns
              la prag) și să putem dovedi acordul</td>
            <td>Consimțământ (bifa din formular, confirmată prin linkul din email)</td>
          </tr>
        </tbody>
      </table>
      <p>
        Nu cerem cont, nu vindem date și nu trimitem către Google adresa de email, telefonul, adresa
        IP sau alte date de contact.
      </p>
      <p>
        Imaginile produselor și logourile magazinelor se încarcă direct de pe serverele magazinelor
        și ale Profitshare. Ca la orice imagine de pe internet, browserul tău le transmite adresa IP;
        aceste imagini nu setează cookie-uri.
      </p>

      <h2>Google Analytics și Google Ads fără consimțământ</h2>
      <p>
        Folosim Google Consent Mode v2. Până accepți, cookie-urile Google nu sunt setate. Google
        poate primi totuși semnale fără cookie-uri și fără identificatori (de exemplu, că a avut
        loc o vizită), pe care le folosește doar pentru statistici estimate, agregate. Dacă refuzi
        categoria „Publicitate”, nu salvăm identificatorii clickurilor pe reclame — în afara
        jurnalelor tehnice ale serverului și ale Cloudflare, în care adresa completă a paginii
        (inclusiv identificatorul din ea) poate apărea; acestea se păstrează de regulă câteva
        săptămâni, doar pentru securitate, nu le folosim pentru reclame și nu le trimitem la Google.
      </p>

      <h2>Identificatorul clickului pe reclama Google, pe scurt</h2>
      <ul>
        <li>
          <strong>Înainte să alegi</strong>, nu stocăm nimic pe dispozitivul tău (nici cookie, nici{' '}
          <code>sessionStorage</code> sau <code>localStorage</code>). Identificatorul din adresa paginii
          rămâne doar în memoria paginii deschise și se pierde la reîncărcare sau la închiderea filei.
          Dacă accepți „Publicitate” între timp, abia atunci scriem cookie-ul <code>se_gclid</code>
          (identificatorul și momentul sosirii pe site, valabil 90 de zile de la sosire).
        </li>
        <li>
          <strong>Dacă refuzi</strong>, nu păstrăm identificatorul, în afara jurnalelor tehnice ale
          serverului și ale Cloudflare, în care adresa completă a paginii (inclusiv identificatorul din
          ea) poate apărea. Aceste jurnale se păstrează de regulă câteva săptămâni, doar pentru
          securitate; nu le folosim pentru reclame și nu le trimitem la Google.
        </li>
        <li>
          <strong>Pe serverul nostru</strong>, identificatorul se leagă de un click spre magazin doar dacă
          în acel moment ai acordul „Publicitate”. Îl ștergem automat după 90 de zile de la clickul pe
          reclamă, indiferent dacă a dus sau nu la o comandă. Codul intern al clickului rămâne, fără
          identificatorul Google, ca să putem potrivi comisioanele primite de la rețeaua de afiliere.
        </li>
        <li>
          <strong>Ce trimitem la Google</strong> (Google Ireland Ltd., prin Data Manager API / Google Ads,
          ca „conversie offline”): doar identificatorul clickului, valoarea comisionului nostru în lei,
          ora și ID-ul comenzii. Nu trimitem email, telefon sau adresa IP. Dacă o comandă deja raportată
          se anulează, îi cerem lui Google să o retragă, pe baza ID-ului comenzii.
        </li>
        <li>
          <strong>Identificatorul clickului nu e folosit pentru reclame personalizate.</strong> În conversiile
          offline descrise mai sus, semnalul <code>ad_personalization</code> este mereu „refuzat”.
          Reclamele personalizate (remarketing) funcționează separat, prin Google Analytics, cu acordul
          „Publicitate” — vezi secțiunea de mai jos.
        </li>
        <li>
          <strong>Dacă îți retragi acordul</strong> (din „Setări cookies”), dacă acordul expiră (după
          6 luni) sau dacă actualizăm politica și îți cerem din nou acordul, ștergem cookie-ul{' '}
          <code>se_gclid</code> de pe dispozitiv și trimitem serverului nostru, o singură dată, doar
          identificatorul (fără alte date), ca să-l ștergem din clickurile deja înregistrate. După
          aceea nu mai trimitem la Google conversii pentru acele clickuri; conversiile trimise
          înainte, cât aveai acordul, rămân la Google. Pentru această cerere, aplicația folosește adresa
          ta IP doar temporar, în memorie, ca protecție împotriva abuzurilor, și nu o salvează separat.
          Ca la orice cerere către site, adresa IP apare însă în jurnalele tehnice ale serverului și ale
          Cloudflare (vezi „Cât timp păstrăm datele”), păstrate de regulă câteva săptămâni, doar pentru
          securitate.
        </li>
      </ul>

      <h2>Reclame personalizate (remarketing)</h2>
      <p>
        Dacă accepți „Publicitate”, site-ul trimite către Google
        semnalul <code>ad_personalization</code> = „acordat”. Google Analytics poate atunci include browserul
        tău într-o listă de vizitatori, de exemplu „a văzut un produs, dar nu a mers spre magazin în
        ultimele 7 zile”, pe care o folosim în Google Ads ca să îți arătăm reclamele noastre când cauți din
        nou pe Google (eventual cu o licitare mai mare pentru tine). Nu vedem cine este în listă:
        Google ne arată doar numere agregate. Acordurile „Publicitate” date înainte de 3 octombrie 2026, când textul nu pomenea reclamele
        personalizate, nu le includ: pentru ele semnalul rămâne „refuzat” până îți salvezi din nou alegerea
        din „Setări cookies” sau până îți cerem din nou acordul.
      </p>
      <ul>
        <li>Nu folosim Google Signals și nu trimitem la Google email, telefon sau adresa IP. Google poate
          combina aceste informații cu datele pe care le are deja despre tine (de exemplu, dacă ești
          autentificat într-un cont Google), conform propriei politici:{' '}
          <a href="https://policies.google.com/technologies/partner-sites" rel="noopener" target="_blank">
            cum folosește Google datele de pe site-urile partenerilor</a>.</li>
        <li>Durata: cel mult 540 de zile (aproximativ 18 luni) de la ultima vizită care te-a inclus în listă.</li>
        <li>Retragere: debifezi „Publicitate” din „Setări cookies”. De atunci nu mai ești
          adăugat; apartenența existentă expiră în cel mult 540 de zile. Poți folosi și setările Google, la{' '}
          <a href="https://myadcenter.google.com" rel="noopener" target="_blank">myadcenter.google.com</a>.</li>
      </ul>

      <h2>Alertele de preț pe email</h2>
      <ul>
        <li>
          <strong>Confirmare dublă</strong>: după formular îți trimitem un email de confirmare. Alerta
          pornește doar după ce apeși butonul din pagina deschisă din acel email. Cererile neconfirmate
          (adresa și alertele) se șterg automat după 7 zile.
        </li>
        <li>
          <strong>Ce stocăm</strong>: doar adresa de email, alertele (produs, prag) și momentele de mai sus.
          Nu folosim adresa în alt scop (nu trimitem newslettere sau reclame), nu o vindem și nu o
          transmitem către Google sau rețelele de afiliere.
        </li>
        <li>
          <strong>Gestionare fără cont</strong>: fiecare email conține un link personal către „Alertele
          mele” (schimbi pragul, ștergi o alertă) și un link de dezabonare. Dezabonarea șterge complet
          adresa și toate alertele asociate.
        </li>
        <li>
          <strong>Protecție împotriva abuzurilor</strong>: numărăm cererile din formular per adresă IP
          (transformată într-un cod criptografic, ținut doar într-o memorie temporară și șters automat
          după cel mult o oră — la fel ca la clickurile spre magazine) și trimitem cel mult 3 emailuri
          de confirmare pe zi către aceeași adresă de email.
        </li>
        <li>
          <strong>Trimiterea emailurilor</strong> se face prin{' '}
          {COMPANY.emailProvider ?? 'furnizorul nostru de servicii de email'}, care acționează ca
          persoană împuternicită (prelucrează adresa și conținutul emailului doar ca să-l livreze, în baza
          unui contract de prelucrare a datelor).
        </li>
      </ul>
      <p className="text-xs text-muted">Recomandare: verificare de către un jurist (secțiunea despre alertele pe email).</p>

      <h2>Linkurile spre magazine</h2>
      <p>
        Când dai click pe o ofertă, treci prin rețeaua de afiliere (Profitshare sau 2Performant)
        și ajungi pe site-ul magazinului. Rețeaua și magazinul pot seta propriile cookie-uri,
        conform politicilor lor; nu controlăm aceste cookie-uri. Din partea rețelei primim doar
        date despre comenzi, fără datele tale personale: ID comandă, valoare comision, status, codul de click.
      </p>
      <p>
        Ca să nu trimitem rețelelor clickuri false generate de programe automate (roboți), înainte de
        redirecționare browserul tău cere de la site un cod de verificare temporar, valabil câteva
        minute, care nu conține date despre tine și nu se salvează în cookie-uri. Tot pentru asta
        numărăm câte cereri de acest fel vin de la aceeași adresă IP: adresa este transformată
        într-un cod criptografic (nu se păstrează în clar), ținut doar într-o memorie temporară și
        șters automat după cel mult o oră. Nu o salvăm în baza de date și nu o folosim în alt scop
        (temei: interes legitim — securitatea site-ului și corectitudinea statisticilor de afiliere).
      </p>

      <h2>Cui transmitem date</h2>
      <ul>
        <li>Furnizorul de găzduire a serverului, {COMPANY.hosting ?? <Todo>furnizor găzduire + țara serverului</Todo>}.</li>
        <li>Cloudflare, Inc., prin care trece traficul site-ului (protecție și livrare rapidă): adresa IP,
          pagina cerută și browserul. Cloudflare poate transfera date în SUA, în baza Cadrului UE–SUA
          privind protecția datelor.</li>
        <li>Google Ireland Ltd. (Analytics, Ads), doar cu consimțământul tău. Google poate transfera
          date în SUA, în baza Cadrului UE–SUA privind protecția datelor.</li>
        <li>Rețelele de afiliere Profitshare și 2Performant (codul de click; bannerele Profitshare,
          doar cu consimțământ).</li>
        <li>Telegram, dacă folosești alertele pe Telegram (mesajele trec prin serverele Telegram).</li>
        <li>{COMPANY.emailProvider ?? 'Furnizorul nostru de servicii de email'}, dacă folosești alertele
          pe email (împuternicit: livrează emailurile).</li>
      </ul>

      <h2>Cât timp păstrăm datele</h2>
      <ul>
        <li>Alegerea despre cookie-uri: 6 luni, apoi te întrebăm din nou (la fel dacă actualizăm
          politica). Până la noua alegere, identificatorul clickului pe reclamă se șterge, ca la
          retragerea acordului.</li>
        <li>Identificatorul clickului pe reclamă (<code>gclid</code> etc.): 90 de zile de la clickul pe
          reclamă — atât în cookie-ul <code>se_gclid</code>, cât și pe serverul nostru, unde îl ștergem
          automat, indiferent dacă a dus la o comandă (codul de click rămâne, fără identificatorul Google).
          Îl ștergem mai devreme dacă îți retragi acordul sau dacă acordul expiră.</li>
        <li>Datele Google Analytics: 14 luni (setarea din Google Analytics).</li>
        <li>Apartenența la listele de reclame personalizate: cel mult 540 de zile (aproximativ 18 luni) de la ultima vizită care
          te-a inclus (setarea listelor din Google Analytics).</li>
        <li>Alertele Telegram: până le oprești (comanda <code>/sterge</code>) sau ne ceri ștergerea, dar
          cel mult 12 luni fără nicio activitate (anunț, re-armare sau schimbare de prag).</li>
        <li>Alertele pe email: cererile neconfirmate, 7 zile; alertele confirmate rămân active și după
          un anunț (te anunțăm din nou la următoarea scădere sub prag), până le oprești sau te dezabonezi,
          dar cel mult 12 luni fără nicio activitate (anunț, re-armare sau schimbare de prag) — apoi le
          ștergem automat; adresa de email, până te dezabonezi sau până trec 90 de zile fără nicio
          alertă și fără niciun email de la noi. La dezabonare ștergem imediat adresa și toate alertele.</li>
        <li>Jurnalele tehnice: cât e necesar pentru securitate, de regulă câteva săptămâni.</li>
      </ul>

      <h2>Drepturile tale</h2>
      <p>
        Ai dreptul de acces, rectificare, ștergere, restricționare, portabilitate și opoziție,
        precum și dreptul de a-ți retrage oricând consimțământul, din{' '}
        <Link href="/cookies">Setări cookies</Link> (linkul din subsolul fiecărei pagini). Ne poți
        scrie la adresa de mai sus. Ai și dreptul de a depune o plângere la Autoritatea Națională de
        Supraveghere a Prelucrării Datelor cu Caracter Personal (
        <a href="https://www.dataprotection.ro" rel="noopener" target="_blank">dataprotection.ro</a>).
      </p>
    </LegalPage>
  )
}
