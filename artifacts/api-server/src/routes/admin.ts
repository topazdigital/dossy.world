import { Router } from 'express'
import { promises as fs } from 'fs'
import path from 'path'
import { requireAdmin, isValidKenyanPhone, normalizePhone } from '../lib/auth.js'
import {
  getStats,
  getActiveRoundStrict,
  getBuysByRound,
  getSetting,
  getAllUsers,
  getAllRounds,
  getAllSettings,
  setSetting,
  updateUser,
  findUserById,
  updateUserBalance,
  createTransaction,
  getWithdrawalRequests,
  updateWithdrawalRequest,
  updateRound,
  getAllBotNames,
  getRoundById,
  recordAudit,
  getAuditLogs,
} from '../lib/db.js'
import { tick } from '../lib/game-engine.js'
import { triggerBotBurst, scheduleBotBuys, executeBotBuy } from '../lib/bots.js'
import { initiateStkPush } from '../lib/payhero.js'

const DATA_DIR = path.join(process.cwd(), '.data')
const DB_FILE = path.join(DATA_DIR, 'db.json')

const router = Router()

router.get('/admin/stats', async (req, res) => {
  try {
    const admin = await requireAdmin(req)
    void admin
    const stats = await getStats()
    const live = await getActiveRoundStrict()
    let liveDetails = null
    if (live) {
      const buys = await getBuysByRound(live.id)
      const realStake = buys.filter((b) => !b.is_bot_buy).reduce((s, b) => s + b.amount, 0)
      const botStake = buys.filter((b) => b.is_bot_buy).reduce((s, b) => s + b.amount, 0)
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
        real_user_count: new Set(buys.filter((b) => !b.is_bot_buy).map((b) => b.user_id)).size,
      }
    }
    const houseEdge = parseInt((await getSetting('house_edge_percentage')) || '35', 10)
    const vaultLifetime = parseInt((await getSetting('vault_lifetime_seconds')) || '90', 10)
    return res.json({ ...stats, liveVault: liveDetails, tuning: { house_edge_percentage: houseEdge, vault_lifetime_seconds: vaultLifetime } })
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('Unauthorized')) return res.status(401).json({ error: 'Unauthorized' })
    req.log.error(err)
    return res.status(500).json({ error: 'Failed to fetch stats' })
  }
})

router.get('/admin/users', async (req, res) => {
  try {
    await requireAdmin(req)
    const users = await getAllUsers(true)
    return res.json({ users: users.map((u) => ({ id: u.id, username: u.username, email: u.email, phone: u.phone, balance: u.balance, is_admin: u.is_admin, is_bot: u.is_bot, is_banned: u.is_banned, created_at: u.created_at })) })
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('Unauthorized')) return res.status(401).json({ error: 'Unauthorized' })
    req.log.error(err)
    return res.status(500).json({ error: 'Failed to fetch users' })
  }
})

router.post('/admin/users/ban', async (req, res) => {
  try {
    const admin = await requireAdmin(req)
    const { userId, banned } = req.body
    if (!userId) return res.status(400).json({ error: 'User ID required' })
    const user = await findUserById(userId)
    if (!user) return res.status(404).json({ error: 'User not found' })
    if (user.is_admin) return res.status(400).json({ error: 'Cannot ban admin users' })
    await updateUser(userId, { is_banned: banned })
    await recordAudit({ admin_id: admin.id, admin_username: admin.username, action: banned ? 'user.ban' : 'user.unban', target_type: 'user', target_id: userId, details: { target_username: user.username } })
    return res.json({ success: true, message: banned ? 'User banned' : 'User unbanned' })
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('Unauthorized')) return res.status(401).json({ error: 'Unauthorized' })
    req.log.error(err)
    return res.status(500).json({ error: 'Operation failed' })
  }
})

router.post('/admin/users/balance', async (req, res) => {
  try {
    const admin = await requireAdmin(req)
    const { userId, amount, type } = req.body
    if (!userId || !amount) return res.status(400).json({ error: 'User ID and amount required' })
    const user = await findUserById(userId)
    if (!user) return res.status(404).json({ error: 'User not found' })
    if (amount < 0 && user.balance + amount < 0) return res.status(400).json({ error: 'Insufficient balance for debit' })
    const updatedUser = await updateUserBalance(userId, amount)
    if (!updatedUser) return res.status(500).json({ error: 'Failed to update balance' })
    await createTransaction({ user_id: userId, type: type === 'credit' ? 'admin_credit' : 'admin_debit', amount, balance_after: updatedUser.balance, status: 'completed', description: `Admin ${type} by ${admin.username}` })
    await recordAudit({ admin_id: admin.id, admin_username: admin.username, action: type === 'credit' ? 'user.balance_credit' : 'user.balance_debit', target_type: 'user', target_id: userId, details: { amount, target_username: user.username, new_balance: updatedUser.balance } })
    return res.json({ success: true, message: `Successfully ${type}ed KES ${Math.abs(amount).toLocaleString()}`, newBalance: updatedUser.balance })
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('Unauthorized')) return res.status(401).json({ error: 'Unauthorized' })
    req.log.error(err)
    return res.status(500).json({ error: 'Operation failed' })
  }
})

