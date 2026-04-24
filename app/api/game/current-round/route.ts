import { NextResponse } from 'next/server'
import { tick, getEngineState } from '@/lib/game-engine'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await tick()
    const state = await getEngineState()
    return NextResponse.json(state)
  } catch (error) {
    console.error('current-round error:', error)
    return NextResponse.json({ error: 'Failed to fetch state' }, { status: 500 })
  }
}
