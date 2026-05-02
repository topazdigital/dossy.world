import { Router } from 'express'
import { requireAuth, isValidKenyanPhone, normalizePhone, getClientIp } from '../lib/auth.js'
import {
  createTransaction,
  findUserById,
  findUserByPhone,
  updateUser,
  updateUserBalance,
  updateTransaction,
  createWithdrawalRequest,
  getSetting,
  findTransactionByCheckoutId,
} from '../lib/db.js'
import { initiateStkPush, parseCallback } from '../lib/payhero.js'
import { rateLimit } from '../lib/rate-limit.js'

const router = Router()

router.post('/wallet/deposit', async (req, res) => {
  try {
    const user = await requireAuth(req)
    const ip = getClientIp(req)
    const userRl = rateLimit(`deposit:user:${user.id}`, 5, 10 * 60 * 1000)
    if (!userRl.ok) {
      return res.status(429).json({ error: `Too many deposit attempts. Try again in ${userRl.retryInSeconds}s.` })
    }
    const ipRl = rateLimit(`deposit:ip:${ip}`, 10, 10 * 60 * 1000)
    if (!ipRl.ok) {
      return res.status(429).json({ error: `Too many deposits from your network. Try again in ${ipRl.retryInSeconds}s.` })
    }

    const { amount, phone } = req.body
    if (!amount || typeof amount !== 'number' || amount < 10) {
      return res.status(400).json({ error: 'Minimum deposit is KES 10' })
    }
    if (!phone) return res.status(400).json({ error: 'Phone number is required' })
    if (!isValidKenyanPhone(phone)) return res.status(400).json({ error: 'Please enter a valid Kenyan phone number' })

    const normalizedPhone = normalizePhone(phone)

    if (user.bound_phone && user.bound_phone !== normalizedPhone) {
      return res.status(400).json({
        error: `This account is locked to phone ending in ${user.bound_phone.slice(-4)}. Please deposit from that number.`,
      })
    }
    const phoneOwner = await findUserByPhone(normalizedPhone)
    if (phoneOwner && phoneOwner.id !== user.id) {
      return res.status(400).json({ error: 'This phone number is already linked to another account.' })
    }
    if (!user.bound_phone) {
      await updateUser(user.id, { bound_phone: normalizedPhone, phone: user.phone || normalizedPhone })
    }

    const transaction = await createTransaction({
      user_id: user.id,
      type: 'deposit',
      amount,
      balance_after: user.balance,
      status: 'pending',
      phone: normalizedPhone,
      description: 'PayHero / M-Pesa deposit',
    })

    const stk = await initiateStkPush({
      phone: normalizedPhone,
      amount,
      accountReference: `DOSSY${transaction.id.substring(0, 8).toUpperCase()}`,
      customerName: user.username,
    })

    if (stk.success && stk.checkoutRequestId) {
      await updateTransaction(transaction.id, { mpesa_checkout_id: stk.checkoutRequestId })

      if (stk.checkoutRequestId.startsWith('DEMO_')) {
        setTimeout(async () => {
          const currentUser = await findUserById(user.id)
          if (currentUser) {
            const newBalance = currentUser.balance + amount
            await updateUserBalance(user.id, amount)
            await updateTransaction(transaction.id, {
              status: 'completed',
              balance_after: newBalance,
              mpesa_receipt: `DEMO_${Date.now()}`,
            })
          }
        }, 3000)
      }

      return res.json({
        success: true,
        message: 'STK Push sent to your phone',
        checkoutRequestId: stk.checkoutRequestId,
        customerMessage: stk.customerMessage,
      })
    }

    await updateTransaction(transaction.id, { status: 'failed', description: `PayHero deposit - Failed: ${stk.error || 'Unknown error'}` })
    return res.status(500).json({ error: stk.error || 'Failed to initiate payment' })
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'Unauthorized') return res.status(401).json({ error: 'Please login to continue' })
    req.log.error(err)
    return res.status(500).json({ error: 'Deposit failed' })
  }
})

router.post('/wallet/withdraw', async (req, res) => {
  try {
    const user = await requireAuth(req)
    if (user.is_banned) return res.status(403).json({ error: 'Your account has been suspended' })

    const { amount, phone } = req.body
    if (!amount || typeof amount !== 'number' || amount <= 0) return res.status(400).json({ error: 'Invalid amount' })
    if (!phone) return res.status(400).json({ error: 'Phone number is required' })
    if (!isValidKenyanPhone(phone)) return res.status(400).json({ error: 'Please enter a valid Kenyan phone number' })

    const minWithdraw = parseInt((await getSetting('min_withdrawal')) || '100')
    const maxWithdraw = parseInt((await getSetting('max_withdrawal')) || '70000')
    if (amount < minWithdraw) return res.status(400).json({ error: `Minimum withdrawal is KES ${minWithdraw}` })
    if (amount > maxWithdraw) return res.status(400).json({ error: `Maximum withdrawal is KES ${maxWithdraw}` })
    if (amount > user.balance) return res.status(400).json({ error: 'Insufficient balance' })

    const normalizedPhone = normalizePhone(phone)
    if (user.bound_phone && user.bound_phone !== normalizedPhone) {
      return res.status(400).json({ error: `Withdrawals must go to your bound phone ending in ${user.bound_phone.slice(-4)}.` })
    }

    const updatedUser = await updateUserBalance(user.id, -amount)
    if (!updatedUser) return res.status(500).json({ error: 'Failed to update balance' })

    const withdrawalRequest = await createWithdrawalRequest({ user_id: user.id, amount, phone: normalizedPhone })
    await createTransaction({
      user_id: user.id,
      type: 'withdrawal',
      amount: -amount,
      balance_after: updatedUser.balance,
      status: 'pending',
      phone: normalizedPhone,
      description: 'Withdrawal request',
      reference_id: withdrawalRequest.id,
    })

    return res.json({
      success: true,
      message: 'Withdrawal request submitted. You will receive your funds within 24 hours.',
      requestId: withdrawalRequest.id,
    })
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'Unauthorized') return res.status(401).json({ error: 'Please login to continue' })
    req.log.error(err)
    return res.status(500).json({ error: 'Withdrawal failed' })
  }
})

router.post('/wallet/callback', async (req, res) => {
  try {
    const body = req.body
    const callback = parseCallback(body)
    if (!callback) return res.json({ success: true, message: 'Callback received' })

    const lookupId = callback.checkoutRequestId || callback.reference
    if (!lookupId) return res.json({ success: true, message: 'No reference in callback' })

    const transaction = await findTransactionByCheckoutId(lookupId)
    if (!transaction) return res.json({ success: true, message: 'Transaction not found' })
    if (transaction.status === 'completed') return res.json({ success: true, message: 'Already processed' })

    const isSuccess = callback.resultCode === 0 || callback.status === 'SUCCESS'
    if (isSuccess) {
      const depositAmount = callback.amount || transaction.amount
      const user = await findUserById(transaction.user_id)
      if (user) {
        const newBalance = user.balance + depositAmount
        await updateUserBalance(transaction.user_id, depositAmount)
        await updateTransaction(transaction.id, {
          status: 'completed',
          balance_after: newBalance,
          mpesa_receipt: callback.receiptNumber || null,
        })
      }
    } else {
      await updateTransaction(transaction.id, {
        status: 'failed',
        description: `PayHero deposit - Failed: ${callback.resultDesc}`,
      })
    }

    return res.json({ success: true })
  } catch (err) {
    req.log.error(err)
    return res.json({ success: true, message: 'Callback received' })
  }
})

export default router
