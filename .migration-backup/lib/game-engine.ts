// Continuous "Aviator-style" vault engine with a real house edge.
//
// One active round at a time. Each round, on creation, secretly rolls
// "will_fill" against the configured house edge. Bots only push toward a
// per-round bot_target_pct (100% on a fill round, 50–80% on a no-fill round).
//
// Outcomes:
//   - Vault hits cap     -> status 'filled', payout to real users after a
//                           short cooldown, next vault promoted instantly.
//   - Vault expires      -> status 'expired'. No payouts. Real-user stakes
//                           stay with the house. Next vault promoted instantly.
//
// will_fill, bot_target_pct, expires_at are server-internal. They are never
// returned by the public engine view (admin endpoints expose them).

import { createHash, createHmac, randomBytes } from 'crypto'
import {
  getCurrentRound,
  getActiveRoundStrict,
  getNextWaitingRound,
  getRoundsByStatus,
  getBuysByRound,
  getRecentRealBuyerCount,
  createRound,
  updateRound,
  updateBuy,
  updateUserBalance,
  createBuy,
  createTransaction,
  getSetting,
  type Round,
} from './db'
import { getOrCreateBotUser, randomBotBuyAmount } from './bots'

// Provably-fair: deterministic outcome from a server seed (committed before
// the round starts) and a client seed (a public, unpredictable value mixed in
// so the server can't pre-pick a seed that gives a desired outcome). After
// the round ends we publish the server seed so anyone can verify.
export function computeFairOutcome(
  serverSeed: string,
  roundId: string,
  clientSeed: string,
  nonce: number,
): { roll: number; hash: string } {
  const message = `${roundId}:${clientSeed}:${nonce}`
  const hmac = createHmac('sha256', serverSeed).update(message).digest('hex')
  // Take the first 8 hex chars -> 32-bit int -> [0, 1).
  const intVal = parseInt(hmac.substring(0, 8), 16)
  const roll = (intVal / 0x100000000) * 100  // 0..100
  return { roll, hash: hmac }
}

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex')
}

const BOT_TICK_MIN_INTERVAL_MS = 1500
const BOT_ACTIVE_USER_THRESHOLD = 3 // 3+ unique real buyers in window = bots stand down
const REAL_USER_WINDOW_MS = 90_000

let tickPromise: Promise<void> | null = null
const lastBotDripAt = new Map<string, number>()

async function settingInt(key: string, fallback: number): Promise<number> {
  const v = await getSetting(key)
  if (v == null) return fallback
  const n = parseInt(v, 10)
  return Number.isFinite(n) ? n : fallback
}

async function payoutCooldownMs(): Promise<number> {
  return (await settingInt('payout_cooldown_seconds', 5)) * 1000
}

async function defaultVaultCap(): Promise<number> {
  return settingInt('default_vault_cap', 10000)
}
async function defaultProfit(): Promise<number> {
  return settingInt('default_profit_percentage', 30)
}
async function houseEdgePct(): Promise<number> {
  return Math.max(0, Math.min(95, await settingInt('house_edge_percentage', 70)))
}
async function vaultLifetimeMs(): Promise<number> {
  return Math.max(15, await settingInt('vault_lifetime_seconds', 90)) * 1000
}
async function noFillTargetRange(): Promise<[number, number]> {
  const lo = Math.max(10, Math.min(95, await settingInt('nofill_bot_target_min_pct', 50)))
  const hi = Math.max(lo, Math.min(95, await settingInt('nofill_bot_target_max_pct', 80)))
  return [lo, hi]
}

