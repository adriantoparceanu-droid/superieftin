import { createAdminUserAction, toggleAdminUserAction } from '@/lib/admin/actions'
import { getAdminUsers } from '@/lib/admin/queries'
import { requireAdmin } from '@/lib/admin/session'

export default async function UtilizatoriPage() {
  const current = await requireAdmin()
  const users = await getAdminUsers()

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">Utilizatori admin</h1>

      <form action={createAdminUserAction} className="bg-white border border-line rounded-xl p-4 flex flex-wrap items-end gap-3 mb-6">
        <div>
          <label className="block text-xs text-muted mb-1">Email</label>
          <input name="email" type="email" required className="border border-line rounded-lg px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Nume</label>
          <input name="name" className="border border-line rounded-lg px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Parolă (min 8 caractere)</label>
          <input name="password" type="password" required minLength={8} className="border border-line rounded-lg px-3 py-1.5 text-sm" />
        </div>
        <button type="submit" className="bg-brand text-white text-sm font-semibold rounded-lg px-4 py-1.5 hover:opacity-90">
          Adaugă / resetează parola
        </button>
      </form>

      <div className="bg-white border border-line rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-muted">
            <tr>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Nume</th>
              <th className="px-4 py-2">Ultimul login</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-line">
                <td className="px-4 py-2 font-medium">{u.email}</td>
                <td className="px-4 py-2">{u.name || '—'}</td>
                <td className="px-4 py-2 text-muted">{u.last_login_at ? new Date(u.last_login_at).toLocaleString('ro-RO') : 'niciodată'}</td>
                <td className="px-4 py-2">{u.is_active ? 'activ' : 'dezactivat'}</td>
                <td className="px-4 py-2 text-right">
                  {u.id !== current.id && (
                    <form action={toggleAdminUserAction}>
                      <input type="hidden" name="id" value={u.id} />
                      <button type="submit" className="text-xs text-brand hover:underline">
                        {u.is_active ? 'dezactivează' : 'reactivează'}
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
