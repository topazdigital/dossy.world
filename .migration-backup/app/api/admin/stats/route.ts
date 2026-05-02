import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { getStats, getActiveRoundStrict, getBuysByRound, getSetting } from '@/lib/db'

export async function GET() {
  try {
    await requireAdmin()
    const stats = await getStats()

    // Augment activeRound with admin-only intel: hidden outcome flag,
    // bot target %, time remaining, real-user stake exposure.
    const live = await getActiveRoundStrict()
    let liveDetails: Record<string, unknown> | null = null
    if (live) {
      const buys = await getBuysByRound(live.id)
      const realStake = buys.filter(b => !b.is_bot_buy).reduce((s, b) => s + b.amount, 0)
      const botStake = buys.filter(b => b.is_bot_buy).reduce((s, b) => s + b.amount, 0)
      const expiresAt = live.expires_at ? new Date(live.expires_at).getTime() : 0
      const secondsLeft = expiresAt ? Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)) : null
      liveDetails = {
        id: live.id,
        round_number: live.round_number,
        vault_cap: live.vault_cap,
        profit_percentage: live.profit_percentage,
        current_amount: live.current_amount,
        will_fill: live.will_fill,
        bot_target_pct: live.bot_target_pct,
        seconds_until_expiry: secondsLeft,
        real_user_stake: realStake,
        bot_stake: botStake,
        real_user_count: new Set(buys.filter(b => !b.is_bot_buy).map(b => b.user_id)).size,
      }
    }

    const houseEdge = parseInt((await getSetting('house_edge_percentage')) || '35', 10)
    const vaultLifetime = parseInt((await getSetting('vault_lifetime_seconds')) || '90', 10)

    return NextResponse.json({
      ...stats,
      liveVault: liveDetails,
      tuning: {
        house_edge_percentage: houseEdge,
        vault_lifetime_seconds: vaultLifetime,
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Stats error:', error)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}
