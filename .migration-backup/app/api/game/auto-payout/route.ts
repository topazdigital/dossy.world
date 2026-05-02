import { NextResponse } from 'next/server'
import { tick } from '@/lib/game-engine'

// Legacy endpoint. The engine now handles payouts automatically on tick.
// Kept as a no-op so any old client still hitting it just nudges the engine.
export async function POST() {
  await tick()
  return NextResponse.json({ success: true })
}
