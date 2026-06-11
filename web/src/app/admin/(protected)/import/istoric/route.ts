import { NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/admin/session'
import { getRecentSyncs } from '@/lib/admin/queries'

export async function GET() {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json(await getRecentSyncs(20))
}
