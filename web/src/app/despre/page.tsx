import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage, Todo } from '@/components/LegalPage'
import { COMPANY } from '@/lib/company'

export const metadata: Metadata = {
  title: 'Despre noi — cum verificăm reducerile',
  description:
    'Cum funcționează superieftin.ro: urmărim zilnic prețurile, calculăm mediana ultimelor 30 de zile și marcăm doar reducerile reale.',
  alternates: { canonical: '/despre' },
}

export default function DesprePage() {
  return (
    <LegalPage title="Despre superieftin.ro">
      <p>
        superieftin.ro este un comparator de prețuri pentru magazinele online din România.
        Scopul lui e simplu: să vezi dacă o „reducere” e reală sau doar un preț vechi umflat.
      </p>

      <h2>Cum verificăm o reducere</h2>
      <ul>
        <li>Preluăm zilnic prețurile produselor de la magazinele partenere și le păstrăm istoricul.</li>
        <li>
          Pentru fiecare ofertă calculăm <strong>mediana 30 de zile</strong>: prețul „din mijloc” al
          ultimelor 30 de zile. Spre deosebire de o medie simplă, mediana e foarte puțin
          influențată de un preț urcat artificial pentru câteva zile chiar înainte de o promoție.
        </li>
        <li>
          Comparăm prețul de azi cu mediana. Marcăm ca reducere doar produsele care sunt cu cel
          puțin <strong>5% sub mediana 30 de zile</strong> — nu ne uităm la „prețul vechi” afișat de magazin.
        </li>
        <li>Pe pagina fiecărui produs vezi graficul de preț și mediana, ca să verifici singur.</li>
      </ul>

      <h2>Cum câștigăm bani</h2>
      <p>
        Linkurile spre magazine sunt linkuri de afiliere (prin rețelele Profitshare și
        2Performant). Dacă cumperi după ce ai dat click pe un link de pe site, magazinul ne
        plătește un comision mic. <strong>Prețul pentru tine rămâne același.</strong> Comisionul nu
        influențează ce marcăm ca reducere: verdictul vine doar din istoricul de preț.
      </p>

      <h2>Cine suntem</h2>
      <p>
        superieftin.ro este operat de {COMPANY.name ?? <Todo>denumire firmă</Todo>}.
        Ne găsești pe pagina de <Link href="/contact">contact</Link>.
      </p>

      <h2>Limite</h2>
      <p>
        Prețurile se actualizează periodic, nu în timp real. Prețul final și stocul sunt cele
        afișate de magazin în momentul comenzii. Dacă observi o diferență, scrie-ne.
      </p>
    </LegalPage>
  )
}
