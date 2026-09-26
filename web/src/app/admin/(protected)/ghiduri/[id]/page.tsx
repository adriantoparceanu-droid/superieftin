import Link from 'next/link'
import { notFound } from 'next/navigation'
import { GuideEditor } from '@/components/admin/GuideEditor'
// Componentele client din previzualizare trebuie importate de pagina (vezi fisierul)
import '@/components/guides/preview-client-refs'
import { getGuideAdmin, getGuideAuthors, getGuideCategoryOptions } from '@/lib/admin/guides'
import { deleteGuideAction } from '@/lib/admin/guide-actions'

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ salvat?: string }> }

export default async function EditGuidePage({ params, searchParams }: Props) {
  const { id } = await params
  const { salvat } = await searchParams
  const guideId = Number(id)
  if (!Number.isInteger(guideId) || guideId <= 0) notFound()
  const [guide, authors, categories] = await Promise.all([
    getGuideAdmin(guideId),
    getGuideAuthors(),
    getGuideCategoryOptions(),
  ])
  if (!guide) notFound()

  return (
    <div className="max-w-4xl">
      <p className="text-sm mb-2"><Link href="/admin/ghiduri" className="text-muted hover:text-brand">← Ghiduri</Link></p>
      <h1 className="text-2xl font-bold mb-1">{guide.title}</h1>
      {salvat && <p className="text-sm text-green-700 mb-4">Ciorna a fost creată.</p>}
      {/* key: dupa salvare editorul pastreaza starea locala; la schimbarea ghidului porneste curat */}
      <GuideEditor key={guide.id} guide={guide} authors={authors} categories={categories} />

      {guide.status === 'draft' && (
        <form action={deleteGuideAction} className="mt-8 border-t border-line pt-4">
          <input type="hidden" name="id" value={guide.id} />
          <button type="submit" className="text-sm text-red-600 hover:underline">Șterge ciorna definitiv</button>
        </form>
      )}
    </div>
  )
}
