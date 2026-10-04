import { ARTICLE_CARD, ARTICLE_H1, ARTICLE_PROSE } from '@/components/article'

// Cadru comun pentru paginile de incredere (Despre, Contact, Confidentialitate, Termeni,
// Cookies, Metodologie) si pentru paginile alertelor pe email: titlu, data ultimei actualizari si
// tipografia de articol (components/article.ts — aceeasi ca la ghiduri).
export function LegalPage({ title, updated, children }: {
  title: string
  updated?: string   // ex. '26 septembrie 2026'
  children: React.ReactNode
}) {
  return (
    <article className={ARTICLE_CARD}>
      <h1 className={ARTICLE_H1}>{title}</h1>
      {updated && <p className="mt-2 text-[13px] text-ink-3">Ultima actualizare: {updated}</p>}
      <div className={`mt-6 ${ARTICLE_PROSE}`}>
        {children}
      </div>
    </article>
  )
}

// Placeholder vizibil pentru datele firmei — le completeaza proprietarul.
// policy-reviewer da FAIL cat timp mai exista vreunul pe site.
// Chihlimbar pe tokeni (lizibil si in modul intunecat), nu galben fix.
export function Todo({ children }: { children: React.ReactNode }) {
  return (
    <mark className="rounded bg-amber-tint px-1 font-semibold text-amber-ink ring-1 ring-inset ring-amber-ink/30 [box-decoration-break:clone]">
      [DE COMPLETAT: {children}]
    </mark>
  )
}
