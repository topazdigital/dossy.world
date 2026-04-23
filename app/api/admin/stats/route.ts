import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { getStats } from '@/lib/db'

export async function GET() {
  try {
    await requireAdmin()
    const stats = await getStats()
    return NextResponse.json(stats)
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Stats error:', error)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}
