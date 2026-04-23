import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { getAllBotNames } from '@/lib/db'

export async function GET() {
  try {
    await requireAdmin()
    const botNames = await getAllBotNames()
    return NextResponse.json({ botNames })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Bot names fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch bot names' }, { status: 500 })
  }
}
