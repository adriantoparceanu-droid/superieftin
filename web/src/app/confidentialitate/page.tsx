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
export default function ConfidentialitatePage() {
  const privacyEmail = COMPANY.privacyEmail ?? COMPANY.email
  return (
    <LegalPage title="Politica de confidențialitate" updated="26 septembrie 2026">
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
              <strong>Google Ads</strong>: identificatorul clickului pe reclamă (<code>gclid</code>,{' '}
              <code>gbraid</code>, <code>wbraid</code>) și, dacă ai cumpărat, valoarea comisionului
            </td>
            <td>Măsurăm dacă reclamele noastre aduc cumpărături reale</td>
            <td>Consimțământ (categoria „Publicitate”)</td>
          </tr>
          <tr>
            <td><strong>Bannere de afiliere Profitshare</strong> (doar pe desktop): pagina vizitată,
              browserul, rezoluția ecranului, cookie-uri Profitshare</td>
            <td>Afișarea bannerelor partenerilor</td>
            <td>Consimțământ (categoria „Publicitate”); fără acord, bannerele nu se încarcă</td>
          </tr>
          <tr>
            <td><strong>Alerte de preț pe Telegram</strong>: ID-ul conversației, numele de utilizator și prenumele din Telegram, alertele setate</td>
            <td>Să îți trimitem alertele cerute</td>
            <td>Executarea serviciului cerut de tine</td>
          </tr>
        </tbody>
      </table>
      <p>
        Nu cerem cont, nu vindem date și nu trimitem către Google adresa de email, telefonul sau
        alte date de contact.
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
        categoria „Publicitate”, nu salvăm identificatorii clickurilor pe reclame.
      </p>

      <h2>Linkurile spre magazine</h2>
      <p>
        Când dai click pe o ofertă, treci prin rețeaua de afiliere (Profitshare sau 2Performant)
        și ajungi pe site-ul magazinului. Rețeaua și magazinul pot seta propriile cookie-uri,
        conform politicilor lor; nu controlăm aceste cookie-uri. Din partea rețelei primim doar
        date despre comenzi, fără datele tale personale: ID comandă, valoare comision, status, codul de click.
      </p>

      <h2>Cui transmitem date</h2>
      <ul>
        <li>Furnizorul de găzduire a serverului, {COMPANY.hosting ?? <Todo>furnizor găzduire + țara serverului</Todo>}.</li>
        <li>Google Ireland Ltd. (Analytics, Ads), doar cu consimțământul tău. Google poate transfera
          date în SUA, în baza Cadrului UE–SUA privind protecția datelor.</li>
        <li>Rețelele de afiliere Profitshare și 2Performant (codul de click; bannerele Profitshare,
          doar cu consimțământ).</li>
        <li>Telegram, dacă folosești alertele (mesajele trec prin serverele Telegram).</li>
      </ul>

      <h2>Cât timp păstrăm datele</h2>
      <ul>
        <li>Alegerea despre cookie-uri: 6 luni, apoi te întrebăm din nou.</li>
        <li>Identificatorul clickului pe reclamă (<code>gclid</code> etc.): cel mult 90 de zile.</li>
        <li>Datele Google Analytics: 14 luni (setarea din Google Analytics).</li>
        <li>Alertele Telegram: până le ștergi (comanda <code>/sterge</code>) sau ne ceri ștergerea.</li>
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
