import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage } from '@/components/LegalPage'
import { OFFER_STALE_DAYS } from '@/lib/availability'
import { RSS_PATH, RSS_TITLE } from '@/lib/guides/rss'

// Metodologia articolelor (blogul de recomandari, reorganizarea din 20.11.2026). Fiecare
// afirmatie trebuie sa corespunda codului si fluxului real:
// - cardul de produs = cel mai ieftin magazin partener cu oferta disponibila si link afiliat
//   (lib/best-offer.ts → pickBestOffer); ofertele vechi se ascund dupa OFFER_STALE_DAYS (importat);
// - verificarea saptamanala = jobul guide-health din worker (produse indisponibile, pret peste
//   bugetul din titlu, articole neactualizate de mult) — doar semnaleaza, corectia o face un om;
// - autorul si verificatorul apar sub titlu si au pagina proprie (/autori/<slug>).
// Fara cifre scrise de mana si fara promisiuni.
export const metadata: Metadata = {
  title: 'Metodologie — cum alegem și verificăm recomandările',
  description:
    'Cum alegem produsele din articole, de unde vin prețurile, cine verifică fiecare articol, cum ne finanțăm și cât de des actualizăm.',
  alternates: {
    canonical: '/ghiduri/metodologie',
    types: { 'application/rss+xml': [{ url: RSS_PATH, title: RSS_TITLE }] },
  },
}

export default function MetodologiePage() {
  return (
    <LegalPage title="Metodologie: cum lucrăm la articole">
      <h2>Cum alegem produsele</h2>
      <ul>
        <li>
          Pornim de la ce caută oamenii și de la produsele pe care magazinele partenere le au efectiv
          în stoc. Nu recomandăm produse pe care nu le poți cumpăra.
        </li>
        <li>
          Urmărim zilnic, intern, prețurile magazinelor partenere. Ne uităm la cum a evoluat prețul
          unui produs în ultimele săptămâni, ca să nu recomandăm un produs într-un moment în care e
          mai scump decât de obicei. Istoricul de preț rămâne o unealtă internă de lucru.
        </li>
        <li>
          Caracteristicile tehnice (dimensiuni, capacitate, consum, compatibilitate) le luăm din
          specificațiile publicate de producător și din fișa produsului de la magazin.
        </li>
        <li>
          Pentru fiecare produs recomandat scriem pe scurt ce face bine și ce face mai slab, ca să
          poți decide singur dacă ți se potrivește.
        </li>
      </ul>

      <h2>Prețul din articol</h2>
      <p>
        Prețurile nu sunt scrise de mână. Cardul fiecărui produs arată cel mai bun preț găsit la
        magazinele partenere, completat automat din datele noastre, și un singur buton spre acel
        magazin. Prețurile se actualizează periodic, nu în timp real: prețul final și stocul sunt cele
        afișate de magazin în momentul comenzii.
      </p>
      <p>
        O ofertă pe care n-am mai găsit-o de {OFFER_STALE_DAYS} zile la magazin nu mai apare în
        articole. Dacă niciun magazin partener nu mai are produsul, cardul scrie că e momentan
        indisponibil, fără buton.
      </p>

      <h2>Cine scrie și cine verifică</h2>
      <p>
        Ciornele se pot scrie cu ajutorul unor instrumente de inteligență artificială, pornind de la
        datele noastre. Fiecare articol este citit și verificat de un om înainte de publicare. Numele
        autorului și al celui care a verificat articolul apar sub titlu, cu link spre pagina lor, alături
        de data publicării și a ultimei actualizări.
      </p>

      <h2>Cât de des actualizăm</h2>
      <p>
        Verificăm săptămânal articolele publicate: dacă un produs recomandat nu mai e disponibil, dacă
        prețul a ieșit din bugetul din titlu sau dacă un articol n-a mai fost revizuit de mult. Când
        găsim o problemă, articolul se corectează și data actualizării se schimbă.
      </p>

      <h2>Cum ne finanțăm</h2>
      <p>
        Unele linkuri spre magazine sunt linkuri de afiliere, prin rețelele Profitshare și 2Performant.
        Dacă cumperi după ce ai dat click pe un astfel de link, magazinul ne plătește un comision.
        <strong> Prețul pentru tine rămâne același.</strong>
      </p>
      <p>
        Nu primim bani de la producători sau de la magazine pentru a recomanda un produs, iar comisionul
        nu decide ce produse intră în articol. Butonul din card duce la magazinul partener cu cel mai bun
        preț găsit, nu la cel care plătește comisionul mai mare.
      </p>

      <h2>Mai multe</h2>
      <p>
        Despre site și firma care îl operează: <Link href="/despre">Despre noi</Link>. Ai găsit o
        greșeală într-un articol? Scrie-ne pe pagina de <Link href="/contact">contact</Link>.
      </p>
    </LegalPage>
  )
}
