import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import {
  getActiveRoundStrict,
  updateRound,
  setSetting,
  recordAudit,
} from '@/lib/db'
import { tick } from '@/lib/game-engine'

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin()

    const body = await request.json()
    const { action, vaultCap, profitPercentage, houseEdge, vaultLifetimeSeconds } = body

    await recordAudit({
      admin_id: admin.id,
      admin_username: admin.username,
      action: `round.${action}`,
      target_type: 'round',
      target_id: null,
      details: { vaultCap, profitPercentage, houseEdge, vaultLifetimeSeconds },
    })

    switch (action) {
      case 'force_erupt': {
        const active = await getActiveRoundStrict()
        if (!active) {
          return NextResponse.json({ error: 'No active vault to erupt' }, { status: 400 })
        }
        await updateRound(active.id, {
          status: 'filled',
          current_amount: active.vault_cap,
          filled_at: new Date().toISOString(),
        })
        await tick()
        return NextResponse.json({ success: true, message: 'Vault erupted — payout cooldown started' })
      }

      case 'force_expire': {
        const active = await getActiveRoundStrict()
        if (!active) {
          return NextResponse.json({ error: 'No active vault to expire' }, { status: 400 })
        }
        await updateRound(active.id, {
          status: 'expired',
          expired_at: new Date().toISOString(),
        })
        await tick()
        return NextResponse.json({ success: true, message: 'Vault expired — house kept all stakes' })
      }

      case 'apply_to_live': {
        const active = await getActiveRoundStrict()
        if (!active) {
          return NextResponse.json({ error: 'No active vault' }, { status: 400 })
        }
        const patch: Record<string, unknown> = {}
        if (vaultCap) patch.vault_cap = parseInt(String(vaultCap), 10)
        if (profitPercentage) patch.profit_percentage = parseInt(String(profitPercentage), 10)
        if (Object.keys(patch).length === 0) {
          return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
        }
        await updateRound(active.id, patch)
        return NextResponse.json({ success: true, message: 'Live vault updated' })
      }

      case 'set_defaults': {
        if (vaultCap) await setSetting('default_vault_cap', String(vaultCap))
        if (profitPercentage) await setSetting('default_profit_percentage', String(profitPercentage))
        if (houseEdge !== undefined && houseEdge !== '') {
          await setSetting('house_edge_percentage', String(houseEdge))
        }
        if (vaultLifetimeSeconds !== undefined && vaultLifetimeSeconds !== '') {
          await setSetting('vault_lifetime_seconds', String(vaultLifetimeSeconds))
        }
        return NextResponse.json({
          success: true,
          message: 'Defaults updated for upcoming vaults',
        })
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Round control error:', error)
    return NextResponse.json({ error: 'Operation failed' }, { status: 500 })
  }
}
