import { Router } from 'express'
import { tick, getEngineState, getRoundAcceptingBuys, computeFairOutcome } from '../lib/game-engine.js'
import { requireAuth } from '../lib/auth.js'
import {
  createBuy,
  updateUserBalance,
  createTransaction,
  getSetting,
  findUserById,
  getBuysByRound,
  getRoundById,
} from '../lib/db.js'
import { addToCounter, getCounter, touchCounter, rateLimit } from '../lib/rate-limit.js'
import { getClientIp } from '../lib/auth.js'

const router = Router()

router.get('/game/current-round', async (req, res) => {
  try {
    await tick()
    const state = await getEngineState()
    return res.json(state)
  } catch (err) {
    req.log.error(err)
    return res.status(500).json({ error: 'Failed to fetch state' })
  }
})

router.post('/game/buy', async (req, res) => {
  try {
    const user = await requireAuth(req)
    if (user.is_banned) return res.status(403).json({ error: 'Your account has been suspended' })
    const { amount } = req.body
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' })
    }
    const minBuy = parseInt((await getSetting('min_buy_amount')) || '50', 10)
    const maxBuy = parseInt((await getSetting('max_buy_amount')) || '5000', 10)
    if (amount < minBuy) return res.status(400).json({ error: `Minimum buy is KES ${minBuy}` })
    if (amount > maxBuy) return res.status(400).json({ error: `Maximum buy is KES ${maxBuy}` })
    if (amount > user.balance) return res.status(400).json({ error: 'Insufficient balance' })

    const round = await getRoundAcceptingBuys()
    if (!round) return res.status(400).json({ error: 'Vault is not accepting buys right now' })

    const remaining = round.vault_cap - round.current_amount
    if (remaining <= 0) return res.status(409).json({ error: 'Vault just erupted, try again' })

    const stakePctSetting = parseInt((await getSetting('max_user_stake_pct_per_round')) || '25', 10)
    const stakePct = Math.max(1, Math.min(100, isFinite(stakePctSetting) ? stakePctSetting : 25))
    const perUserCap = Math.floor((round.vault_cap * stakePct) / 100)
    const existingBuys = await getBuysByRound(round.id)
    const userAlreadyStaked = existingBuys
      .filter((b) => b.user_id === user.id && !b.is_bot_buy)
      .reduce((sum, b) => sum + b.amount, 0)
    const userRoomLeft = perUserCap - userAlreadyStaked
    if (userRoomLeft <= 0) {
      return res.status(400).json({ error: `You've already hit your per-round limit of KES ${perUserCap}. Wait for the next vault.` })
    }

    const ip = getClientIp(req)
    const ipPctSetting = parseInt((await getSetting('max_ip_stake_pct_per_round')) || '40', 10)
    const ipPct = Math.max(1, Math.min(100, isFinite(ipPctSetting) ? ipPctSetting : 40))
    const perIpCap = Math.floor((round.vault_cap * ipPct) / 100)
    const ipKey = `ipstake:${round.id}:${ip}`
    touchCounter(ipKey)
    const ipAlready = getCounter(ipKey)
    const ipRoomLeft = perIpCap - ipAlready
    if (ipRoomLeft <= 0) {
      return res.status(429).json({ error: 'Too much activity from your network for this vault. Try the next round.' })
    }

    const finalAmount = Math.min(amount, remaining, userRoomLeft, ipRoomLeft)
    const updatedUser = await updateUserBalance(user.id, -finalAmount)
    if (!updatedUser) return res.status(500).json({ error: 'Failed to update balance' })

    const buy = await createBuy({ round_id: round.id, user_id: user.id, amount: finalAmount, is_bot_buy: false })
    addToCounter(ipKey, finalAmount)

    await createTransaction({
      user_id: user.id,
      type: 'buy',
      amount: -finalAmount,
      balance_after: updatedUser.balance,
      status: 'completed',
      description: 'Vault buy-in',
      reference_id: buy.id,
    })

    const finalUser = await findUserById(user.id)
    return res.json({
      success: true,
      buy: { id: buy.id, amount: buy.amount, created_at: buy.created_at },
      user: finalUser ? { id: finalUser.id, username: finalUser.username, balance: finalUser.balance } : null,
    })
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'Unauthorized') {
      return res.status(401).json({ error: 'Please login to continue' })
    }
    req.log.error(err)
    return res.status(500).json({ error: 'Buy failed' })
  }
})

router.post('/game/start-round', async (req, res) => {
  await tick()
  return res.json({ success: true })
})

router.post('/game/auto-payout', async (req, res) => {
  await tick()
  return res.json({ success: true })
})

router.get('/game/fairness/:roundId', async (req, res) => {
  try {
    const { roundId } = req.params
    const round = await getRoundById(roundId)
    if (!round) return res.status(404).json({ error: 'Round not found' })

    const isOver = ['filled', 'paid', 'expired', 'cancelled'].includes(round.status)

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
      return res.json({ ...base, server_seed: null, revealed: false })
    }

    const { roll, hash } = computeFairOutcome(round.server_seed, 'pending', round.client_seed || '', round.fairness_nonce || 0)
    return res.json({
      ...base,
      revealed: true,
      server_seed: round.server_seed,
      hmac: hash,
      roll,
      will_fill: round.will_fill,
      outcome: round.status === 'expired' ? 'no-payout' : 'payout',
    })
  } catch (err) {
    req.log.error(err)
    return res.status(500).json({ error: 'Failed' })
  }
})

export default router
