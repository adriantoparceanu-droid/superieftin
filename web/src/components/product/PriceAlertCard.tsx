'use client'

import { useId, useState } from 'react'
import { formatLeiInput, parseLeiAmount, telegramTarget, thresholdStatus } from '@/lib/alert-threshold'
import { telegramAlertUrl } from '@/lib/price-alert'
import { PriceAlertButton } from '@/components/PriceAlert'
import { EmailAlertForm } from '@/components/EmailAlertForm'
import { BellIcon, MailIcon, TelegramIcon } from './icons'

// Cardul „Alertă de preț” de pe /p/ (redesign, stilul C — design §4.5). Vizitatorul scrie ORICE
// sumă în „Pragul tău” (precompletat cu pragul propus: 5% sub min(preț azi, mediană), rotunjit în
// jos — lib/price-alert.ts); sub câmp, un mesaj live spune exact ce se va întâmpla
// (lib/alert-threshold.ts → thresholdStatus). Peste prețul de azi: avertisment, dar alerta e
// acceptată și pleacă la următoarea verificare (decizia proprietarului, 5 oct. 2026).
//
// Canale: Telegram (deep link /start prod_<id>_<prag>, citit de worker/src/lib/price-alert.ts —
// pragul în lei întregi, rotunjit în jos) și email (double opt-in, EmailAlertForm). De ce contează
// alerta: la afiliere câștigă ultimul click — alerta aduce vizitatorul înapoi (CLAUDE.md).
//
// Bara fixă de jos (StickyBuyBar) derulează la #alerta-pret și pune focusul în câmp (#prag-alerta).

export const ALERT_CARD_ID = 'alerta-pret'
export const ALERT_INPUT_ID = 'prag-alerta'

interface Props {
  productId: string
  offerId: string | null
  category: string | null
  todayPrice: number | null      // cel mai mic preț disponibil acum (null = indisponibil)
  suggested: number | null       // pragul propus
  telegramBot: string | null     // TELEGRAM_BOT_USERNAME (null = fără Telegram)
  emailEnabled: boolean
  className?: string
}

const btn =
  'inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-[10px] bg-surface px-3.5 font-display text-[14.5px] font-extrabold text-ink ring-[1.5px] ring-inset ring-line-2 transition-shadow hover:ring-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink aria-expanded:ring-ink'

export function PriceAlertCard({ productId, offerId, category, todayPrice, suggested, telegramBot, emailEnabled, className = '' }: Props) {
  const [raw, setRaw] = useState(suggested != null ? formatLeiInput(suggested) : '')
  const [emailOpen, setEmailOpen] = useState(false)
  const msgId = useId()
  const status = thresholdStatus(raw, todayPrice, suggested)
  const tgHref = telegramBot ? telegramAlertUrl(telegramBot, productId, telegramTarget(status.value)) : null
  const placement = todayPrice != null ? 'actiuni' : 'indisponibil'
  const msgTone = status.kind === 'err' ? 'font-semibold text-red-ink' : status.kind === 'warn' ? 'text-amber-ink' : 'text-ink-3'
  const channels = tgHref && emailEnabled ? 'pe Telegram sau pe email' : tgHref ? 'pe Telegram' : 'pe email'

  function useSuggested() {
    if (suggested == null) return
    setRaw(formatLeiInput(suggested))
    document.getElementById(ALERT_INPUT_ID)?.focus()
  }

  return (
    <section id={ALERT_CARD_ID} aria-labelledby={`${ALERT_CARD_ID}-titlu`} className={`scroll-mt-24 ${className}`}>
      <div className="flex items-start gap-2.5">
        <BellIcon className="mt-0.5 h-6 w-6 shrink-0 text-red-ink" />
        <div>
          <h2 id={`${ALERT_CARD_ID}-titlu`} className="text-lg font-extrabold text-ink">Alertă de preț</h2>
          <p className="mt-0.5 text-[13.5px] text-ink-3">Te anunțăm când oricare magazin ajunge la pragul tău sau sub el.</p>
        </div>
      </div>

      <label
        htmlFor={ALERT_INPUT_ID}
        className="mt-3 flex cursor-text items-center justify-between gap-2.5 rounded-xl border-[1.5px] border-line-2 bg-surface-2 py-1 pl-3 pr-2.5 focus-within:border-ink focus-within:bg-surface"
      >
        <span className="text-[13.5px] font-bold leading-tight text-ink">
          Pragul tău
          {suggested != null && <small className="block text-xs font-medium text-ink-3">propus: {formatLeiInput(suggested)} lei</small>}
        </span>
        <span className="flex min-w-0 items-baseline gap-1">
          <input
            id={ALERT_INPUT_ID}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            enterKeyHint="done"
            maxLength={14}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            onBlur={() => {
              const v = parseLeiAmount(raw)
              if (v != null) setRaw(formatLeiInput(v))
            }}
            aria-invalid={status.kind === 'err' || undefined}
            aria-describedby={msgId}
            className="w-[7.5ch] min-w-0 border-0 bg-transparent py-2 text-right font-display text-2xl font-extrabold tabular-nums text-ink outline-none"
          />
          <span className="text-sm font-bold text-ink-2">lei</span>
        </span>
      </label>
      <p id={msgId} aria-live="polite" className={`mx-0.5 mt-1.5 min-h-[1.4em] text-[12.5px] leading-snug ${msgTone}`}>
        {status.message}
        {status.showReset && (
          <>
            {' '}
            <button type="button" onClick={useSuggested} className="font-bold text-ink underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded">
              Folosește pragul propus
            </button>
          </>
        )}
      </p>

      <div className={`mt-2.5 grid gap-2 ${tgHref && emailEnabled ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {tgHref && (
          <PriceAlertButton
            href={tgHref}
            productId={productId}
            category={category}
            price={todayPrice}
            target={status.value}
            placement={placement}
            className={btn}
          >
            <TelegramIcon />
            Telegram
          </PriceAlertButton>
        )}
        {emailEnabled && (
          <button type="button" className={btn} aria-expanded={emailOpen} onClick={() => setEmailOpen((o) => !o)}>
            <MailIcon />
            Email
          </button>
        )}
      </div>
      {/* Descrie EXACT ce face alerta, fără să promită că prețul va scădea (regula 9).
          „pe Telegram” rămâne vizibil: reclamele promit „Alertă de preț pe Telegram”. */}
      <p className="mt-2 text-xs text-ink-3">Gratuit, fără cont, {channels}. Poți opri alerta oricând.</p>
      {emailEnabled && emailOpen && (
        <EmailAlertForm productId={productId} offerId={offerId} target={status.value} category={category} price={todayPrice} />
      )}
    </section>
  )
}
