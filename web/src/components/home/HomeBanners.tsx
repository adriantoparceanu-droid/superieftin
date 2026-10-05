'use client'

import { useState } from 'react'
import type { Banner as BannerData } from '@/lib/queries'
import { RawEmbed } from '@/components/RawEmbed'
import { useAdAllowed } from '@/components/consent/AdConsentGate'
import { homeBannerLayout, clampMainBannerHeight } from '@/lib/home-banners'

type SmallSlot = 'small_left' | 'small_right'
const SMALL_SLOTS: SmallSlot[] = ['small_left', 'small_right']

// Bannerele administrate din /admin/bannere (un banner mare + două mici), SUS pe homepage,
// imediat sub antet, în containerul paginii (aceeași lățime ca restul secțiunilor).
//   ≥ xl:   mare în stânga + coloană de 500 px în dreapta cu cele 2 mici suprapuse
//           (widgeturile Profitshare au 468×60 px, măsurat pe producție)
//   lg–xl:  mare pe toată lățimea, cele 2 mici pe un rând dedesubt
//   < lg:   nimic (blocul e ascuns, iar bannerele HTML nici nu se încarcă — useAdAllowed)
// Lipsește un banner → aranjarea se adaptează (lib/home-banners.ts).
//
// Bannerele HTML (scripturi de afiliere → cookie-uri) se încarcă DOAR cu acord „Publicitate”.
// `adConsentHint` = acordul citit pe server din cookie: cu el, casetele se rezervă încă din
// HTML-ul serverului (pagina nu sare când apar bannerele); scripturile tot doar după
// verificarea din browser. Fără acord casetele nu apar deloc — nu lăsăm dreptunghiuri goale.
// O casetă al cărei widget n-a afișat nimic (RawEmbed → onEmpty) dispare și ea.
export function HomeBanners({ banners, adConsentHint }: {
  banners: Record<string, BannerData>
  adConsentHint: boolean
}) {
  const allowed = useAdAllowed(1024)
  const [empty, setEmpty] = useState<Record<number, boolean>>({})
  const [mainHeight, setMainHeight] = useState<number | null>(null)

  // Vizibil = imagine (mereu) sau HTML cu acord (până știm în browser: indiciul serverului)
  const visible = (b: BannerData | undefined): b is BannerData => {
    if (!b) return false
    if (b.type === 'image') return Boolean(b.image_url)
    if (b.type !== 'html' || !b.html) return false
    return (allowed ?? adConsentHint) && !empty[b.id]
  }

  const main = visible(banners['main']) ? banners['main'] : null
  const smalls = SMALL_SLOTS.map((s) => banners[s]).filter(visible)
  const layout = homeBannerLayout(Boolean(main), smalls.length)
  if (!layout) return null

  const markEmpty = (id: number) => setEmpty((e) => ({ ...e, [id]: true }))

  return (
    <aside aria-label="Publicitate" className="hidden lg:block lg:mb-4">
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3">Publicitate</p>
      <div className={layout === 'grid' ? 'grid gap-3 xl:grid-cols-[minmax(0,1fr)_500px]' : 'grid gap-3'}>
        {main && (
          <div
            className="overflow-hidden rounded-xl border border-line bg-surface"
            // Bannerul mare HTML: până la primul raport rezervăm raportul formatului obișnuit
            // (1170×310, banner 2Performant); apoi înălțimea reală a conținutului, limitată (+2 = bordura)
            style={main.type === 'html'
              ? (mainHeight ? { height: clampMainBannerHeight(mainHeight) + 2 } : { aspectRatio: '1170 / 310' })
              : undefined}
          >
            {main.type === 'image' ? (
              <BannerImage banner={main} />
            ) : allowed ? (
              <RawEmbed
                id={main.id}
                fill
                onHeight={(h) => { if (h > 0) setMainHeight(h) }}
                onEmpty={() => markEmpty(main.id)}
              />
            ) : null}
          </div>
        )}

        {smalls.length > 0 && (
          <div
            className={
              smalls.length === 1
                ? 'grid gap-3 xl:flex xl:flex-col'
                // ≥ xl lângă bannerul mare: coloană, fiecare casetă ia jumătate din înălțimea lui
                : layout === 'grid' ? 'grid grid-cols-2 gap-3 xl:flex xl:flex-col' : 'grid grid-cols-2 gap-3'
            }
          >
            {smalls.map((b) => (
              <SmallBox key={b.id} banner={b} load={allowed === true} onEmpty={() => markEmpty(b.id)} />
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}

// Caseta unui banner mic: înălțime controlată + overflow ascuns, ca un widget să nu poată
// împinge pagina; conținutul centrat. Sub xl: fix 84 px (widget 468×60 + aer). ≥ xl: flex-1 cu
// bază 0 (min 84 px) → casetele împart înălțimea bannerului mare, oricât de înalt e widgetul.
function SmallBox({ banner, load, onEmpty }: { banner: BannerData; load: boolean; onEmpty: () => void }) {
  return (
    <div className="flex h-[84px] items-center justify-center overflow-hidden rounded-xl border border-line bg-surface px-3 xl:h-auto xl:min-h-[84px] xl:flex-1">
      {banner.type === 'image' ? (
        <BannerImage banner={banner} contain />
      ) : load ? (
        <div className="w-full max-h-full overflow-hidden">
          <RawEmbed id={banner.id} onEmpty={onEmpty} />
        </div>
      ) : null}
    </div>
  )
}

// Banner de tip imagine (cu link opțional). Mare: lățimea casetei, raport păstrat (nu taie
// textul din banner). Mic (`contain`): încape în casetă, centrat.
function BannerImage({ banner, contain = false }: { banner: BannerData; contain?: boolean }) {
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={banner.image_url ?? ''}
      alt={banner.alt ?? banner.title ?? ''}
      // lazy: pe mobil blocul e display:none → imaginea nici nu se descarcă
      loading="lazy"
      className={contain ? 'block max-h-full max-w-full object-contain' : 'block h-auto w-full'}
    />
  )
  return banner.link_url ? (
    <a
      href={banner.link_url}
      target="_blank"
      rel="noopener sponsored"
      className={contain ? 'flex h-full items-center justify-center' : 'block'}
    >
      {img}
    </a>
  ) : img
}
