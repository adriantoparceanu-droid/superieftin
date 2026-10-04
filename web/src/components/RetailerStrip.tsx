import Image from 'next/image'
import type { PublicRetailer } from '@/lib/queries'

// Magazinele urmărite (logo-urile retailerilor activi), discret, la finalul homepage-ului:
// gri, fără cadru — informează, nu concurează cu reducerile.
export function RetailerStrip({ retailers }: { retailers: PublicRetailer[] }) {
  if (!retailers.length) return null

  return (
    <section aria-labelledby="magazine-urmarite" className="pt-8 lg:pt-12">
      <h2 id="magazine-urmarite" className="text-xs font-semibold uppercase tracking-wide text-ink-3 [font-family:inherit]">
        Magazine urmărite
      </h2>
      <ul className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-3">
        {retailers.map((r) => (
          // dark:bg-white — logo-urile magazinelor sunt desenate pentru fundal deschis; pe fundalul
          // întunecat (gri pe negru) nu se mai vedeau, așa că primesc o plăcuță deschisă
          <li
            key={r.slug}
            className="relative h-8 w-24 shrink-0 grayscale opacity-60 transition-all hover:grayscale-0 hover:opacity-100 dark:rounded-md dark:bg-white dark:opacity-80"
            title={r.name}
          >
            <Image src={r.logo_url} alt={r.name} fill sizes="96px" className="object-contain dark:p-1" unoptimized />
          </li>
        ))}
      </ul>
    </section>
  )
}
