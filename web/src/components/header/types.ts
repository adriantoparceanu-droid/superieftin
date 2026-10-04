import type { ReactNode } from 'react'

// Datele meniului, pregătite pe server (components/Header.tsx) din arborele `menu_items`
// și trimise componentelor client. Iconița vine deja randată (ReactNode), ca setul mare de
// iconițe din CategoryIcon să nu intre în JavaScript-ul trimis browserului.
export interface NavChild {
  id: number
  label: string
  href: string
}

export interface NavParent extends NavChild {
  icon: ReactNode // null = categoria nu are iconiță aleasă
  children: NavChild[]
}

export interface NavTag {
  slug: string
  name: string
}
