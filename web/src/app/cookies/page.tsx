import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage } from '@/components/LegalPage'
import { CookieSettingsButton } from '@/components/consent/CookieSettingsButton'

export const metadata: Metadata = {
  title: 'Politica de cookies',
  description: 'Ce cookie-uri folosește superieftin.ro și cum îți schimbi alegerea.',
  alternates: { canonical: '/cookies' },
}

// Lista reflecta ce seteaza REAL site-ul. La un tag/cookie nou, actualizeaza tabelul.
// „Reclame personalizate” (3 oct 2026): text de verificat de jurist inainte de deploy; dupa deploy,
// verifica in DevTools → Application → Cookies ce cookie-uri Google apar cu bifa activa.
export default function CookiesPage() {
  return (
    <LegalPage title="Politica de cookies" updated="3 octombrie 2026">
      <p>
        Cookie-urile sunt fișiere mici salvate de browser. Folosim doar cookie-urile necesare,
        iar pe cele de analiză, publicitate și reclame personalizate numai dacă ești de acord.
      </p>

      <p>
        <CookieSettingsButton className="px-4 py-2 rounded-lg text-sm font-semibold bg-brand hover:bg-brand-dark text-white transition-colors" />
      </p>

      <h2>Cookie-uri folosite</h2>
      <table>
        <thead>
          <tr><th>Cookie</th><th>Categorie</th><th>Scop</th><th>Durată</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><code>se_consent</code></td>
            <td>Necesar</td>
            <td>Ține minte alegerea ta despre cookie-uri</td>
            <td>6 luni</td>
          </tr>
          <tr>
            <td><code>_ga</code>, <code>_ga_*</code></td>
            <td>Analiză</td>
            <td>Google Analytics 4: deosebește vizitatorii pentru statistici agregate</td>
            <td>până la 2 ani</td>
          </tr>
          <tr>
            <td><code>se_gclid</code></td>
            <td>Publicitate</td>
            <td>
              Conține identificatorul clickului pe reclama Google cu care ai ajuns pe site
              (<code>gclid</code>, <code>gbraid</code> sau <code>wbraid</code>) și momentul în care ai ajuns.
              Scopul: dacă mergi apoi spre un magazin și cumperi ceva, să putem lega comanda de reclama
              care ți-a adus vizita, ca să știm ce reclame aduc cumpărături reale. Se scrie numai dacă accepți
              „Publicitate” și se șterge dacă îți retragi acordul (detalii mai jos).
            </td>
            <td>90 de zile de la sosirea pe site</td>
          </tr>
          <tr>
            <td>Cookie-uri Profitshare (ex. <code>PROFITSHARESESSID</code>)</td>
            <td>Publicitate</td>
            <td>
              Bannerele de afiliere de pe prima pagină (doar pe desktop) sunt servite de Profitshare,
              care își setează propriile cookie-uri. Bannerele se încarcă numai dacă accepți categoria
              „Publicitate”.
            </td>
            <td>stabilită de Profitshare (de regulă, sesiunea)</td>
          </tr>
          <tr>
            <td>Cookie-uri Google de publicitate, pe domeniile Google (ex. <code>doubleclick.net</code>)</td>
            <td>Reclame personalizate</td>
            <td>
              Google Analytics anunță Google Ads că ai văzut pagini de produs pe superieftin.ro (și dacă ai
              mers spre un magazin), iar Google te poate include, pentru cel mult 30 de zile, într-o listă de
              vizitatori cărora le arătăm reclamele noastre, de exemplu când cauți din nou pe Google. Google
              recunoaște browserul prin cookie-urile proprii. Se întâmplă numai dacă accepți atât „Publicitate”,
              cât și „Reclame personalizate”.
            </td>
            <td>stabilită de Google (lista noastră: max. 30 de zile)</td>
          </tr>
        </tbody>
      </table>

      <h2>Identificatorul reclamei Google: ce se întâmplă, pas cu pas</h2>
      <ul>
        <li>
          <strong>Înainte să alegi:</strong> nu salvăm nimic pe dispozitivul tău — nici cookie, nici
          altă formă de stocare a browserului (<code>sessionStorage</code>, <code>localStorage</code>).
          Identificatorul din adresa paginii rămâne doar în memoria paginii deschise și se pierde dacă
          reîncarci pagina sau închizi fila. Dacă accepți „Publicitate” între timp, abia atunci scriem
          cookie-ul <code>se_gclid</code>.
        </li>
        <li>
          <strong>Dacă refuzi:</strong> nu păstrăm identificatorul, în afara jurnalelor tehnice ale
          serverului și ale Cloudflare, în care adresa completă a paginii (inclusiv identificatorul din
          ea) poate apărea. Aceste jurnale se păstrează de regulă câteva săptămâni, doar pentru
          securitate; nu le folosim pentru reclame și nu le trimitem la Google.
        </li>
        <li>
          <strong>Dacă îți retragi acordul</strong> (din „Setări cookies”), dacă acordul expiră (după
          6 luni) sau dacă actualizăm politica și îți cerem din nou acordul: ștergem cookie-ul{' '}
          <code>se_gclid</code> de pe dispozitiv și trimitem serverului nostru, o singură dată, doar
          identificatorul (fără alte date), ca să-l ștergem și din clickurile spre magazine deja
          înregistrate. După aceea nu mai trimitem la Google conversii pentru acele clickuri.
          Conversiile trimise înainte, cât aveai acordul, rămân la Google.
        </li>
      </ul>
      <p>
        Ce se întâmplă pe serverul nostru și ce ajunge la Google este descris în{' '}
        <Link href="/confidentialitate">Politica de confidențialitate</Link>.
      </p>

      <h2>Reclame personalizate (remarketing), pe scurt</h2>
      <ul>
        <li>
          <strong>Ce înseamnă:</strong> dacă ai văzut un produs pe superieftin.ro, îți putem arăta din nou
          reclama noastră în Google, ca să revii la comparația de prețuri. Nu folosim Google Signals și
          nu trimitem la Google email, telefon sau adresa IP.
        </li>
        <li>
          <strong>Doar cu acord separat:</strong> bifa „Reclame personalizate” e implicit debifată și
          funcționează numai împreună cu „Publicitate”. Fără ea, Google Analytics nu te adaugă în listele
          noastre de reclame.
        </li>
        <li>
          <strong>Retragere:</strong> o debifezi oricând din „Setări cookies”. De atunci nu mai ești adăugat
          în liste; apartenența deja înregistrată expiră singură după cel mult 30 de zile de la ultima
          vizită. Google oferă și setări proprii pentru reclame, la{' '}
          <a href="https://myadcenter.google.com" rel="noopener" target="_blank">myadcenter.google.com</a>.
        </li>
      </ul>

      <h2>Cookie-uri ale altor site-uri</h2>
      <p>
        Când dai click pe o ofertă, treci prin Profitshare sau 2Performant spre magazin. Aceste
        site-uri își setează propriile cookie-uri (de exemplu, ca să atribuie comanda), conform
        politicilor lor. Le poți gestiona din setările browserului sau de pe site-urile respective.
      </p>

      <h2>Cum îți schimbi alegerea</h2>
      <p>
        Folosește butonul „Setări cookies” de mai sus sau din subsolul oricărei pagini. Poți
        șterge oricând cookie-urile din setările browserului. Detalii despre datele prelucrate
        găsești în <Link href="/confidentialitate">Politica de confidențialitate</Link>.
      </p>
    </LegalPage>
  )
}
