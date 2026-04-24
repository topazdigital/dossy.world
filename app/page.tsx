"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/context/auth-context'
import { AuthModal } from '@/components/auth/auth-modal'
import { UserDropdown } from '@/components/auth/user-dropdown'
import { VaultAnimation } from '@/components/game/vault-animation'
import { PayoutCelebration } from '@/components/game/payout-celebration'
import { BuyPanel } from '@/components/game/buy-panel'
import { LiveFeed, type FeedItem } from '@/components/game/live-feed'
import { DepositModal } from '@/components/wallet/deposit-modal'
import { WithdrawModal } from '@/components/wallet/withdraw-modal'
import { Button } from '@/components/ui/button'
import {
  Sparkles,
  RefreshCw,
  History,
  ChevronRight,
  Flame,
} from 'lucide-react'

interface ActiveRound {
  id: string
  vault_cap: number
  profit_percentage: number
  current_amount: number
  fill_percentage: number
  participants: number
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

interface ErruptingRound {
  id: string
  vault_cap: number
  profit_percentage: number
  seconds_until_payout: number
  participants: number
}

interface EngineState {
  active: ActiveRound | null
  erupting: ErruptingRound | null
}

export default function GamePage() {
  const { user, isLoading: authLoading, refreshUser } = useAuth()
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showDepositModal, setShowDepositModal] = useState(false)
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [state, setState] = useState<EngineState | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const lastEruptionId = useRef<string | null>(null)
  const seenEruptionIds = useRef<Set<string>>(new Set())
  const [celebration, setCelebration] = useState<{
    id: string
    vaultCap: number
    profitPercentage: number
    participants: number
  } | null>(null)

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch('/api/game/current-round', { cache: 'no-store' })
      if (!res.ok) return
      const data: EngineState = await res.json()
      setState(data)

      // Trigger the celebration overlay the first time we see a new eruption.
      if (data.erupting && !seenEruptionIds.current.has(data.erupting.id)) {
        seenEruptionIds.current.add(data.erupting.id)
        setCelebration({
          id: data.erupting.id,
          vaultCap: data.erupting.vault_cap,
          profitPercentage: data.erupting.profit_percentage,
          participants: data.erupting.participants,
        })
        // Auto-clear so the next eruption can re-trigger.
        setTimeout(() => setCelebration(null), 6500)
      }

