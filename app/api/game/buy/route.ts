import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { 
  getCurrentRound, 
  createBuy, 
  updateUserBalance, 
  createTransaction,
  getSetting,
  findUserById
} from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Please login to continue' },
        { status: 401 }
      )
    }

    if (user.is_banned) {
      return NextResponse.json(
        { error: 'Your account has been suspended' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { amount } = body

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      )
    }

    // Get min/max buy settings
    const minBuy = parseInt(await getSetting('min_buy_amount') || '50')
    const maxBuy = parseInt(await getSetting('max_buy_amount') || '5000')

    if (amount < minBuy) {
      return NextResponse.json(
        { error: `Minimum buy is KES ${minBuy}` },
        { status: 400 }
      )
    }

    if (amount > maxBuy) {
      return NextResponse.json(
        { error: `Maximum buy is KES ${maxBuy}` },
        { status: 400 }
      )
    }

    // Check balance
    if (amount > user.balance) {
      return NextResponse.json(
        { error: 'Insufficient balance' },
        { status: 400 }
      )
    }

    // Get current round
    const round = await getCurrentRound()
    
    if (!round) {
      return NextResponse.json(
        { error: 'No active round' },
        { status: 400 }
      )
    }

    if (round.status !== 'active') {
      return NextResponse.json(
        { error: 'Round is not accepting buys' },
        { status: 400 }
      )
    }

    // Check if round is already filled
    if (round.current_amount >= round.vault_cap) {
      return NextResponse.json(
        { error: 'Vault is full' },
        { status: 400 }
      )
    }

    // Deduct from user balance
    const updatedUser = await updateUserBalance(user.id, -amount)
    if (!updatedUser) {
      return NextResponse.json(
        { error: 'Failed to update balance' },
        { status: 500 }
      )
    }

    // Create buy
    const buy = await createBuy({
      round_id: round.id,
      user_id: user.id,
      amount,
      is_bot_buy: false
    })

    // Create transaction record
    await createTransaction({
      user_id: user.id,
      type: 'buy',
      amount: -amount,
      balance_after: updatedUser.balance,
      status: 'completed',
      description: `Buy in Round #${round.round_number}`,
      reference_id: buy.id
    })

    // Fetch updated user
    const finalUser = await findUserById(user.id)

    return NextResponse.json({
      success: true,
      buy: {
        id: buy.id,
        amount: buy.amount,
        created_at: buy.created_at
      },
      user: finalUser ? {
        id: finalUser.id,
        username: finalUser.username,
        balance: finalUser.balance
      } : null
    })
  } catch (error) {
    console.error('Buy error:', error)
    return NextResponse.json(
      { error: 'Buy failed' },
      { status: 500 }
    )
  }
}
