import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { updateUser, findUserById, recordAudit } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin()

    const body = await request.json()
    const { userId, banned } = body
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }
    
    const user = await findUserById(userId)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    
    if (user.is_admin) {
      return NextResponse.json({ error: 'Cannot ban admin users' }, { status: 400 })
    }
    
    await updateUser(userId, { is_banned: banned })

    await recordAudit({
      admin_id: admin.id,
      admin_username: admin.username,
      action: banned ? 'user.ban' : 'user.unban',
      target_type: 'user',
      target_id: userId,
      details: { target_username: user.username },
    })

    return NextResponse.json({
      success: true,
      message: banned ? 'User banned' : 'User unbanned'
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Ban error:', error)
    return NextResponse.json({ error: 'Operation failed' }, { status: 500 })
  }
}
