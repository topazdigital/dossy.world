"use client"

import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Sparkles, TrendingUp, Clock, Users } from 'lucide-react'

interface VaultAnimationProps {
  currentAmount: number
  vaultCap: number
  profitPercentage: number
  status: 'waiting' | 'active' | 'filled' | 'paying' | 'paid' | 'cancelled'
  participantCount: number
}

export function VaultAnimation({ 
  currentAmount, 
  vaultCap, 
  profitPercentage,
  status,
  participantCount
}: VaultAnimationProps) {
  const fillPercentage = Math.min((currentAmount / vaultCap) * 100, 100)
  const isFilled = status === 'filled' || status === 'paying' || status === 'paid'
  const [showCelebration, setShowCelebration] = useState(false)

  useEffect(() => {
    if (isFilled && fillPercentage >= 100) {
      setShowCelebration(true)
      const timer = setTimeout(() => setShowCelebration(false), 5000)
      return () => clearTimeout(timer)
    }
  }, [isFilled, fillPercentage])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  return (
    <div className="relative flex flex-col items-center">
      {/* Celebration particles */}
      <AnimatePresence>
        {showCelebration && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {[...Array(20)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute"
                initial={{ 
                  x: '50%', 
                  y: '50%',
                  scale: 0,
                  opacity: 1
                }}
                animate={{ 
                  x: `${Math.random() * 100}%`,
                  y: `${Math.random() * 100}%`,
                  scale: [0, 1, 0],
                  opacity: [1, 1, 0]
                }}
                transition={{ 
                  duration: 2,
                  delay: i * 0.1,
                  ease: 'easeOut'
                }}
              >
                <Sparkles className="size-6 text-[var(--neon-cyan)]" />
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* Vault Container */}
      <div className="relative mb-6">
        {/* Outer glow ring */}
        <motion.div 
          className="absolute -inset-4 rounded-full bg-gradient-to-r from-[var(--neon-cyan)] via-[var(--neon-purple)] to-[var(--neon-green)] opacity-30 blur-xl"
          animate={{ 
            scale: isFilled ? [1, 1.1, 1] : 1,
            opacity: isFilled ? [0.3, 0.6, 0.3] : 0.3
          }}
          transition={{ 
            duration: 2,
            repeat: isFilled ? Infinity : 0
          }}
        />
        
        {/* Vault outer ring */}
        <div className="relative size-64 rounded-full border-4 border-[var(--neon-cyan)]/30 p-2 sm:size-72 md:size-80">
          <div className="relative size-full rounded-full border-2 border-[var(--neon-purple)]/20 bg-gradient-to-b from-[var(--card)] to-[var(--background)] p-3">
            
            {/* Inner vault */}
            <div className="relative size-full overflow-hidden rounded-full border border-[var(--border)]">
              {/* Fill liquid */}
              <motion.div
                className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[var(--neon-cyan)] via-[var(--neon-cyan)]/70 to-[var(--neon-cyan)]/30"
                initial={{ height: '0%' }}
                animate={{ height: `${fillPercentage}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              >
                {/* Wave effect */}
                <motion.div
                  className="bg-primary/20 absolute -left-1/2 top-0 h-4 w-[200%] rounded-[100%]"
                  animate={{ x: ['-25%', '0%', '-25%'] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                />
              </motion.div>
              
              {/* Center content */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <motion.div 
                  className="text-center"
                  animate={isFilled ? { scale: [1, 1.05, 1] } : {}}
                  transition={{ duration: 0.5 }}
                >
                  <p className="text-muted-foreground text-xs uppercase tracking-wider">
                    {isFilled ? 'Vault Full!' : 'Current'}
                  </p>
                  <motion.p 
                    className="neon-text text-2xl font-bold drop-shadow-lg sm:text-3xl md:text-4xl"
                    key={currentAmount}
                    initial={{ scale: 1.2, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    {formatCurrency(currentAmount)}
                  </motion.p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    of {formatCurrency(vaultCap)}
                  </p>
                </motion.div>
              </div>
              
              {/* Percentage ring overlay */}
              <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="var(--border)"
                  strokeWidth="2"
                />
                <motion.circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="url(#gradient)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={`${fillPercentage * 2.83} 283`}
                  initial={{ strokeDasharray: '0 283' }}
                  animate={{ strokeDasharray: `${fillPercentage * 2.83} 283` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                />
                <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="var(--neon-cyan)" />
                    <stop offset="50%" stopColor="var(--neon-purple)" />
                    <stop offset="100%" stopColor="var(--neon-green)" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>
        </div>
        
        {/* Percentage badge */}
        <motion.div 
          className="bg-card/90 absolute -right-2 top-4 rounded-full border border-[var(--neon-cyan)]/50 px-3 py-1 shadow-lg backdrop-blur-sm"
          animate={fillPercentage > 80 ? { scale: [1, 1.1, 1] } : {}}
          transition={{ duration: 0.5, repeat: fillPercentage > 80 ? Infinity : 0 }}
        >
          <span className={`text-sm font-bold ${fillPercentage > 80 ? 'neon-text' : ''}`}>
            {fillPercentage.toFixed(1)}%
          </span>
        </motion.div>
      </div>

      {/* Stats row */}
      <div className="flex w-full max-w-md justify-center gap-4">
        <motion.div 
          className="bg-card/50 flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2"
          whileHover={{ scale: 1.05, borderColor: 'var(--neon-green)' }}
        >
          <TrendingUp className="size-4 text-[var(--neon-green)]" />
          <div>
            <p className="text-muted-foreground text-[10px] uppercase">Profit</p>
            <p className="neon-text-green text-sm font-bold">+{profitPercentage}%</p>
          </div>
        </motion.div>
        
        <motion.div 
          className="bg-card/50 flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2"
          whileHover={{ scale: 1.05, borderColor: 'var(--neon-cyan)' }}
        >
          <Users className="size-4 text-[var(--neon-cyan)]" />
          <div>
            <p className="text-muted-foreground text-[10px] uppercase">Players</p>
            <p className="text-sm font-bold">{participantCount}</p>
          </div>
        </motion.div>
        
        <motion.div 
          className="bg-card/50 flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2"
          whileHover={{ scale: 1.05, borderColor: 'var(--neon-purple)' }}
        >
          <Clock className="size-4 text-[var(--neon-purple)]" />
          <div>
            <p className="text-muted-foreground text-[10px] uppercase">Status</p>
            <p className="text-sm font-bold capitalize">{status}</p>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
