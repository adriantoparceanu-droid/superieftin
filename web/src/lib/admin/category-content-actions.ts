'use server'

// Salvarea textului unei categorii (Admin → Categorii → „text”). Coloanele din migratia 030.
import { revalidatePath, revalidateTag, refresh } from 'next/cache'
import pool from '../db'
import { requireAdmin } from './session'
import { validateCategoryContent, MAX_FAQ, type CategoryFaqItem } from '../category-markers'

export type CategoryContentState = { error?: string; message?: string } | null

export async function saveCategoryContentAction(_prev: CategoryContentState, formData: FormData): Promise<CategoryContentState> {
  await requireAdmin()

  const id = Number(formData.get('id'))
  if (!Number.isInteger(id) || id <= 0) return { error: 'Categorie invalidă.' }
  const intro = String(formData.get('intro_md') ?? '').trim()
  let faq: CategoryFaqItem[] = []
  try {
    const raw = JSON.parse(String(formData.get('faq') ?? '[]'))
    if (Array.isArray(raw)) {
      faq = raw
        .map((f) => ({ q: String(f?.q ?? '').trim(), a: String(f?.a ?? '').trim() }))
        // randurile complet goale se ignora; cele completate pe jumatate ajung la validare
        .filter((f) => f.q || f.a)
    }
  } catch {
    return { error: 'Întrebările frecvente nu au putut fi citite.' }
  }
  if (faq.length > MAX_FAQ) return { error: `Maxim ${MAX_FAQ} întrebări.` }

  // Aceleasi reguli ca pentru textele din migratie: marcaje cunoscute, fara preturi/procente
  // scrise de mana (regula 9), fara promisiuni, fara afirmatii de sanatate (regula 8)
  const issues = validateCategoryContent(intro, faq)
  if (issues.length) {
    return { error: `Nu am salvat. ${issues.map((i) => `${i.field}: ${i.message}`).join(' · ')}` }
  }

  const { rows } = await pool.query<{ slug: string }>(`
    UPDATE categories
    SET intro_md = $2, faq = $3::jsonb, content_updated_at = now()
    WHERE id = $1
    RETURNING slug
  `, [id, intro || null, JSON.stringify(faq)])
  if (!rows[0]) return { error: 'Categoria nu mai există.' }

  // getCategoryContent are tag-ul 'categories'; pagina /c/ e dinamica, dar datele sunt in cache
  revalidateTag('categories', 'max')
  revalidatePath(`/c/${rows[0].slug}`)
  refresh()
  return { message: 'Salvat. Textul apare pe pagina categoriei (pagina 1, fără filtre).' }
}
