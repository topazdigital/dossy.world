// Investment API - Users can only invest during the WAITING phase

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { 
  findUserById, 
  getGameState,
  getCurrentRound,
  getSetting,
  createBuy,
  updateUserBalance,
  createTransaction
} from '@/lib/db'

export async function POST(request: Request) {
  try {
    // Verify authentication
    const cookieStore = await cookies()
    const token = cookieStore.get('auth_token')?.value
    
    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    
    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }
    
    const user = await findUserById(payload.userId)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    
    if (user.is_banned) {
      return NextResponse.json({ error: 'Account is banned' }, { status: 403 })
    }
    
    // Get request body
    const body = await request.json()
    const { amount, roundId } = body
    
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }
    
    // Get game state
    const gameState = await getGameState()
    
    // Check if system is paused
    if (gameState.is_paused) {
      return NextResponse.json({ error: 'System is paused' }, { status: 400 })
    }
    
    // Check if we're in the waiting phase (only time investments are accepted)
    if (gameState.phase !== 'waiting') {
      return NextResponse.json({ 
        error: 'Investments are only accepted during the waiting period',
        phase: gameState.phase
      }, { status: 400 })
    }
    
    // Check waiting time remaining
    const waitingDuration = parseInt(await getSetting('waiting_duration_seconds') || '5')
    const phaseStarted = new Date(gameState.phase_started_at).getTime()
    const elapsed = (Date.now() - phaseStarted) / 1000
    
    if (elapsed >= waitingDuration) {
      return NextResponse.json({ 
        error: 'Investment window has closed',
        phase: gameState.phase
      }, { status: 400 })
    }
    
    // Verify round
    const currentRound = await getCurrentRound()
    if (!currentRound) {
      return NextResponse.json({ error: 'No active round' }, { status: 400 })
    }
    
    if (roundId && roundId !== currentRound.id) {
      return NextResponse.json({ error: 'Round mismatch - please refresh' }, { status: 400 })
    }
    
    // Validate amount limits
    const minInvest = parseFloat(await getSetting('min_invest_amount') || '50')
    const maxInvest = parseFloat(await getSetting('max_invest_amount') || '5000')
    
    if (amount < minInvest) {
      return NextResponse.json({ error: `Minimum investment is KES ${minInvest}` }, { status: 400 })
    }
    
    if (amount > maxInvest) {
      return NextResponse.json({ error: `Maximum investment is KES ${maxInvest}` }, { status: 400 })
    }
    
    // Check user balance
    if (amount > user.balance) {
      return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 })
    }
    
    // Deduct from user balance
    const newBalance = user.balance - amount
    await updateUserBalance(user.id, -amount)
    
    // Create the investment record
    const buy = await createBuy({
      round_id: currentRound.id,
      user_id: user.id,
      amount,
      is_bot_buy: false
    })
    
    // Create transaction record
    await createTransaction({
      user_id: user.id,
      type: 'invest',
      amount: -amount,
      balance_after: newBalance,
      status: 'completed',
      description: `Investment in round #${currentRound.round_number}`,
      reference_id: buy?.id
    })
    
    // Calculate potential return
    const profitPercentage = currentRound.profit_percentage
    const potentialReturn = amount * (1 + profitPercentage / 100)
    
    return NextResponse.json({
      success: true,
      message: 'Investment successful',
      investment: {
        id: buy?.id,
        amount,
        potentialReturn,
        profitPercentage,
        roundNumber: currentRound.round_number
      },
      newBalance
    })
    
  } catch (error) {
    console.error('Investment error:', error)
    return NextResponse.json({ error: 'Investment failed' }, { status: 500 })
  }
}
