import type { Metadata } from 'next'
import { SITE_NAME } from './site'

// De ce exista: in Next, `openGraph` setat intr-o pagina INLOCUIESTE complet pe cel din layout
// (nu se combina). Fara helper, paginile /c/, /p/, /t/ pierdeau og:type, og:site_name, og:locale.
// withOg repeta mereu campurile comune.
export function withOg(o: {
  title: string
  description: string
  url: string
  type?: 'website' | 'article'
  images?: { url: string; alt?: string }[]
}): NonNullable<Metadata['openGraph']> {
  return {
    type: o.type ?? 'website',
    locale: 'ro_RO',
    siteName: SITE_NAME,
    title: o.title,
    description: o.description,
    url: o.url,
    ...(o.images?.length ? { images: o.images } : {}),
  }
}
