import { createBannerAction, toggleBannerAction, deleteBannerAction } from '@/lib/admin/actions'
import { getAdminBanners, type AdminBanner } from '@/lib/admin/queries'

const SLOTS: { value: string; label: string; hint: string }[] = [
  { value: 'main', label: 'Banner mare (sus)', hint: 'lățime completă, deasupra celor două mici' },
  { value: 'small_left', label: 'Banner mic — stânga', hint: 'jumătatea stângă, sub cel mare' },
  { value: 'small_right', label: 'Banner mic — dreapta', hint: 'jumătatea dreaptă, sub cel mare' },
]

const input = 'w-full border border-line rounded-lg px-3 py-1.5 text-sm'
const label = 'block text-xs text-muted mb-1'

function BannerRow({ b }: { b: AdminBanner }) {
  return (
    <div className="flex items-start gap-3 border-t border-line py-3">
      <div className="shrink-0 w-24 h-16 bg-surface border border-line rounded overflow-hidden flex items-center justify-center">
        {b.type === 'image' && b.image_url
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={b.image_url} alt="" className="w-full h-full object-cover" />
          : <span className="text-[10px] text-muted px-1 text-center">cod HTML/JS</span>}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{b.title || (b.type === 'image' ? b.image_url : 'Banner HTML')}</p>
        <p className="text-xs text-muted">
          {b.type === 'image' ? 'Imagine' : 'Cod HTML/JS'}
          {b.link_url && b.type === 'image' && <> · link: <span className="truncate">{b.link_url}</span></>}
          {' · '}{b.is_active ? '✅ activ' : 'inactiv'}
        </p>
      </div>
      <div className="shrink-0 flex items-center gap-3">
        <form action={toggleBannerAction}>
          <input type="hidden" name="id" value={b.id} />
          <button type="submit" className="text-xs text-brand hover:underline">
            {b.is_active ? 'dezactivează' : 'activează'}
          </button>
        </form>
        <form action={deleteBannerAction}>
          <input type="hidden" name="id" value={b.id} />
          <button type="submit" className="text-xs text-red-600 hover:underline">șterge</button>
        </form>
      </div>
    </div>
  )
}

export default async function BannerePage() {
  const banners = await getAdminBanners()

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-2">Bannere homepage</h1>
      <p className="text-sm text-muted mb-6">
        Zona din dreapta meniului de pe prima pagină: un <strong>banner mare</strong> sus și{' '}
        <strong>două bannere mici</strong> sub el. Fiecare poate fi o imagine (cu link) sau cod HTML/JS
        (ex. banner de afiliere). Cât timp slotul mare nu are banner activ, se afișează hero-ul automat.
        Codul HTML/JS rulează ca atare — folosește doar surse de încredere.
      </p>

      {/* Formular adăugare */}
      <form action={createBannerAction} className="bg-white border border-line rounded-xl p-4 mb-8 grid gap-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className={label}>Poziție</label>
            <select name="slot" className={input} defaultValue="main">
              {SLOTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Tip</label>
            <select name="type" className={input} defaultValue="image">
              <option value="image">Imagine (URL + link)</option>
              <option value="html">Cod HTML / JS</option>
            </select>
          </div>
        </div>

        <div>
          <label className={label}>Nume intern (opțional)</label>
          <input name="title" className={input} placeholder="ex. Promo eMAG octombrie" />
        </div>

        <fieldset className="grid gap-3 border border-line rounded-lg p-3">
          <legend className="text-xs text-muted px-1">Pentru tip „Imagine"</legend>
          <div>
            <label className={label}>URL imagine</label>
            <input name="image_url" type="url" className={input} placeholder="https://.../banner.jpg" />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={label}>Link (unde duce click-ul)</label>
              <input name="link_url" type="url" className={input} placeholder="https://..." />
            </div>
            <div>
              <label className={label}>Text alternativ</label>
              <input name="alt" className={input} placeholder="descriere imagine" />
            </div>
          </div>
        </fieldset>

        <fieldset className="grid gap-2 border border-line rounded-lg p-3">
          <legend className="text-xs text-muted px-1">Pentru tip „Cod HTML / JS"</legend>
          <textarea name="html" rows={4} className={`${input} font-mono text-xs`} placeholder="<a href='...'><img src='...'></a>  sau  <script>...</script>" />
        </fieldset>

        <div>
          <button type="submit" className="bg-brand text-white text-sm font-semibold rounded-lg px-4 py-1.5 hover:opacity-90">
            Adaugă banner
          </button>
        </div>
      </form>

      {/* Listă pe sloturi */}
      {SLOTS.map((s) => {
        const inSlot = banners.filter((b) => b.slot === s.value)
        return (
          <div key={s.value} className="mb-6">
            <h2 className="text-sm font-bold text-[var(--color-text)]">{s.label}</h2>
            <p className="text-xs text-muted mb-1">{s.hint} · primul activ (după ordine) apare pe site</p>
            <div className="bg-white border border-line rounded-xl px-4 py-1">
              {inSlot.length
                ? inSlot.map((b) => <BannerRow key={b.id} b={b} />)
                : <p className="text-sm text-muted py-3">Niciun banner în această poziție.</p>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
