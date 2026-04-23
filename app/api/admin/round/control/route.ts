import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { 
  getCurrentRound, 
  createRound, 
  updateRound, 
  getSetting,
  getBuysByRound,
  updateUserBalance,
  createTransaction,
  updateBuy,
  findUserById
} from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()
    
    const body = await request.json()
    const { action, vaultCap, profitPercentage, botCount } = body

    const round = await getCurrentRound()

    switch (action) {
      case 'new': {
        // Create a new round
        const defaultCap = parseInt(await getSetting('default_vault_cap') || '10000')
        const defaultProfit = parseInt(await getSetting('default_profit_percentage') || '30')
        
        const newRound = await createRound({
          vault_cap: vaultCap || defaultCap,
          profit_percentage: profitPercentage || defaultProfit,
          bot_count: botCount || 0
        })
        
        return NextResponse.json({
          success: true,
          message: `Round #${newRound.round_number} created`,
          round: newRound
        })
      }

      case 'start': {
        if (!round) {
          return NextResponse.json({ error: 'No round to start' }, { status: 400 })
        }
        
        if (round.status !== 'waiting') {
          return NextResponse.json({ error: 'Round is not in waiting state' }, { status: 400 })
        }
        
        const updatedRound = await updateRound(round.id, {
          status: 'active',
          started_at: new Date().toISOString()
        })
        
        return NextResponse.json({
          success: true,
          message: `Round #${round.round_number} started`,
          round: updatedRound
        })
      }

      case 'end': {
        if (!round) {
          return NextResponse.json({ error: 'No active round' }, { status: 400 })
        }
        
        if (round.status !== 'active') {
          return NextResponse.json({ error: 'Round is not active' }, { status: 400 })
        }
        
        // Mark as filled to trigger payout
        const updatedRound = await updateRound(round.id, {
          status: 'filled',
          filled_at: new Date().toISOString()
        })
        
        return NextResponse.json({
          success: true,
          message: `Round #${round.round_number} ended`,
          round: updatedRound
        })
      }

      case 'payout': {
        if (!round) {
          return NextResponse.json({ error: 'No round to payout' }, { status: 400 })
        }
        
        if (round.status !== 'filled') {
          return NextResponse.json({ error: 'Round is not ready for payout' }, { status: 400 })
        }
        
        // Set status to paying
        await updateRound(round.id, { status: 'paying' })
        
        // Get all buys for this round
        const buys = await getBuysByRound(round.id)
        let payoutCount = 0
        let totalPayout = 0
        
        // Process each buy
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
          message: `Paid ${payoutCount} users a total of KES ${totalPayout.toLocaleString()}`,
          payoutCount,
          totalPayout
        })
      }

      case 'cancel': {
        if (!round) {
          return NextResponse.json({ error: 'No round to cancel' }, { status: 400 })
        }
        
        // Refund all buys
        const buys = await getBuysByRound(round.id)
        let refundCount = 0
        
        for (const buy of buys) {
          if (buy.is_paid || buy.is_bot_buy) continue
          
          const user = await findUserById(buy.user_id)
          if (!user) continue
          
          // Refund the buy amount
          const updatedUser = await updateUserBalance(buy.user_id, buy.amount)
          
          if (updatedUser) {
            await createTransaction({
              user_id: buy.user_id,
              type: 'refund',
              amount: buy.amount,
              balance_after: updatedUser.balance,
              status: 'completed',
              description: `Refund from cancelled Round #${round.round_number}`,
              reference_id: buy.id
            })
            
            await updateBuy(buy.id, { is_paid: true, payout_amount: buy.amount })
            refundCount++
          }
        }
        
        await updateRound(round.id, { status: 'cancelled' })
        
        return NextResponse.json({
          success: true,
          message: `Round cancelled, refunded ${refundCount} users`,
          refundCount
        })
      }

      case 'update': {
        if (!round) {
          return NextResponse.json({ error: 'No round to update' }, { status: 400 })
        }
        
        const updates: Record<string, number> = {}
        if (vaultCap) updates.vault_cap = vaultCap
        if (profitPercentage) updates.profit_percentage = profitPercentage
        if (botCount !== undefined) updates.bot_count = botCount
        
        const updatedRound = await updateRound(round.id, updates)
        
        return NextResponse.json({
          success: true,
          message: 'Round updated',
          round: updatedRound
        })
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Round control error:', error)
    return NextResponse.json({ error: 'Operation failed' }, { status: 500 })
  }
}
