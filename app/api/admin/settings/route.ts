import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { getAllSettings, setSetting } from '@/lib/db'

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
    await requireAdmin()
    
    const body = await request.json()
    const { settings } = body
    
    if (!settings || typeof settings !== 'object') {
      return NextResponse.json({ error: 'Invalid settings' }, { status: 400 })
    }
    
    // Update each setting
    for (const [key, value] of Object.entries(settings)) {
      if (typeof value === 'string' && value.trim()) {
        await setSetting(key, value)
      }
    }
    
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
