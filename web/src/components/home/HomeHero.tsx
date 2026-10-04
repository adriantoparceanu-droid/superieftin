import { SearchForm } from '@/components/header/SearchForm'
import type { SiteFacts } from '@/lib/seo/site-facts'

// Hero-ul homepage-ului (macheta direcției B, „.hero”): continuă antetul cărbune, pune întrebarea
// vizitatorului și explică metoda într-o frază. Cifrele vin LIVE din getSiteFacts (cache 1 h,
// același query ca descrierea paginii) — nimic scris de mână; fără date (DB căzut) nu apar deloc.
//
// Căutarea: pe mobil antetul are deja căutarea deschisă pe prima pagină (MobileHeader), chiar
// deasupra hero-ului — o a doua, imediat dedesubt, ar fi dublură. De aceea câmpul mare din hero
// apare doar de la lg (desktop), unde e „căutarea mare” din design.
//
// Fundalul cărbune iese din containerul paginii (max-w-7xl, px-4) până la marginile ecranului
// prin box-shadow + clip-path — NU cu 100vw/margini negative, care ar adăuga scroll orizontal
// (100vw include bara de derulare pe desktop).
export function HomeHero({ facts }: { facts: SiteFacts | null }) {
  const stats: [number, string][] = facts
    ? ([
        [facts.products, 'produse urmărite'],
        [facts.retailers, facts.retailers === 1 ? 'magazin' : 'magazine'],
        [facts.realDiscounts, 'reduceri reale azi'],
      ] as [number, string][]).filter(([n]) => n > 0)
    : []

  return (
    <section
      aria-labelledby="home-titlu"
      className="-mt-6 bg-head text-head-ink [box-shadow:0_0_0_100vmax_var(--head)] [clip-path:inset(0_-100vmax)] pt-1.5 pb-[22px] lg:pt-10 lg:pb-12"
    >
      <h1
        id="home-titlu"
        className="text-[31px] leading-[1.04] font-black [font-stretch:82%] tracking-[-0.02em] sm:text-[40px] lg:text-[54px] lg:max-w-[880px]"
      >
        Merită acum? <em className="not-italic text-red-on-head">Vezi prețul față de ultimele 30 de zile.</em>
      </h1>
      <p className="mt-2.5 mb-3.5 text-[14.5px] text-head-ink-2 lg:mt-4 lg:mb-6 lg:text-[17px] lg:max-w-[640px]">
        Comparăm prețul de azi cu mediana ultimelor 30 de zile. Reducere reală = cel puțin 5% sub ea.
      </p>

      <SearchForm className="hidden lg:flex lg:max-w-[640px] h-14! pl-4! pr-2!" />

      {stats.length > 0 && (
        <dl className="mt-3.5 flex flex-wrap gap-x-4 gap-y-2 text-xs text-head-ink-2 lg:mt-7 lg:gap-x-10 lg:text-sm">
          {stats.map(([n, label]) => (
            // dt/dd în ordinea vizuală inversă: cifra (dd) sus, eticheta (dt) jos
            <div key={label} className="flex flex-col-reverse">
              <dt>{label}</dt>
              <dd className="font-display text-[18px] leading-tight text-head-ink tabular lg:text-[28px]">
                {n.toLocaleString('ro-RO')}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  )
}
