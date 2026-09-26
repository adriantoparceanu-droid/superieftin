import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage } from '@/components/LegalPage'
import { REAL_DISCOUNT_PCT, ABOVE_MEDIAN_PCT, FRESH_HOURS } from '@/lib/discount'
import { OFFER_STALE_DAYS } from '@/lib/availability'

// Metodologia ghidurilor. Fiecare afirmatie de aici trebuie sa corespunda codului:
// - pragurile vin din lib/discount.ts, ascunderea ofertelor din lib/availability.ts
//   (importate, nu scrise de mana, ca textul sa nu ramana in urma daca se schimba valorile);
// - ordinea ofertelor: pagina de produs le sorteaza dupa pret (queries.ts → getProductDetail),
//   listele dupa pret, reducere sau nume — niciodata dupa comision.
export const metadata: Metadata = {
  title: 'Metodologie — cum verificăm prețurile din ghiduri',
  description:
    'De unde vin prețurile, cum calculăm reducerea reală față de mediana de 30 de zile, cum scriem și verificăm ghidurile și cum câștigăm bani.',
  alternates: { canonical: '/ghiduri/metodologie' },
}

export default function MetodologiePage() {
  return (
    <LegalPage title="Metodologie: cum lucrăm la ghiduri">
      <h2>De unde vin datele</h2>
      <ul>
        <li>
          Prețurile vin din feed-urile de produse ale magazinelor (fișiere cu produse și prețuri, primite
          de regulă prin rețelele de afiliere) și din scanarea periodică a paginilor unor magazine.
        </li>
        <li>
          Fiecare preț găsit se salvează în istoricul nostru de preț. Din acest istoric calculăm
          mediana și desenăm graficul de pe pagina fiecărui produs.
        </li>
        <li>
          Prețurile se actualizează periodic, nu în timp real. Prețul final și stocul sunt cele
          afișate de magazin în momentul comenzii.
        </li>
      </ul>

      <h2>Cum calculăm reducerea reală</h2>
      <ul>
        <li>
          Pentru fiecare ofertă calculăm <strong>mediana 30 de zile</strong>: prețul „din mijloc” al
          ultimelor 30 de zile. Mediana e puțin influențată de un preț urcat pentru câteva zile
          chiar înainte de o promoție.
        </li>
        <li>
          Un preț este <strong>reducere reală</strong> dacă e cu cel puțin {REAL_DISCOUNT_PCT}% sub mediana
          30 de zile. Între {REAL_DISCOUNT_PCT}% sub și {ABOVE_MEDIAN_PCT}% peste mediană îl numim „preț în
          intervalul obișnuit”, iar peste {ABOVE_MEDIAN_PCT}% îl marcăm ca mai scump decât de obicei.
        </li>
        <li>Nu ne uităm la „prețul vechi” tăiat afișat de magazin.</li>
        <li>
          În ghiduri, o reducere reală se afișează doar dacă prețul a fost verificat în ultimele{' '}
          {FRESH_HOURS} de ore și avem cel puțin două prețuri în ultimele 30 de zile; altfel scriem
          „istoric insuficient”.
        </li>
      </ul>

      <h2>Prețurile din ghiduri nu sunt scrise de mână</h2>
      <p>
        Ofertele, prețurile, graficele și procentele de reducere din ghiduri se completează automat din
        baza noastră de date, la fiecare actualizare a paginii. Dacă prețul se schimbă după publicare,
        ghidul arată prețul nou, nu pe cel din ziua scrierii.
      </p>

      <h2>Ofertele vechi sunt ascunse</h2>
      <p>
        O ofertă pe care n-am mai găsit-o de {OFFER_STALE_DAYS} zile în niciun feed sau scanare este
        considerată fără stoc și nu mai apare pe site. Dacă un produs nu mai are nicio ofertă
        disponibilă, ghidul scrie „indisponibil momentan” în locul prețului. Ofertele revin automat
        când produsul reapare la magazin.
      </p>

      <h2>Cine scrie ghidurile</h2>
      <p>
        Ghidurile sunt semnate de echipa superieftin.ro. Ciornele se pot scrie cu ajutorul unor
        instrumente de inteligență artificială; fiecare ghid este citit și verificat de un om înainte
        de publicare, iar numele celui care l-a verificat apare sub titlu. Data publicării și data
        ultimei actualizări sunt afișate pe fiecare ghid.
      </p>

      <h2>Cum câștigăm bani</h2>
      <p>
        Linkurile spre magazine sunt linkuri de afiliere prin rețelele Profitshare și 2Performant.
        Dacă cumperi după ce ai dat click pe un astfel de link, magazinul ne plătește un comision.
        <strong> Prețul pentru tine rămâne același.</strong>
      </p>
      <p>
        Comisionul nu influențează ordinea ofertelor: pe pagina unui produs, ofertele sunt ordonate
        după preț, de la cel mai mic. Listele de produse se ordonează după preț, după reducerea față de
        mediană sau după nume. Verdictul „reducere reală” vine doar din istoricul de preț.
      </p>

      <h2>Mai multe</h2>
      <p>
        Despre site și firma care îl operează: <Link href="/despre">Despre noi</Link>. Ai găsit o
        greșeală într-un ghid? Scrie-ne pe pagina de <Link href="/contact">contact</Link>.
      </p>
    </LegalPage>
  )
}
