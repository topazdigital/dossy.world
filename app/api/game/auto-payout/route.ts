import { NextResponse } from 'next/server'
import { 
  getCurrentRound, 
  updateRound, 
  getBuysByRound,
  updateUserBalance,
  createTransaction,
  updateBuy
} from '@/lib/db'

export async function POST() {
  try {
    const round = await getCurrentRound()
    
    if (!round) {
      return NextResponse.json({ error: 'No round found' }, { status: 400 })
    }
    
    if (round.status !== 'filled') {
      return NextResponse.json({ error: 'Round is not filled' }, { status: 400 })
    }
    
    // Set status to paying
    await updateRound(round.id, { status: 'paying' })
    
    // Get all buys for this round
    const buys = await getBuysByRound(round.id)
    let payoutCount = 0
    let totalPayout = 0
    
    // Process each buy (non-bot only)
    for (const buy of buys) {
      if (buy.is_paid || buy.is_bot_buy) continue
      
      const payoutAmount = buy.amount * (1 + round.profit_percentage / 100)
      
      // Update user balance
      const updatedUser = await updateUserBalance(buy.user_id, payoutAmount)
      
      if (updatedUser) {
        // Create transaction record
        await createTransaction({
          user_id: buy.user_id,
          type: 'payout',
          amount: payoutAmount,
          balance_after: updatedUser.balance,
          status: 'completed',
          description: `Payout from Round #${round.round_number} (+${round.profit_percentage}%)`,
          reference_id: buy.id
        })
        
        // Mark buy as paid
        await updateBuy(buy.id, {
          is_paid: true,
          payout_amount: payoutAmount
        })
        
        payoutCount++
        totalPayout += payoutAmount
      }
    }
    
    // Mark round as paid
    await updateRound(round.id, {
      status: 'paid',
      paid_at: new Date().toISOString()
    })
    
    return NextResponse.json({
      success: true,
      message: `Paid ${payoutCount} users`,
      payoutCount,
      totalPayout
    })
  } catch (error) {
    console.error('Auto payout error:', error)
    return NextResponse.json({ error: 'Payout failed' }, { status: 500 })
  }
}
