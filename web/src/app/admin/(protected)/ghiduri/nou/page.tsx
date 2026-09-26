import Link from 'next/link'
import { GuideEditor } from '@/components/admin/GuideEditor'
// Componentele client din previzualizare trebuie importate de pagina (vezi fisierul)
import '@/components/guides/preview-client-refs'
import { getGuideAuthors, getGuideCategoryOptions, getProductsByIds } from '@/lib/admin/guides'

type Props = { searchParams: Promise<{ produs?: string }> }

export default async function NewGuidePage({ searchParams }: Props) {
  const { produs } = await searchParams
  const [authors, categories, prefill] = await Promise.all([
    getGuideAuthors(),
    getGuideCategoryOptions(),
    produs && /^\d+$/.test(produs) ? getProductsByIds([produs]) : Promise.resolve([]),
  ])

  // „Creează ghid” din lista de candidati: produsul legat, categoria lui si un schelet cu marcaje
  // live (fara text inventat — autorul scrie continutul, preturile vin din date).
  const p = prefill[0]
  const initial = p
    ? {
        products: [{ id: p.id, name: p.name, slug: p.slug }],
        category_slug: categories.some((c) => c.slug === p.category) ? p.category : null,
        body_md: `{{reducere:${p.id}}}\n\n## \n\n{{oferte:${p.id}}}\n\n{{istoric-pret:${p.id}}}\n`,
      }
    : undefined

  return (
    <div className="max-w-4xl">
      <p className="text-sm mb-2"><Link href="/admin/ghiduri" className="text-muted hover:text-brand">← Ghiduri</Link></p>
      <h1 className="text-2xl font-bold mb-6">Ghid nou</h1>
      <GuideEditor guide={null} authors={authors} categories={categories} initial={initial} />
    </div>
  )
}