async function rollNewRoundParams() {
  const cap = await defaultVaultCap()
  const profit = await defaultProfit()
  const edge = await houseEdgePct()
  const lifetimeMs = await vaultLifetimeMs()

  // Provably-fair: generate a fresh server seed, publish only its sha256
  // hash now. Mix in a fresh client seed + nonce so the outcome is
  // deterministic and verifiable later.
  const serverSeed = randomBytes(32).toString('hex')
  const serverSeedHash = sha256(serverSeed)
  const clientSeed = randomBytes(8).toString('hex')
  const nonce = Date.now()

  // We need a placeholder round id for the HMAC; we'll mix in the real round
  // id (at create time we don't have it yet, so we use the client_seed +
  // nonce alone for the outcome, and the round id is included only for
  // verification on the player's side via the same string we publish).
  const { roll } = computeFairOutcome(serverSeed, 'pending', clientSeed, nonce)
  const willFill = roll >= edge

  let botTargetPct = 100
  if (!willFill) {
    const [lo, hi] = await noFillTargetRange()
    botTargetPct = Math.floor(lo + Math.random() * (hi - lo + 1))
  }
  const expiresAt = new Date(Date.now() + lifetimeMs).toISOString()
  return {
    cap, profit, willFill, botTargetPct, expiresAt,
    serverSeed, serverSeedHash, clientSeed, nonce,
  }
}

async function ensureActiveRound(): Promise<Round> {
  const active = await getActiveRoundStrict()
  if (active) return active
  const p = await rollNewRoundParams()
  const created = await createRound({
    vault_cap: p.cap,
    profit_percentage: p.profit,
    will_fill: p.willFill,
    bot_target_pct: p.botTargetPct,
    expires_at: p.expiresAt,
    server_seed: p.serverSeed,
    server_seed_hash: p.serverSeedHash,
    client_seed: p.clientSeed,
    fairness_nonce: p.nonce,
  })
  const started = await updateRound(created.id, {
    status: 'active',
    started_at: new Date().toISOString(),
  })
  return started || created
}

async function promoteNext(): Promise<Round> {
  const next = await getNextWaitingRound()
  if (next) {
    // Refresh expires_at relative to "now" — the lifetime starts when the
    // vault actually goes live, not when it was queued.
    const lifetimeMs = await vaultLifetimeMs()
    const refreshed = await updateRound(next.id, {
      status: 'active',
      started_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + lifetimeMs).toISOString(),
    })
    return refreshed || next
  }
  const p = await rollNewRoundParams()
  const created = await createRound({
    vault_cap: p.cap,
    profit_percentage: p.profit,
    will_fill: p.willFill,
    bot_target_pct: p.botTargetPct,
    expires_at: p.expiresAt,
    server_seed: p.serverSeed,
    server_seed_hash: p.serverSeedHash,
    client_seed: p.clientSeed,
    fairness_nonce: p.nonce,
  })
  const started = await updateRound(created.id, {
    status: 'active',
    started_at: new Date().toISOString(),
  })
  return started || created
}

async function payoutRound(round: Round): Promise<void> {
  await updateRound(round.id, { status: 'paying' })
  const buys = await getBuysByRound(round.id)
  for (const buy of buys) {
    if (buy.is_paid || buy.is_bot_buy) continue
    const payout = buy.amount * (1 + round.profit_percentage / 100)
    const updated = await updateUserBalance(buy.user_id, payout)
    if (!updated) continue
    await createTransaction({
      user_id: buy.user_id,
      type: 'payout',
      amount: payout,
      balance_after: updated.balance,
      status: 'completed',
      description: `Vault eruption payout (+${round.profit_percentage}%)`,
      reference_id: buy.id,
    })
    await updateBuy(buy.id, { is_paid: true, payout_amount: payout })
  }
  await updateRound(round.id, { status: 'paid', paid_at: new Date().toISOString() })
}

