import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getCategoryProducts, getCategories } from '@/lib/queries'
import { ProductCard } from '@/components/ProductCard'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ categorie: string }>
  searchParams: Promise<{ sort?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { categorie } = await params
  const label = categorie.replace(/-/g, ' ')
  const title = `${label.charAt(0).toUpperCase() + label.slice(1)} — prețuri și reduceri reale`
  const description = `Comparator de prețuri pentru ${label}. Verificăm reducerile față de mediana prețurilor pe 30 de zile.`
  return {
    title,
    description,
    alternates: { canonical: `/c/${categorie}` },
    openGraph: { title, description },
  }
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { categorie } = await params
  const { sort = 'price' } = await searchParams
  const sortValue = (sort === 'discount' || sort === 'price' || sort === 'name') ? sort : 'price'

  const products = await getCategoryProducts(categorie, 48, sortValue)

  if (products.length === 0) {
    // Categoria nu exista sau e goala
    const categories = await getCategories()
    const exists = categories.some(c => c.category === categorie)
    if (!exists) notFound()
  }

  const label = categorie.replace(/-/g, ' ')
  const discountCount = products.filter(p => p.discount_pct != null).length

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://superieftin.ro'
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${label.charAt(0).toUpperCase() + label.slice(1)} — prețuri`,
    numberOfItems: products.length,
    itemListElement: products.slice(0, 10).map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${siteUrl}/p/${p.slug}`,
      name: p.name,
    })),
  }

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Acasă', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: label, item: `${siteUrl}/c/${categorie}` },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />

      {/* Header categorie */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 capitalize">{label}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {products.length} produse
          {discountCount > 0 && `, ${discountCount} cu reducere reală verificată`}
        </p>
      </div>

      {/* Sortare */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {[
          { value: 'price', label: 'Preț mic' },
          { value: 'discount', label: 'Reducere maximă' },
          { value: 'name', label: 'Alfabetic' },
        ].map(opt => (
          <a
            key={opt.value}
            href={`/c/${categorie}?sort=${opt.value}`}
            className={`text-sm px-4 py-1.5 rounded-full border transition-colors ${
              sortValue === opt.value
                ? 'bg-red-600 text-white border-red-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-red-400 hover:text-red-600'
            }`}
          >
            {opt.label}
          </a>
        ))}
      </div>

      {/* Grid produse */}
      {products.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {products.map((product) => (
            <ProductCard key={product.offer_id} product={product} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-gray-400">
          <p className="text-5xl mb-4">📦</p>
          <p>Niciun produs disponibil în această categorie.</p>
        </div>
      )}
    </>
  )
}
