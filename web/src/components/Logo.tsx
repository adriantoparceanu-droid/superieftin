import Link from 'next/link'

// Logo-ul superieftin.ro (redesign, design §3 „Logo”): simbolul = chiar ideea site-ului — o linie
// de preț în trepte care coboară sub mediană (linia punctată) și se oprește în „azi” (punctul).
// Wordmark în Archivo semi-condensat, „.ro” roșu. SVG inline (nu imagine): zero cereri în plus,
// se vede imediat, iar culorile wordmark-ului urmează tema prin tokeni.
// Aceeași formă e și favicon-ul (app/icon.svg + app/favicon.ico) — modifică-le împreună.

// Simbolul singur (pătratul roșu). `mono` = variantă cărbune, pentru contexte monocrome.
export function LogoSymbol({ size = 30, mono = false, className = '' }: { size?: number; mono?: boolean; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
      className={`shrink-0 ${className}`}
    >
      <rect width="32" height="32" rx="8" fill={mono ? '#14161A' : '#D42B2B'} />
      <path d="M5.5 14.5h21" stroke="#fff" strokeWidth="1.6" strokeDasharray="2.2 2.2" strokeLinecap="round" opacity=".7" />
      <path d="M5.5 9.5h6v3.5h5.5v9h9.5" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="26" cy="22" r="2.6" fill="#fff" />
    </svg>
  )
}

interface LogoProps {
  // true = pe antetul cărbune / fundal închis: wordmark alb și „.ro” în roșul deschis (--red-on-head),
  // altfel roșul de text normal (--red-ink) ar avea contrast prea mic pe cărbune
  onDark?: boolean
  // fără link (ex. în emailuri sau acolo unde logo-ul e deja într-un link)
  href?: string | null
  size?: 'md' | 'lg'
  className?: string
}

export function Logo({ onDark = false, href = '/', size = 'md', className = '' }: LogoProps) {
  const sym = size === 'lg' ? 40 : 30
  const text = size === 'lg' ? 'text-[28px]' : 'text-[21px]'
  const inner = (
    <>
      <LogoSymbol size={sym} />
      <span
        className={`font-display font-[850] leading-none tracking-[-0.02em] [font-stretch:84%] ${text} ${onDark ? 'text-head-ink' : 'text-ink'}`}
      >
        superieftin<span className={onDark ? 'text-red-on-head' : 'text-red-ink'}>.ro</span>
      </span>
    </>
  )
  const cls = `inline-flex items-center gap-2 no-underline ${className}`

  if (href == null) return <span className={cls}>{inner}</span>
  return (
    <Link
      href={href}
      aria-label="superieftin.ro — acasă"
      className={`${cls} rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2`}
    >
      {inner}
    </Link>
  )
}
