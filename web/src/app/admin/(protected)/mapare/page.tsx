import Link from 'next/link'
import {
  getUnmappedGroups, getCategoriesTree, getTagsWithCounts, getMappingRules,
  getUnmappedGroupNames, previewNameRule, getNameRules,
} from '@/lib/admin/queries'
import { createMappingRuleAction, deleteMappingRuleAction, createNameRuleAction, deleteNameRuleAction } from '@/lib/admin/actions'
import { termsPattern, topWords } from '@/lib/admin/nameMatch'

type Props = { searchParams: Promise<{ grup?: string; terme?: string; actiune?: string; categorie?: string; toti?: string; magazin?: string }> }

const NO_CATEGORY = '(fără categorie)'

export default async function MaparePage({ searchParams }: Props) {
  const sp = await searchParams
  const [allGroups, categories, tags, rules, allNameRules] = await Promise.all([
    getUnmappedGroups(),
    getCategoriesTree(),
    getTagsWithCounts(),
    getMappingRules(),
    getNameRules(),
  ])
  // ?magazin=<retailer_id> (link din Surse feed → Alege categoriile): arata doar grupurile
  // nemapate ale magazinului si regulile dupa denumire care il privesc (ale lui + globale).
  // Fara parametru pagina arata tot, ca inainte.
  const shopId = Number(sp.magazin) || null
  const groups = shopId ? allGroups.filter((g) => g.retailer_id === shopId) : allGroups
  const nameRules = shopId ? allNameRules.filter((r) => r.retailer_id == null || r.retailer_id === shopId) : allNameRules
  const shopName = shopId
    ? allNameRules.find((r) => r.retailer_id === shopId)?.retailer_name
      ?? allGroups.find((g) => g.retailer_id === shopId)?.retailer_name ?? `magazinul #${shopId}`
    : null

  // Grupul deschis pentru „mapare dupa denumire”: ?grup=<retailer_id>|<categorie feed>
  const [grpRetailer, ...grpCatParts] = (sp.grup ?? '').split('|')
  const grpCat = grpCatParts.join('|')
  const openGroup = sp.grup ? groups.find((g) => String(g.retailer_id) === grpRetailer && g.feed_category === grpCat) ?? null : null
  const groupNames = openGroup?.retailer_id ? await getUnmappedGroupNames(openGroup.retailer_id, openGroup.feed_category) : []
  const words = topWords(groupNames)
  const terms = (sp.terme ?? '').trim()
  const pattern = terms ? termsPattern(terms) : null
  const allRetailers = sp.toti === '1'
  const preview = pattern && openGroup ? await previewNameRule(allRetailers ? null : openGroup.retailer_id, pattern) : null
  const groupHref = (g: { retailer_id: number | null; feed_category: string }, extra = '') =>
    `/admin/mapare?grup=${encodeURIComponent(`${g.retailer_id}|${g.feed_category}`)}${extra}#denumire`

  const categoryOptions = categories.map((c) => {
    const parent = c.parent_id ? categories.find((p) => p.id === c.parent_id) : null
    return { id: c.id, label: parent ? `${parent.name} → ${c.name}` : c.name }
  })

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold mb-2">Mapare categorii</h1>
      <p className="text-sm text-muted mb-6">
        Categoriile din feed-uri fără regulă de mapare. Alege categoria site-ului — regula se aplică
        retroactiv pe produsele existente și automat la importurile viitoare.
      </p>

      {shopId && (
        <div className="bg-surface border border-line rounded-xl p-3 mb-6 text-sm flex items-center justify-between gap-3">
          <span>Arăți doar <strong>{shopName}</strong> (grupuri nemapate + regulile după denumire ale magazinului și cele globale).</span>
          <Link href="/admin/mapare" className="text-brand underline whitespace-nowrap">arată toate magazinele</Link>
        </div>
      )}

      {!groups.length && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-8 text-sm text-green-800">
          Toate produsele sunt mapate. 🎉
        </div>
      )}

      <div className="space-y-3 mb-10">
        {groups.map((g) => (
          <form
            key={`${g.retailer_id}-${g.feed_category}`}
            action={createMappingRuleAction}
            className="bg-white border border-line rounded-xl p-4 flex flex-wrap items-center gap-3"
          >
            <input type="hidden" name="feed_category" value={g.feed_category} />
            <input type="hidden" name="retailer_id" value={g.retailer_id ?? ''} />
            <div className="min-w-48 flex-1">
              <p className="font-semibold">{g.feed_category}</p>
              <p className="text-xs text-muted">
                {g.retailer_name ?? 'fără retailer'} · {g.product_count.toLocaleString('ro-RO')} produse
              </p>
              {g.retailer_id && (
                <Link href={groupHref(g)} className="text-xs text-brand font-semibold hover:underline">
                  🔍 Vezi ce conține / mapează după denumire
                </Link>
              )}
            </div>
            {g.feed_category !== NO_CATEGORY && (<>
            <select name="category_id" required className="border border-line rounded-lg px-2 py-1.5 text-sm">
              <option value="">— alege categoria —</option>
              {categoryOptions.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
            <select name="tag_ids" multiple size={1} className="border border-line rounded-lg px-2 py-1.5 text-sm min-w-28" title="Taguri (Cmd+click pentru mai multe)">
              {tags.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <label className="text-xs text-muted flex items-center gap-1">
              <input type="checkbox" name="global" /> regulă globală
            </label>
            <button type="submit" className="bg-brand text-white text-sm font-semibold rounded-lg px-4 py-1.5 hover:opacity-90">
              Mapează
            </button>
            </>)}
          </form>
        ))}
      </div>

      {openGroup && (
        <section id="denumire" className="bg-white border-2 border-brand rounded-xl p-5 mb-10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Mapare după denumire: {openGroup.feed_category}</h2>
              <p className="text-sm text-muted">{openGroup.retailer_name} · {openGroup.product_count.toLocaleString('ro-RO')} produse nemapate</p>
            </div>
            <Link href="/admin/mapare" className="text-sm text-muted hover:underline">închide ✕</Link>
          </div>

          <h3 className="text-sm font-semibold mt-4 mb-2">Cuvintele cele mai frecvente <span className="font-normal text-muted">(click = folosește ca termen)</span></h3>
          <div className="flex flex-wrap gap-1.5">
            {words.map((w) => (
              <Link key={w.word} href={groupHref(openGroup, `&terme=${encodeURIComponent(w.word)}`)}
                className="text-xs border border-line rounded-full px-2 py-0.5 hover:border-brand">
                {w.word} <span className="text-muted">{w.count}</span>
              </Link>
            ))}
          </div>

          <details className="mt-3">
            <summary className="text-sm cursor-pointer text-muted">Exemple de denumiri ({Math.min(groupNames.length, 25)} din {groupNames.length})</summary>
            <ul className="mt-2 text-xs text-muted list-disc pl-5 space-y-0.5">
              {groupNames.filter((_, i) => i % Math.max(1, Math.floor(groupNames.length / 25)) === 0).slice(0, 25).map((n) => <li key={n}>{n}</li>)}
            </ul>
          </details>

          {/* Pasul 1: previzualizare (GET) — nu salveaza nimic */}
          <form method="get" action="/admin/mapare#denumire" className="mt-5 flex flex-wrap items-end gap-3 border-t border-line pt-4">
            <input type="hidden" name="grup" value={`${openGroup.retailer_id}|${openGroup.feed_category}`} />
            <div className="flex-1 min-w-64">
              <label className="block text-xs text-muted mb-1">Denumirea conține (cuvinte întregi, separate prin virgulă)</label>
              <input name="terme" defaultValue={terms} placeholder="ex. calculator, pc, sistem" className="w-full border border-line rounded-lg px-3 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Ce facem cu ele</label>
              <select name="actiune" defaultValue={sp.actiune ?? 'map'} className="border border-line rounded-lg px-2 py-1.5 text-sm">
                <option value="map">Mapează în categoria…</option>
                <option value="ignore">Ignoră (nu le importa, nu apar pe site)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Categoria site</label>
              <select name="categorie" defaultValue={sp.categorie ?? ''} className="border border-line rounded-lg px-2 py-1.5 text-sm">
                <option value="">—</option>
                {categoryOptions.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <label className="text-xs text-muted flex items-center gap-1 pb-2">
              <input type="checkbox" name="toti" value="1" defaultChecked={allRetailers} /> pentru toți retailerii
            </label>
            <button className="border border-brand text-brand text-sm font-semibold rounded-lg px-4 py-1.5">Previzualizează</button>
          </form>

          {terms && !pattern && <p className="text-sm text-red-700 mt-3">Scrie cel puțin un termen.</p>}
          {preview && (
            <div className="mt-4 rounded-lg bg-surface border border-line p-4">
              <p className="text-sm">
                Regula ar prinde <strong>{preview.count.toLocaleString('ro-RO')}</strong> produse nemapate
                {allRetailers ? ' (toți retailerii)' : ` de la ${openGroup.retailer_name}`}:
              </p>
              <ul className="mt-2 text-xs text-muted list-disc pl-5 space-y-0.5">
                {preview.examples.map((n) => <li key={n}>{n}</li>)}
              </ul>
              {preview.count > 0 && (
                <form action={createNameRuleAction} className="mt-3">
                  <input type="hidden" name="terme" value={terms} />
                  <input type="hidden" name="actiune" value={sp.actiune === 'ignore' ? 'ignore' : 'map'} />
                  <input type="hidden" name="categorie" value={sp.categorie ?? ''} />
                  <input type="hidden" name="retailer" value={openGroup.retailer_id ?? ''} />
                  <input type="hidden" name="toti" value={allRetailers ? '1' : ''} />
                  {sp.actiune !== 'ignore' && !sp.categorie ? (
                    <p className="text-sm text-amber-700">Alege categoria site-ului, apoi previzualizează din nou.</p>
                  ) : (
                    <button className="bg-brand text-white text-sm font-semibold rounded-lg px-4 py-1.5">
                      {sp.actiune === 'ignore' ? `Salvează: ignoră ${preview.count} produse` : `Salvează și mapează ${preview.count} produse`}
                    </button>
                  )}
                </form>
              )}
            </div>
          )}
        </section>
      )}

      <h2 id="reguli-denumire" className="text-lg font-semibold mb-3">Reguli după denumire ({nameRules.length})</h2>
      <div className="bg-white border border-line rounded-xl overflow-hidden mb-10">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-muted">
            <tr>
              <th className="px-4 py-2">Denumirea conține</th>
              <th className="px-4 py-2">Retailer</th>
              <th className="px-4 py-2">→ Rezultat</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {nameRules.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-3 text-muted">Nicio regulă. Deschide un grup nemapat → „Vezi ce conține”.</td></tr>
            )}
            {nameRules.map((r) => (
              <tr key={r.id} className="border-t border-line">
                <td className="px-4 py-2 font-medium">{r.terms}</td>
                <td className="px-4 py-2">{r.retailer_name ?? <span className="text-muted">toți</span>}</td>
                <td className="px-4 py-2">{r.action === 'ignore' ? <span className="text-red-700">ignorat</span> : r.category_name}</td>
                <td className="px-4 py-2 text-right">
                  <form action={deleteNameRuleAction}>
                    <input type="hidden" name="id" value={r.id} />
                    <button type="submit" className="text-red-600 text-xs hover:underline">șterge</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="text-lg font-semibold mb-3">Reguli existente ({rules.length})</h2>
      <div className="bg-white border border-line rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-muted">
            <tr>
              <th className="px-4 py-2">Categorie feed</th>
              <th className="px-4 py-2">Retailer</th>
              <th className="px-4 py-2">→ Categorie site</th>
              <th className="px-4 py-2">Taguri</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id} className="border-t border-line">
                <td className="px-4 py-2 font-medium">{r.feed_category}</td>
                <td className="px-4 py-2">{r.retailer_name ?? <span className="text-muted">globală</span>}</td>
                <td className="px-4 py-2">{r.category_name}</td>
                <td className="px-4 py-2 text-muted">{r.tag_names.join(', ') || '—'}</td>
                <td className="px-4 py-2 text-right">
                  <form action={deleteMappingRuleAction}>
                    <input type="hidden" name="id" value={r.id} />
                    <button type="submit" className="text-red-600 text-xs hover:underline">șterge</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
