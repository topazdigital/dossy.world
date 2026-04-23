import { NextRequest, NextResponse } from 'next/server'
import { parseCallback } from '@/lib/mpesa'
import { 
  findTransactionByCheckoutId, 
  updateTransaction, 
  updateUserBalance,
  findUserById
} from '@/lib/db'

// M-Pesa STK Push Callback Handler
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('[M-Pesa Callback] Received:', JSON.stringify(body))
    
    const callbackData = parseCallback(body)
    
    if (!callbackData) {
      console.error('[M-Pesa Callback] Failed to parse callback data')
      return NextResponse.json({ ResultCode: 0, ResultDesc: 'Callback received' })
    }
    
    const { checkoutRequestId, resultCode, resultDesc, amount, mpesaReceiptNumber } = callbackData
    
    // Find the transaction by checkout ID
    const transaction = await findTransactionByCheckoutId(checkoutRequestId)
    
    if (!transaction) {
      console.error('[M-Pesa Callback] Transaction not found for checkout ID:', checkoutRequestId)
      return NextResponse.json({ ResultCode: 0, ResultDesc: 'Transaction not found' })
    }
    
    if (transaction.status === 'completed') {
      console.log('[M-Pesa Callback] Transaction already completed')
      return NextResponse.json({ ResultCode: 0, ResultDesc: 'Already processed' })
    }
    
    if (resultCode === 0) {
      // Payment successful
      const depositAmount = amount || transaction.amount
      
      // Get user
      const user = await findUserById(transaction.user_id)
      if (!user) {
        console.error('[M-Pesa Callback] User not found')
        return NextResponse.json({ ResultCode: 0, ResultDesc: 'User not found' })
      }
      
      // Update user balance
      const newBalance = user.balance + depositAmount
      await updateUserBalance(transaction.user_id, depositAmount)
      
      // Update transaction
      await updateTransaction(transaction.id, {
        status: 'completed',
        balance_after: newBalance,
        mpesa_receipt: mpesaReceiptNumber || null
      })
      
      console.log(`[M-Pesa Callback] Deposit successful: KES ${depositAmount} for user ${user.username}`)
    } else {
      // Payment failed
      await updateTransaction(transaction.id, {
        status: 'failed',
        description: `M-Pesa deposit - Failed: ${resultDesc}`
      })
      
      console.log('[M-Pesa Callback] Payment failed:', resultDesc)
    }
    
    // Always return success to M-Pesa
    return NextResponse.json({
      ResultCode: 0,
      ResultDesc: 'Callback processed successfully'
    })
  } catch (error) {
    console.error('[M-Pesa Callback] Error:', error)
    // Still return success to prevent M-Pesa from retrying
    return NextResponse.json({
      ResultCode: 0,
      ResultDesc: 'Callback received'
    })
  }
}
