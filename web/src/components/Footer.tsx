import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { CookieSettingsButton } from '@/components/consent/CookieSettingsButton'

// Subsolul blogului (varianta A „Revista”): pe tokeni (deschis / întunecat ca restul paginii),
// cu separatorul negru gros de 3px deasupra. Paginile de încredere — Google le cere vizibile pe
// orice pagină a unui site de afiliere — + nota de afiliere.
const FOOTER_LINKS: [string, string][] = [
  ['/ghiduri', 'Articole'],
  ['/ghiduri/metodologie', 'Cum lucrăm'],
  ['/despre', 'Despre noi'],
  ['/contact', 'Contact'],
  ['/confidentialitate', 'Confidențialitate'],
  ['/termeni', 'Termeni'],
  ['/cookies', 'Cookies'],
]

const linkClass =
  'text-ink underline-offset-2 hover:underline hover:text-red-ink rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink'

export function Footer() {
  return (
    <footer className="mt-16 text-ink-3 text-[13px]">
      <div className="max-w-7xl mx-auto px-4">
        <div className="border-t-[3px] border-ink pt-6 pb-8">
          <Logo wordmark />
          <p className="mt-2.5 max-w-xl leading-relaxed text-ink-2">
            Recomandări de cumpărare: top-uri pe buget, comparații și ghiduri de alegere, scrise și verificate de echipa noastră.
          </p>

          <nav
            aria-label="Informații"
            className="grid grid-cols-2 gap-x-3 gap-y-2 my-4 sm:flex sm:flex-wrap sm:gap-x-6"
          >
            {FOOTER_LINKS.map(([href, label]) => (
              <Link key={href} href={href} className={linkClass}>{label}</Link>
            ))}
          </nav>

          <CookieSettingsButton className="border border-line-2 text-ink rounded-lg px-3 py-2 text-[13px] hover:bg-surface-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink" />

          <p className="mt-4 max-w-3xl text-xs leading-normal">
            superieftin.ro folosește linkuri de afiliere. Dacă cumperi prin linkurile noastre,
            primim un comision mic din partea magazinului, fără cost suplimentar pentru tine.
          </p>
          <p className="mt-2.5 text-xs">
            © {new Date().getFullYear()} superieftin.ro — recomandări de cumpărare
          </p>
        </div>
      </div>
    </footer>
  )
}
