import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { getRoundById, updateRound } from '@/lib/db'
import { scheduleBotBuys, executeBotBuy } from '@/lib/bots'

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()
    
    const body = await request.json()
    const { roundId, count = 5 } = body
    
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
    
    // Update bot count on round
    await updateRound(roundId, { bot_count: count })
    
    // Schedule bot buys
    const scheduledBuys = await scheduleBotBuys(round, count)
    
    // Execute bot buys with delays (non-blocking)
    // In production, you'd want to use a proper job queue
    scheduledBuys.forEach(({ delay, amount, botUser }) => {
      setTimeout(async () => {
        try {
          await executeBotBuy(roundId, amount, botUser)
        } catch (error) {
          console.error('Bot buy execution error:', error)
        }
      }, delay)
    })
    
    return NextResponse.json({
      success: true,
      message: `Scheduled ${scheduledBuys.length} bot buys`,
      scheduledCount: scheduledBuys.length
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Bot trigger error:', error)
    return NextResponse.json({ error: 'Failed to trigger bots' }, { status: 500 })
  }
}
