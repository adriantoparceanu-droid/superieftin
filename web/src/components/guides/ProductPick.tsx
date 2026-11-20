import Image from 'next/image'
import { AffiliateLink } from '@/components/analytics/AffiliateLink'
import { ExternalIcon } from '@/components/product/icons'
import { btn } from '@/components/product/buttons'
import { formatPrice } from '@/lib/discount'
import type { BestOffer } from '@/lib/best-offer'

// Cardul de produs dintr-un articol (reorganizarea în blog, varianta A „Revista”).
//
// De ce atât de puțin: site-ul devine blog de recomandări, iar istoricul de preț e DOAR intern
// (design 2026-11-20). Cardul nu arată mediana, procente, „Reducere reală”, grafic sau lista de
// magazine — doar produsul, cel mai bun preț găsit la magazinele partenere și UN singur buton,
// spre oferta aleasă de pickBestOffer (lib/best-offer.ts). Textul spune „magazinele partenere”,
// nu „cel mai mic preț din România”: comparăm doar magazinele din care avem oferte (regula 9).
//
// Butonul trece OBLIGATORIU prin AffiliateLink (token anti-roboți, /go/, click_id, GA4).

export interface PickProduct {
  id: string
  name: string
  slug: string
  category: string
  image_url: string | null
}

interface Props {
  product: PickProduct
  offer: BestOffer | null
  // compact = în tabelul de comparație: poză mică, fără nume (numele e în capul coloanei)
  compact?: boolean
  // Ancora #produs-<slug> (țintă pentru redirecturile /p/ → articol). O pune GuideBody DOAR pe
  // prima apariție a produsului în articol, ca id-ul să rămână unic în pagină.
  anchor?: boolean
  // Punctele tari / slabe scrise de autor ({{pro:…}} / {{contra:…}} sub marcaj, lib/guides/markers.ts).
  // Opinie editoriala, nu date de pret — de aceea pot sta in card. Doar in varianta mare.
  pros?: string[]
  cons?: string[]
  // Cheie unica a cardului in pagina (indicele blocului din articol) — pentru id-urile etichetelor
  // listelor, unice chiar daca acelasi produs apare in doua carduri
  uid?: string
}

const UNAVAILABLE = 'Momentan indisponibil la magazinele partenere'

// sizeClass = dimensiuni FIXE (fără salt de pagină la încărcarea pozei); maxPx = cea mai mare
// dintre ele, pentru `sizes`.
function Photo({ src, sizeClass, maxPx }: { src: string | null; sizeClass: string; maxPx: number }) {
  return (
    // Fundal alb și în modul întunecat (ca pe restul site-ului): pozele de la magazine au aproape
    // mereu fundal alb.
    <div className={`relative shrink-0 overflow-hidden rounded-xl bg-surface-2 dark:bg-white ${sizeClass}`}>
      {src ? (
        // loading lazy implicit în next/image; unoptimized = ca în restul site-ului (poze externe)
        <Image src={src} alt="" fill sizes={`${maxPx}px`} className="object-contain p-2 mix-blend-multiply" unoptimized />
      ) : (
        <span aria-hidden className="flex h-full w-full items-center justify-center text-xs text-ink-3">fără poză</span>
      )}
    </div>
  )
}

function ShopButton({ product, offer, className }: { product: PickProduct; offer: BestOffer; className: string }) {
  return (
    <AffiliateLink
      offerId={offer.offer_id}
      productId={product.id}
      productName={product.name}
      merchantName={offer.retailer_name}
      price={offer.current_price}
      category={product.category}
      // Fără afirmații de reducere pe card → nimic de raportat ca reducere în GA4
      discountPct={null}
      className={className}
    >
      <span className="min-w-0 truncate">
        Vezi la <span className="capitalize">{offer.retailer_name}</span>
      </span>
      <ExternalIcon />
    </AffiliateLink>
  )
}

