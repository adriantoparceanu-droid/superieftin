const BENEFITS = [
  { icon: '✓', title: 'Prețuri verificate zilnic', text: 'Sincronizăm ofertele în fiecare zi' },
  { icon: '📊', title: 'Istoric 30 de zile', text: 'Vezi evoluția reală a prețului' },
  { icon: '🧮', title: 'Reduceri validate matematic', text: 'Comparate cu mediana, nu cu prețul „vechi"' },
  { icon: '🔗', title: 'Acces direct la magazin', text: 'Cumperi de la retailer, fără intermediari' },
]

// Echivalentul barei „free shipping / money back" din Porto, adaptat la comparator
export function BenefitsBar() {
  return (
    <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
      {BENEFITS.map((b) => (
        <div key={b.title} className="flex items-start gap-3 bg-surface border border-line rounded-xl px-4 py-3">
          <span className="text-xl leading-none mt-0.5">{b.icon}</span>
          <div>
            <p className="text-sm font-semibold text-[var(--color-text)] leading-tight">{b.title}</p>
            <p className="text-xs text-muted mt-0.5">{b.text}</p>
          </div>
        </div>
      ))}
    </section>
  )
}
