import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { updateUserBalance, findUserById, createTransaction } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    
    const body = await request.json()
    const { userId, amount, type } = body
    
    if (!userId || !amount) {
      return NextResponse.json({ error: 'User ID and amount required' }, { status: 400 })
    }
    
    const user = await findUserById(userId)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    
    // For debit, check if user has enough balance
    if (amount < 0 && user.balance + amount < 0) {
      return NextResponse.json({ error: 'Insufficient balance for debit' }, { status: 400 })
    }
    
    const updatedUser = await updateUserBalance(userId, amount)
    
    if (!updatedUser) {
      return NextResponse.json({ error: 'Failed to update balance' }, { status: 500 })
    }
    
    // Create transaction record
    await createTransaction({
      user_id: userId,
      type: type === 'credit' ? 'admin_credit' : 'admin_debit',
      amount: amount,
      balance_after: updatedUser.balance,
      status: 'completed',
      description: `Admin ${type} by ${admin.username}`
    })
    
    return NextResponse.json({
      success: true,
      message: `Successfully ${type}ed KES ${Math.abs(amount).toLocaleString()}`,
      newBalance: updatedUser.balance
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Balance adjustment error:', error)
    return NextResponse.json({ error: 'Operation failed' }, { status: 500 })
  }
}
