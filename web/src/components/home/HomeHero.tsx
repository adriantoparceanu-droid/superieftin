import type { SiteFacts } from '@/lib/seo/site-facts'

// Hero-ul homepage-ului: o bandă cărbune scurtă — întrebarea vizitatorului, metoda într-o frază
// și cifrele LIVE din getSiteFacts (cache 1 h, același query ca descrierea paginii; nimic scris
// de mână; fără date — DB căzut — cifrele nu apar deloc).
//
// Fără câmp de căutare: antetul îl are deja (pe desktop în bara de sus, pe mobil deschis pe
// prima pagină) — o a doua căutare imediat dedesubt era dublură (decizia proprietarului, 5 oct 2026).
//
// Mobil (< lg): continuă antetul cărbune — fundalul iese din containerul paginii (max-w-7xl, px-4)
// până la marginile ecranului prin box-shadow + clip-path, NU cu 100vw/margini negative (ar
// adăuga scroll orizontal: 100vw include bara de derulare).
// Desktop (lg+): sub bannere, deci o casetă rotunjită în containerul paginii (aliniată cu
// bannerele și cu secțiunile), titlul + fraza în stânga, cifrele în dreapta pe același rând.
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
      className="-mt-6 bg-head text-head-ink [box-shadow:0_0_0_100vmax_var(--head)] [clip-path:inset(0_-100vmax)] pt-1.5 pb-[18px] lg:mt-0 lg:flex lg:items-center lg:justify-between lg:gap-8 lg:rounded-2xl lg:px-7 lg:py-5 lg:[box-shadow:none] lg:[clip-path:none]"
    >
      <div className="min-w-0">
        <h1
          id="home-titlu"
          className="text-[27px] leading-[1.06] font-black [font-stretch:82%] tracking-[-0.015em] sm:text-[32px] lg:text-[26px] xl:text-[31px]"
        >
          Merită acum? <em className="not-italic text-red-on-head">Vezi prețul față de ultimele 30 de zile.</em>
        </h1>
        <p className="mt-2 text-[14px] text-head-ink-2 lg:mt-1.5 lg:text-[14.5px]">
          Comparăm prețul de azi cu mediana ultimelor 30 de zile. Reducere reală = cel puțin 5% sub ea.
        </p>
      </div>

      {stats.length > 0 && (
        <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-2 lg:flex-nowrap text-xs text-head-ink-2 lg:mt-0 lg:shrink-0 lg:gap-x-7 lg:text-[13px]">
          {stats.map(([n, label]) => (
            // dt/dd în ordinea vizuală inversă: cifra (dd) sus, eticheta (dt) jos
            <div key={label} className="flex flex-col-reverse">
              <dt className="whitespace-nowrap">{label}</dt>
              <dd className="font-display text-[18px] leading-tight text-head-ink tabular lg:text-[24px]">
                {n.toLocaleString('ro-RO')}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  )
}