router.get('/admin/rounds', async (req, res) => {
  try {
    await requireAdmin(req)
    const rounds = await getAllRounds()
    const roundsWithStats = await Promise.all(rounds.map(async (round) => {
      const buys = await getBuysByRound(round.id)
      const realBuys = buys.filter((b) => !b.is_bot_buy)
      const totalPayout = buys.filter((b) => b.is_paid && !b.is_bot_buy).reduce((sum, b) => sum + (b.payout_amount || 0), 0)
      return { ...round, buy_count: realBuys.length, total_payout: totalPayout }
    }))
    return res.json({ rounds: roundsWithStats })
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('Unauthorized')) return res.status(401).json({ error: 'Unauthorized' })
    req.log.error(err)
    return res.status(500).json({ error: 'Failed to fetch rounds' })
  }
})

router.post('/admin/round/control', async (req, res) => {
  try {
    const admin = await requireAdmin(req)
    const { action, vaultCap, profitPercentage, houseEdge, vaultLifetimeSeconds } = req.body
    await recordAudit({ admin_id: admin.id, admin_username: admin.username, action: `round.${action}`, target_type: 'round', target_id: null, details: { vaultCap, profitPercentage, houseEdge, vaultLifetimeSeconds } })

    switch (action) {
      case 'force_erupt': {
        const active = await getActiveRoundStrict()
        if (!active) return res.status(400).json({ error: 'No active vault to erupt' })
        await updateRound(active.id, { status: 'filled', current_amount: active.vault_cap, filled_at: new Date().toISOString() })
        await tick()
        return res.json({ success: true, message: 'Vault erupted — payout cooldown started' })
      }
      case 'force_expire': {
        const active = await getActiveRoundStrict()
        if (!active) return res.status(400).json({ error: 'No active vault to expire' })
        await updateRound(active.id, { status: 'expired', expired_at: new Date().toISOString() })
        await tick()
        return res.json({ success: true, message: 'Vault expired — house kept all stakes' })
      }
      case 'apply_to_live': {
        const active = await getActiveRoundStrict()
        if (!active) return res.status(400).json({ error: 'No active vault' })
        const patch: Record<string, unknown> = {}
        if (vaultCap) patch.vault_cap = parseInt(String(vaultCap), 10)
        if (profitPercentage) patch.profit_percentage = parseInt(String(profitPercentage), 10)
        if (Object.keys(patch).length === 0) return res.status(400).json({ error: 'Nothing to update' })
        await updateRound(active.id, patch)
        return res.json({ success: true, message: 'Live vault updated' })
      }
      case 'set_defaults': {
        if (vaultCap) await setSetting('default_vault_cap', String(vaultCap))
        if (profitPercentage) await setSetting('default_profit_percentage', String(profitPercentage))
        if (houseEdge !== undefined && houseEdge !== '') await setSetting('house_edge_percentage', String(houseEdge))
        if (vaultLifetimeSeconds !== undefined && vaultLifetimeSeconds !== '') await setSetting('vault_lifetime_seconds', String(vaultLifetimeSeconds))
        return res.json({ success: true, message: 'Defaults updated for upcoming vaults' })
      }
      default:
        return res.status(400).json({ error: 'Unknown action' })
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('Unauthorized')) return res.status(401).json({ error: 'Unauthorized' })
    req.log.error(err)
    return res.status(500).json({ error: 'Operation failed' })
  }
})

const SENSITIVE_KEYS = new Set(['google_client_secret', 'payhero_basic_auth'])
const MASKED = '__MASKED__'

router.get('/admin/settings', async (req, res) => {
  try {
    await requireAdmin(req)
    const settings = await getAllSettings()
    const safe = settings.map(s => ({
      ...s,
      setting_value: SENSITIVE_KEYS.has(s.setting_key) && s.setting_value
        ? MASKED
        : s.setting_value,
    }))
    return res.json({ settings: safe })
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('Unauthorized')) return res.status(401).json({ error: 'Unauthorized' })
    req.log.error(err)
    return res.status(500).json({ error: 'Failed to fetch settings' })
  }
})

