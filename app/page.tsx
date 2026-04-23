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
  ChevronRight,
  Clock
} from 'lucide-react'

interface GameState {
  phase: 'waiting' | 'filling' | 'eruption' | 'paused'
  phaseStartedAt: string
  vaultFillPercent: number
  totalInvested: number
  vaultTarget: number
  investorCount: number
  isPaused: boolean
  waitingTimeRemaining: number
  roundId: string | null
  roundNumber: number
  profitPercentage: number
  recentInvestments: Array<{
    id: string
    username: string
    amount: number
    isBot: boolean
    createdAt: string
  }>
  serverTime: number
}

export default function GamePage() {
  const { user, isLoading: authLoading, refreshUser } = useAuth()
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showDepositModal, setShowDepositModal] = useState(false)
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastPhase, setLastPhase] = useState<string | null>(null)

  // Fetch synchronized game state
  const fetchGameState = useCallback(async () => {
    try {
      const response = await fetch('/api/game/state')
      if (response.ok) {
        const data = await response.json()
        
        // Check for phase transitions
        if (data.phase && lastPhase !== data.phase) {
          // Refresh user balance on eruption (payouts)
          if (data.phase === 'waiting' && lastPhase === 'eruption') {
            refreshUser()
          }
          setLastPhase(data.phase)
        }
        
        setGameState(data)
      }
    } catch (error) {
      console.error('Failed to fetch game state:', error)
    }
  }, [lastPhase, refreshUser])

  // Tick the game forward (triggers phase transitions)
  const tickGame = useCallback(async () => {
    try {
      await fetch('/api/game/state', { method: 'POST', body: JSON.stringify({}) })
    } catch (error) {
      console.error('Game tick failed:', error)
    }
  }, [])

  // Initial fetch and polling - ALL browsers see the same state
  useEffect(() => {
    fetchGameState()
    
    // Poll every second for real-time sync
    const stateInterval = setInterval(fetchGameState, 1000)
    
    // Tick game every 2 seconds to progress phases
    const tickInterval = setInterval(tickGame, 2000)
    
    return () => {
      clearInterval(stateInterval)
      clearInterval(tickInterval)
    }
  }, [fetchGameState, tickGame])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await fetchGameState()
    setIsRefreshing(false)
  }

  const feedItems: FeedItem[] = (gameState?.recentInvestments || []).map(inv => ({
    id: inv.id,
    username: inv.username,
    amount: inv.amount,
    isBot: inv.isBot,
    createdAt: inv.createdAt
  }))

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

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
            {/* Live indicator */}
            <div className="hidden items-center gap-2 rounded-full bg-[var(--neon-green)]/10 px-3 py-1 text-xs text-[var(--neon-green)] sm:flex">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--neon-green)] opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-[var(--neon-green)]" />
              </span>
              LIVE
            </div>

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
        {gameState && (
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
                <p className="text-muted-foreground text-xs">Round</p>
                <p className="text-lg font-bold">#{gameState.roundNumber || '—'}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-6 text-center">
              <div>
                <p className="text-muted-foreground text-xs">Target</p>
                <p className="font-semibold">{formatCurrency(gameState.vaultTarget)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Profit</p>
                <p className="font-semibold text-[var(--neon-green)]">+{gameState.profitPercentage}%</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Phase</p>
                <p className={`font-semibold capitalize ${
                  gameState.phase === 'waiting' ? 'text-[var(--neon-green)]' :
                  gameState.phase === 'filling' ? 'text-[var(--neon-cyan)]' :
                  gameState.phase === 'eruption' ? 'neon-text' :
                  'text-[var(--warning)]'
                }`}>
                  {gameState.phase === 'waiting' ? 'Accepting' : gameState.phase}
                </p>
              </div>
              {gameState.phase === 'waiting' && gameState.waitingTimeRemaining > 0 && (
                <div>
                  <p className="text-muted-foreground text-xs">Closes In</p>
                  <p className="flex items-center gap-1 font-semibold text-[var(--neon-green)]">
                    <Clock className="size-3" />
                    {gameState.waitingTimeRemaining}s
                  </p>
                </div>
              )}
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
            {gameState ? (
              <VaultAnimation
                phase={gameState.phase}
                fillPercent={gameState.vaultFillPercent}
                totalInvested={gameState.totalInvested}
                vaultTarget={gameState.vaultTarget}
                profitPercentage={gameState.profitPercentage}
                investorCount={gameState.investorCount}
                waitingTimeRemaining={gameState.waitingTimeRemaining}
              />
            ) : (
              <div className="flex size-72 items-center justify-center rounded-full border-2 border-dashed border-[var(--border)]">
                <p className="text-muted-foreground">Connecting...</p>
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
                roundId={gameState?.roundId || null}
                phase={gameState?.phase || 'paused'}
                profitPercentage={gameState?.profitPercentage || 30}
                minBuy={50}
                maxBuy={5000}
                waitingTimeRemaining={gameState?.waitingTimeRemaining || 0}
                onBuySuccess={() => {
                  fetchGameState()
                  refreshUser()
                }}
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

        {/* How it works section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-12"
        >
          <h2 className="mb-6 text-center text-xl font-bold">How It Works</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="bg-card/30 rounded-xl border border-[var(--border)] p-4 text-center">
              <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-[var(--neon-green)]/20">
                <span className="text-xl font-bold text-[var(--neon-green)]">1</span>
              </div>
              <h3 className="mb-2 font-semibold">Invest</h3>
              <p className="text-muted-foreground text-sm">
                During the &quot;Accepting&quot; phase, invest any amount between KES 50 - 5,000
              </p>
            </div>
            <div className="bg-card/30 rounded-xl border border-[var(--border)] p-4 text-center">
              <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-[var(--neon-cyan)]/20">
                <span className="text-xl font-bold text-[var(--neon-cyan)]">2</span>
              </div>
              <h3 className="mb-2 font-semibold">Watch</h3>
              <p className="text-muted-foreground text-sm">
                The vault fills with investments. When it reaches 100%, it erupts!
              </p>
            </div>
            <div className="bg-card/30 rounded-xl border border-[var(--border)] p-4 text-center">
              <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-[var(--neon-purple)]/20">
                <span className="text-xl font-bold text-[var(--neon-purple)]">3</span>
              </div>
              <h3 className="mb-2 font-semibold">Profit</h3>
              <p className="text-muted-foreground text-sm">
                When the vault erupts, everyone gets their investment back + 30% profit!
              </p>
            </div>
          </div>
        </motion.div>

        {/* History link for logged-in users */}
        {user && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-8 text-center"
          >
            <Button variant="ghost" className="text-muted-foreground" asChild>
              <a href="/history">
                <History className="mr-2 size-4" />
                View Your Investment History
              </a>
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
            Invest responsibly. Must be 18+ to participate.
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
