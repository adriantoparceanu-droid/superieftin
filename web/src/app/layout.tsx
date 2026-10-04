import type { Metadata } from 'next'
import { Archivo, Inter } from 'next/font/google'
import './globals.css'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { GoogleAnalytics } from '@/components/analytics/GoogleAnalytics'
import { CookieBanner } from '@/components/consent/CookieBanner'
import { AdClickCapture } from '@/components/consent/AdClickCapture'
import { organizationLd, websiteLd, ldScript } from '@/lib/seo/jsonld'

// Fonturile redesignului (design §3): Archivo variabil pentru titluri, prețuri și verdicte —
// cu axa de lățime (`wdth`), ca să-l putem condensa din CSS (font-stretch: 84–92%) fără un
// al doilea font; Inter pentru text. `latin-ext` = ă, â, î, ș, ț corecte (virgulă dedesubt).
// Fără `weight`: un font variabil aduce toată plaja de greutăți într-un singur fișier.
const archivo = Archivo({
  subsets: ['latin', 'latin-ext'],
  axes: ['wdth'],
  variable: '--ff-archivo',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  variable: '--ff-inter',
  display: 'swap',
})

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.superieftin.ro'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  other: {
    profitshareid: '7b0fb694429c6ff955cbb90f718f6502',
  },
  title: {
    default: 'SuperIeftin.ro — Reduceri reale pe piața din România',
    template: '%s | superieftin.ro',
  },
  description:
    'Comparăm prețurile și păstrăm istoricul ca să știi când e ofertă adevărată. Urmărim oferte de la mai multe magazine online din România.',
  openGraph: {
    type: 'website',
    locale: 'ro_RO',
    siteName: 'superieftin.ro',
  },
  // FARA `robots` si `alternates.canonical` aici (raport SEO 2026-10-04, A1): ce e in layout se
  // mosteneste de orice pagina fara metadata proprie — 404-urile primeau „index, follow” langa
  // „noindex” si canonical = homepage. Fiecare pagina indexabila isi declara canonical-ul ei.
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro" className={`${archivo.variable} ${inter.variable}`}>
      <GoogleAnalytics />
      {/* Fundalul și culoarea textului vin din tokeni (globals.css → body), inclusiv modul întunecat */}
      <body className="min-h-screen antialiased">
        {/* Entitatea site-ului (Organization + WebSite cu cautare), aceeasi pe toate paginile —
            ghidurile si produsele trimit la ea prin @id (lib/seo/jsonld.ts) */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldScript(organizationLd()) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldScript(websiteLd()) }} />
        <Header />
        <main className="max-w-7xl mx-auto px-4 py-6">
          {children}
        </main>
        <Footer />
        <CookieBanner />
        <AdClickCapture />
      </body>
    </html>
  )
}
