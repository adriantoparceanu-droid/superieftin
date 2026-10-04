import Link from 'next/link'
import { REAL_DISCOUNT_PCT } from '@/lib/discount'

// Bucățile comune ale paginilor de listă (/c/, /t/, /cautare, /reduceri-reale/…), după macheta
// direcției B (secțiunea „2. Pagina de categorie”). Doar prezentare, pe tokeni (corecte și în
// modul întunecat).

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

// Antetul listei: fir de navigare, titlu Archivo, rândul de cifre (copii) sub el
export function ListingHeader({ crumbs, title, children, className = '' }: {
  crumbs: Crumb[]
  title: React.ReactNode
  children?: React.ReactNode
  className?: string
}) {
  return (
    <header className={`pb-3 ${className}`}>
      <Crumbs items={crumbs} />
      <h1 className="mt-1.5 text-[25px] font-extrabold leading-[1.1] text-ink lg:text-[30px]">{title}</h1>
      {children && <div className="mt-1 text-[13px] text-ink-3 lg:text-sm">{children}</div>}
    </header>
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

// Nota de metodă („.method”): definiția reducerii reale, scurt. Textul implicit e cel aprobat
// pentru liste; paginile cu text propriu (landing-urile de reclame) îl trimit ca `children`.
export function MethodNote({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return (
    <div className={`flex items-start gap-2.5 rounded-[10px] bg-surface px-3 py-2.5 text-[12.5px] leading-snug text-ink-2 ring-1 ring-inset ring-line ${className}`}>
      <InfoIcon className="mt-px h-[18px] w-[18px] shrink-0 text-red-ink" />
      <p>
        {children ?? (
          <>
            „Reducere reală” = preț de azi cu cel puțin {REAL_DISCOUNT_PCT}% sub mediana prețurilor din ultimele
            30 de zile, nu față de „prețul vechi” al magazinului.{' '}
            <Link href="/ghiduri/metodologie" className="font-semibold text-ink underline underline-offset-2 hover:text-red-ink">
              Cum calculăm
            </Link>
          </>
        )}
      </p>
    </div>
  )
}

// Rândul de deasupra listei: „412 produse” · (dreapta) ceva opțional
export function ListInfo({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2 text-[12.5px] text-ink-3 lg:text-sm" aria-live="polite">
      <p className="tabular-nums">{children}</p>
      {aside && <div className="min-w-0">{aside}</div>}
    </div>
  )
}

// Starea goală (fără produse): iconiță discretă + mesaj + acțiuni
export function EmptyState({ title, children }: { title: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-surface px-5 py-10 text-center shadow-card ring-1 ring-inset ring-line/60">
      <svg viewBox="0 0 24 24" aria-hidden="true" className="mx-auto h-10 w-10 text-line-2" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
        <circle cx="11" cy="11" r="6.5" />
        <path d="m20 20-4.2-4.2" />
      </svg>
      <p className="mt-3 text-[15px] font-semibold text-ink">{title}</p>
      {children && <div className="mt-1.5 text-sm text-ink-3">{children}</div>}
    </div>
  )
}
