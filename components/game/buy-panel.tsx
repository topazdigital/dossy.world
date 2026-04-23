"use client"

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/context/auth-context'
import { 
  Wallet, 
  ArrowRight, 
  Loader2, 
  AlertCircle,
  Zap,
  TrendingUp
} from 'lucide-react'
import { toast } from 'sonner'

interface BuyPanelProps {
  roundId: string | null
  roundStatus: string
  profitPercentage: number
  minBuy: number
  maxBuy: number
  onBuySuccess?: () => void
  onLoginRequired?: () => void
}

export function BuyPanel({ 
  roundId, 
  roundStatus, 
  profitPercentage,
  minBuy = 50,
  maxBuy = 5000,
  onBuySuccess,
  onLoginRequired
}: BuyPanelProps) {
  const { user } = useAuth()
  const [amount, setAmount] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const numericAmount = parseFloat(amount) || 0
  const potentialProfit = numericAmount * (profitPercentage / 100)
  const totalReturn = numericAmount + potentialProfit

  const canBuy = roundStatus === 'active' && 
    numericAmount >= minBuy && 
    numericAmount <= maxBuy &&
    (!user || numericAmount <= user.balance)

  const quickAmounts = [100, 200, 500, 1000, 2000]

  const handleBuy = async () => {
    if (!user) {
      onLoginRequired?.()
      return
    }

    if (!roundId || roundStatus !== 'active') {
      toast.error('No active round')
      return
    }

    if (numericAmount < minBuy) {
      toast.error(`Minimum buy is KES ${minBuy}`)
      return
    }

    if (numericAmount > maxBuy) {
      toast.error(`Maximum buy is KES ${maxBuy}`)
      return
    }

    if (numericAmount > user.balance) {
      toast.error('Insufficient balance')
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch('/api/game/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: numericAmount })
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(`Successfully bought in for KES ${numericAmount.toLocaleString()}!`)
        setAmount('')
        onBuySuccess?.()
      } else {
        toast.error(data.error || 'Buy failed')
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

  return (
    <div className="bg-card/50 w-full max-w-md rounded-2xl border border-[var(--border)] p-6 backdrop-blur-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <Zap className="size-5 text-[var(--neon-cyan)]" />
          Buy In
        </h3>
        {user && (
          <div className="flex items-center gap-2 text-sm">
            <Wallet className="text-muted-foreground size-4" />
            <span className="text-muted-foreground">Balance:</span>
            <span className="font-semibold">KES {formatCurrency(user.balance)}</span>
          </div>
        )}
      </div>

      {/* Quick amount buttons */}
      <div className="mb-4 flex flex-wrap gap-2">
        {quickAmounts.map((quickAmount) => (
          <Button
            key={quickAmount}
            variant="outline"
            size="sm"
            className={`border-border/50 transition-all ${
              numericAmount === quickAmount 
                ? 'border-primary bg-primary/10' 
                : 'hover:border-primary/50'
            }`}
            onClick={() => setAmount(quickAmount.toString())}
          >
            {quickAmount.toLocaleString()}
          </Button>
        ))}
      </div>

      {/* Amount input */}
      <div className="relative mb-4">
        <span className="text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium">
          KES
        </span>
        <Input
          type="number"
          placeholder={`${minBuy} - ${formatCurrency(maxBuy)}`}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="border-border/50 bg-background/50 h-12 pl-12 text-lg font-semibold"
          min={minBuy}
          max={maxBuy}
        />
      </div>

      {/* Potential return display */}
      {numericAmount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 rounded-lg border border-[var(--neon-green)]/30 bg-[var(--neon-green)]/10 p-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="size-4 text-[var(--neon-green)]" />
              <span className="text-sm">Potential Return</span>
            </div>
            <div className="text-right">
              <p className="neon-text-green text-lg font-bold">
                KES {formatCurrency(totalReturn)}
              </p>
              <p className="text-muted-foreground text-xs">
                +{formatCurrency(potentialProfit)} profit
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Warning messages */}
      {numericAmount > 0 && numericAmount < minBuy && (
        <div className="mb-4 flex items-center gap-2 text-sm text-[var(--warning)]">
          <AlertCircle className="size-4" />
          Minimum buy is KES {minBuy}
        </div>
      )}

      {user && numericAmount > user.balance && (
        <div className="text-destructive mb-4 flex items-center gap-2 text-sm">
          <AlertCircle className="size-4" />
          Insufficient balance. Please deposit first.
        </div>
      )}

      {/* Buy button */}
      <Button
        className="w-full bg-gradient-to-r from-[var(--neon-cyan)] to-[var(--neon-purple)] py-6 text-lg font-semibold"
        disabled={!canBuy || isLoading || roundStatus !== 'active'}
        onClick={handleBuy}
      >
        {isLoading ? (
          <>
            <Loader2 className="size-5 animate-spin" />
            Processing...
          </>
        ) : !user ? (
          <>
            Login to Buy
            <ArrowRight className="size-5" />
          </>
        ) : roundStatus !== 'active' ? (
          'Waiting for Round'
        ) : (
          <>
            Buy Now
            <ArrowRight className="size-5" />
          </>
        )}
      </Button>

      {/* Info text */}
      <p className="text-muted-foreground mt-3 text-center text-xs">
        When the vault fills, your buy + {profitPercentage}% profit is credited to your balance
      </p>
    </div>
  )
}
