import Image from 'next/image'
import type { PublicRetailer } from '@/lib/queries'

// Echivalentul „Featured Brands" din Porto: logo-urile retailerilor monitorizati
export function RetailerStrip({ retailers }: { retailers: PublicRetailer[] }) {
  if (!retailers.length) return null

  return (
    <section className="mb-10">
      <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">Magazine monitorizate</h2>
      <div className="flex gap-6 items-center overflow-x-auto bg-surface border border-line rounded-xl px-6 py-4">
        {retailers.map((r) => (
          // dark:bg-white — logo-urile magazinelor sunt desenate pentru fundal deschis; pe fundalul
          // întunecat (gri pe negru) nu se mai vedeau, așa că primesc o plăcuță deschisă
          <div key={r.slug} className="relative h-9 w-28 shrink-0 grayscale opacity-70 hover:grayscale-0 hover:opacity-100 transition-all dark:bg-white dark:rounded-md dark:opacity-90" title={r.name}>
            <Image src={r.logo_url} alt={r.name} fill sizes="112px" className="object-contain dark:p-1" unoptimized />
          </div>
        ))}
      </div>
    </section>
  )
}
