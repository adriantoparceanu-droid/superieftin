'use client'

import { useEffect } from 'react'
import { gaEvent, type GaItem } from '@/lib/ga'

interface Props {
  item: GaItem
  value: number | null
}

// Eveniment GA4 ecommerce standard 'view_item' — pe paginile de produs
export function TrackViewItem({ item, value }: Props) {
  useEffect(() => {
    gaEvent('view_item', {
      currency: 'RON',
      value: value ?? undefined,
      items: [item],
    })
  }, [item, value])

  return null
}