router.post('/admin/settings', async (req, res) => {
  try {
    const admin = await requireAdmin(req)
    const { settings } = req.body
    if (!settings || typeof settings !== 'object') return res.status(400).json({ error: 'Invalid settings' })
    const changed: Record<string, string> = {}
    for (const [key, value] of Object.entries(settings)) {
      if (typeof value === 'string' && value !== MASKED) {
        await setSetting(key, value)
        changed[key] = SENSITIVE_KEYS.has(key) ? '[updated]' : value
      }
    }
    await recordAudit({ admin_id: admin.id, admin_username: admin.username, action: 'settings.update', target_type: 'settings', target_id: null, details: { changed } })
    return res.json({ success: true, message: 'Settings saved successfully' })
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('Unauthorized')) return res.status(401).json({ error: 'Unauthorized' })
    req.log.error(err)
    return res.status(500).json({ error: 'Failed to update settings' })
  }
})

router.get('/admin/withdrawals', async (req, res) => {
  try {
    await requireAdmin(req)
    const withdrawals = await getWithdrawalRequests()
    return res.json({ withdrawals })
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('Unauthorized')) return res.status(401).json({ error: 'Unauthorized' })
    req.log.error(err)
    return res.status(500).json({ error: 'Failed to fetch withdrawals' })
  }
})

router.post('/admin/withdrawals/process', async (req, res) => {
  try {
    const admin = await requireAdmin(req)
    const { requestId, action, mpesaReceipt, adminNotes } = req.body
    if (!requestId || !action) return res.status(400).json({ error: 'Request ID and action required' })

    if (action === 'approve') {
      await updateWithdrawalRequest(requestId, { status: 'completed', mpesa_receipt: mpesaReceipt || null, admin_notes: adminNotes || null, processed_by: admin.id, processed_at: new Date().toISOString() })
      await recordAudit({ admin_id: admin.id, admin_username: admin.username, action: 'withdrawal.approve', target_type: 'withdrawal', target_id: requestId, details: { mpesaReceipt: mpesaReceipt || null, notes: adminNotes || null } })
      return res.json({ success: true, message: 'Withdrawal approved' })
    } else if (action === 'reject') {
      const requests = await getWithdrawalRequests()
      const withdrawalRequest = requests.find((r) => r.id === requestId)
      if (!withdrawalRequest) return res.status(404).json({ error: 'Request not found' })
      const user = await findUserById(withdrawalRequest.user_id)
      if (user) {
        const updatedUser = await updateUserBalance(withdrawalRequest.user_id, withdrawalRequest.amount)
        if (updatedUser) {
          await createTransaction({ user_id: withdrawalRequest.user_id, type: 'refund', amount: withdrawalRequest.amount, balance_after: updatedUser.balance, status: 'completed', description: `Withdrawal refund - rejected by admin: ${adminNotes || 'No reason provided'}` })
        }
      }
      await updateWithdrawalRequest(requestId, { status: 'rejected', admin_notes: adminNotes || null, processed_by: admin.id, processed_at: new Date().toISOString() })
      await recordAudit({ admin_id: admin.id, admin_username: admin.username, action: 'withdrawal.reject', target_type: 'withdrawal', target_id: requestId, details: { notes: adminNotes || null } })
      return res.json({ success: true, message: 'Withdrawal rejected and refunded' })
    }
    return res.status(400).json({ error: 'Invalid action' })
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('Unauthorized')) return res.status(401).json({ error: 'Unauthorized' })
    req.log.error(err)
    return res.status(500).json({ error: 'Operation failed' })
  }
})

router.get('/admin/transactions', async (req, res) => {
  try {
    await requireAdmin(req)
    const data = await fs.readFile(DB_FILE, 'utf-8')
    const db = JSON.parse(data)
    const transactions = (db.transactions || [])
      .sort((a: { created_at: string }, b: { created_at: string }) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 500)
      .map((tx: { user_id: string }) => {
        const user = db.users.find((u: { id: string }) => u.id === (tx as { user_id: string }).user_id)
        return { ...tx, user: user ? { username: user.username } : null }
      })
    return res.json({ transactions })
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('Unauthorized')) return res.status(401).json({ error: 'Unauthorized' })
    req.log.error(err)
    return res.status(500).json({ error: 'Failed to fetch transactions' })
  }
})