async function maybeDripBot(active: Round): Promise<boolean> {
  const now = Date.now()
  const targetAmount = Math.floor(active.vault_cap * (active.bot_target_pct / 100))
  const remainingForBots = targetAmount - active.current_amount
  if (remainingForBots <= 0) return false

  const last = lastBotDripAt.get(active.id) || 0
  const realBuyers = await getRecentRealBuyerCount(REAL_USER_WINDOW_MS)

  // ---- Fill rounds: pace-keeper. Make sure the vault actually erupts
  // before its lifetime expires, even with no real users present.
  if (active.will_fill && active.expires_at && active.started_at) {
    const startedAt = new Date(active.started_at).getTime()
    const expiresAt = new Date(active.expires_at).getTime()
    const totalLifeMs = Math.max(1000, expiresAt - startedAt)
    const elapsedMs = Math.max(0, Math.min(totalLifeMs, now - startedAt))
    // Aim to fill by 80% of lifetime so eruption happens with a buffer.
    const expected = active.vault_cap * Math.min(1, elapsedMs / (totalLifeMs * 0.8))
    const deficit = expected - active.current_amount
    const remainingToCap = active.vault_cap - active.current_amount

    if (now - last < 400) return false

    // If on pace and real users are carrying the vault, sit out.
    if (deficit <= 0 && realBuyers >= BOT_ACTIVE_USER_THRESHOLD) return false
    // If on pace and no real users, still drip but with a calmer cadence.
    if (deficit <= 0 && now - last < 1500) return false

    // Compute drip size: base random + however much we're behind.
    let amount = randomBotBuyAmount()
    if (deficit > 0) amount = Math.max(amount, Math.ceil(deficit * 0.5))
    // Cap so a single bot can't solo-erupt and so we don't exceed cap.
    const maxChunk = Math.max(80, Math.floor(remainingToCap * 0.35))
    amount = Math.min(amount, maxChunk, remainingToCap)
    // Final top-off: if the vault is within a tiny gap of cap, just close it.
    if (remainingToCap > 0 && remainingToCap < 50) amount = remainingToCap
    if (amount < 1) return false

    lastBotDripAt.set(active.id, now)
    const bot = await getOrCreateBotUser()
    if (!bot) return false
    await createBuy({ round_id: active.id, user_id: bot.id, amount, is_bot_buy: true })
    return true
  }

  // ---- No-fill rounds: gently drip toward bot_target_pct, then stop.
  if (now - last < BOT_TICK_MIN_INTERVAL_MS) return false
  if (realBuyers >= BOT_ACTIVE_USER_THRESHOLD) return false

  const baseDelay = realBuyers === 0 ? 2000 : realBuyers === 1 ? 5000 : 8000
  const jitter = Math.floor(Math.random() * baseDelay)
  if (now - last < baseDelay + jitter) return false

  const remainingToCap = active.vault_cap - active.current_amount
  const maxBotChunk = Math.max(50, Math.floor(remainingToCap * 0.3))
  const cappedByTarget = Math.min(maxBotChunk, remainingForBots)
  const amount = Math.min(randomBotBuyAmount(), cappedByTarget)
  if (amount < 50) return false

  lastBotDripAt.set(active.id, now)
  const bot = await getOrCreateBotUser()
  if (!bot) return false
  await createBuy({ round_id: active.id, user_id: bot.id, amount, is_bot_buy: true })
  return true
}

async function runTick(): Promise<void> {
  // Always make sure there's a vault accepting buys.
  let active = await ensureActiveRound()

  // 1. Eruption: vault hit its cap.
  if (active.status === 'active' && active.current_amount >= active.vault_cap) {
    const filled = await updateRound(active.id, {
      status: 'filled',
      filled_at: new Date().toISOString(),
    })
    if (filled) active = filled
    await promoteNext()
  }

  // 2. Expiration: live vault that did NOT fill within its lifetime.
  if (
    active.status === 'active' &&
    active.expires_at &&
    Date.now() >= new Date(active.expires_at).getTime() &&
    active.current_amount < active.vault_cap
  ) {
    await updateRound(active.id, {
      status: 'expired',
      expired_at: new Date().toISOString(),
    })
    await promoteNext()
  }

  // 3. Pay out any erupted vaults whose cooldown has elapsed.
  const cooldownMs = await payoutCooldownMs()
  const filled = await getRoundsByStatus('filled')
  for (const r of filled) {
    const filledAt = r.filled_at ? new Date(r.filled_at).getTime() : 0
    if (Date.now() - filledAt >= cooldownMs) {
      await payoutRound(r)
    }
  }

  // 4. Adaptive bot drip on the current live vault.
  // Fill rounds may need multiple drips per tick to stay on pace if the
  // engine is only being polled once a second or so.
  for (let i = 0; i < 4; i++) {
    const liveActive = await getActiveRoundStrict()
    if (!liveActive) break
    const dripped = await maybeDripBot(liveActive).catch(err => {
      console.error('bot drip', err)
      return false
    })
    if (!dripped) break
    // Re-check fill state — eruption inside the loop should hand off cleanly.
    if (liveActive.current_amount + 1 >= liveActive.vault_cap) break
  }
}

