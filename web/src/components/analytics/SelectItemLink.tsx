'use client'

import Link from 'next/link'
import { gaEvent, type GaItem } from '@/lib/ga'

interface Props {
  href: string
  item: GaItem
  className?: string
  children: React.ReactNode
}

// Link intern spre pagina de produs cu tracking GA4 'select_item'
// (utilizatorul alege un produs din lista de comparare)
export function SelectItemLink({ href, item, className, children }: Props) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => {
        gaEvent('select_item', { items: [item] })
      }}
    >
      {children}
    </Link>
  )
}
