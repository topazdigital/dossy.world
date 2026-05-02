import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { requireAdmin } from '@/lib/auth'

const DATA_DIR = path.join(process.cwd(), '.data')
const DB_FILE = path.join(DATA_DIR, 'db.json')

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()
    
    const body = await request.json()
    const { id, active } = body
    
    if (id === undefined || active === undefined) {
      return NextResponse.json({ error: 'ID and active status required' }, { status: 400 })
    }
    
    // Read DB
    const data = await fs.readFile(DB_FILE, 'utf-8')
    const db = JSON.parse(data)
    
    // Find and update bot name
    const index = db.bot_names.findIndex((bn: { id: number }) => bn.id === id)
    if (index === -1) {
      return NextResponse.json({ error: 'Bot name not found' }, { status: 404 })
    }
    
    db.bot_names[index].is_active = active
    
    // Write DB
    await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2))
    
    return NextResponse.json({
      success: true,
      message: `Bot name ${active ? 'activated' : 'deactivated'}`
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Bot toggle error:', error)
    return NextResponse.json({ error: 'Failed to toggle bot name' }, { status: 500 })
  }
}
