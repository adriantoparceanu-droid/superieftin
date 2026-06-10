import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import { Header } from '@/components/Header'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist-sans' })

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
    <html lang="ro" className={geist.variable}>
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        <Header />
        <main className="max-w-6xl mx-auto px-4 py-6">
          {children}
        </main>
        <footer className="mt-12 border-t border-gray-100 bg-white">
          <div className="max-w-6xl mx-auto px-4 py-6 text-sm text-gray-400 flex flex-col sm:flex-row justify-between gap-2">
            <p>© {new Date().getFullYear()} superieftin.ro — Comparator de prețuri pentru România</p>
            <p>
              Prețurile includ linkuri de afiliere. Ultima actualizare: în timp real.
            </p>
          </div>
        </footer>
      </body>
    </html>
  )
}
