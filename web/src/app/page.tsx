import type { Metadata } from 'next'
import Link from 'next/link'
import { BookOpen, Calculator } from 'lucide-react'
import {
  getTopDiscounts, getCheapestProducts, getCategories,
  getActiveRetailersPublic, getMenu, getBanners,
  type Banner as BannerData,
} from '@/lib/queries'
import { ProductCard } from '@/components/ProductCard'
import { Banner } from '@/components/Banner'
import { AdConsentGate } from '@/components/consent/AdConsentGate'
import { RetailerStrip } from '@/components/RetailerStrip'
import { HomeHero } from '@/components/home/HomeHero'
import { VerdictLegend } from '@/components/home/VerdictLegend'
import { SectionHeading } from '@/components/home/SectionHeading'
import { HomeCategories } from '@/components/home/HomeCategories'
import { getSiteFacts } from '@/lib/seo/site-facts'
import { withOg } from '@/lib/seo/og'
import { SITE_URL, roCount } from '@/lib/seo/site'

export const dynamic = 'force-dynamic'

// Titlul cu brand + ce face site-ul (template-ul „%s | superieftin.ro” nu se aplica pe radacina,
// deci titlul era fara brand). Descrierea are cifre live (lib/seo/site-facts.ts, cache 1 h).
const HOME_TITLE = 'superieftin.ro — comparator de prețuri cu istoric și reduceri reale'

export async function generateMetadata(): Promise<Metadata> {
  const facts = await getSiteFacts().catch(() => null)
  const tracked = facts && facts.products > 0
    ? `Urmărim zilnic ${roCount(facts.products, 'produse', 'produs')} de la ${roCount(facts.retailers, 'magazine online', 'magazin online')} din România. `
    : 'Urmărim zilnic prețurile magazinelor online din România. '
  const description = `${tracked}Comparăm prețul de azi cu mediana ultimelor 30 de zile — nu cu prețul vechi afișat de magazin.`
  return {
    title: { absolute: HOME_TITLE },
    description,
    alternates: { canonical: '/' },
    openGraph: withOg({ title: HOME_TITLE, description, url: `${SITE_URL}/` }),
  }
}

// Câte carduri arătăm în „Reduceri reale azi”: 12 = 2 rânduri pe desktop (6 coloane) și
// 3 rânduri pe tabletă (4 coloane); pe mobil (2 coloane) doar primele 8, ca pagina să nu fie
// un perete de carduri înainte de categorii.
const TOP_PRODUCTS = 12
const TOP_PRODUCTS_MOBILE = 8

