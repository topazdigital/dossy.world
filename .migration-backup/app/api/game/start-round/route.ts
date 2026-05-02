import { NextResponse } from 'next/server'
import { tick } from '@/lib/game-engine'

// Legacy endpoint. Rounds now flow continuously via the engine.
export async function POST() {
  await tick()
  return NextResponse.json({ success: true })
}
