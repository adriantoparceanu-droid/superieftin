// Iconițele paginii de produs (desenele din macheta direcției B). SVG inline, `currentColor`,
// decorative (aria-hidden) — textul de lângă ele spune ce fac.

type P = { className?: string }
const base = { viewBox: '0 0 24 24', 'aria-hidden': true as const, fill: 'none', stroke: 'currentColor' }

export function BellIcon({ className = 'w-5 h-5' }: P) {
  return (
    <svg {...base} className={className} strokeWidth={2} strokeLinejoin="round">
      <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z" />
      <path d="M10 20.5a2 2 0 0 0 4 0" />
    </svg>
  )
}

export function ExternalIcon({ className = 'w-[18px] h-[18px]' }: P) {
  return (
    <svg {...base} className={className} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </svg>
  )
}

export function TelegramIcon({ className = 'w-[18px] h-[18px]' }: P) {
  return (
    <svg {...base} className={className} strokeWidth={1.8} strokeLinejoin="round">
      <path d="M21 4 3 11l6 2 2 6 3-4 5 4z" />
      <path d="m9 13 8-6" />
    </svg>
  )
}

export function MailIcon({ className = 'w-[18px] h-[18px]' }: P) {
  return (
    <svg {...base} className={className} strokeWidth={1.8}>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  )
}

export function ChartIcon({ className = 'w-[18px] h-[18px]' }: P) {
  return (
    <svg {...base} className={className} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19h16M5 15l4-5 4 3 6-7" />
    </svg>
  )
}

export function ClockIcon({ className = 'w-[18px] h-[18px]' }: P) {
  return (
    <svg {...base} className={className} strokeWidth={1.8} strokeLinecap="round">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  )
}

export function StoreIcon({ className = 'w-[18px] h-[18px]' }: P) {
  return (
    <svg {...base} className={className} strokeWidth={1.8} strokeLinejoin="round">
      <path d="M4 9.5 5.5 4h13L20 9.5M4 9.5h16M4 9.5V20h16V9.5M9.5 20v-5h5v5" />
    </svg>
  )
}

export function TouchIcon({ className = 'w-4 h-4' }: P) {
  return (
    <svg {...base} className={className} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11m0-1.5a1.5 1.5 0 0 1 3 0V12m0-1a1.5 1.5 0 0 1 3 0v4a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-2.7L4 15.5a1.5 1.5 0 0 1 2.4-1.8L9 16" />
    </svg>
  )
}
