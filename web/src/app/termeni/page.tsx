import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage, Todo } from '@/components/LegalPage'
import { COMPANY } from '@/lib/company'

export const metadata: Metadata = {
  title: 'Termeni și condiții',
  description: 'Condițiile de utilizare a site-ului superieftin.ro.',
  alternates: { canonical: '/termeni' },
}

// Text redactat fara jurist — recomandat sa fie verificat inainte de lansarea reclamelor.
// Sectiunea 7 completata pe 3 oct 2026 (reclame personalizate) — de verificat de jurist inainte de deploy.
export default function TermeniPage() {
  return (
    <LegalPage title="Termeni și condiții" updated="3 octombrie 2026">
      <h2>1. Despre serviciu</h2>
      <p>
        superieftin.ro, operat de {COMPANY.name ?? <Todo>denumire firmă</Todo>} (CUI{' '}
        {COMPANY.cui ?? <Todo>CUI</Todo>}), este un serviciu gratuit de comparare a prețurilor.
        Nu vindem produse și nu suntem parte în contractul dintre tine și magazin.
      </p>

      <h2>2. Prețuri și informații despre produse</h2>
      <ul>
        <li>Prețurile, stocul și descrierile sunt preluate periodic de la magazine și pot fi
          întârziate față de site-ul magazinului.</li>
        <li>Prețul, stocul și condițiile valabile sunt cele afișate de magazin în momentul comenzii.</li>
        <li>Verdictul „reducere reală” e un calcul statistic (preț actual comparat cu mediana
          ultimelor 30 de zile), nu o garanție că prețul nu va scădea mai mult.
          Metoda e descrisă pe pagina <Link href="/despre">Despre noi</Link>.</li>
      </ul>

      <h2>3. Linkuri de afiliere</h2>
      <p>
        Linkurile spre magazine sunt linkuri de afiliere. Dacă faci o comandă după un click,
        putem primi un comision de la magazin. Prețul pentru tine nu se schimbă.
      </p>

      <h2>4. Alerte de preț</h2>
      <p>
        Alertele pe Telegram sunt gratuite și oferite „ca atare”. Nu garantăm livrarea fiecărei
        alerte în timp util. Le poți opri oricând cu comanda <code>/sterge</code>.
      </p>

      <h2>5. Proprietate intelectuală</h2>
      <p>
        Numele și logourile magazinelor și ale produselor aparțin proprietarilor lor. Structura
        site-ului, textele proprii și calculele de preț aparțin operatorului superieftin.ro.
      </p>

      <h2>6. Răspundere</h2>
      <p>
        Depunem toate eforturile ca informațiile să fie corecte, dar nu răspundem pentru erori
        preluate de la magazine, pentru indisponibilitatea temporară a site-ului sau pentru
        relația ta cu magazinul (livrare, garanție, retur).
      </p>

      <h2>7. Date personale și cookies</h2>
      <p>
        Vezi <Link href="/confidentialitate">Politica de confidențialitate</Link> și{' '}
        <Link href="/cookies">Politica de cookies</Link>.
      </p>
      <p>
        Analiza (Google Analytics) și publicitatea (Google Ads) funcționează numai cu acordul tău, dat
        din bannerul de cookies. Categoria „Publicitate” include și reclamele personalizate
        (remarketing): dacă ai văzut un produs pe site, Google îți poate arăta din nou reclamele noastre,
        timp de cel mult 540 de zile (aproximativ 18 luni). Îți poți schimba oricând alegerea din „Setări cookies”, în subsolul
        fiecărei pagini. Detaliile (ce date, cât timp, cui le transmitem) sunt în cele două politici de mai sus.
      </p>

      <h2>8. Modificări și legea aplicabilă</h2>
      <p>
        Putem actualiza acești termeni; versiunea curentă e mereu pe această pagină. Se aplică
        legea română.
      </p>
    </LegalPage>
  )
}
