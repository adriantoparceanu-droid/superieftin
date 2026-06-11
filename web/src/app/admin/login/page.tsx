'use client'

import { useActionState } from 'react'
import { loginAction } from '@/lib/admin/actions'

export default function AdminLoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, null)

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4">
      <form action={formAction} className="w-full max-w-sm bg-white border border-line rounded-2xl p-8 shadow-sm">
        <h1 className="text-xl font-bold mb-1">Administrare</h1>
        <p className="text-sm text-muted mb-6">superieftin.ro</p>

        <label className="block text-sm font-medium mb-1" htmlFor="email">Email</label>
        <input
          id="email" name="email" type="email" required autoComplete="username"
          className="w-full border border-line rounded-lg px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-brand"
        />

        <label className="block text-sm font-medium mb-1" htmlFor="password">Parolă</label>
        <input
          id="password" name="password" type="password" required autoComplete="current-password"
          className="w-full border border-line rounded-lg px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-brand"
        />

        {state?.error && <p className="text-sm text-red-600 mb-4">{state.error}</p>}

        <button
          type="submit" disabled={pending}
          className="w-full bg-brand text-white font-semibold rounded-lg py-2 hover:opacity-90 disabled:opacity-50"
        >
          {pending ? 'Se verifică…' : 'Autentificare'}
        </button>
      </form>
    </div>
  )
}
