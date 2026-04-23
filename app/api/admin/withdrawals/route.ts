import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { getWithdrawalRequests } from '@/lib/db'

export async function GET() {
  try {
    await requireAdmin()
    
    const withdrawals = await getWithdrawalRequests()
    
    return NextResponse.json({ withdrawals })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Withdrawals fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch withdrawals' }, { status: 500 })
  }
}
