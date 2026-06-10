import type { Metadata } from 'next'
import { Archivo_Black, Instrument_Sans } from 'next/font/google'
import './globals.css'
import { Header } from '@/components/Header'

const archivoBlack = Archivo_Black({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-archivo-black',
  display: 'swap',
})

const instrumentSans = Instrument_Sans({
  weight: ['400', '600'],
  subsets: ['latin'],
  variable: '--font-instrument-sans',
  display: 'swap',
})

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://superieftin.ro'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'SuperIeftin.ro — Reduceri reale pe piața din România',
    template: '%s | superieftin.ro',
  },
  description:
    'Comparăm prețurile și păstrăm istoricul ca să știi când e ofertă adevărată. Monitorizăm eMAG, Altex și alte magazine.',
  openGraph: {
    type: 'website',
    locale: 'ro_RO',
    siteName: 'superieftin.ro',
  },
  robots: { index: true, follow: true },
  alternates: { canonical: SITE_URL },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro" className={`${archivoBlack.variable} ${instrumentSans.variable}`}>
      <body className="min-h-screen antialiased" style={{ background: 'var(--color-page)', color: 'var(--color-text)' }}>
        <Header />
        <main className="max-w-6xl mx-auto px-4 py-6">
          {children}
        </main>
        <footer className="mt-12 border-t border-line bg-surface">
          <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col gap-3">
            <p className="text-xs text-muted">
              superieftin.ro folosește linkuri de afiliere. Dacă cumperi prin linkurile noastre,
              primim un comision mic din partea retailerului, fără cost suplimentar pentru tine.
              Prețurile și reducerile sunt verificate independent.
            </p>
            <p className="text-xs text-muted">
              © {new Date().getFullYear()} superieftin.ro — Comparator de prețuri pentru România
            </p>
          </div>
        </footer>
      </body>
    </html>
  )
}
