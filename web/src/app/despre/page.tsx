import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage, Todo } from '@/components/LegalPage'
import { COMPANY } from '@/lib/company'

export const metadata: Metadata = {
  title: 'Despre noi — observatorul reducerilor reale',
  description:
    'Cum funcționează superieftin.ro, observatorul reducerilor reale din România: urmărim zilnic prețurile, calculăm mediana ultimelor 30 de zile, marcăm doar reducerile reale și publicăm lunar indicele prețurilor.',
  alternates: { canonical: '/despre' },
}

export default function DesprePage() {
  return (
    <LegalPage title="Despre superieftin.ro">
      <p>
        superieftin.ro este observatorul reducerilor reale din România: măsurăm zilnic prețurile din
        magazinele online și spunem, cu date, dacă o „reducere” e reală sau doar un preț vechi umflat.
        Comparatorul de prețuri și linkurile spre magazine pornesc de la această analiză.
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

      {/* Secțiunea observatorului (repoziționarea din 21 oct. 2026). Rezumată și în lib/seo/llms.ts
          (buildLlmsFull) — dacă schimbi textul aici, actualizează-l și acolo. */}
      <h2>Observatorul reducerilor reale</h2>
      <p>
        Pe lângă pagina fiecărui produs, publicăm ce arată datele adunate la nivel de categorie. Toate
        cifrele sunt calculate automat din prețurile înregistrate, cu aceeași metodă pentru toate magazinele;
        nu scriem prețuri sau procente de mână.
      </p>
      <ul>
        <li>
          <Link href="/indice">Indicele prețurilor</Link>: în fiecare lună, cum s-a schimbat prețul tipic al
          acelorași produse (un coș stabil) față de luna anterioară, pe categorii. O ediție publicată nu se mai
          modifică; eventualele corecții apar ca notă.
        </li>
        <li>
          <Link href="/cand-sa-cumperi">Când să cumperi</Link>: pentru categoriile cu destule produse urmărite, cât
          de des au apărut reduceri reale și cât au durat. Descriem doar perioada urmărită — nu estimăm prețurile
          viitoare și nu vorbim de tipare anuale înainte să avem un an de date.
        </li>
        <li>
          <Link href="/black-friday-2026">Black Friday 2026</Link>: din 1 noiembrie măsurăm zilnic câte dintre
          reducerile din perioada Black Friday sunt reale, față de mediana prețurilor de dinainte de 1 noiembrie.
        </li>
      </ul>
      <p>
        Categoria Sănătate & Naturale nu intră în paginile observatorului.
      </p>

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
