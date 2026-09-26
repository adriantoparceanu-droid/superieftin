import Link from 'next/link'
import { getGuideAuthors } from '@/lib/admin/guides'
import { saveGuideAuthorAction } from '@/lib/admin/guide-actions'

const input = 'w-full border border-line rounded-lg px-3 py-1.5 text-sm bg-white'

// Autorii si verificatorii ghidurilor. DOAR persoane reale (fara autori inventati);
// „url” = pagina autorului (pe site, /…, sau profil public https://…), optionala.
export default async function AutoriPage() {
  const authors = await getGuideAuthors()

  const fields = (a?: (typeof authors)[number]) => (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="block text-xs text-muted mb-1">Nume</label>
          <input name="name" defaultValue={a?.name} required className={input} />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Tip</label>
          <select name="kind" defaultValue={a?.kind ?? 'person'} className={input}>
            <option value="person">Persoană</option>
            <option value="organization">Organizație / echipă</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Pagină (opțional: /despre sau https://…)</label>
          <input name="url" defaultValue={a?.url ?? ''} className={input} />
        </div>
      </div>
      <div>
        <label className="block text-xs text-muted mb-1">Bio scurt (opțional)</label>
        <textarea name="bio" defaultValue={a?.bio ?? ''} rows={2} className={input} />
      </div>
    </>
  )

  return (
    <div className="max-w-3xl space-y-6">
      <p className="text-sm"><Link href="/admin/ghiduri" className="text-muted hover:text-brand">← Ghiduri</Link></p>
      <h1 className="text-2xl font-bold">Autori ghiduri</h1>
      <p className="text-sm text-muted">Adaugă doar persoane reale. Verificatorul („Verificat de”) trebuie să fie o persoană.</p>

      {authors.map((a) => (
        <form key={a.id} action={saveGuideAuthorAction} className="bg-white border border-line rounded-xl p-4 space-y-3">
          <input type="hidden" name="id" value={a.id} />
          {fields(a)}
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted">slug: {a.slug}</span>
            <button type="submit" className="text-sm border border-line rounded-lg px-4 py-1.5 hover:border-brand">Salvează</button>
          </div>
        </form>
      ))}

      <form action={saveGuideAuthorAction} className="bg-white border border-line rounded-xl p-4 space-y-3">
        <h2 className="font-semibold text-sm">Autor nou</h2>
        {fields()}
        <button type="submit" className="bg-brand text-white text-sm font-semibold rounded-lg px-4 py-1.5 hover:opacity-90">Adaugă</button>
      </form>
    </div>
  )
}