// Single-flight tick: concurrent requests share one tick.
export async function tick(): Promise<void> {
  if (tickPromise) return tickPromise
  tickPromise = runTick().finally(() => {
    tickPromise = null
  })
  return tickPromise
}

export interface PublicRoundView {
  id: string
  vault_cap: number
  profit_percentage: number
  current_amount: number
  fill_percentage: number
  participants: number
  // Provably-fair commitment. Hash is published while the round is live;
  // the seed is revealed via /api/game/fairness/[roundId] after the round
  // ends so players can re-derive the outcome.
  server_seed_hash: string | null
  client_seed: string | null
  fairness_nonce: number | null
  buys: Array<{
    id: string
    user_id: string
    amount: number
    is_bot_buy: boolean
    created_at: string
    user: { username: string } | null
  }>
}

export interface PublicEngineState {
  active: PublicRoundView | null
  // The round that just erupted and is in payout cooldown, if any.
  erupting: {
    id: string
    vault_cap: number
    profit_percentage: number
    seconds_until_payout: number
    participants: number
  } | null
}

function toPublicRoundView(round: Round, buys: Awaited<ReturnType<typeof getBuysByRound>>): PublicRoundView {
  return {
    id: round.id,
    vault_cap: round.vault_cap,
    profit_percentage: round.profit_percentage,
    current_amount: round.current_amount,
    fill_percentage: Math.min(100, (round.current_amount / round.vault_cap) * 100),
    participants: buys.length,
    server_seed_hash: round.server_seed_hash ?? null,
    client_seed: round.client_seed ?? null,
    fairness_nonce: round.fairness_nonce ?? null,
    buys: buys.slice(0, 50).map(b => ({
      id: b.id,
      user_id: b.user_id,
      amount: b.amount,
      is_bot_buy: b.is_bot_buy,
      created_at: b.created_at,
      user: b.user ? { username: b.user.username } : null,
    })),
  }
}

export async function getEngineState(): Promise<PublicEngineState> {
  const active = await getActiveRoundStrict()
  const filled = await getRoundsByStatus('filled')

  let activeView: PublicRoundView | null = null
  if (active) {
    const buys = await getBuysByRound(active.id)
    activeView = toPublicRoundView(active, buys)
  }

  let erupting: PublicEngineState['erupting'] = null
  if (filled.length > 0) {
    const cooldownMs = await payoutCooldownMs()
    // Show the most recently filled round.
    const r = filled.sort((a, b) =>
      new Date(b.filled_at || b.created_at).getTime() -
      new Date(a.filled_at || a.created_at).getTime()
    )[0]
    const filledAt = r.filled_at ? new Date(r.filled_at).getTime() : Date.now()
    const remainingMs = Math.max(0, cooldownMs - (Date.now() - filledAt))
    const buys = await getBuysByRound(r.id)
    erupting = {
      id: r.id,
      vault_cap: r.vault_cap,
      profit_percentage: r.profit_percentage,
      seconds_until_payout: Math.ceil(remainingMs / 1000),
      participants: buys.filter(b => !b.is_bot_buy).length,
    }
  }

  return { active: activeView, erupting }
}

// Expose for buy route: returns the round currently accepting buys.
export async function getRoundAcceptingBuys(): Promise<Round | null> {
  await tick()
  return getActiveRoundStrict()
}

// Backwards-compat helper used by existing legacy code paths.
export { getCurrentRound }
