import { RawEmbed } from './RawEmbed'
import type { Banner as BannerType } from '@/lib/queries'

// Randeaza un banner administrat: fie cod HTML/JS brut, fie o imagine (optional cu link).
export function Banner({ banner, className }: { banner: BannerType; className?: string }) {
  if (banner.type === 'html' && banner.html) {
    return (
      <div className={`overflow-hidden rounded-2xl ${className ?? ''}`}>
        <RawEmbed id={banner.id} />
      </div>
    )
  }

  if (banner.image_url) {
    const img = (
      // Se scaleaza la latimea cadrului (max 970px), pastrand proportiile — h-auto.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={banner.image_url}
        alt={banner.alt ?? banner.title ?? ''}
        className="block w-full h-auto"
      />
    )
    return (
      <div className={`overflow-hidden rounded-2xl border border-line ${className ?? ''}`}>
        {banner.link_url ? (
          <a href={banner.link_url} target="_blank" rel="noopener sponsored" className="block">
            {img}
          </a>
        ) : (
          img
        )}
      </div>
    )
  }

  return null
}
