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
export default function CookiesPage() {
  return (
    <LegalPage title="Politica de cookies" updated="26 septembrie 2026">
      <p>
        Cookie-urile sunt fișiere mici salvate de browser. Folosim doar cookie-urile necesare,
        iar pe cele de analiză și publicitate numai dacă ești de acord.
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
            <td>Identificator click reclamă (<code>gclid</code>, <code>gbraid</code>, <code>wbraid</code>)</td>
            <td>Publicitate</td>
            <td>Google Ads: arată dacă o vizită venită dintr-o reclamă a dus la o comandă</td>
            <td>90 de zile</td>
          </tr>
        </tbody>
      </table>

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
