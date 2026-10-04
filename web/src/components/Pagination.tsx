interface PaginationProps {
  currentPage: number
  totalPages: number
  buildUrl: (page: number) => string
}

export function Pagination({ currentPage, totalPages, buildUrl }: PaginationProps) {
  if (totalPages <= 1) return null

  // Generează lista de pagini cu ellipsis
  function getPages(): (number | '...')[] {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)

    const pages: (number | '...')[] = [1]

    if (currentPage > 3) pages.push('...')

    const start = Math.max(2, currentPage - 1)
    const end = Math.min(totalPages - 1, currentPage + 1)
    for (let i = start; i <= end; i++) pages.push(i)

    if (currentPage < totalPages - 2) pages.push('...')

    pages.push(totalPages)
    return pages
  }

  const pages = getPages()
  // Pe tokeni (corect și în modul întunecat). Pagina curentă = cerneală plină, nu roșu: roșul
  // plin e rezervat butonului „Vezi oferta” (design §3).
  const btnBase = 'inline-flex items-center justify-center min-w-10 h-10 px-2.5 rounded-[10px] text-sm font-semibold tabular-nums transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2'
  const btnActive = 'bg-ink text-page'
  const btnInactive = 'bg-surface text-ink ring-[1.5px] ring-inset ring-line-2 hover:ring-ink'
  const btnDisabled = 'bg-surface text-ink-3 ring-1 ring-inset ring-line cursor-not-allowed opacity-60'

  return (
    <nav className="flex items-center justify-center gap-1.5 mt-8 flex-wrap" aria-label="Paginație">
      {currentPage > 1 ? (
        <a href={buildUrl(currentPage - 1)} className={`${btnBase} ${btnInactive}`} aria-label="Pagina anterioară">
          ← Anterior
        </a>
      ) : (
        <span className={`${btnBase} ${btnDisabled}`}>← Anterior</span>
      )}

      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`ellipsis-${i}`} className={`${btnBase} text-ink-3`}>…</span>
        ) : p === currentPage ? (
          <span key={p} className={`${btnBase} ${btnActive}`} aria-current="page">{p}</span>
        ) : (
          <a key={p} href={buildUrl(p)} className={`${btnBase} ${btnInactive}`}>{p}</a>
        )
      )}

      {currentPage < totalPages ? (
        <a href={buildUrl(currentPage + 1)} className={`${btnBase} ${btnInactive}`} aria-label="Pagina următoare">
          Următor →
        </a>
      ) : (
        <span className={`${btnBase} ${btnDisabled}`}>Următor →</span>
      )}
    </nav>
  )
}
