import type { Metadata } from 'next'

// Tot /admin (inclusiv login) e privat: noindex, nofollow. Inainte venea „index, follow” din
// layout-ul radacina; acum layout-ul radacina nu mai seteaza robots (raport SEO, A1).
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

// Adminul rămâne mereu LUMINOS (redesign, mod întunecat): paginile lui au multe `bg-white` /
// culori scrise de mână, care în modul întunecat ar da text deschis pe fundal alb. `data-theme`
// re-declară paleta luminoasă pentru tot subarborele (globals.css), iar `text-ink`/`bg-page`
// reiau culorile pe acest element (altfel s-ar moșteni cele întunecate de pe <body>).
export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-theme="light" className="bg-page text-ink">
      {children}
    </div>
  )
}
