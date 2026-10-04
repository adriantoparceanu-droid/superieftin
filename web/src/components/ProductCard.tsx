import Image from 'next/image'
import { VerdictBadge } from './VerdictBadge'
import { SelectItemLink } from './analytics/SelectItemLink'
import { MiniThermometer } from './listing/MiniThermometer'
import { formatPrice } from '@/lib/discount'
import { listingView, storesText } from '@/lib/listing-product'
import type { ProductWithDiscount } from '@/lib/queries'

// Cardul de produs din grilă (macheta direcției B, „.pc”): imagine pe surface-2 cu insigna de
// verdict peste ea, numele pe 2 rânduri, prețul mare, „mediana 30 z”, mini-termometrul și
// magazinul. Tot cardul e un link spre /p/ (select_item în GA4) — fără buton spre magazin:
// decizia de cumpărare se ia pe pagina de produs, unde se vede verdictul complet.
//
// Folosit pe desktop/tabletă în liste (pe mobil, listele au ProductRow) și pe homepage.

export function gaItemOf(product: ProductWithDiscount) {
  return {
    item_name: product.name,
    item_category: product.category,
    item_brand: product.brand,
    price: product.current_price,
    affiliation: product.retailer_name,
  }
}

export function ProductCard({ product }: { product: ProductWithDiscount }) {
  const v = listingView(product)
  const stores = storesText(v.stores)

  return (
    <SelectItemLink
      href={`/p/${product.slug}`}
      item={gaItemOf(product)}
      className="group relative flex h-full flex-col overflow-hidden rounded-[14px] bg-surface shadow-card ring-1 ring-inset ring-line/60 transition-shadow hover:ring-line-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
    >
      {/* Înălțime fixă (fără salt de pagină la încărcare). Luminos: surface-2 + multiply (fundalul alb
          al pozelor se topește în gri); întunecat: alb, ca pe /p/ — pozele au aproape mereu fundal alb. */}
      <div className="relative h-[150px] shrink-0 bg-surface-2 dark:bg-white">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt=""
            fill
            sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw"
            className="object-contain p-3 mix-blend-multiply"
            unoptimized
          />
        ) : (
          <NoImage />
        )}
        {/* Insigna stă ÎN imagine: max-w + overflow-hidden ca un text lung să nu iasă din card */}
        <VerdictBadge
          verdict={v.info.verdict}
          discountPct={v.info.discountPct}
          className="absolute left-2 top-2 max-w-[calc(100%-1rem)] overflow-hidden"
        />
      </div>

      <div className="flex flex-1 flex-col px-3 pb-3 pt-2.5">
        {/* h3: cardul stă sub un titlu de secțiune (h2) */}
        <h3 className="line-clamp-2 min-h-[2.6em] font-sans text-[13.5px] font-semibold leading-[1.3] tracking-normal text-ink [font-stretch:100%] group-hover:text-red-ink">
          {product.name}
        </h3>
        <p className="mt-1.5 font-display text-[19px] font-extrabold leading-tight tabular-nums text-ink">
          {formatPrice(product.current_price)}
        </p>
        {v.median && (
          <p className="text-[11.5px] tabular-nums text-ink-3">mediana 30 z: {v.median}</p>
        )}
        {v.thermo && <MiniThermometer th={v.thermo} verdict={v.info.verdict} className="mt-2 mb-0.5" />}
        <p className="mt-auto truncate pt-2 text-[11.5px] text-ink-2">
          la <b className="font-bold text-ink">{product.retailer_name}</b>
          {stores && <> · {stores}</>}
        </p>
      </div>
    </SelectItemLink>
  )
}

// Fără imagine: o siluetă neutră (pe tokeni, corectă și în modul întunecat)
export function NoImage({ className = 'w-12 h-12' }: { className?: string }) {
  return (
    <div className="absolute inset-0 grid place-items-center text-line-2">
      <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round">
        <path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z" />
        <path d="M3 7.5 12 12l9-4.5M12 12v9" />
      </svg>
    </div>
  )
}
