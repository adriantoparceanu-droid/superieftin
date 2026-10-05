'use client'

import { useEffect, useRef, useState } from 'react'

// Randeaza un banner HTML/JS (din admin) intr-un iframe care incarca /embed/banner/{id}.
// De ce iframe cu src real (nu srcdoc, nu injectare directa): codurile de afiliere care
// folosesc document.write (ex. Profitshare pe mod sincron) functioneaza doar intr-un document
// incarcat normal, unde scriptul extern blocheaza parser-ul. Pagina /embed isi raporteaza
// inaltimea CONTINUTULUI prin postMessage, ca sa ajustam iframe-ul la ea.
//
// Pana la primul raport iframe-ul umple caseta parintelui (height 100%) — caseta are deja
// dimensiunea rezervata, deci nimic nu sare. `onHeight` anunta parintele (ex. ca sa potriveasca
// inaltimea casetei); `onEmpty` se cheama daca la `EMPTY_AFTER_MS` dupa incarcare continutul
// tot are 0 px (widgetul n-a afisat nimic — ex. Profitshare in afara domeniului aprobat),
// ca parintele sa ascunda caseta in loc sa lase un dreptunghi gol.
const EMPTY_AFTER_MS = 6000

export function RawEmbed({ id, fill = false, onHeight, onEmpty }: {
  id: number | string
  fill?: boolean          // imaginile bannerului iau toată lățimea (vezi /embed/banner, ?fill=1)
  onHeight?: (height: number) => void
  onEmpty?: () => void
}) {
  const ref = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState<number | null>(null)
  // Ultima inaltime raportata, citita de timer-ul de „gol” (fara closure vechi)
  const lastHeight = useRef(0)
  // Callback-urile cele mai noi, pentru ascultătorul de mesaje și timer (actualizate după randare)
  const callbacks = useRef({ onHeight, onEmpty })
  useEffect(() => { callbacks.current = { onHeight, onEmpty } })

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.source !== ref.current?.contentWindow) return
      const data = e.data
      // Number(): `banners.id` e BIGINT → din pg vine ca STRING ("22"), iar pagina /embed trimite
      // număr (22). Comparația strictă eșua mereu → iframe-ul rămânea la înălțimea inițială
      // (260 px, golul alb de sub bannerele mici de pe producție, până la 5 oct 2026).
      if (data && Number(data.__banner) === Number(id) && typeof data.height === 'number' && data.height >= 0) {
        lastHeight.current = data.height
        setHeight(data.height)
        callbacks.current.onHeight?.(data.height)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [id])

  const emptyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (emptyTimer.current) clearTimeout(emptyTimer.current) }, [])

  function handleLoad() {
    if (emptyTimer.current) clearTimeout(emptyTimer.current)
    emptyTimer.current = setTimeout(() => {
      if (lastHeight.current <= 0) callbacks.current.onEmpty?.()
    }, EMPTY_AFTER_MS)
  }

  return (
    <iframe
      ref={ref}
      src={`/embed/banner/${id}${fill ? '?fill=1' : ''}`}
      title="Publicitate"
      scrolling="no"
      onLoad={handleLoad}
      style={{ width: '100%', height: height && height > 0 ? height : '100%', border: 0, display: 'block' }}
    />
  )
}
