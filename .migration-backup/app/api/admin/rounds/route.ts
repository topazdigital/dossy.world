import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { getAllRounds, getBuysByRound } from '@/lib/db'

export async function GET() {
  try {
    await requireAdmin()
    
    const rounds = await getAllRounds()
    
    // Add buy counts to each round
    const roundsWithStats = await Promise.all(
      rounds.map(async (round) => {
        const buys = await getBuysByRound(round.id)
        const realBuys = buys.filter(b => !b.is_bot_buy)
        const totalPayout = buys
          .filter(b => b.is_paid && !b.is_bot_buy)
          .reduce((sum, b) => sum + (b.payout_amount || 0), 0)
        
        return {
          ...round,
          buy_count: realBuys.length,
          total_payout: totalPayout
        }
      })
    )
    
    return NextResponse.json({ rounds: roundsWithStats })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Rounds fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch rounds' }, { status: 500 })
  }
}
