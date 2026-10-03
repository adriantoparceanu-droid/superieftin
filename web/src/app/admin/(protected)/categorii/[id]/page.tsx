import Link from 'next/link'
import { notFound } from 'next/navigation'
import pool from '@/lib/db'
import { getCategoryStats } from '@/lib/category-content'
import { CAT_MARKER_KEYS, markerValue, parseFaq } from '@/lib/category-markers'
import { CategoryContentView } from '@/components/CategoryContent'
import { CategoryContentEditor } from '@/components/admin/CategoryContentEditor'

// Admin → Categorii → „text”: textul introductiv + întrebările frecvente ale unei categorii
// (migrația 030), afișate pe /c/<slug> sub lista de produse.
type Props = { params: Promise<{ id: string }> }

// Ce înseamnă fiecare marcaj (pentru tabelul de ajutor)
const MARKER_HELP: Record<string, string> = {
  produse: 'nr. de produse disponibile (cu subcategoriile)',
  magazine: 'nr. de magazine cu oferte disponibile',
  'lista-magazine': 'numele magazinelor',
  reduceri: 'nr. de produse cu reducere reală acum (ca pe /reduceri-reale/)',
  'cu-mediana': 'nr. de produse care au deja mediana pe 30 de zile',
  'pret-median': 'prețul median al produselor',
  'pret-p10': '8 din 10 produse costă peste…',
  'pret-p90': '…și sub această valoare',
  'branduri-top': 'primele 5 mărci după nr. de produse',
  'istoric-de-la': 'luna din care urmărim prețurile',
  actualizat: 'momentul calculului cifrelor',
  prag: 'pragul reducerii reale',
}

export default async function CategoryContentPage({ params }: Props) {
  const { id } = await params
  const categoryId = Number(id)
  if (!Number.isInteger(categoryId) || categoryId <= 0) notFound()

  const { rows } = await pool.query(`
    SELECT c.id, c.name, c.slug, c.intro_md, c.faq, c.content_updated_at, pc.slug AS parent_slug
    FROM categories c LEFT JOIN categories pc ON pc.id = c.parent_id
    WHERE c.id = $1
  `, [categoryId])
  const cat = rows[0]
  if (!cat) notFound()

  const faq = parseFaq(cat.faq)
  const stats = await getCategoryStats(cat.slug)
  const isHealth = cat.slug === 'sanatate-naturale' || cat.parent_slug === 'sanatate-naturale'

  return (
    <div className="max-w-4xl">
      <p className="text-sm mb-2"><Link href="/admin/categorii" className="text-muted hover:text-brand">← Categorii</Link></p>
      <h1 className="text-2xl font-bold mb-1">Text pentru „{cat.name}”</h1>
      <p className="text-sm text-muted mb-4">
        Apare pe <Link href={`/c/${cat.slug}`} target="_blank" className="text-brand hover:underline">/c/{cat.slug} ↗</Link> sub
        lista de produse, doar pe pagina 1 fără filtre. Fără promisiuni de reduceri: scrie ce constatăm
        („la momentul actualizării”), cifrele doar prin marcaje.
        {cat.content_updated_at && <> Ultima salvare: {new Date(cat.content_updated_at).toLocaleString('ro-RO', { timeZone: 'Europe/Bucharest' })}.</>}
      </p>
      {isHealth && (
        <p className="text-sm bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
          Categorie din Sănătate &amp; Naturale: nicio afirmație de sănătate (REGULI.md, regula 8). Salvarea e blocată la cuvinte ca „vindecă”, „tratează”, „detoxifică”, dar verifică și restul textului.
        </p>
      )}

      <CategoryContentEditor key={cat.id} id={cat.id} intro={cat.intro_md ?? ''} faq={faq} />

      <details className="mt-6 bg-white border border-line rounded-xl p-4">
        <summary className="text-sm font-semibold cursor-pointer">Marcaje disponibile (valorile de acum pentru această categorie)</summary>
        <p className="text-xs text-muted mt-2">
          La numere poți adăuga substantivul, la singular și plural: <code>{'{{cat:produse|laptop|laptopuri}}'}</code> → „1 laptop”, „12 laptopuri”, „1.221 de laptopuri”.
        </p>
        <table className="w-full text-sm mt-2">
          <tbody>
            {CAT_MARKER_KEYS.map((k) => (
              <tr key={k} className="border-t border-line">
                <td className="py-1.5 pr-3 font-mono text-xs whitespace-nowrap">{`{{cat:${k}}}`}</td>
                <td className="py-1.5 pr-3">{markerValue(k, stats)}</td>
                <td className="py-1.5 text-xs text-muted">{MARKER_HELP[k]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>

      <div className="mt-6">
        <p className="text-sm font-semibold mb-2">Previzualizare (textul salvat, cu cifrele de acum)</p>
        <div className="bg-white border border-line rounded-xl p-4 [&>section]:mt-0 [&>section]:border-t-0 [&>section]:pt-0">
          {cat.intro_md || faq.length
            ? <CategoryContentView name={cat.name} intro={cat.intro_md} faq={faq} stats={stats} />
            : <p className="text-sm text-muted">Încă nu există text pentru această categorie.</p>}
        </div>
      </div>
    </div>
  )
}
