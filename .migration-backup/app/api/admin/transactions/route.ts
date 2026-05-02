import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { requireAdmin } from '@/lib/auth'

const DATA_DIR = path.join(process.cwd(), '.data')
const DB_FILE = path.join(DATA_DIR, 'db.json')

export async function GET() {
  try {
    await requireAdmin()
    
    const data = await fs.readFile(DB_FILE, 'utf-8')
    const db = JSON.parse(data)
    
    // Get all transactions with user info
    const transactions = (db.transactions || [])
      .sort((a: { created_at: string }, b: { created_at: string }) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      .slice(0, 500) // Limit to last 500
      .map((tx: { user_id: string }) => {
        const user = db.users.find((u: { id: string }) => u.id === tx.user_id)
        return {
          ...tx,
          user: user ? { username: user.username } : null
        }
      })
    
    return NextResponse.json({ transactions })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Transactions fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 })
  }
}
