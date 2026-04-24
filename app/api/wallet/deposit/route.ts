import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, isValidKenyanPhone, normalizePhone } from '@/lib/auth'
import {
  createTransaction,
  findUserById,
  findUserByPhone,
  updateUser,
  updateUserBalance,
  updateTransaction,
} from '@/lib/db'
import { initiateStkPush } from '@/lib/payhero'
import { getClientIp, rateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json({ error: 'Please login to continue' }, { status: 401 })
    }

    // Stop attackers from burning PayHero fees by spamming STK pushes:
    // 5 deposit attempts per user / 10 min, plus 10 per IP / 10 min.
    const ip = getClientIp(request)
    const userRl = rateLimit(`deposit:user:${user.id}`, 5, 10 * 60 * 1000)
    if (!userRl.ok) {
      return NextResponse.json(
        { error: `Too many deposit attempts. Try again in ${userRl.retryInSeconds}s.` },
        { status: 429 },
      )
    }
    const ipRl = rateLimit(`deposit:ip:${ip}`, 10, 10 * 60 * 1000)
    if (!ipRl.ok) {
      return NextResponse.json(
        { error: `Too many deposits from your network. Try again in ${ipRl.retryInSeconds}s.` },
        { status: 429 },
      )
    }

    const body = await request.json()
    const { amount, phone } = body

    if (!amount || typeof amount !== 'number' || amount < 10) {
      return NextResponse.json({ error: 'Minimum deposit is KES 10' }, { status: 400 })
    }

    if (!phone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 })
    }

    if (!isValidKenyanPhone(phone)) {
      return NextResponse.json(
        { error: 'Please enter a valid Kenyan phone number' },
        { status: 400 },
      )
    }

    const normalizedPhone = normalizePhone(phone)

    // Anti-multi-account: a phone is permanently bound to the first account
    // it deposits into. After that the phone can never be used by another
    // account, and the bound account can never deposit from a different phone.
    if (user.bound_phone && user.bound_phone !== normalizedPhone) {
      return NextResponse.json(
        {
          error: `This account is locked to phone ending in ${user.bound_phone.slice(-4)}. Please deposit from that number.`,
        },
        { status: 400 },
      )
    }
    const phoneOwner = await findUserByPhone(normalizedPhone)
    if (phoneOwner && phoneOwner.id !== user.id) {
      return NextResponse.json(
        {
          error: 'This phone number is already linked to another account. Each phone can only fund one account.',
        },
        { status: 400 },
      )
    }
    // Bind on first deposit attempt (we lock the account before STK so even
    // a never-completed push reserves the phone for this user).
    if (!user.bound_phone) {
      await updateUser(user.id, { bound_phone: normalizedPhone, phone: user.phone || normalizedPhone })
    }

    const transaction = await createTransaction({
      user_id: user.id,
      type: 'deposit',
      amount,
      balance_after: user.balance,
      status: 'pending',
      phone: normalizedPhone,
      description: 'PayHero / M-Pesa deposit',
    })

    const stk = await initiateStkPush({
      phone: normalizedPhone,
      amount,
      accountReference: `DOSSY${transaction.id.substring(0, 8).toUpperCase()}`,
      customerName: user.username,
    })

    if (stk.success && stk.checkoutRequestId) {
      await updateTransaction(transaction.id, {
        mpesa_checkout_id: stk.checkoutRequestId,
      })

      // Demo-mode auto-complete so local dev still flows end-to-end.
      if (stk.checkoutRequestId.startsWith('DEMO_')) {
        setTimeout(async () => {
          const currentUser = await findUserById(user.id)
          if (currentUser) {
            const newBalance = currentUser.balance + amount
            await updateUserBalance(user.id, amount)
            await updateTransaction(transaction.id, {
              status: 'completed',
              balance_after: newBalance,
              mpesa_receipt: `DEMO_${Date.now()}`,
            })
          }
        }, 3000)
      }

      return NextResponse.json({
        success: true,
        message: 'STK Push sent to your phone',
        checkoutRequestId: stk.checkoutRequestId,
        customerMessage: stk.customerMessage,
      })
    }

    await updateTransaction(transaction.id, {
      status: 'failed',
      description: `PayHero deposit - Failed: ${stk.error || 'Unknown error'}`,
    })

    return NextResponse.json(
      { error: stk.error || 'Failed to initiate payment' },
      { status: 500 },
    )
  } catch (error) {
    console.error('Deposit error:', error)
    return NextResponse.json({ error: 'Deposit failed' }, { status: 500 })
  }
}
