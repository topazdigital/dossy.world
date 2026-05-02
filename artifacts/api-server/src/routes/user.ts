import { Router } from 'express'
import { requireAuth, isValidUsername, isValidKenyanPhone, normalizePhone } from '../lib/auth.js'
import {
  updateUser,
  findUserByUsername,
  findUserByPhone,
  getTransactionsByUser,
  getBuysByUser,
  getRoundById,
  getActiveRoundStrict,
} from '../lib/db.js'

const router = Router()

router.get('/user/profile', async (req, res) => {
  try {
    const user = await requireAuth(req)
    return res.json({ user: { id: user.id, username: user.username, email: user.email, phone: user.phone, balance: user.balance, is_admin: user.is_admin } })
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'Unauthorized') return res.status(401).json({ error: 'Not authenticated' })
    req.log.error(err)
    return res.status(500).json({ error: 'Failed to fetch profile' })
  }
})

router.patch('/user/profile', async (req, res) => {
  try {
    const user = await requireAuth(req)
    const { username, phone } = req.body
    const updates: { username?: string; phone?: string } = {}

    if (username && username !== user.username) {
      if (!isValidUsername(username)) {
        return res.status(400).json({ error: 'Username must be 3-20 characters, start with a letter, and contain only letters, numbers, and underscores' })
      }
      const existingUser = await findUserByUsername(username)
      if (existingUser && existingUser.id !== user.id) return res.status(400).json({ error: 'This username is already taken' })
      updates.username = username
    }

    if (phone !== undefined) {
      if (phone === '') {
        updates.phone = ''
      } else if (phone !== user.phone) {
        if (!isValidKenyanPhone(phone)) return res.status(400).json({ error: 'Please enter a valid Kenyan phone number' })
        const normalizedPhone = normalizePhone(phone)
        const existingUser = await findUserByPhone(normalizedPhone)
        if (existingUser && existingUser.id !== user.id) return res.status(400).json({ error: 'This phone number is already registered' })
        updates.phone = normalizedPhone
      }
    }

    if (Object.keys(updates).length > 0) {
      const updatedUser = await updateUser(user.id, updates)
      if (!updatedUser) return res.status(500).json({ error: 'Failed to update profile' })
      return res.json({ success: true, user: { id: updatedUser.id, username: updatedUser.username, email: updatedUser.email, phone: updatedUser.phone, balance: updatedUser.balance, is_admin: updatedUser.is_admin } })
    }

    return res.json({ success: true, user: { id: user.id, username: user.username, email: user.email, phone: user.phone, balance: user.balance, is_admin: user.is_admin } })
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'Unauthorized') return res.status(401).json({ error: 'Not authenticated' })
    req.log.error(err)
    return res.status(500).json({ error: 'Failed to update profile' })
  }
})

router.get('/user/transactions', async (req, res) => {
  try {
    const user = await requireAuth(req)
    const transactions = await getTransactionsByUser(user.id)
    return res.json({ transactions: transactions.slice(0, 50) })
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'Unauthorized') return res.status(401).json({ error: 'Unauthorized' })
    req.log.error(err)
    return res.status(500).json({ error: 'Failed to fetch transactions' })
  }
})

router.get('/user/buys', async (req, res) => {
  try {
    const user = await requireAuth(req)
    const buys = await getBuysByUser(user.id)
    const enrichedBuys = await Promise.all(
      buys.slice(0, 50).map(async (buy) => {
        const round = await getRoundById(buy.round_id)
        return {
          ...buy,
          round: round ? { round_number: round.round_number, profit_percentage: round.profit_percentage, status: round.status } : null,
        }
      })
    )
    return res.json({ buys: enrichedBuys })
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'Unauthorized') return res.status(401).json({ error: 'Unauthorized' })
    req.log.error(err)
    return res.status(500).json({ error: 'Failed to fetch buys' })
  }
})

router.get('/user/upcoming-payout', async (req, res) => {
  try {
    const user = await requireAuth(req)
    const round = await getActiveRoundStrict()
    if (!round) return res.json({ upcoming: null })
    const buys = await getBuysByUser(user.id)
    const activeBuys = buys.filter(b => b.round_id === round.id)
    if (activeBuys.length === 0) return res.json({ upcoming: null })
    const totalStaked = activeBuys.reduce((s, b) => s + b.amount, 0)
    const expectedPayout = Math.round(totalStaked * (1 + round.profit_percentage / 100))
    return res.json({
      upcoming: {
        round_id: round.id,
        staked: totalStaked,
        expected_payout: expectedPayout,
        profit_percentage: round.profit_percentage,
        fill_percentage: Math.min(100, Math.round((round.current_amount / round.vault_cap) * 100)),
      }
    })
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'Unauthorized') return res.status(401).json({ error: 'Unauthorized' })
    req.log.error(err)
    return res.status(500).json({ error: 'Failed to fetch upcoming payout' })
  }
})

export default router
