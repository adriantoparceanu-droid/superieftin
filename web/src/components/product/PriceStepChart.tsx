'use client'

import { useEffect, useRef, useState } from 'react'
import type { DiscountVerdict } from '@/lib/discount'
import { formatAmount, formatPct, formatPrice } from '@/lib/discount'
import type { DayPrice } from '@/lib/price-series'
import { TouchIcon } from './icons'

// Istoricul prețului pe /p/ (redesign, design §4.4): „cel mai mic preț pe zi” în trepte (prețurile
// se schimbă în salturi), fereastra ultimelor 30 de zile umbrită, mediana punctată, zona de
// reducere reală (sub 0,95 × mediană), punctul „azi”, file 30 / 90 de zile (doar cu istoric mai
// lung de 30 de zile) și prețul zilei la atingere / hover / săgeți.
//
// SVG desenat de mână (fără recharts): ne trebuie trepte, zone și etichete pe tokeni (mod întunecat).
// `touch-action: pan-y` → pe telefon tragerea pe orizontală arată prețul, cea pe verticală derulează.
// Seria vine gata calculată de pagină (lib/price-series.ts), din istoricul deja încărcat.

interface Props {
  series: DayPrice[]
  median: number | null        // mediana pe 30 de zile a ofertei afișate
  verdict: DiscountVerdict
  endsToday: boolean           // ultimul punct = prețul de azi (produs disponibil)
}

const MONTH_DAY = new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const FULL_DAY = new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const asDate = (day: string) => new Date(`${day}T00:00:00Z`)
// Etichetele de pe grafic: aceeași regulă ca prețurile (întreg sau exact 2 zecimale)
const num = formatAmount

