import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import {
  createBuy,
  updateUserBalance,
  createTransaction,
  getSetting,
  findUserById,
  getBuysByRound,
} from '@/lib/db'
import { getRoundAcceptingBuys } from '@/lib/game-engine'
import { addToCounter, getClientIp, getCounter, touchCounter } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Please login to continue' }, { status: 401 })
    }
    if (user.is_banned) {
      return NextResponse.json({ error: 'Your account has been suspended' }, { status: 403 })
    }

    const body = await request.json()
    const { amount } = body
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    const minBuy = parseInt((await getSetting('min_buy_amount')) || '50', 10)
    const maxBuy = parseInt((await getSetting('max_buy_amount')) || '5000', 10)
    if (amount < minBuy) {
      return NextResponse.json({ error: `Minimum buy is KES ${minBuy}` }, { status: 400 })
    }
    if (amount > maxBuy) {
      return NextResponse.json({ error: `Maximum buy is KES ${maxBuy}` }, { status: 400 })
    }
    if (amount > user.balance) {
      return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 })
    }

    // Engine guarantees there is always an active round accepting buys.
    const round = await getRoundAcceptingBuys()
    if (!round) {
      return NextResponse.json({ error: 'Vault is not accepting buys right now' }, { status: 400 })
    }

    // Don't allow overflow past the cap.
    const remaining = round.vault_cap - round.current_amount
    if (remaining <= 0) {
      return NextResponse.json({ error: 'Vault just erupted, try again' }, { status: 409 })
    }

    // Per-user-per-round cap. Stops one player from gobbling the whole vault.
    const stakePctSetting = parseInt(
      (await getSetting('max_user_stake_pct_per_round')) || '25',
      10,
    )
    const stakePct = Math.max(1, Math.min(100, isFinite(stakePctSetting) ? stakePctSetting : 25))
    const perUserCap = Math.floor((round.vault_cap * stakePct) / 100)
    const existingBuys = await getBuysByRound(round.id)
    const userAlreadyStaked = existingBuys
      .filter(b => b.user_id === user.id && !b.is_bot_buy)
      .reduce((sum, b) => sum + b.amount, 0)
    const userRoomLeft = perUserCap - userAlreadyStaked
    if (userRoomLeft <= 0) {
      return NextResponse.json(
        {
          error: `You've already hit your per-round limit of KES ${perUserCap}. Wait for the next vault.`,
        },
        { status: 400 },
      )
    }

    // Per-IP-per-round soft cap. Catches lazy Sybil attackers running
    // multiple browsers from the same network.
    const ip = getClientIp(request)
    const ipPctSetting = parseInt(
      (await getSetting('max_ip_stake_pct_per_round')) || '40',
      10,
    )
    const ipPct = Math.max(1, Math.min(100, isFinite(ipPctSetting) ? ipPctSetting : 40))
    const perIpCap = Math.floor((round.vault_cap * ipPct) / 100)
    const ipKey = `ipstake:${round.id}:${ip}`
    touchCounter(ipKey)
    const ipAlready = getCounter(ipKey)
    const ipRoomLeft = perIpCap - ipAlready
    if (ipRoomLeft <= 0) {
      return NextResponse.json(
        {
          error: 'Too much activity from your network for this vault. Try the next round.',
        },
        { status: 429 },
      )
    }

    const finalAmount = Math.min(amount, remaining, userRoomLeft, ipRoomLeft)

    const updatedUser = await updateUserBalance(user.id, -finalAmount)
    if (!updatedUser) {
      return NextResponse.json({ error: 'Failed to update balance' }, { status: 500 })
    }

    const buy = await createBuy({
      round_id: round.id,
      user_id: user.id,
      amount: finalAmount,
      is_bot_buy: false,
    })

    // Track the IP's running stake for this round.
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
    return NextResponse.json({
      success: true,
      buy: { id: buy.id, amount: buy.amount, created_at: buy.created_at },
      user: finalUser
        ? { id: finalUser.id, username: finalUser.username, balance: finalUser.balance }
        : null,
    })
  } catch (error) {
    console.error('Buy error:', error)
    return NextResponse.json({ error: 'Buy failed' }, { status: 500 })
  }
}
