import { Search } from 'lucide-react'

// Căutarea din antet (macheta „.search”): câmp ALB și pe antetul cărbune, în ambele teme,
// cu butonul roșu „Caută”. Formular GET simplu spre /cautare?q= — merge și fără JavaScript;
// evenimentul GA4 de căutare îl trimite pagina /cautare (TrackSearch), nu formularul.
// `compact` = fără butonul „Caută” (meniul mobil — Enter / „Caută” de pe tastatură trimite).
export function SearchForm({
  id,
  autoFocus,
  compact = false,
  placeholder = 'Caută un produs sau o marcă',
  className = '',
}: {
  id?: string
  autoFocus?: boolean
  compact?: boolean
  placeholder?: string
  className?: string
}) {
  return (
    <form action="/cautare" method="get" role="search" className={`flex items-center gap-2 h-[46px] rounded-xl bg-white text-[#14161A] pl-3.5 pr-1.5 focus-within:ring-2 focus-within:ring-red-on-head ${className}`}>
      <Search size={20} className="shrink-0 text-[#6A707C]" aria-hidden="true" />
      <input
        id={id}
        name="q"
        type="search"
        autoComplete="off"
        autoFocus={autoFocus}
        enterKeyHint="search"
        placeholder={placeholder}
        aria-label="Caută produse"
        className="flex-1 min-w-0 h-full bg-transparent text-[15px] text-[#14161A] placeholder:text-[#6A707C] focus:outline-none"
      />
      {!compact && (
        <button
          type="submit"
          className="shrink-0 h-9 px-3.5 rounded-[9px] bg-red hover:bg-red-hover text-white text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          Caută
        </button>
      )}
    </form>
  )
}
