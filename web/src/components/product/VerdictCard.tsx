import Link from 'next/link'
import { calculateDiscount, formatPrice } from '@/lib/discount'
import { thermometer, verdictCopy } from '@/lib/verdict'
import type { FactPart } from '@/lib/seo/product-facts'
import type { OfferRow } from '@/lib/queries'
import { VerifiedAt } from './VerifiedAt'

// Cardul „MERITĂ ACUM?” (redesign „Verdict întâi”, design §4.2): verdictul în cuvinte + procent,
// fraza din date, prețul mare + magazinul, termometrul min–mediană–max pe 30 de zile.
//
// Totul se raportează la oferta afișată (cea mai ieftină disponibilă) și la mediana EI pe 30 de
// zile — aceeași regulă ca până acum (lib/discount.ts). Termometrul citește min_30d / max_30d
// din offer_price_stats (migrația 032); fără ele nu desenăm nimic (nu inventăm o scară).
//
// ATENȚIE: titlul „Reducere reală” + fraza „Prețul de azi e cu X% sub mediana” sunt citite de
// ads:validate / ads-guard (lib/verdict.ts). Trebuie să rămână text vizibil, nu doar ARIA.

const TONE = {
  real: { strip: 'bg-red', text: 'text-red-ink', pin: 'bg-red ring-red', flag: 'bg-red text-white', arrow: 'border-t-red' },
  normal: { strip: 'bg-line-2', text: 'text-ink', pin: 'bg-ink ring-ink', flag: 'bg-ink text-[var(--bg)]', arrow: 'border-t-ink' },
  higher: { strip: 'bg-amber', text: 'text-amber-ink', pin: 'bg-amber ring-amber', flag: 'bg-amber text-[#14161A]', arrow: 'border-t-amber' },
  'no-data': { strip: 'bg-line', text: 'text-ink-2', pin: 'bg-ink ring-ink', flag: 'bg-ink text-[var(--bg)]', arrow: 'border-t-ink' },
} as const

export function Parts({ parts }: { parts: FactPart[] }) {
  return <>{parts.map((p, i) => (typeof p === 'string' ? <span key={i}>{p}</span> : <b key={i} className="font-semibold text-ink">{p.b}</b>))}</>
}

export function VerdictCard({ offer, offerCount }: { offer: OfferRow; offerCount: number }) {
  const info = calculateDiscount(offer.current_price, offer.median_price)
  const copy = verdictCopy(info, offer.median_price)
  const tone = TONE[copy.verdict]
  const th = thermometer(offer.min_30d ?? null, offer.max_30d ?? null, offer.median_price, offer.current_price)
  const pctTone = copy.verdict === 'normal' ? 'text-ink-2' : tone.text

  return (
    <section aria-labelledby="verdict-titlu" className="relative overflow-hidden rounded-2xl bg-surface shadow-card">
      <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-[5px] ${tone.strip}`} />
      <div className="px-4 pt-3.5 lg:px-5">
        <p className="flex items-center justify-between text-xs font-bold uppercase tracking-[.08em] text-ink-3">
          Merită acum?
          <span className="font-medium normal-case tracking-normal">verdictul de azi</span>
        </p>
        <h2 id="verdict-titlu" className="mt-1.5 flex flex-wrap items-baseline gap-x-2.5 font-display leading-[1.05]" style={{ fontStretch: '84%' }}>
          <span className={`text-[30px] lg:text-[38px] font-black tracking-[-.02em] ${tone.text}`}>{copy.word}</span>
          {copy.pct && <span className={`text-[30px] lg:text-[38px] font-black tabular-nums ${pctTone}`}>{copy.pct}</span>}
        </h2>
        <p className="mt-1.5 text-[14.5px] text-ink-2"><Parts parts={copy.sentence} /></p>

        <div className="mt-3 border-t border-dashed border-line pt-3">
          <div className="font-display text-[32px] lg:text-[38px] font-extrabold leading-none tracking-[-.02em] tabular-nums text-ink">
            {formatPrice(offer.current_price)}
          </div>
          <p className="mt-1.5 text-[13.5px] text-ink-2">
            la <b className="font-bold text-ink">{offer.retailer_name}</b>
            {offerCount > 1 ? ` · cel mai mic preț din ${offerCount} magazine` : ''}
          </p>
        </div>
      </div>

      {th && offer.median_price != null && (
        <div className="px-4 pb-1.5 pt-4 lg:px-5" role="group" aria-label="Prețul de azi față de ultimele 30 de zile">
          <div className="relative mt-8 h-3 rounded-full bg-surface-2">
            <span
              aria-hidden="true"
              className="absolute inset-y-0 left-0 rounded-l-full"
              style={{ width: `${th.realEnd}%`, background: 'repeating-linear-gradient(135deg, var(--red-zone) 0 6px, transparent 6px 9px), var(--red-zone)' }}
            />
            <span aria-hidden="true" className="absolute inset-y-0 right-0 rounded-r-full bg-amber-tint" style={{ left: `${th.highStart}%` }} />
            <span aria-hidden="true" className="absolute -top-[5px] -bottom-[5px] w-0.5 -ml-px rounded bg-ink" style={{ left: `${th.median}%` }} />
            <span
              aria-hidden="true"
              className={`absolute top-1/2 -ml-[11px] -mt-[11px] h-[22px] w-[22px] rounded-full border-4 border-surface ring-2 ${tone.pin}`}
              style={{ left: `${th.today}%` }}
            />
            <span
              className={`absolute bottom-5 -translate-x-1/2 whitespace-nowrap rounded-md px-[7px] py-[3px] text-[11.5px] font-bold tabular-nums ${tone.flag}`}
              style={{ left: `${th.flag}%` }}
            >
              Azi · {formatPrice(offer.current_price)}
              <span aria-hidden="true" className={`absolute left-1/2 -bottom-1 -ml-1 border-x-4 border-t-4 border-x-transparent ${tone.arrow}`} />
            </span>
          </div>
          <dl className="mt-2.5 grid grid-cols-3 text-xs text-ink-3 tabular-nums">
            <div><dt>Minim 30 z</dt><dd className="text-[13.5px] font-bold text-ink">{formatPrice(offer.min_30d ?? null)}</dd></div>
            <div className="text-center"><dt>Mediana</dt><dd className="text-[13.5px] font-bold text-ink">{formatPrice(offer.median_price)}</dd></div>
            <div className="text-right"><dt>Maxim 30 z</dt><dd className="text-[13.5px] font-bold text-ink">{formatPrice(offer.max_30d ?? null)}</dd></div>
          </dl>
          <p className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-ink-3">
            <span className="inline-flex items-center gap-1.5">
              <i aria-hidden="true" className="inline-block h-2 w-3 rounded-sm bg-red-zone ring-1 ring-inset ring-red-ink" />
              ≥5% sub mediană = reducere reală
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i aria-hidden="true" className="inline-block h-2 w-3 rounded-sm bg-amber-tint ring-1 ring-inset ring-amber" />
              peste +5%
            </span>
          </p>
        </div>
      )}

      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-line px-4 py-2.5 text-[12.5px] text-ink-3 lg:px-5">
        {offer.last_checked ? <VerifiedAt iso={offer.last_checked} /> : <span />}
        <Link href="/ghiduri/metodologie" className="font-semibold text-ink underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded">
          Cum calculăm?
        </Link>
      </div>
    </section>
  )
}