// Homepage-ul redesignului (design §4 „Homepage”, macheta direcției B, secțiunea 3):
// hero cărbune cu metoda și cifre live → bannerele din admin (dacă există) → legenda verdictelor
// → reducerile reale de azi → categorii → ghiduri → magazinele urmărite.
// JSON-LD WebSite (+ SearchAction) si Organization sunt in layout, pe toate paginile
// (lib/seo/jsonld.ts), cu @id comun.
export default async function HomePage() {
  const [facts, discounts, categories, retailers, menu, banners] = await Promise.all([
    getSiteFacts().catch(() => null),
    getTopDiscounts(TOP_PRODUCTS * 2).catch(() => []),
    getCategories().catch(() => []),
    getActiveRetailersPublic().catch(() => []),
    getMenu().catch(() => []),
    getBanners().catch(() => ({} as Record<string, BannerData>)),
  ])

  // getTopDiscounts întoarce oferte, nu produse: același produs poate apărea de două ori (la
  // două magazine). Păstrăm prima apariție (cea cu procentul cel mai mare — lista e sortată).
  const seen = new Set<string>()
  const topDiscounts = discounts.filter((p) => !seen.has(p.id) && seen.add(p.id)).slice(0, TOP_PRODUCTS)

  // Fără reduceri reale (ex. imediat după un import, înainte să avem 30 de zile de date):
  // cele mai mici prețuri, ca înainte — dar cerute doar atunci, nu la fiecare afișare.
  const isRealDiscount = topDiscounts.length > 0
  const products = isRealDiscount
    ? topDiscounts
    : await getCheapestProducts(TOP_PRODUCTS).catch(() => [])

  return (
    <>
      <HomeHero facts={facts} />
      <HomeBanners banners={banners} />
      <VerdictLegend />

      <section aria-labelledby="reduceri-azi">
        <SectionHeading
          id="reduceri-azi"
          title={isRealDiscount ? 'Reduceri reale azi' : 'Cele mai mici prețuri acum'}
          // Legătura internă spre hubul /reduceri-reale (raport SEO, A8)
          href="/reduceri-reale"
          sub={isRealDiscount
            ? 'Sortate după procentul sub mediana pe 30 de zile · prețuri verificate în ultimele 48 de ore'
            : 'Reducerile reale apar pe măsură ce adunăm istoricul de prețuri.'}
        />
        {products.length > 0 ? (
          <ul className="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-3 lg:grid-cols-6">
            {products.map((product, i) => (
              <li key={product.offer_id} className={i >= TOP_PRODUCTS_MOBILE ? 'hidden md:block' : undefined}>
                <ProductCard product={product} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl bg-surface p-6 text-center text-sm text-ink-3 shadow-card">
            Monitorizăm prețurile — reducerile reale apar pe măsură ce acumulăm date.
          </p>
        )}
      </section>

      {categories.length > 0 && (
        <section aria-labelledby="categorii">
          <SectionHeading id="categorii" title="Categorii" />
          <HomeCategories categories={categories} menu={menu} />
        </section>
      )}

      {/* Ghiduri: homepage-ul nu încarcă articolele (fără query în plus pe fiecare afișare) —
          doar linkuri spre lista de ghiduri și spre metodologie, pagini care există mereu. */}
      <section aria-labelledby="ghiduri">
        <SectionHeading id="ghiduri" title="Ghiduri" href="/ghiduri" />
        <div className="grid gap-2 lg:grid-cols-2 lg:gap-3">
          <GuideLink
            href="/ghiduri"
            icon={<BookOpen size={26} aria-hidden="true" />}
            title="Ghiduri de cumpărare"
            text="Ce contează când alegi, cu prețuri și reduceri actualizate automat din datele noastre."
          />
          <GuideLink
            href="/ghiduri/metodologie"
            icon={<Calculator size={26} aria-hidden="true" />}
            title="Cum calculăm reducerea reală"
            text="Mediana ultimelor 30 de zile, pragul de 5% și de ce nu ne uităm la prețul vechi afișat de magazin."
          />
        </div>
      </section>

      <RetailerStrip retailers={retailers} />
    </>
  )
}

// Card de ghid (macheta „.guide”): iconiță pe surface-2 + titlu + o frază
function GuideLink({ href, icon, title, text }: { href: string; icon: React.ReactNode; title: string; text: string }) {
  return (
    <Link
      href={href}
      className="group flex gap-3 rounded-xl bg-surface p-3 shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink lg:p-4"
    >
      <span className="grid h-[54px] w-[54px] shrink-0 place-items-center rounded-[10px] bg-surface-2 text-ink-3">{icon}</span>
      <span className="min-w-0">
        <b className="block text-sm leading-[1.3] text-ink group-hover:text-red-ink transition-colors lg:text-base">{title}</b>
        <span className="text-xs text-ink-3 lg:text-sm">{text}</span>
      </span>
    </Link>
  )
}

// Bannerele administrate din /admin/bannere (un banner mare + două mici), sub hero.
// Toate tipurile erau deja doar pentru desktop (imaginile au format 970 px; bannerele HTML de
// afiliere cer acord „Publicitate” + ecran lat — AdConsentGate), deci tot blocul e ascuns sub lg.
// Fără bannere active nu se afișează nimic.
function HomeBanners({ banners }: { banners: Record<string, BannerData> }) {
  const main = banners['main'] ?? null
  const smalls = (['small_left', 'small_right'] as const).filter((slot) => banners[slot])
  if (!main && smalls.length === 0) return null

  // Banner HTML de afiliere (scripturi Profitshare → cookie): doar cu acord „Publicitate”
  const render = (b: BannerData) =>
    b.type === 'html' ? <AdConsentGate><Banner banner={b} /></AdConsentGate> : <Banner banner={b} />

  return (
    <div className="hidden lg:flex flex-col gap-4 w-full max-w-[970px] mx-auto pt-6">
      {main && render(main)}
      {smalls.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          {smalls.map((slot) => <div key={slot}>{render(banners[slot])}</div>)}
        </div>
      )}
    </div>
  )
}