export function PriceStepChart({ series, median, verdict, endsToday }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const [W, setW] = useState(360)
  const [range, setRange] = useState<30 | 90>(90)
  const [hover, setHover] = useState<number | null>(null)

  useEffect(() => {
    const el = box.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  if (series.length < 2) {
    return (
      <p className="mt-2 flex h-32 items-center justify-center rounded-xl bg-surface-2 px-4 text-center text-sm text-ink-3">
        Date insuficiente — istoricul se construiește cu fiecare verificare.
      </p>
    )
  }

  const wide = W >= 600
  const H = wide ? 260 : 210
  const padL = 4, padR = wide ? 92 : 72, padT = 40, padB = 24
  const canSwitch = series.length > 30
  const data = canSwitch && range === 30 ? series.slice(-30) : series
  const n = data.length
  const prices = data.map((d) => d.price)
  const today = prices[n - 1]
  const thr = median != null ? median * 0.95 : null

  let lo = Math.min(...prices, ...(thr != null ? [thr] : []))
  let hi = Math.max(...prices, ...(median != null ? [median] : []))
  const span = hi - lo || hi * 0.1
  lo -= span * 0.12
  hi += span * 0.1
  const iw = W - padL - padR
  const ih = H - padT - padB
  const X = (i: number) => padL + (n === 1 ? iw : (i / (n - 1)) * iw)
  const Y = (v: number) => padT + (1 - (v - lo) / (hi - lo)) * ih

  let d = `M${X(0)},${Y(prices[0])}`
  for (let i = 1; i < n; i++) d += `H${X(i)}V${Y(prices[i])}`
  const area = `${d}V${padT + ih}H${X(0)}Z`
  const w0 = X(Math.max(0, n - 30))
  const showWindow = n > 30
  const col = verdict === 'real' ? 'var(--red)' : verdict === 'higher' ? 'var(--amber)' : 'var(--ink)'
  const todayInk = verdict === 'real' ? 'var(--red-ink)' : verdict === 'higher' ? 'var(--amber-ink)' : 'var(--ink)'
  const rx = padL + iw + 6
  const yMed = median != null ? Y(median) : null
  const yT = Y(today)
  const todayLabelY = yMed != null && Math.abs(yT - yMed) < 26 ? (yT > yMed ? yMed + 30 : yMed - 22) : yT + 4
  const ticks = n >= 4 ? [0, Math.round((n - 1) / 3), Math.round((2 * (n - 1)) / 3), n - 1] : [0, n - 1]

  function pick(clientX: number) {
    const r = box.current?.querySelector('svg')?.getBoundingClientRect()
    if (!r || !r.width) return
    const vx = ((clientX - r.left) / r.width) * W
    setHover(Math.max(0, Math.min(n - 1, Math.round(((vx - padL) / iw) * (n - 1)))))
  }

  const h = hover != null && hover < n ? hover : null
  let tip: { left: number; date: string; price: string; rel: string } | null = null
  if (h != null) {
    const v = prices[h]
    const isToday = endsToday && h === n - 1
    const rel = median == null
      ? ''
      : h >= n - 30
        ? `${v < median ? '−' : '+'}${formatPct((v / median - 1) * 100)}% față de mediana de azi`
        : 'înainte de fereastra de 30 de zile'
    tip = {
      left: Math.max(70, Math.min(W - 70, X(h))),
      date: `${isToday ? 'Azi, ' : ''}${FULL_DAY.format(asDate(data[h].day))}`,
      price: formatPrice(v),
      rel,
    }
  }

  return (
    <div>
      {canSwitch && (
        <div role="group" aria-label="Intervalul graficului" className="mb-1 mt-2.5 flex gap-1">
          {([30, 90] as const).map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={range === r}
              onClick={() => { setRange(r); setHover(null) }}
              className="rounded-full bg-surface-2 px-3 py-1.5 text-[12.5px] font-bold text-ink-2 aria-pressed:bg-ink aria-pressed:text-[var(--bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              {r === 30 ? '30 de zile' : series.length >= 90 ? '90 de zile' : 'Tot istoricul'}
            </button>
          ))}
        </div>
      )}
      <div className="@container">
        <div
          ref={box}
          tabIndex={0}
          role="group"
          aria-roledescription="grafic"
          aria-label={`Graficul celui mai mic preț pe zi, ${n} zile${median != null ? `, cu mediana pe 30 de zile ${formatPrice(median)}` : ''}. Folosește săgețile stânga / dreapta pentru prețul fiecărei zile.`}
          className="relative -mx-1 h-[210px] select-none outline-none [touch-action:pan-y] focus-visible:ring-2 focus-visible:ring-brand rounded-lg @[600px]:h-[260px]"
          onPointerMove={(e) => pick(e.clientX)}
          onPointerDown={(e) => pick(e.clientX)}
          onPointerLeave={(e) => { if (e.pointerType === 'mouse') setHover(null) }}
          onBlur={() => setHover(null)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
              e.preventDefault()
              setHover((cur) => Math.max(0, Math.min(n - 1, (cur ?? n - 1) + (e.key === 'ArrowLeft' ? -1 : 1))))
            } else if (e.key === 'Escape') setHover(null)
          }}
        >
          <svg viewBox={`0 0 ${W} ${H}`} className="block h-full w-full overflow-visible" aria-hidden="true">
            {[hi - (hi - lo) * 0.1, (hi + lo) / 2, lo + (hi - lo) * 0.1].map((v, i) => (
              <line key={i} x1={padL} x2={padL + iw} y1={Y(v)} y2={Y(v)} stroke="var(--line)" strokeWidth="1" />
            ))}
            {showWindow && (
              <>
                <rect x={w0} y={padT} width={padL + iw - w0} height={ih} fill="var(--surface-2)" opacity=".7" />
                <text x={w0 + 4} y={padT - 6} fontSize="10.5" fill="var(--ink-3)">ultimele 30 de zile</text>
              </>
            )}
            {thr != null && (
              <>
                <rect x={w0} y={Y(thr)} width={padL + iw - w0} height={Math.max(0, padT + ih - Y(thr))} fill="var(--red-zone)" />
                <line x1={w0} x2={padL + iw} y1={Y(thr)} y2={Y(thr)} stroke="var(--red-ink)" strokeWidth="1" strokeDasharray="1 3" opacity=".8" />
              </>
            )}
            <path d={area} fill="var(--ink)" opacity=".06" />
            <path d={d} fill="none" stroke="var(--ink)" strokeWidth="2.2" strokeLinejoin="round" />
            {yMed != null && (
              <>
                <line x1={w0} x2={padL + iw} y1={yMed} y2={yMed} stroke="var(--ink-2)" strokeWidth="1.6" strokeDasharray="5 4" />
                <text x={rx} y={yMed - 2} fontSize="10.5" fill="var(--ink-3)">mediana</text>
                <text x={rx} y={yMed + 11} fontSize="11.5" fontWeight="700" fill="var(--ink)">{num(median!)}</text>
              </>
            )}
            <text x={rx} y={todayLabelY} fontSize="11.5" fontWeight="800" fill={todayInk}>
              {endsToday ? 'azi ' : ''}{num(today)}
            </text>
            <circle cx={X(n - 1)} cy={yT} r="9" fill={col} opacity=".2" />
            <circle cx={X(n - 1)} cy={yT} r="4.5" fill={col} stroke="var(--surface)" strokeWidth="2" />
            {ticks.map((t, k) => (
              <text
                key={t}
                x={X(t)}
                y={H - 6}
                fontSize="10.5"
                fill="var(--ink-3)"
                textAnchor={k === 0 ? 'start' : k === ticks.length - 1 ? 'end' : 'middle'}
              >
                {t === n - 1 && endsToday ? 'azi' : MONTH_DAY.format(asDate(data[t].day))}
              </text>
            ))}
            {h != null && (
              <g>
                <line x1={X(h)} x2={X(h)} y1={padT} y2={padT + ih} stroke="var(--ink)" strokeWidth="1" />
                <circle cx={X(h)} cy={Y(prices[h])} r="5" fill="var(--surface)" stroke="var(--ink)" strokeWidth="2.5" />
              </g>
            )}
          </svg>
          {tip && (
            <div
              className="pointer-events-none absolute top-0 -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-xs leading-tight text-[var(--bg)] shadow-card"
              style={{ left: `${(tip.left / W) * 100}%` }}
              aria-live="polite"
            >
              <span className="block text-[11px] opacity-85">{tip.date}</span>
              <b className="block font-display text-sm tabular-nums">{tip.price}</b>
              {tip.rel && <span className="block text-[11px] opacity-85">{tip.rel}</span>}
            </div>
          )}
        </div>
      </div>
      <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-3">
        <TouchIcon />
        Atinge sau trage pe grafic ca să vezi prețul fiecărei zile.
      </p>
      <p className="mt-2 flex flex-wrap gap-3 text-xs text-ink-2">
        <span className="inline-flex items-center gap-1.5"><i aria-hidden="true" className="inline-block w-4 border-t-2 border-ink" />Cel mai mic preț pe zi</span>
        {median != null && (
          <>
            <span className="inline-flex items-center gap-1.5"><i aria-hidden="true" className="inline-block w-4 border-t-2 border-dashed border-ink-2" />Mediana 30 de zile</span>
            <span className="inline-flex items-center gap-1.5"><i aria-hidden="true" className="inline-block h-2 w-4 bg-red-zone" />Zona „reducere reală” (≥5% sub mediană)</span>
          </>
        )}
      </p>
    </div>
  )
}
