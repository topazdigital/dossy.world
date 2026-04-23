import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { 
  updateWithdrawalRequest, 
  updateUserBalance, 
  createTransaction,
  findUserById
} from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    
    const body = await request.json()
    const { requestId, action, mpesaReceipt, adminNotes } = body
    
    if (!requestId || !action) {
      return NextResponse.json({ error: 'Request ID and action required' }, { status: 400 })
    }
    
    if (action === 'approve') {
      // Mark as completed
      await updateWithdrawalRequest(requestId, {
        status: 'completed',
        mpesa_receipt: mpesaReceipt || null,
        admin_notes: adminNotes || null,
        processed_by: admin.id,
        processed_at: new Date().toISOString()
      })
      
      return NextResponse.json({
        success: true,
        message: 'Withdrawal approved'
      })
    } else if (action === 'reject') {
      // Get the withdrawal request to find user and amount
      const { getWithdrawalRequests } = await import('@/lib/db')
      const requests = await getWithdrawalRequests()
      const withdrawalRequest = requests.find(r => r.id === requestId)
      
      if (!withdrawalRequest) {
        return NextResponse.json({ error: 'Request not found' }, { status: 404 })
      }
      
      // Refund the user's balance
      const user = await findUserById(withdrawalRequest.user_id)
      if (user) {
        const updatedUser = await updateUserBalance(withdrawalRequest.user_id, withdrawalRequest.amount)
        
        if (updatedUser) {
          // Create refund transaction
          await createTransaction({
            user_id: withdrawalRequest.user_id,
            type: 'refund',
            amount: withdrawalRequest.amount,
            balance_after: updatedUser.balance,
            status: 'completed',
            description: `Withdrawal refund - rejected by admin: ${adminNotes || 'No reason provided'}`
          })
        }
      }
      
      // Mark as rejected
      await updateWithdrawalRequest(requestId, {
        status: 'rejected',
        admin_notes: adminNotes || null,
        processed_by: admin.id,
        processed_at: new Date().toISOString()
      })
      
      return NextResponse.json({
        success: true,
        message: 'Withdrawal rejected and refunded'
      })
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Process withdrawal error:', error)
    return NextResponse.json({ error: 'Operation failed' }, { status: 500 })
  }
}
