'use client'

import { useEffect, useRef, useState } from 'react'

// Randeaza un banner HTML/JS (din admin) intr-un iframe care incarca /embed/banner/{id}.
// De ce iframe cu src real (nu srcdoc, nu injectare directa): codurile de afiliere care
// folosesc document.write (ex. Profitshare pe mod sincron) functioneaza doar intr-un document
// incarcat normal, unde scriptul extern blocheaza parser-ul. Pagina /embed isi raporteaza
// inaltimea prin postMessage, ca sa ajustam iframe-ul la continut.
export function RawEmbed({ id }: { id: number }) {
  const ref = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(260)

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.source !== ref.current?.contentWindow) return
      const data = e.data
      if (data && data.__banner === id && typeof data.height === 'number' && data.height > 0) {
        setHeight(data.height)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [id])

  return (
    <iframe
      ref={ref}
      src={`/embed/banner/${id}`}
      title="banner"
      scrolling="no"
      style={{ width: '100%', height, border: 0, display: 'block' }}
    />
  )
}
