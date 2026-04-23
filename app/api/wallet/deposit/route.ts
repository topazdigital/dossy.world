import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, isValidKenyanPhone, normalizePhone } from '@/lib/auth'
import { createTransaction, findUserById, updateUserBalance, updateTransaction } from '@/lib/db'
import { initiateStkPush } from '@/lib/mpesa'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Please login to continue' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { amount, phone } = body

    if (!amount || typeof amount !== 'number' || amount < 10) {
      return NextResponse.json(
        { error: 'Minimum deposit is KES 10' },
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

    const normalizedPhone = normalizePhone(phone)

    // Create pending transaction
    const transaction = await createTransaction({
      user_id: user.id,
      type: 'deposit',
      amount: amount,
      balance_after: user.balance, // Will be updated on callback
      status: 'pending',
      phone: normalizedPhone,
      description: 'M-Pesa deposit'
    })

    // Initiate STK Push
    const stkResult = await initiateStkPush({
      phone: normalizedPhone,
      amount,
      accountReference: `DOSSY${transaction.id.substring(0, 8).toUpperCase()}`,
      transactionDesc: 'Deposit to Dossy World'
    })

    if (stkResult.success && stkResult.checkoutRequestId) {
      // Update transaction with checkout ID
      await updateTransaction(transaction.id, {
        mpesa_checkout_id: stkResult.checkoutRequestId
      })

      // For demo mode, auto-complete the transaction
      if (stkResult.checkoutRequestId.startsWith('DEMO_')) {
        // Simulate successful deposit after a delay
        setTimeout(async () => {
          const currentUser = await findUserById(user.id)
          if (currentUser) {
            const newBalance = currentUser.balance + amount
            await updateUserBalance(user.id, amount)
            await updateTransaction(transaction.id, {
              status: 'completed',
              balance_after: newBalance,
              mpesa_receipt: `DEMO_${Date.now()}`
            })
          }
        }, 3000)
      }

      return NextResponse.json({
        success: true,
        message: 'STK Push sent to your phone',
        checkoutRequestId: stkResult.checkoutRequestId,
        customerMessage: stkResult.customerMessage
      })
    } else {
      // Update transaction as failed
      await updateTransaction(transaction.id, {
        status: 'failed',
        description: `M-Pesa deposit - Failed: ${stkResult.error || 'Unknown error'}`
      })

      return NextResponse.json(
        { error: stkResult.error || 'Failed to initiate payment' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Deposit error:', error)
    return NextResponse.json(
      { error: 'Deposit failed' },
      { status: 500 }
    )
  }
}
