"use client"

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/context/auth-context'
import { 
  Wallet, 
  ArrowRight, 
  Loader2, 
  AlertCircle,
  Zap,
  TrendingUp,
  Lock,
  Timer
} from 'lucide-react'
import { toast } from 'sonner'

interface BuyPanelProps {
  roundId: string | null
  phase: 'waiting' | 'filling' | 'eruption' | 'paused'
  profitPercentage: number
  minBuy: number
  maxBuy: number
  waitingTimeRemaining: number
  onBuySuccess?: () => void
  onLoginRequired?: () => void
}

export function BuyPanel({ 
  roundId, 
  phase, 
  profitPercentage,
  minBuy = 50,
  maxBuy = 5000,
  waitingTimeRemaining,
  onBuySuccess,
  onLoginRequired
}: BuyPanelProps) {
  const { user } = useAuth()
  const [amount, setAmount] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const numericAmount = parseFloat(amount) || 0
  const potentialProfit = numericAmount * (profitPercentage / 100)
  const totalReturn = numericAmount + potentialProfit

  // Can only invest during waiting phase
  const canInvest = phase === 'waiting' && waitingTimeRemaining > 0

  const isValidAmount = numericAmount >= minBuy && 
    numericAmount <= maxBuy &&
    (!user || numericAmount <= user.balance)

  const quickAmounts = [100, 200, 500, 1000, 2000]

  const handleBuy = async () => {
    if (!user) {
      onLoginRequired?.()
      return
    }

    if (!canInvest) {
      toast.error('Investments are currently locked')
      return
    }

    if (!roundId) {
      toast.error('No active round')
      return
    }

    if (numericAmount < minBuy) {
      toast.error(`Minimum investment is KES ${minBuy}`)
      return
    }

    if (numericAmount > maxBuy) {
      toast.error(`Maximum investment is KES ${maxBuy}`)
      return
    }

    if (numericAmount > user.balance) {
      toast.error('Insufficient balance')
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch('/api/game/invest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: numericAmount, roundId })
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(`Invested KES ${numericAmount.toLocaleString()}! Potential return: KES ${totalReturn.toLocaleString()}`)
        setAmount('')
        onBuySuccess?.()
      } else {
        toast.error(data.error || 'Investment failed')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setIsLoading(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-KE').format(value)
  }

  const getStatusMessage = () => {
    switch (phase) {
      case 'waiting':
        if (waitingTimeRemaining > 0) {
          return `Invest now! ${waitingTimeRemaining}s remaining`
        }
        return 'Preparing next round...'
      case 'filling':
        return 'Vault is filling... Wait for next round'
      case 'eruption':
        return 'Vault erupted! Payouts in progress...'
      case 'paused':
        return 'System is paused'
      default:
        return 'Loading...'
    }
  }

  return (
    <div className="bg-card/50 w-full max-w-md rounded-2xl border border-[var(--border)] p-6 backdrop-blur-sm">
      {/* Header with status */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <Zap className={`size-5 ${canInvest ? 'text-[var(--neon-green)]' : 'text-[var(--warning)]'}`} />
          Invest
        </h3>
        {user && (
          <div className="flex items-center gap-2 text-sm">
            <Wallet className="text-muted-foreground size-4" />
            <span className="text-muted-foreground">Balance:</span>
            <span className="font-semibold">KES {formatCurrency(user.balance)}</span>
          </div>
        )}
      </div>

      {/* Phase status banner */}
      <motion.div 
        className={`mb-4 flex items-center gap-2 rounded-lg px-4 py-2 text-sm ${
          canInvest 
            ? 'border border-[var(--neon-green)]/30 bg-[var(--neon-green)]/10 text-[var(--neon-green)]'
            : 'border border-[var(--warning)]/30 bg-[var(--warning)]/10 text-[var(--warning)]'
        }`}
        animate={canInvest ? { opacity: [0.8, 1, 0.8] } : {}}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        {canInvest ? (
          <Timer className="size-4" />
        ) : (
          <Lock className="size-4" />
        )}
        <span className="font-medium">{getStatusMessage()}</span>
      </motion.div>

      {/* Quick amount buttons - only show when can invest */}
      <AnimatePresence>
        {canInvest && (
          <motion.div 
            className="mb-4 flex flex-wrap gap-2"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            {quickAmounts.map((quickAmount) => (
              <Button
                key={quickAmount}
                variant="outline"
                size="sm"
                className={`border-border/50 transition-all ${
                  numericAmount === quickAmount 
                    ? 'border-[var(--neon-green)] bg-[var(--neon-green)]/10' 
                    : 'hover:border-[var(--neon-green)]/50'
                }`}
                onClick={() => setAmount(quickAmount.toString())}
                disabled={!canInvest}
              >
                {quickAmount.toLocaleString()}
              </Button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Amount input */}
      <div className="relative mb-4">
        <span className="text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium">
          KES
        </span>
        <Input
          type="number"
          placeholder={canInvest ? `${minBuy} - ${formatCurrency(maxBuy)}` : 'Investments locked'}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className={`border-border/50 bg-background/50 h-12 pl-12 text-lg font-semibold ${
            !canInvest ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          min={minBuy}
          max={maxBuy}
          disabled={!canInvest}
        />
      </div>

      {/* Potential return display */}
      <AnimatePresence>
        {numericAmount > 0 && canInvest && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-4 rounded-lg border border-[var(--neon-green)]/30 bg-[var(--neon-green)]/10 p-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="size-4 text-[var(--neon-green)]" />
                <span className="text-sm">When Vault Erupts</span>
              </div>
              <div className="text-right">
                <p className="neon-text-green text-lg font-bold">
                  KES {formatCurrency(totalReturn)}
                </p>
                <p className="text-muted-foreground text-xs">
                  +{formatCurrency(potentialProfit)} profit ({profitPercentage}%)
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Warning messages */}
      {numericAmount > 0 && numericAmount < minBuy && canInvest && (
        <div className="mb-4 flex items-center gap-2 text-sm text-[var(--warning)]">
          <AlertCircle className="size-4" />
          Minimum investment is KES {minBuy}
        </div>
      )}

      {user && numericAmount > user.balance && canInvest && (
        <div className="text-destructive mb-4 flex items-center gap-2 text-sm">
          <AlertCircle className="size-4" />
          Insufficient balance. Please deposit first.
        </div>
      )}

      {/* Invest button */}
      <Button
        className={`w-full py-6 text-lg font-semibold ${
          canInvest 
            ? 'bg-gradient-to-r from-[var(--neon-green)] to-[var(--neon-cyan)]'
            : 'bg-muted cursor-not-allowed'
        }`}
        disabled={!canInvest || !isValidAmount || isLoading || !roundId}
        onClick={handleBuy}
      >
        {isLoading ? (
          <>
            <Loader2 className="size-5 animate-spin" />
            Processing...
          </>
        ) : !user ? (
          <>
            Login to Invest
            <ArrowRight className="size-5" />
          </>
        ) : !canInvest ? (
          <>
            <Lock className="size-5" />
            {phase === 'filling' ? 'Wait for Next Round' : 
             phase === 'eruption' ? 'Payout in Progress' : 
             phase === 'paused' ? 'System Paused' : 'Preparing...'}
          </>
        ) : (
          <>
            Invest Now
            <ArrowRight className="size-5" />
          </>
        )}
      </Button>

      {/* Info text */}
      <p className="text-muted-foreground mt-3 text-center text-xs">
        {canInvest 
          ? `Invest during the open window. When the vault fills and erupts, you receive your investment + ${profitPercentage}% profit.`
          : 'Investments are only accepted during the waiting period between rounds.'
        }
      </p>
    </div>
  )
}