// „Bun:” / „Mai slab:” — doua liste scurte. Accesibil: fiecare lista are eticheta ei (aria-labelledby),
// iar semnele +/− sunt decorative (aria-hidden), ca cititorul de ecran sa nu le pronunte.
function Notes({ id, pros, cons }: { id: string; pros: string[]; cons: string[] }) {
  if (!pros.length && !cons.length) return null
  const lists = [
    { key: 'pro', label: 'Bun:', items: pros, sign: '+', signClass: 'text-success-ink' },
    { key: 'contra', label: 'Mai slab:', items: cons, sign: '−', signClass: 'text-amber-ink' },
  ].filter((l) => l.items.length)
  return (
    <div className={`mt-4 grid gap-3 ${lists.length > 1 ? 'sm:grid-cols-2' : ''}`}>
      {lists.map((l) => (
        <div key={l.key}>
          <p id={`${id}-${l.key}`} className="text-[12px] font-bold uppercase tracking-[.05em] text-ink-3">{l.label}</p>
          <ul aria-labelledby={`${id}-${l.key}`} className="mt-1 space-y-1 text-[14.5px] leading-snug text-ink-2">
            {l.items.map((t, i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden className={`w-3 shrink-0 font-bold ${l.signClass}`}>{l.sign}</span>
                <span className="min-w-0">{t}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

export function ProductPick({ product, offer, compact, anchor, pros = [], cons = [], uid }: Props) {
  const id = anchor ? `produs-${product.slug}` : undefined

  if (compact) {
    return (
      <div id={id} className="flex scroll-mt-24 flex-col gap-2">
        <Photo src={product.image_url} sizeClass="h-[72px] w-[72px]" maxPx={72} />
        {offer ? (
          <>
            <p className="text-[11.5px] leading-snug text-ink-3">Cel mai bun preț găsit la magazinele partenere</p>
            <p className="font-display text-[22px] font-extrabold leading-none tabular-nums text-ink">{formatPrice(offer.current_price)}</p>
            <ShopButton product={product} offer={offer} className={`${btn('primary', 'sm')} w-full`} />
          </>
        ) : (
          <p className="text-[13px] leading-snug text-ink-3">{UNAVAILABLE}</p>
        )}
      </div>
    )
  }

  return (
    // Chenarul de sus de 3px în culoarea textului = semnătura „Revista” (varianta A)
    <div id={id} className="my-6 scroll-mt-24 border-t-[3px] border-ink bg-surface pt-4">
      <div className="flex gap-4">
        {/* Pe telefon (375 px) poza e mai mică, ca prețul mare să încapă lângă ea pe un rând */}
        <Photo src={product.image_url} sizeClass="h-[84px] w-[84px] sm:h-28 sm:w-28" maxPx={112} />
        <div className="min-w-0 flex-1">
          <p className="font-display text-[17px] font-extrabold leading-snug text-ink sm:text-[20px] [overflow-wrap:anywhere]">{product.name}</p>
          {offer ? (
            <>
              <p className="mt-2 text-[12px] font-bold uppercase tracking-[.05em] text-ink-3">
                Cel mai bun preț găsit la magazinele partenere
              </p>
              <p className="mt-1 font-display text-[26px] font-extrabold leading-none tabular-nums text-ink sm:text-[34px]">
                {formatPrice(offer.current_price)}
              </p>
            </>
          ) : (
            <p className="mt-2 text-[14px] text-ink-3">{UNAVAILABLE}</p>
          )}
        </div>
      </div>
      <Notes id={`note-${uid ?? product.id}`} pros={pros} cons={cons} />
      {offer && (
        // Pe telefon butonul ocupă toată lățimea (țintă mare la atingere); de la sm, cât textul
        <div className="mt-4 sm:pl-[128px]">
          <ShopButton product={product} offer={offer} className={`${btn('primary', 'lg')} w-full max-w-full sm:w-auto`} />
        </div>
      )}
    </div>
  )
}
