import type { Metadata } from 'next'

// Tot /admin (inclusiv login) e privat: noindex, nofollow. Inainte venea „index, follow” din
// layout-ul radacina; acum layout-ul radacina nu mai seteaza robots (raport SEO, A1).
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return children
}
