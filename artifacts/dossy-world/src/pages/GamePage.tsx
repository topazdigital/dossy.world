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
import { Button } from '@/components/ui/button'
import { Link, useLocation } from 'wouter'
import { Sparkles, RefreshCw, History, ChevronRight, Flame, Bitcoin } from 'lucide-react'

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

const WHATSAPP_GROUP_URL = import.meta.env.VITE_WHATSAPP_GROUP_URL || 'https://chat.whatsapp.com/invite'

export default function GamePage() {
  const { user, isLoading: authLoading, refreshUser } = useAuth()
  const [, navigate] = useLocation()
  const [showAuthModal, setShowAuthModal] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('redirect') === '/admin') {
      setShowAuthModal(true)
      const url = new URL(window.location.href)
      url.searchParams.delete('redirect')
      window.history.replaceState({}, '', url.toString())
    }
  }, [])

  const handleAuthSuccess = (loggedInUser: { is_admin: boolean }) => {
    if (loggedInUser.is_admin) navigate('/admin')
  }
  const [showDepositModal, setShowDepositModal] = useState(false)
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

  const apiBase = import.meta.env.BASE_URL.replace(/\/$/, '')

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/api/game/current-round`)
      if (!res.ok) return
      const data: EngineState = await res.json()
      setState(data)

      if (data.erupting && !seenEruptionIds.current.has(data.erupting.id)) {
        seenEruptionIds.current.add(data.erupting.id)
        setCelebration({
          id: data.erupting.id,
          vaultCap: data.erupting.vault_cap,
          profitPercentage: data.erupting.profit_percentage,
          participants: data.erupting.participants,
        })
        setTimeout(() => setCelebration(null), 6500)
      }

      if (data.erupting && data.erupting.id !== lastEruptionId.current && data.erupting.seconds_until_payout <= 0) {
        lastEruptionId.current = data.erupting.id
        refreshUser()
      }
    } catch (err) {
      console.error('Failed to fetch state:', err)
    }
  }, [refreshUser, apiBase])

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
    new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(n)

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute top-0 left-1/4 h-96 w-96 rounded-full bg-[var(--neon-cyan)]/10 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-96 w-96 rounded-full bg-[var(--neon-purple)]/10 blur-3xl" />
      </div>

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

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={handleRefresh} className="text-muted-foreground hover:text-foreground">
              <RefreshCw className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="ghost" size="icon" asChild className="text-muted-foreground hover:text-foreground" title="Crypto deposits">
              <Link href="/crypto">
                <Bitcoin className="size-4" />
              </Link>
            </Button>

            {authLoading ? (
              <div className="bg-card/50 h-10 w-32 animate-pulse rounded-lg" />
            ) : user ? (
              <UserDropdown onDeposit={() => setShowDepositModal(true)} />
            ) : (
              <Button onClick={() => setShowAuthModal(true)} className="bg-gradient-to-r from-[var(--neon-cyan)] to-[var(--neon-purple)]">
                Join Now
                <ChevronRight className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </header>

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
                  ) : ' now…'}{' '}
                  · A new vault is already accepting buys below.
                </span>
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="relative z-10 mx-auto max-w-7xl px-4 py-8">
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
                    href={`${apiBase}/api/game/fairness/${active.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block max-w-[140px] truncate font-mono text-xs text-[var(--neon-cyan)] underline-offset-2 hover:underline"
                  >
                    {active.server_seed_hash.slice(0, 10)}…
                  </a>
                </div>
              )}
            </div>
          </motion.div>
        )}

        <div className="flex flex-col items-center gap-8 lg:flex-row lg:items-start lg:justify-center lg:gap-12">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }} className="flex flex-col items-center">
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
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
              <BuyPanel
                roundId={active?.id || null}
                profitPercentage={active?.profit_percentage || 30}
                minBuy={50}
                maxBuy={5000}
                onBuySuccess={fetchState}
                onLoginRequired={() => setShowAuthModal(true)}
              />
            </motion.div>
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
              <LiveFeed items={feedItems} />
            </motion.div>
          </div>
        </div>

        {user && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="mt-8 text-center">
            <Button variant="ghost" className="text-muted-foreground" asChild>
              <Link href="/history">
                <History className="mr-2 size-4" />
                View Your History
              </Link>
            </Button>
          </motion.div>
        )}
      </main>

      <footer className="relative z-10 border-t border-[var(--border)]/50 bg-[var(--background)]/80 py-6 backdrop-blur-lg">
        <div className="mx-auto max-w-7xl px-4 text-center">
          <p className="text-muted-foreground text-sm">&copy; {new Date().getFullYear()} Dossy World. All rights reserved.</p>
          <p className="text-muted-foreground mt-1 text-xs">Play responsibly. Must be 18+ to participate.</p>
        </div>
      </footer>

      {/* WhatsApp floating button */}
      <a
        href={WHATSAPP_GROUP_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 flex size-14 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-110 active:scale-95"
        style={{ background: '#25D366' }}
        title="Join our WhatsApp group"
      >
        <WhatsAppIcon className="size-7 text-white" />
      </a>

      <AuthModal open={showAuthModal} onOpenChange={setShowAuthModal} onSuccess={handleAuthSuccess} />
      <DepositModal open={showDepositModal} onOpenChange={setShowDepositModal} />
      <PayoutCelebration
        show={!!celebration}
        vaultCap={celebration?.vaultCap ?? 0}
        profitPercentage={celebration?.profitPercentage ?? 0}
        participantCount={celebration?.participants ?? 0}
      />
    </div>
  )
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  )
}
