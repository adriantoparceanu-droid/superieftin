import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage, Todo } from '@/components/LegalPage'
import { COMPANY } from '@/lib/company'
import { RSS_ALTERNATE_TYPES } from '@/lib/guides/rss'

// Rezumat si in lib/seo/llms.ts (buildLlmsFull, „Despre”) — daca schimbi textul aici, actualizeaza-l si acolo.
export const metadata: Metadata = {
  title: 'Despre noi — blog de recomandări de produse',
  description:
    'Ce este superieftin.ro: un blog de recomandări de produse din România. Cum alegem produsele, cine scrie și verifică articolele și cum ne finanțăm (linkuri de afiliere).',
  alternates: { canonical: '/despre', types: RSS_ALTERNATE_TYPES },
}

export default function DesprePage() {
  return (
    <LegalPage title="Despre superieftin.ro">
      <p>
        superieftin.ro este un blog de recomandări de produse din România. Scriem articole care te ajută
        să alegi: top-uri pe buget, comparații între modele și ghiduri de alegere. Fiecare produs recomandat
        are un card cu cel mai bun preț găsit la magazinele partenere și un buton spre acel magazin.
      </p>

      <h2>Cum alegem produsele</h2>
      <ul>
        <li>Pornim de la ce caută oamenii și de la produsele pe care magazinele partenere le au în stoc.</li>
        <li>
          Urmărim zilnic, intern, prețurile magazinelor partenere, ca să nu recomandăm un produs într-un
          moment în care e mai scump decât de obicei.
        </li>
        <li>Caracteristicile tehnice le luăm din specificațiile producătorului și din fișa produsului de la magazin.</li>
        <li>Pentru fiecare produs scriem pe scurt ce face bine și ce face mai slab.</li>
      </ul>
      <p>
        Detaliile sunt în <Link href="/ghiduri/metodologie">metodologie</Link>. Toate articolele:{' '}
        <Link href="/ghiduri">Articole</Link>.
      </p>

      <h2>Cum câștigăm bani</h2>
      <p>
        Unele linkuri spre magazine sunt linkuri de afiliere (prin rețelele Profitshare și
        2Performant). Dacă cumperi după ce ai dat click pe un astfel de link, magazinul ne
        plătește un comision. <strong>Prețul pentru tine rămâne același.</strong> Comisionul nu
        decide ce produse recomandăm: butonul din card duce la magazinul partener cu cel mai bun preț găsit.
      </p>

      <h2>Cine suntem</h2>
      <p>
        superieftin.ro este operat de {COMPANY.name ?? <Todo>denumire firmă</Todo>}.
        Ne găsești pe pagina de <Link href="/contact">contact</Link>.
      </p>

      <h2>Limite</h2>
      <p>
        Prețurile se actualizează periodic, nu în timp real. Prețul final și stocul sunt cele
        afișate de magazin în momentul comenzii. Dacă observi o diferență sau o greșeală, scrie-ne.
      </p>
    </LegalPage>
  )
}
