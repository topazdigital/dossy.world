import { NextResponse } from 'next/server'
import { 
  getCurrentRound, 
  createRound, 
  updateRound, 
  getSetting
} from '@/lib/db'
import { scheduleBotBuys, executeBotBuy } from '@/lib/bots'

// Helper to trigger bots for a round
async function triggerBotsForRound(roundId: string, botCount: number, vaultCap: number, currentAmount: number) {
  try {
    const round = {
      id: roundId,
      vault_cap: vaultCap,
      current_amount: currentAmount
    } as Parameters<typeof scheduleBotBuys>[0]
    
    const scheduledBuys = await scheduleBotBuys(round, botCount)
    
    // Execute bot buys with delays (non-blocking)
    scheduledBuys.forEach(({ delay, amount, botUser }) => {
      setTimeout(async () => {
        try {
          await executeBotBuy(roundId, amount, botUser)
        } catch (error) {
          console.error('Bot buy execution error:', error)
        }
      }, delay)
    })
    
    return scheduledBuys.length
  } catch (error) {
    console.error('Bot trigger error:', error)
    return 0
  }
}

export async function POST() {
  try {
    const currentRound = await getCurrentRound()
    
    // If there's an active round, don't start a new one
    if (currentRound && currentRound.status === 'active') {
      return NextResponse.json({ 
        message: 'Round already active',
        round: currentRound 
      })
    }
    
    // If there's a waiting round, start it
    if (currentRound && currentRound.status === 'waiting') {
      const updatedRound = await updateRound(currentRound.id, {
        status: 'active',
        started_at: new Date().toISOString()
      })
      
      // Trigger bots for this round
      if (currentRound.bot_count > 0) {
        triggerBotsForRound(
          currentRound.id, 
          currentRound.bot_count, 
          currentRound.vault_cap, 
          currentRound.current_amount
        )
      }
      
      return NextResponse.json({
        success: true,
        message: `Round #${currentRound.round_number} started`,
        round: updatedRound
      })
    }
    
    // Create a new round
    const defaultCap = parseInt(await getSetting('default_vault_cap') || '10000')
    const defaultProfit = parseInt(await getSetting('default_profit_percentage') || '30')
    const defaultBotCount = 5 // Default bot count
    
    const newRound = await createRound({
      vault_cap: defaultCap,
      profit_percentage: defaultProfit,
      bot_count: defaultBotCount
    })
    
    // Immediately start the round
    const startedRound = await updateRound(newRound.id, {
      status: 'active',
      started_at: new Date().toISOString()
    })
    
    // Trigger bots for new round
    triggerBotsForRound(newRound.id, defaultBotCount, defaultCap, 0)
    
    return NextResponse.json({
      success: true,
      message: `Round #${newRound.round_number} created and started`,
      round: startedRound
    })
  } catch (error) {
    console.error('Start round error:', error)
    return NextResponse.json({ error: 'Failed to start round' }, { status: 500 })
  }
}
