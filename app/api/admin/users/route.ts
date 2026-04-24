import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { getAllUsers } from '@/lib/db'

export async function GET() {
  try {
    await requireAdmin()
    
    const users = await getAllUsers(true) // Include bots and admin
    
    return NextResponse.json({ 
      users: users.map(user => ({
        id: user.id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        balance: user.balance,
        is_admin: user.is_admin,
        is_bot: user.is_bot,
        is_banned: user.is_banned,
        created_at: user.created_at
      }))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Users fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}
