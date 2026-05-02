import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { getAllSettings, recordAudit, setSetting } from '@/lib/db'

export async function GET() {
  try {
    await requireAdmin()
    const settings = await getAllSettings()
    return NextResponse.json({ settings })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Settings fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin()

    const body = await request.json()
    const { settings } = body

    if (!settings || typeof settings !== 'object') {
      return NextResponse.json({ error: 'Invalid settings' }, { status: 400 })
    }

    const changed: Record<string, string> = {}
    for (const [key, value] of Object.entries(settings)) {
      if (typeof value === 'string' && value.trim()) {
        await setSetting(key, value)
        changed[key] = value
      }
    }

    await recordAudit({
      admin_id: admin.id,
      admin_username: admin.username,
      action: 'settings.update',
      target_type: 'settings',
      target_id: null,
      details: { changed },
    })

    return NextResponse.json({
      success: true,
      message: 'Settings updated'
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Settings update error:', error)
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
