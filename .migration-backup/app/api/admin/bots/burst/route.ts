import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { getRoundById } from '@/lib/db'
import { triggerBotBurst } from '@/lib/bots'

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()
    
    const body = await request.json()
    const { roundId } = body
    
    if (!roundId) {
      return NextResponse.json({ error: 'Round ID required' }, { status: 400 })
    }
    
    const round = await getRoundById(roundId)
    if (!round) {
      return NextResponse.json({ error: 'Round not found' }, { status: 404 })
    }
    
    if (round.status !== 'active') {
      return NextResponse.json({ error: 'Round is not active' }, { status: 400 })
    }
    
    const successfulBuys = await triggerBotBurst(roundId)
    
    return NextResponse.json({
      success: true,
      message: `Burst executed: ${successfulBuys} buys`,
      successfulBuys
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Bot burst error:', error)
    return NextResponse.json({ error: 'Failed to execute burst' }, { status: 500 })
  }
}
