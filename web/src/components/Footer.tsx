import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { CookieSettingsButton } from '@/components/consent/CookieSettingsButton'

// Subsolul (redesign, macheta „.ft”): cărbune în ambele teme, ca antetul.
// Paginile de incredere — Google le cere vizibile pe orice pagina a unui site de afiliere
// + legaturi interne spre articole si metodologie (raport SEO 2026-10-04, A8; blog din 20 nov. 2026)
const FOOTER_LINKS: [string, string][] = [
  ['/ghiduri', 'Articole'],
  ['/ghiduri/metodologie', 'Cum alegem produsele'],
  ['/alerte/gestionare', 'Alertele mele'],
  ['/despre', 'Despre noi'],
  ['/contact', 'Contact'],
  ['/confidentialitate', 'Confidențialitate'],
  ['/termeni', 'Termeni'],
  ['/cookies', 'Cookies'],
]

const linkClass =
  'text-head-ink underline-offset-2 hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-on-head'

export function Footer() {
  return (
    <footer className="mt-12 bg-head text-head-ink-2 text-[13px]">
      <div className="max-w-7xl mx-auto px-4 pt-6 pb-7">
        <Logo onDark />
        <p className="mt-2.5 max-w-xl leading-relaxed">
          Recomandări de produse, cu cel mai bun preț găsit la magazinele partenere. Unele linkuri sunt de afiliere.
        </p>

        <nav
          aria-label="Informații"
          className="grid grid-cols-2 gap-x-3 gap-y-2 my-4 sm:flex sm:flex-wrap sm:gap-x-6"
        >
          {FOOTER_LINKS.map(([href, label]) => (
            <Link key={href} href={href} className={linkClass}>{label}</Link>
          ))}
        </nav>

        <CookieSettingsButton className="border border-[#3A3F49] text-head-ink rounded-lg px-3 py-2 text-[13px] hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-on-head" />

        <p className="mt-4 text-xs leading-normal">
          superieftin.ro folosește linkuri de afiliere. Dacă cumperi prin linkurile noastre,
          primim un comision mic din partea retailerului, fără cost suplimentar pentru tine.
          Prețurile și reducerile sunt verificate independent.
        </p>
        <p className="mt-2.5 text-xs">
          © {new Date().getFullYear()} superieftin.ro — Observatorul reducerilor reale din România
        </p>
      </div>
    </footer>
  )
}
