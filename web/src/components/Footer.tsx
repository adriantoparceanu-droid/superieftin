import { CookieSettingsButton } from '@/components/consent/CookieSettingsButton'

const linkClass = 'hover:text-[var(--color-text)] underline-offset-2 hover:underline transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded'

export function Footer() {
  return (
    <footer className="mt-12 border-t border-line bg-surface">
      <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col gap-3">
        <nav aria-label="Informații" className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
          <CookieSettingsButton className={linkClass} />
        </nav>
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
  )
}
