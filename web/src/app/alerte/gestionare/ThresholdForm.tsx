'use client'

import { useId, useState } from 'react'
import { formatLeiInput, parseLeiAmount, thresholdStatus } from '@/lib/alert-threshold'
import { OUTLINE_BUTTON } from '@/components/article'

// Câmpul „Pragul tău” din „Alertele mele”: aceeași parsare și aceleași mesaje live ca pe /p/
// (lib/alert-threshold.ts → thresholdStatus). Pragul poate fi ORICE sumă (decizia proprietarului,
// 5 oct. 2026); peste prețul de azi apare doar avertismentul. Serverul (updateTargetAction →
// parseTargetPrice) folosește aceeași funcție parseLeiAmount, deci acceptă exact aceleași sume.
//
// Formularul rămâne un <form action={…}> obișnuit: merge și fără JavaScript (mesajul live lipsește,
// dar serverul validează și întoarce eroarea în pagină).

interface Props {
  action: (formData: FormData) => Promise<void>
  token: string
  alertId: number
  target: number           // pragul salvat
  today: number | null     // cel mai mic preț disponibil acum (null = indisponibil)
}

export function ThresholdForm({ action, token, alertId, target, today }: Props) {
  const [raw, setRaw] = useState(formatLeiInput(target))
  const id = useId()
  const status = thresholdStatus(raw, today, null)
  const tone = status.kind === 'err' ? 'font-semibold text-red-ink' : status.kind === 'warn' ? 'text-amber-ink' : 'text-ink-3'

  return (
    <form action={action} className="min-w-0 flex-1">
      <input type="hidden" name="t" value={token} />
      <input type="hidden" name="alertId" value={alertId} />
      <div className="flex flex-wrap items-center gap-2">
        <label
          htmlFor={`${id}-prag`}
          className="flex min-w-0 cursor-text items-center gap-2 rounded-xl border-[1.5px] border-line-2 bg-surface-2 py-0.5 pl-3 pr-2.5 focus-within:border-ink focus-within:bg-surface"
        >
          <span className="text-[13px] font-bold text-ink">Pragul tău</span>
          <input
            id={`${id}-prag`}
            name="target"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            enterKeyHint="done"
            maxLength={14}
            required
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            onBlur={() => {
              const v = parseLeiAmount(raw)
              if (v != null) setRaw(formatLeiInput(v))
            }}
            aria-invalid={status.kind === 'err' || undefined}
            aria-describedby={`${id}-msg`}
            className="w-[7.5ch] min-w-0 border-0 bg-transparent py-1.5 text-right font-display text-xl font-extrabold tabular-nums text-ink outline-none"
          />
          <span className="text-sm font-bold text-ink-2">lei</span>
        </label>
        <button type="submit" disabled={status.value == null} className={`${OUTLINE_BUTTON} disabled:cursor-not-allowed disabled:opacity-50`}>
          Salvează
        </button>
      </div>
      <p id={`${id}-msg`} aria-live="polite" className={`mt-1.5 text-[12.5px] leading-snug ${tone}`}>
        {status.message}
      </p>
    </form>
  )
}
