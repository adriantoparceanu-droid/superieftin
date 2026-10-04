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
  const btnBase = 'inline-flex items-center justify-center min-w-[36px] h-9 px-2 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2'
  const btnActive = 'bg-brand text-white'
  const btnInactive = 'bg-surface border border-line text-[var(--color-text)] hover:border-brand hover:text-red-ink'
  const btnDisabled = 'bg-surface border border-line text-muted cursor-not-allowed opacity-50'

  return (
    <nav className="flex items-center justify-center gap-1 mt-8 flex-wrap" aria-label="Paginație">
      {currentPage > 1 ? (
        <a href={buildUrl(currentPage - 1)} className={`${btnBase} ${btnInactive}`} aria-label="Pagina anterioară">
          ← Anterior
        </a>
      ) : (
        <span className={`${btnBase} ${btnDisabled}`}>← Anterior</span>
      )}

      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`ellipsis-${i}`} className={`${btnBase} text-muted`}>…</span>
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
