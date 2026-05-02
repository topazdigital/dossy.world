import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getBuysByUser, getRoundById } from '@/lib/db'

export async function GET() {
  try {
    const user = await getCurrentUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const buys = await getBuysByUser(user.id)
    
    // Enrich with round data
    const enrichedBuys = await Promise.all(
      buys.slice(0, 50).map(async (buy) => {
        const round = await getRoundById(buy.round_id)
        return {
          ...buy,
          round: round ? {
            round_number: round.round_number,
            profit_percentage: round.profit_percentage,
            status: round.status
          } : null
        }
      })
    )
    
    return NextResponse.json({
      buys: enrichedBuys
    })
  } catch (error) {
    console.error('Fetch buys error:', error)
    return NextResponse.json({ error: 'Failed to fetch buys' }, { status: 500 })
  }
}
