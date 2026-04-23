import { NextResponse } from 'next/server'
import { getCurrentRound, getBuysByRound, createRound, updateRound, getSetting } from '@/lib/db'

export async function GET() {
  try {
    let round = await getCurrentRound()
    
    // If no round exists, create one
    if (!round) {
      const defaultCap = parseInt(await getSetting('default_vault_cap') || '10000')
      const defaultProfit = parseInt(await getSetting('default_profit_percentage') || '30')
      
      round = await createRound({
        vault_cap: defaultCap,
        profit_percentage: defaultProfit,
        bot_count: 0
      })
      
      // Auto-start the first round
      round = await updateRound(round.id, { 
        status: 'active',
        started_at: new Date().toISOString()
      })
    }
    
    // Get buys for this round
    const buys = round ? await getBuysByRound(round.id) : []
    
    return NextResponse.json({
      round: round ? {
        ...round,
        buys: buys.map(buy => ({
          id: buy.id,
          user_id: buy.user_id,
          amount: buy.amount,
          is_bot_buy: buy.is_bot_buy,
          created_at: buy.created_at,
          user: buy.user ? {
            username: buy.user.username
          } : null
        }))
      } : null
    })
  } catch (error) {
    console.error('Error fetching current round:', error)
    return NextResponse.json(
      { error: 'Failed to fetch round' },
      { status: 500 }
    )
  }
}
