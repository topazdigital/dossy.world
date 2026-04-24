import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getTransactionsByUser } from '@/lib/db'

export async function GET() {
  try {
    const user = await getCurrentUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const transactions = await getTransactionsByUser(user.id)
    
    return NextResponse.json({
      transactions: transactions.slice(0, 50) // Last 50 transactions
    })
  } catch (error) {
    console.error('Fetch transactions error:', error)
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 })
  }
}
