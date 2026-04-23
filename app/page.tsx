"use client"

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '@/context/auth-context'
import { AuthModal } from '@/components/auth/auth-modal'
import { UserDropdown } from '@/components/auth/user-dropdown'
import { VaultAnimation } from '@/components/game/vault-animation'
import { BuyPanel } from '@/components/game/buy-panel'
import { LiveFeed, type FeedItem } from '@/components/game/live-feed'
import { DepositModal } from '@/components/wallet/deposit-modal'
import { WithdrawModal } from '@/components/wallet/withdraw-modal'
import { Button } from '@/components/ui/button'
import { 
  Sparkles, 
  RefreshCw,
  History,
  Trophy,
  ChevronRight
} from 'lucide-react'

interface RoundData {
  id: string
  round_number: number
  vault_cap: number
  profit_percentage: number
  current_amount: number
  status: 'waiting' | 'active' | 'filled' | 'paying' | 'paid' | 'cancelled'
  bot_count: number
  started_at: string | null
  filled_at: string | null
  countdown?: number // seconds until next round starts
  buys: Array<{
    id: string
    user_id: string
    amount: number
    is_bot_buy: boolean
    created_at: string
    user?: {
      username: string
    }
  }>
}

const COUNTDOWN_DURATION = 30 // 30 seconds between rounds

export default function GamePage() {
  const { user, isLoading: authLoading, refreshUser } = useAuth()
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showDepositModal, setShowDepositModal] = useState(false)
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [roundData, setRoundData] = useState<RoundData | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [lastStatus, setLastStatus] = useState<string | null>(null)

  const fetchRoundData = useCallback(async () => {
    try {
      const response = await fetch('/api/game/current-round')
      if (response.ok) {
        const data = await response.json()
        const round = data.round
        
        // Check for status transitions
        if (round && lastStatus !== round.status) {
          // When vault fills, start countdown for payout
          if (round.status === 'filled' && lastStatus === 'active') {
            // Auto-trigger payout (in production this would be server-side)
            fetch('/api/game/auto-payout', { method: 'POST' })
          }
          
          // When round is paid, start countdown for next round
          if (round.status === 'paid' || round.status === 'waiting') {
            if (lastStatus === 'paying' || lastStatus === 'filled') {
              setCountdown(COUNTDOWN_DURATION)
            }
          }
          
          setLastStatus(round.status)
        }
        
        setRoundData(round)
        
        // Refresh user balance when payouts happen
        if (round?.status === 'paid' && lastStatus === 'paying') {
          refreshUser()
        }
      }
    } catch (error) {
      console.error('Failed to fetch round data:', error)
    }
  }, [lastStatus, refreshUser])

  // Initial fetch and polling
  useEffect(() => {
    fetchRoundData()
    const interval = setInterval(fetchRoundData, 2000) // Poll every 2 seconds
    return () => clearInterval(interval)
  }, [fetchRoundData])
  
  // Countdown timer effect
  useEffect(() => {
    if (countdown <= 0) return
    
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          // When countdown ends, trigger new round
          fetch('/api/game/start-round', { method: 'POST' })
            .then(() => fetchRoundData())
          return 0
        }
        return prev - 1
      })
    }, 1000)
    
    return () => clearInterval(timer)
  }, [countdown, fetchRoundData])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await fetchRoundData()
    setIsRefreshing(false)
  }

  const feedItems: FeedItem[] = (roundData?.buys || []).map(buy => ({
    id: buy.id,
    username: buy.user?.username || 'Unknown',
    amount: buy.amount,
    isBot: buy.is_bot_buy,
    createdAt: buy.created_at
  }))

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

      {/* Main content */}
      <main className="relative z-10 mx-auto max-w-7xl px-4 py-8">
        {/* Round info banner */}
        {roundData && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card/50 mb-8 flex flex-wrap items-center justify-center gap-4 rounded-xl border border-[var(--border)] p-4 backdrop-blur-sm sm:justify-between"
          >
            <div className="flex items-center gap-4">
              <div className="flex size-10 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--neon-cyan)]/20 to-[var(--neon-purple)]/20">
                <Trophy className="size-5 text-[var(--neon-cyan)]" />
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Current Round</p>
                <p className="text-lg font-bold">Round #{roundData.round_number}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-6 text-center">
              <div>
                <p className="text-muted-foreground text-xs">Target</p>
                <p className="font-semibold">KES {roundData.vault_cap.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Profit</p>
                <p className="font-semibold text-[var(--neon-green)]">+{roundData.profit_percentage}%</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Status</p>
                <p className={`font-semibold capitalize ${
                  roundData.status === 'active' ? 'text-[var(--neon-green)]' :
                  roundData.status === 'filled' ? 'text-[var(--neon-cyan)]' :
                  'text-muted-foreground'
                }`}>
                  {roundData.status}
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Game area */}
        <div className="flex flex-col items-center gap-8 lg:flex-row lg:items-start lg:justify-center lg:gap-12">
          {/* Vault */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="flex flex-col items-center"
          >
            {roundData ? (
              <VaultAnimation
                currentAmount={roundData.current_amount}
                vaultCap={roundData.vault_cap}
                profitPercentage={roundData.profit_percentage}
                status={roundData.status}
                participantCount={roundData.buys?.length || 0}
                countdown={countdown}
              />
            ) : (
              <div className="flex size-72 items-center justify-center rounded-full border-2 border-dashed border-[var(--border)]">
                <p className="text-muted-foreground">Loading...</p>
              </div>
            )}
          </motion.div>

          {/* Right side - Buy panel and feed */}
          <div className="flex w-full max-w-md flex-col gap-6">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <BuyPanel
                roundId={roundData?.id || null}
                roundStatus={roundData?.status || 'waiting'}
                profitPercentage={roundData?.profit_percentage || 30}
                minBuy={50}
                maxBuy={5000}
                onBuySuccess={fetchRoundData}
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

        {/* History link for logged-in users */}
        {user && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-8 text-center"
          >
            <Button variant="ghost" className="text-muted-foreground">
              <History className="mr-2 size-4" />
              View Your History
            </Button>
          </motion.div>
        )}
      </main>

      {/* Footer */}
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

      {/* Modals */}
      <AuthModal open={showAuthModal} onOpenChange={setShowAuthModal} />
      <DepositModal open={showDepositModal} onOpenChange={setShowDepositModal} />
      <WithdrawModal open={showWithdrawModal} onOpenChange={setShowWithdrawModal} />
    </div>
  )
}
