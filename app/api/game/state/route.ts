// Global Game State API
// All clients poll this endpoint to stay synchronized
// Returns the same state for ALL browsers

import { NextResponse } from 'next/server'
import { 
  getGameState, 
  updateGameState, 
  getCurrentRound, 
  getBuysByRound,
  getSetting,
  createRound,
  updateRound,
  getUnpaidBuysByRound,
  updateBuy,
  updateUserBalance,
  createTransaction,
  findUserById,
  getRealUserCountInRound
} from '@/lib/db'
import { triggerSmartBots } from '@/lib/bots'

// GET - Get current synchronized game state
export async function GET() {
  try {
    const gameState = await getGameState()
    const currentRound = await getCurrentRound()
    const waitingDuration = parseInt(await getSetting('waiting_duration_seconds') || '5')
    const profitPercentage = parseFloat(await getSetting('default_profit_percentage') || '30')
    
    // Get recent investments for live feed
    let recentInvestments: Array<{
      id: string
      username: string
      amount: number
      isBot: boolean
      createdAt: string
    }> = []
    
    if (currentRound) {
      const buys = await getBuysByRound(currentRound.id)
      recentInvestments = buys.slice(0, 20).map(b => ({
        id: b.id,
        username: b.user?.username || 'Anonymous',
        amount: b.amount,
        isBot: b.is_bot_buy,
        createdAt: b.created_at
      }))
    }
    
    // Calculate time remaining in waiting phase
    let waitingTimeRemaining = 0
    if (gameState.phase === 'waiting') {
      const phaseStarted = new Date(gameState.phase_started_at).getTime()
      const elapsed = (Date.now() - phaseStarted) / 1000
      waitingTimeRemaining = Math.max(0, waitingDuration - elapsed)
    }
    
    return NextResponse.json({
      // Global synchronized state
      phase: gameState.phase,
      phaseStartedAt: gameState.phase_started_at,
      vaultFillPercent: gameState.vault_fill_percent,
      totalInvested: gameState.total_invested,
      vaultTarget: gameState.vault_target,
      investorCount: gameState.investor_count,
      isPaused: gameState.is_paused,
      waitingTimeRemaining: Math.ceil(waitingTimeRemaining),
      
      // Round info
      roundId: currentRound?.id || null,
      roundNumber: currentRound?.round_number || 0,
      profitPercentage,
      
      // Live feed
      recentInvestments,
      
      // Server timestamp for sync
      serverTime: Date.now()
    })
  } catch (error) {
    console.error('Failed to get game state:', error)
    return NextResponse.json({ error: 'Failed to get game state' }, { status: 500 })
  }
}

