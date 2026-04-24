import { NextResponse } from 'next/server'
import { getRoundById } from '@/lib/db'
import { computeFairOutcome } from '@/lib/game-engine'

// Public provably-fair endpoint.
// While a round is live we expose only the commitment (server_seed_hash,
// client_seed, nonce). Once the round is over (filled, paid, or expired)
// we also reveal the server_seed plus the recomputed roll, so anyone can
// verify HMAC_SHA256(server_seed, "<roundId>:<client_seed>:<nonce>").
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ roundId: string }> },
) {
  const { roundId } = await params
  const round = await getRoundById(roundId)
  if (!round) {
    return NextResponse.json({ error: 'Round not found' }, { status: 404 })
  }

  const isOver =
    round.status === 'filled' ||
    round.status === 'paid' ||
    round.status === 'expired' ||
    round.status === 'cancelled'

  const base = {
    round_id: round.id,
    round_number: round.round_number,
    status: round.status,
    server_seed_hash: round.server_seed_hash,
    client_seed: round.client_seed,
    fairness_nonce: round.fairness_nonce,
    verify_message: round.client_seed
      ? `HMAC_SHA256(server_seed, "pending:${round.client_seed}:${round.fairness_nonce}")`
      : null,
    note: 'Take first 8 hex chars of the HMAC, parse as int, divide by 2^32, multiply by 100 -> roll. Roll >= house_edge_percentage means the round was set to pay out.',
  }

  if (!isOver || !round.server_seed) {
    return NextResponse.json({ ...base, server_seed: null, revealed: false })
  }

  const { roll, hash } = computeFairOutcome(
    round.server_seed,
    'pending',
    round.client_seed || '',
    round.fairness_nonce || 0,
  )

  return NextResponse.json({
    ...base,
    revealed: true,
    server_seed: round.server_seed,
    hmac: hash,
    roll,
    will_fill: round.will_fill,
    outcome: round.status === 'expired' ? 'no-payout' : 'payout',
  })
}
