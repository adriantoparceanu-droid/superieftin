'use client'

import { useFormStatus } from 'react-dom'

// Formular de stergere cu confirmare in browser. Serverul verifica oricum sesiunea admin.
export function ConfirmDeleteButton({ action, id, label, confirmText, className }: {
  action: (formData: FormData) => Promise<void>
  id: number
  label: string
  confirmText: string
  className?: string
}) {
  return (
    <form action={action} onSubmit={(e) => { if (!confirm(confirmText)) e.preventDefault() }}>
      <input type="hidden" name="id" value={id} />
      <Submit label={label} className={className} />
    </form>
  )
}

function Submit({ label, className }: { label: string; className?: string }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className={className ?? 'text-xs text-red-700 hover:underline disabled:opacity-50'}>
      {pending ? 'Se șterge…' : label}
    </button>
  )
}
