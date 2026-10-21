import Link from 'next/link'
import { ldScript } from '@/lib/seo/jsonld'

// Bucățile comune ale paginilor observatorului (/indice, /cand-sa-cumperi): fraza-fapt din cap,
// cardurile de secțiune, cifrele mari, întrebările frecvente și legăturile între pagini.
// Doar prezentare, pe tokeni (corecte și în modul întunecat).

export const CARD = 'rounded-2xl bg-surface p-4 shadow-card ring-1 ring-inset ring-line/60 lg:p-5'
export const H2 = 'text-lg font-extrabold text-ink'
export const LINK = 'font-semibold text-ink underline underline-offset-2 hover:text-red-ink'

// Fraza-fapt datată, sus pe pagină: o propoziție citabilă (sursă, dată, număr de produse)
export function FactLead({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-5 max-w-3xl rounded-xl bg-surface-2 px-4 py-3 text-[15px] leading-relaxed text-ink">
      {children}
    </p>
  )
}

export function Stat({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2.5">
      <div className="font-display text-[22px] font-[850] leading-tight tabular-nums text-ink">{value}</div>
      <div className="mt-0.5 text-xs text-ink-3">{label}</div>
    </div>
  )
}

export function Badge({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center rounded-full bg-neutral-tint px-2 py-0.5 text-[11.5px] font-semibold text-ink-2">{children}</span>
}

export function JsonLd({ data }: { data: unknown }) {
  if (!data) return null
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldScript(data) }} />
}

export function Faq({ items }: { items: { q: string; a: string }[] }) {
  if (!items.length) return null
  return (
    <section aria-labelledby="intrebari-frecvente" className={`mt-6 ${CARD}`}>
      <h2 id="intrebari-frecvente" className={H2}>Întrebări frecvente</h2>
      <div className="mt-3 space-y-4">
        {items.map((f, i) => (
          <div key={i}>
            <h3 className="text-[15px] font-bold text-ink">{f.q}</h3>
            <p className="mt-1 text-[15px] leading-relaxed text-ink-2">{f.a}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

// Legăturile spre celelalte pagini ale observatorului (jos pe fiecare pagină)
export function ObservatorLinks({ current }: { current: 'indice' | 'cand' | 'bf' }) {
  const links: [string, string, string][] = [
    ['indice', '/indice', 'Indicele lunar al prețurilor'],
    ['cand', '/cand-sa-cumperi', 'Când să cumperi, pe categorii'],
    ['bf', '/black-friday-2026', 'Black Friday 2026: reduceri reale, măsurate zilnic'],
    ['metodologie', '/ghiduri/metodologie', 'Metodologia: cum calculăm reducerea reală'],
    ['reduceri', '/reduceri-reale', 'Reducerile reale de azi'],
  ]
  return (
    <nav aria-label="Observatorul reducerilor reale" className="mt-6 text-sm text-ink-2">
      <p className="font-semibold text-ink">Observatorul reducerilor reale</p>
      <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
        {links.filter(([k]) => k !== current).map(([k, href, label]) => (
          <li key={k}><Link href={href} className="underline underline-offset-2 hover:text-red-ink">{label}</Link></li>
        ))}
      </ul>
    </nav>
  )
}
