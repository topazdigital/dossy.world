import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, isValidKenyanPhone, normalizePhone } from '@/lib/auth'
import { 
  createWithdrawalRequest, 
  updateUserBalance, 
  createTransaction,
  getSetting 
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
    const { amount, phone } = body

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      )
    }

    if (!phone) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      )
    }

    if (!isValidKenyanPhone(phone)) {
      return NextResponse.json(
        { error: 'Please enter a valid Kenyan phone number' },
        { status: 400 }
      )
    }

    // Get min/max withdrawal settings
    const minWithdraw = parseInt(await getSetting('min_withdrawal') || '100')
    const maxWithdraw = parseInt(await getSetting('max_withdrawal') || '70000')

    if (amount < minWithdraw) {
      return NextResponse.json(
        { error: `Minimum withdrawal is KES ${minWithdraw}` },
        { status: 400 }
      )
    }

    if (amount > maxWithdraw) {
      return NextResponse.json(
        { error: `Maximum withdrawal is KES ${maxWithdraw}` },
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

    const normalizedPhone = normalizePhone(phone)

    // Deduct from user balance immediately
    const updatedUser = await updateUserBalance(user.id, -amount)
    if (!updatedUser) {
      return NextResponse.json(
        { error: 'Failed to update balance' },
        { status: 500 }
      )
    }

    // Create withdrawal request
    const withdrawalRequest = await createWithdrawalRequest({
      user_id: user.id,
      amount,
      phone: normalizedPhone
    })

    // Create transaction record
    await createTransaction({
      user_id: user.id,
      type: 'withdrawal',
      amount: -amount,
      balance_after: updatedUser.balance,
      status: 'pending',
      phone: normalizedPhone,
      description: 'Withdrawal request',
      reference_id: withdrawalRequest.id
    })

    return NextResponse.json({
      success: true,
      message: 'Withdrawal request submitted. You will receive your funds within 24 hours.',
      requestId: withdrawalRequest.id
    })
  } catch (error) {
    console.error('Withdrawal error:', error)
    return NextResponse.json(
      { error: 'Withdrawal failed' },
      { status: 500 }
    )
  }
}
