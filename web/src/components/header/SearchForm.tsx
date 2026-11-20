import { Search } from 'lucide-react'

// Căutarea din antet: caută în ARTICOLE (pagina /cautare). Formular GET simplu spre /cautare?q= —
// merge și fără JavaScript; evenimentul GA4 de căutare îl trimite pagina /cautare (TrackSearch).
// Antetul e deschis (varianta A „Revista”), deci câmpul e pe tokeni: gri deschis cu contur,
// butonul „Caută” cărbune (roșul plin e rezervat butoanelor spre magazine).
// `compact` = fără butonul „Caută” (meniul mobil — Enter / „Caută” de pe tastatură trimite).
export function SearchForm({
  id,
  autoFocus,
  compact = false,
  placeholder = 'Caută în articole',
  className = '',
}: {
  id?: string
  autoFocus?: boolean
  compact?: boolean
  placeholder?: string
  className?: string
}) {
  return (
    <form action="/cautare" method="get" role="search" className={`flex items-center gap-2 h-[44px] rounded-xl bg-surface-2 text-ink pl-3.5 pr-1.5 ring-1 ring-inset ring-line-2 focus-within:ring-2 focus-within:ring-ink ${className}`}>
      <Search size={19} className="shrink-0 text-ink-3" aria-hidden="true" />
      <input
        id={id}
        name="q"
        type="search"
        autoComplete="off"
        autoFocus={autoFocus}
        enterKeyHint="search"
        placeholder={placeholder}
        aria-label="Caută în articole"
        className="flex-1 min-w-0 h-full bg-transparent text-[15px] text-ink placeholder:text-ink-3 focus:outline-none"
      />
      {!compact && (
        <button
          type="submit"
          className="shrink-0 h-8 px-3 rounded-[9px] bg-ink text-[var(--bg)] text-sm font-semibold transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
        >
          Caută
        </button>
      )}
    </form>
  )
}