// POST - Tick the game forward (called by game loop or admin)
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { action } = body
    
    const gameState = await getGameState()
    const waitingDuration = parseInt(await getSetting('waiting_duration_seconds') || '5')
    const profitPercentage = parseFloat(await getSetting('default_profit_percentage') || '30')
    const vaultTarget = parseFloat(await getSetting('default_vault_target') || '10000')
    const botsEnabled = (await getSetting('bots_enabled')) === 'true'
    
    // Handle admin actions
    if (action === 'pause') {
      await updateGameState({ is_paused: true, phase: 'paused' })
      return NextResponse.json({ success: true, message: 'System paused' })
    }
    
    if (action === 'resume') {
      await updateGameState({ 
        is_paused: false, 
        phase: 'filling',
        phase_started_at: new Date().toISOString()
      })
      return NextResponse.json({ success: true, message: 'System resumed' })
    }
    
    if (action === 'force_eruption') {
      // Force the vault to erupt immediately
      await updateGameState({
        phase: 'eruption',
        phase_started_at: new Date().toISOString(),
        vault_fill_percent: 100
      })
      return NextResponse.json({ success: true, message: 'Forced eruption' })
    }
    
    if (action === 'extend_waiting') {
      // Reset waiting phase timer
      await updateGameState({
        phase: 'waiting',
        phase_started_at: new Date().toISOString()
      })
      return NextResponse.json({ success: true, message: 'Extended waiting period' })
    }
    
    if (action === 'new_round') {
      // Start a fresh round
      const round = await createRound({
        vault_target: vaultTarget,
        profit_percentage: profitPercentage
      })
      await updateGameState({
        current_round_id: round.id,
        phase: 'waiting',
        phase_started_at: new Date().toISOString(),
        vault_fill_percent: 0,
        total_invested: 0,
        vault_target: vaultTarget,
        investor_count: 0,
        is_paused: false
      })
      return NextResponse.json({ success: true, message: 'New round started', roundId: round.id })
    }
    
    // Auto game loop tick
    if (gameState.is_paused) {
      return NextResponse.json({ phase: 'paused', message: 'System is paused' })
    }
    
    const phaseStarted = new Date(gameState.phase_started_at).getTime()
    const elapsed = (Date.now() - phaseStarted) / 1000
    
    // Phase transitions
    if (gameState.phase === 'waiting') {
      // Check if waiting period is over
      if (elapsed >= waitingDuration) {
        // Transition to filling phase
        let currentRound = await getCurrentRound()
        if (!currentRound) {
          // Create new round if none exists
          currentRound = await createRound({
            vault_target: vaultTarget,
            profit_percentage: profitPercentage
          })
        }
        
        await updateGameState({
          phase: 'filling',
          phase_started_at: new Date().toISOString(),
          current_round_id: currentRound.id
        })
        
        return NextResponse.json({ 
          phase: 'filling', 
          message: 'Filling phase started',
          roundId: currentRound.id
        })
      }
    }
    
    if (gameState.phase === 'filling') {
      // Check if vault is full
      if (gameState.vault_fill_percent >= 100) {
        await updateGameState({
          phase: 'eruption',
          phase_started_at: new Date().toISOString()
        })
        
        // Mark round as erupted
        const currentRound = await getCurrentRound()
        if (currentRound) {
          await updateRound(currentRound.id, {
            erupted_at: new Date().toISOString(),
            final_fill_percent: 100
          })
        }
        
        return NextResponse.json({ phase: 'eruption', message: 'Vault erupted!' })
      }
      
      // Trigger smart bots during filling phase
      if (botsEnabled) {
        const currentRound = await getCurrentRound()
        if (currentRound) {
          const realUserCount = await getRealUserCountInRound(currentRound.id)
          await triggerSmartBots(currentRound.id, realUserCount, gameState.vault_fill_percent)
        }
      }
    }
    
    if (gameState.phase === 'eruption') {
      // Process payouts
      const currentRound = await getCurrentRound()
      if (currentRound) {
        const unpaidBuys = await getUnpaidBuysByRound(currentRound.id)
        
        let totalPayout = 0
        for (const buy of unpaidBuys) {
          const payoutAmount = buy.amount * (1 + profitPercentage / 100)
          const payoutMultiplier = 1 + profitPercentage / 100
          
          // Update buy record
          await updateBuy(buy.id, {
            payout_amount: payoutAmount,
            payout_multiplier: payoutMultiplier,
            is_paid: true,
            paid_at: new Date().toISOString()
          })
          
          // Credit user balance
          const user = await findUserById(buy.user_id)
          if (user) {
            await updateUserBalance(buy.user_id, payoutAmount)
            
            // Create transaction record
            await createTransaction({
              user_id: buy.user_id,
              type: 'payout',
              amount: payoutAmount,
              balance_after: user.balance + payoutAmount,
              status: 'completed',
              description: `Payout from round #${currentRound.round_number}`,
              reference_id: buy.id
            })
          }
          
          totalPayout += payoutAmount
        }
        
        // Mark round as completed
        await updateRound(currentRound.id, {
          status: 'completed',
          paid_at: new Date().toISOString(),
          total_payout: totalPayout
        })
      }
      
      // Start new waiting phase
      await updateGameState({
        phase: 'waiting',
        phase_started_at: new Date().toISOString(),
        vault_fill_percent: 0,
        total_invested: 0,
        investor_count: 0,
        current_round_id: null
      })
      
      // Create next round
      const newRound = await createRound({
        vault_target: vaultTarget,
        profit_percentage: profitPercentage
      })
      
      return NextResponse.json({ 
        phase: 'waiting', 
        message: 'Payouts complete, waiting for next round',
        newRoundId: newRound.id
      })
    }
    
    return NextResponse.json({ 
      phase: gameState.phase,
      message: 'Game state unchanged'
    })
    
  } catch (error) {
    console.error('Game tick error:', error)
    return NextResponse.json({ error: 'Game tick failed' }, { status: 500 })
  }
}
