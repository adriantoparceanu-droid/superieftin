import Link from 'next/link'

// Bucăți comune ale paginilor (firul de navigare, iconița de informare), după macheta direcției B.
// Doar prezentare, pe tokeni (corecte și în modul întunecat).

export interface Crumb { label: string; href?: string }

// Firul de navigare: „Acasă › Telefoane & Accesorii › Telefoane mobile”
export function Crumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-[13px] text-ink-3">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
        {items.map((c, i) => (
          <li key={i} className="flex items-center gap-1.5 min-w-0">
            {i > 0 && <span aria-hidden="true" className="text-line-2">›</span>}
            {c.href ? (
              <Link href={c.href} className="hover:text-ink hover:underline underline-offset-2 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink">
                {c.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-ink-2 truncate">{c.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

export function InfoIcon({ className = 'w-[18px] h-[18px]' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5M12 7.6v.1" />
    </svg>
  )
}
