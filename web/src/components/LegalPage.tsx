// Cadru comun pentru paginile de incredere (Despre, Contact, Confidentialitate, Termeni,
// Cookies): titlu, data ultimei actualizari si tipografie lizibila pentru text lung.
// Nu avem pluginul Tailwind Typography, deci stilurile pentru h2/p/ul sunt definite aici.
export function LegalPage({ title, updated, children }: {
  title: string
  updated?: string   // ex. '26 septembrie 2026'
  children: React.ReactNode
}) {
  return (
    <article className="max-w-3xl mx-auto bg-surface border border-line rounded-xl p-5 sm:p-8">
      <h1 className="font-archivo text-2xl sm:text-3xl text-[var(--color-text)]">{title}</h1>
      {updated && <p className="mt-1 text-xs text-muted">Ultima actualizare: {updated}</p>}
      <div className="mt-6 space-y-4 text-sm sm:text-base leading-relaxed text-[var(--color-text)]
        [&_h2]:font-semibold [&_h2]:text-lg [&_h2]:mt-8 [&_h2]:mb-2
        [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1
        [&_a]:text-red-ink [&_a]:underline [&_a]:underline-offset-2
        [&_table]:w-full [&_table]:text-sm [&_th]:text-left [&_th]:font-semibold [&_th]:py-2 [&_th]:pr-3
        [&_td]:py-2 [&_td]:pr-3 [&_td]:align-top [&_tr]:border-b [&_tr]:border-line">
        {children}
      </div>
    </article>
  )
}

// Placeholder vizibil pentru datele firmei — le completeaza proprietarul.
// policy-reviewer da FAIL cat timp mai exista vreunul pe site.
export function Todo({ children }: { children: React.ReactNode }) {
  return <mark className="bg-yellow-100 text-yellow-900 px-1 rounded">[DE COMPLETAT: {children}]</mark>
}