      // Refresh balance once per eruption so payout shows up.
      if (
        data.erupting &&
        data.erupting.id !== lastEruptionId.current &&
        data.erupting.seconds_until_payout <= 0
      ) {
        lastEruptionId.current = data.erupting.id
        refreshUser()
      }
    } catch (err) {
      console.error('Failed to fetch state:', err)
    }
  }, [refreshUser])

  useEffect(() => {
    fetchState()
    const interval = setInterval(fetchState, 1000)
    return () => clearInterval(interval)
  }, [fetchState])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await fetchState()
    setIsRefreshing(false)
  }

  const active = state?.active
  const erupting = state?.erupting

  const feedItems: FeedItem[] = (active?.buys || []).map(buy => ({
    id: buy.id,
    username: buy.user?.username || 'Player',
    amount: buy.amount,
    isBot: buy.is_bot_buy,
    createdAt: buy.created_at,
  }))

  const formatKES = (n: number) =>
    new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      maximumFractionDigits: 0,
    }).format(n)

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background effects */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute top-0 left-1/4 h-96 w-96 rounded-full bg-[var(--neon-cyan)]/10 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-96 w-96 rounded-full bg-[var(--neon-purple)]/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-transparent to-background" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-[var(--border)]/50 bg-[var(--background)]/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <motion.div
              className="flex size-10 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--neon-cyan)] to-[var(--neon-purple)]"
              whileHover={{ scale: 1.1, rotate: 5 }}
              whileTap={{ scale: 0.95 }}
            >
              <Sparkles className="text-primary-foreground size-5" />
            </motion.div>
            <div>
              <h1 className="neon-text text-lg font-bold tracking-tight sm:text-xl">Dossy World</h1>
              <p className="text-muted-foreground hidden text-xs sm:block">Fill the Vault. Share the Profit.</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              className="text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>

            {authLoading ? (
              <div className="bg-card/50 h-10 w-32 animate-pulse rounded-lg" />
            ) : user ? (
              <UserDropdown
                onDeposit={() => setShowDepositModal(true)}
                onWithdraw={() => setShowWithdrawModal(true)}
              />
            ) : (
              <Button
                onClick={() => setShowAuthModal(true)}
                className="bg-gradient-to-r from-[var(--neon-cyan)] to-[var(--neon-purple)]"
              >
                Join Now
                <ChevronRight className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Eruption banner — slides in when previous vault just filled */}
      <AnimatePresence>
        {erupting && (
          <motion.div
            key={erupting.id}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="relative z-10 border-b border-[var(--neon-cyan)]/40 bg-gradient-to-r from-[var(--neon-cyan)]/10 via-[var(--neon-purple)]/10 to-[var(--neon-green)]/10"
          >
            <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-4 px-4 py-3 text-center">
              <Flame className="size-5 text-[var(--neon-cyan)]" />
              <p className="text-sm sm:text-base">
                <span className="neon-text font-semibold">Vault erupted!</span>{' '}
                <span className="text-muted-foreground">
                  {formatKES(erupting.vault_cap)} jackpot · paying out
                  {erupting.seconds_until_payout > 0 ? (
                    <> in <span className="font-semibold">{erupting.seconds_until_payout}s</span></>
                  ) : (
                    <> now…</>
                  )}{' '}
                  · A new vault is already accepting buys below.
                </span>
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content */}
      <main className="relative z-10 mx-auto max-w-7xl px-4 py-8">
        {/* Vault summary banner — no round numbers, just the live vault */}
        {active && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card/50 mb-8 flex flex-wrap items-center justify-center gap-4 rounded-xl border border-[var(--border)] p-4 backdrop-blur-sm sm:justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--neon-cyan)]/20 to-[var(--neon-purple)]/20">
                <Sparkles className="size-5 text-[var(--neon-cyan)]" />
              </div>
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wider">Live Vault</p>
                <p className="text-lg font-bold">Filling now</p>
              </div>
            </div>

            <div className="flex items-center gap-6 text-center">
              <div>
                <p className="text-muted-foreground text-xs">Target</p>
                <p className="font-semibold">{formatKES(active.vault_cap)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Profit on payout</p>
                <p className="font-semibold text-[var(--neon-green)]">+{active.profit_percentage}%</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Players in</p>
                <p className="font-semibold">{active.participants}</p>
              </div>
              {active.server_seed_hash && (
                <div className="text-left">
                  <p className="text-muted-foreground text-xs">Provably fair</p>
                  <a
                    href={`/api/game/fairness/${active.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`Server seed hash (commit): ${active.server_seed_hash}`}
                    className="block max-w-[140px] truncate font-mono text-xs text-[var(--neon-cyan)] underline-offset-2 hover:underline"
                  >
                    {active.server_seed_hash.slice(0, 10)}…
                  </a>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Game area */}
        <div className="flex flex-col items-center gap-8 lg:flex-row lg:items-start lg:justify-center lg:gap-12">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="flex flex-col items-center"
          >
            {active ? (
              <VaultAnimation
                currentAmount={active.current_amount}
                vaultCap={active.vault_cap}
                profitPercentage={active.profit_percentage}
                participantCount={active.participants}
                erupting={!!erupting}
                eruptionSeconds={erupting?.seconds_until_payout ?? 0}
              />
            ) : (
              <div className="flex size-72 items-center justify-center rounded-full border-2 border-dashed border-[var(--border)]">
                <p className="text-muted-foreground">Loading…</p>
              </div>
            )}
          </motion.div>

          <div className="flex w-full max-w-md flex-col gap-6">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <BuyPanel
                roundId={active?.id || null}
                profitPercentage={active?.profit_percentage || 30}
                minBuy={50}
                maxBuy={5000}
                onBuySuccess={fetchState}
                onLoginRequired={() => setShowAuthModal(true)}
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <LiveFeed items={feedItems} />
            </motion.div>
          </div>
        </div>

        {user && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-8 text-center"
          >
            <Button variant="ghost" className="text-muted-foreground" asChild>
              <a href="/history">
                <History className="mr-2 size-4" />
                View Your History
              </a>
            </Button>
          </motion.div>
        )}
      </main>

      <footer className="relative z-10 border-t border-[var(--border)]/50 bg-[var(--background)]/80 py-6 backdrop-blur-lg">
        <div className="mx-auto max-w-7xl px-4 text-center">
          <p className="text-muted-foreground text-sm">
            &copy; {new Date().getFullYear()} Dossy World. All rights reserved.
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            Play responsibly. Must be 18+ to participate.
          </p>
        </div>
      </footer>

      <AuthModal open={showAuthModal} onOpenChange={setShowAuthModal} />
      <DepositModal open={showDepositModal} onOpenChange={setShowDepositModal} />
      <WithdrawModal open={showWithdrawModal} onOpenChange={setShowWithdrawModal} />

      <PayoutCelebration
        show={!!celebration}
        vaultCap={celebration?.vaultCap ?? 0}
        profitPercentage={celebration?.profitPercentage ?? 0}
        participantCount={celebration?.participants ?? 0}
      />
    </div>
  )
}