router.get('/admin/bots', async (req, res) => {
  try {
    await requireAdmin(req)
    const botNames = await getAllBotNames()
    return res.json({ botNames })
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('Unauthorized')) return res.status(401).json({ error: 'Unauthorized' })
    req.log.error(err)
    return res.status(500).json({ error: 'Failed to fetch bot names' })
  }
})

router.post('/admin/bots/toggle', async (req, res) => {
  try {
    await requireAdmin(req)
    const { id, active } = req.body
    if (id === undefined || active === undefined) return res.status(400).json({ error: 'ID and active status required' })
    const data = await fs.readFile(DB_FILE, 'utf-8')
    const db = JSON.parse(data)
    const index = db.bot_names.findIndex((bn: { id: number }) => bn.id === id)
    if (index === -1) return res.status(404).json({ error: 'Bot name not found' })
    db.bot_names[index].is_active = active
    await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2))
    return res.json({ success: true, message: `Bot name ${active ? 'activated' : 'deactivated'}` })
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('Unauthorized')) return res.status(401).json({ error: 'Unauthorized' })
    req.log.error(err)
    return res.status(500).json({ error: 'Failed to toggle bot name' })
  }
})

router.post('/admin/bots/burst', async (req, res) => {
  try {
    await requireAdmin(req)
    const { roundId } = req.body
    if (!roundId) return res.status(400).json({ error: 'Round ID required' })
    const round = await getRoundById(roundId)
    if (!round) return res.status(404).json({ error: 'Round not found' })
    if (round.status !== 'active') return res.status(400).json({ error: 'Round is not active' })
    const successfulBuys = await triggerBotBurst(roundId)
    return res.json({ success: true, message: `Burst executed: ${successfulBuys} buys`, successfulBuys })
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('Unauthorized')) return res.status(401).json({ error: 'Unauthorized' })
    req.log.error(err)
    return res.status(500).json({ error: 'Failed to execute burst' })
  }
})

router.post('/admin/bots/trigger', async (req, res) => {
  try {
    await requireAdmin(req)
    const { roundId, count = 5 } = req.body
    if (!roundId) return res.status(400).json({ error: 'Round ID required' })
    const round = await getRoundById(roundId)
    if (!round) return res.status(404).json({ error: 'Round not found' })
    if (round.status !== 'active') return res.status(400).json({ error: 'Round is not active' })
    await updateRound(roundId, { bot_count: count })
    const scheduledBuys = await scheduleBotBuys(round, count)
    scheduledBuys.forEach(({ delay, amount, botUser }) => {
      setTimeout(async () => {
        try { await executeBotBuy(roundId, amount, botUser) } catch (e) { /* noop */ }
      }, delay)
    })
    return res.json({ success: true, message: `Scheduled ${scheduledBuys.length} bot buys`, scheduledCount: scheduledBuys.length })
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('Unauthorized')) return res.status(401).json({ error: 'Unauthorized' })
    req.log.error(err)
    return res.status(500).json({ error: 'Failed to trigger bots' })
  }
})

router.get('/admin/audit', async (req, res) => {
  try {
    await requireAdmin(req)
    const logs = await getAuditLogs(500)
    return res.json({ logs })
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('Unauthorized')) return res.status(401).json({ error: 'Unauthorized' })
    req.log.error(err)
    return res.status(500).json({ error: 'Failed to load audit log' })
  }
})

router.post('/admin/test-stk-push', async (req, res) => {
  try {
    await requireAdmin(req)
    const phone: string = req.body?.phone || ''
    const amount: number = Number(req.body?.amount) || 0
    if (!phone || !isValidKenyanPhone(phone)) return res.status(400).json({ error: 'Please enter a valid Kenyan phone number (e.g. 0712345678).' })
    if (!Number.isFinite(amount) || amount < 1 || amount > 70000) return res.status(400).json({ error: 'Amount must be between KES 1 and 70,000 for the test push.' })
    const stk = await initiateStkPush({ phone: normalizePhone(phone), amount: Math.round(amount), accountReference: `TESTSTK${Date.now()}`, customerName: 'Dossy World Test' })
    if (!stk.success) return res.status(502).json({ error: stk.error || 'STK push failed' })
    return res.json({ success: true, message: stk.customerMessage || 'STK push sent. Check the phone.', reference: stk.checkoutRequestId })
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('Unauthorized')) return res.status(401).json({ error: 'Unauthorized' })
    req.log.error(err)
    return res.status(500).json({ error: 'Test STK push failed' })
  }
})

export default router
