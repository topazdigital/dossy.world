import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { getAuditLogs } from '@/lib/db'

export async function GET() {
  try {
    await requireAdmin()
    const logs = await getAuditLogs(500)
    return NextResponse.json({ logs })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Audit fetch error:', error)
    return NextResponse.json({ error: 'Failed to load audit log' }, { status: 500 })
  }
}
