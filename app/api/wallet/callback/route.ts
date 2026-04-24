import { NextRequest, NextResponse } from 'next/server'
import { parseCallback } from '@/lib/payhero'
import {
  findTransactionByCheckoutId,
  updateTransaction,
  updateUserBalance,
  findUserById,
} from '@/lib/db'

// PayHero sends a callback when the customer completes (or rejects) the STK push.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('[PayHero Callback] Received:', JSON.stringify(body))

    const callback = parseCallback(body)
    if (!callback) {
      return NextResponse.json({ success: true, message: 'Callback received' })
    }

    const lookupId = callback.checkoutRequestId || callback.reference
    if (!lookupId) {
      return NextResponse.json({ success: true, message: 'No reference in callback' })
    }

    const transaction = await findTransactionByCheckoutId(lookupId)
    if (!transaction) {
      console.error('[PayHero Callback] Transaction not found for:', lookupId)
      return NextResponse.json({ success: true, message: 'Transaction not found' })
    }

    if (transaction.status === 'completed') {
      return NextResponse.json({ success: true, message: 'Already processed' })
    }

    const isSuccess = callback.resultCode === 0 || callback.status === 'SUCCESS'

    if (isSuccess) {
      const depositAmount = callback.amount || transaction.amount
      const user = await findUserById(transaction.user_id)
      if (!user) {
        return NextResponse.json({ success: true, message: 'User not found' })
      }
      const newBalance = user.balance + depositAmount
      await updateUserBalance(transaction.user_id, depositAmount)
      await updateTransaction(transaction.id, {
        status: 'completed',
        balance_after: newBalance,
        mpesa_receipt: callback.receiptNumber || null,
      })
      console.log(
        `[PayHero Callback] Deposit OK: KES ${depositAmount} for ${user.username}`,
      )
    } else {
      await updateTransaction(transaction.id, {
        status: 'failed',
        description: `PayHero deposit - Failed: ${callback.resultDesc}`,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[PayHero Callback] Error:', error)
    return NextResponse.json({ success: true, message: 'Callback received' })
  }
}
