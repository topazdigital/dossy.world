"use client"

import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Sparkles, TrendingUp, Users, Timer, Lock, Unlock } from 'lucide-react'

interface VaultAnimationProps {
  phase: 'waiting' | 'filling' | 'eruption' | 'paused'
  fillPercent: number
  totalInvested: number
  vaultTarget: number
  profitPercentage: number
  investorCount: number
  waitingTimeRemaining: number
}

export function VaultAnimation({ 
  phase,
  fillPercent,
  totalInvested, 
  vaultTarget, 
  profitPercentage,
  investorCount,
  waitingTimeRemaining
}: VaultAnimationProps) {
  const [showCelebration, setShowCelebration] = useState(false)
  const [prevPhase, setPrevPhase] = useState(phase)
  
  // Trigger celebration when eruption happens
  useEffect(() => {
    if (phase === 'eruption' && prevPhase === 'filling') {
      setShowCelebration(true)
      const timer = setTimeout(() => setShowCelebration(false), 5000)
      return () => clearTimeout(timer)
    }
    setPrevPhase(phase)
  }, [phase, prevPhase])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const getPhaseLabel = () => {
    switch (phase) {
      case 'waiting':
        return 'Accepting Investments'
      case 'filling':
        return 'Vault Filling...'
      case 'eruption':
        return 'Erupting!'
      case 'paused':
        return 'System Paused'
      default:
        return 'Loading...'
    }
  }

  const getPhaseColor = () => {
    switch (phase) {
      case 'waiting':
        return 'text-[var(--neon-cyan)]'
      case 'filling':
        return 'text-[var(--neon-green)]'
      case 'eruption':
        return 'neon-text'
      case 'paused':
        return 'text-[var(--warning)]'
      default:
        return ''
    }
  }

  const canInvest = phase === 'waiting'

  return (
    <div className="relative flex flex-col items-center">
      {/* Celebration particles */}
      <AnimatePresence>
        {showCelebration && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {[...Array(30)].map((_, i) => (
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
                  scale: [0, 1.5, 0],
                  opacity: [1, 1, 0]
                }}
                transition={{ 
                  duration: 2.5,
                  delay: i * 0.08,
                  ease: 'easeOut'
                }}
              >
                <Sparkles className="size-8 text-[var(--neon-cyan)]" />
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* Phase indicator with countdown */}
      <motion.div 
        className="mb-4 flex items-center gap-3"
        animate={phase === 'eruption' ? { scale: [1, 1.1, 1] } : {}}
        transition={{ duration: 0.5, repeat: phase === 'eruption' ? Infinity : 0 }}
      >
        {canInvest ? (
          <Unlock className="size-5 text-[var(--neon-green)]" />
        ) : (
          <Lock className="size-5 text-[var(--warning)]" />
        )}
        <span className={`font-semibold ${getPhaseColor()}`}>
          {getPhaseLabel()}
        </span>
        {phase === 'waiting' && waitingTimeRemaining > 0 && (
          <motion.span 
            className="rounded-full bg-[var(--neon-cyan)]/20 px-3 py-1 text-sm font-bold text-[var(--neon-cyan)]"
            key={waitingTimeRemaining}
            initial={{ scale: 1.2 }}
            animate={{ scale: 1 }}
          >
            {waitingTimeRemaining}s
          </motion.span>
        )}
      </motion.div>

      {/* Vault Container */}
      <div className="relative mb-6">
        {/* Outer glow ring */}
        <motion.div 
          className="absolute -inset-4 rounded-full bg-gradient-to-r from-[var(--neon-cyan)] via-[var(--neon-purple)] to-[var(--neon-green)] opacity-30 blur-xl"
          animate={{ 
            scale: phase === 'eruption' ? [1, 1.2, 1] : 1,
            opacity: phase === 'eruption' ? [0.3, 0.8, 0.3] : 0.3
          }}
          transition={{ 
            duration: 1,
            repeat: phase === 'eruption' ? Infinity : 0
          }}
        />
        
        {/* Vault outer ring */}
        <div className={`relative size-64 rounded-full border-4 p-2 sm:size-72 md:size-80 transition-all duration-500 ${
          canInvest 
            ? 'border-[var(--neon-green)]/50' 
            : phase === 'paused' 
              ? 'border-[var(--warning)]/30' 
              : 'border-[var(--neon-cyan)]/30'
        }`}>
          <div className="relative size-full rounded-full border-2 border-[var(--neon-purple)]/20 bg-gradient-to-b from-[var(--card)] to-[var(--background)] p-3">
            
            {/* Inner vault */}
            <div className="relative size-full overflow-hidden rounded-full border border-[var(--border)]">
              {/* Fill liquid */}
              <motion.div
                className={`absolute inset-x-0 bottom-0 ${
                  phase === 'eruption' 
                    ? 'bg-gradient-to-t from-[var(--neon-green)] via-[var(--neon-cyan)] to-[var(--neon-purple)]'
                    : 'bg-gradient-to-t from-[var(--neon-cyan)] via-[var(--neon-cyan)]/70 to-[var(--neon-cyan)]/30'
                }`}
                initial={{ height: '0%' }}
                animate={{ 
                  height: `${fillPercent}%`,
                  opacity: phase === 'paused' ? 0.5 : 1
                }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              >
                {/* Wave effect */}
                <motion.div
                  className="bg-primary/20 absolute -left-1/2 top-0 h-4 w-[200%] rounded-[100%]"
                  animate={{ 
                    x: phase === 'paused' ? '0%' : ['-25%', '0%', '-25%']
                  }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                />
              </motion.div>
              
              {/* Center content */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <motion.div 
                  className="text-center"
                  animate={phase === 'eruption' ? { scale: [1, 1.1, 1] } : {}}
                  transition={{ duration: 0.5 }}
                >
                  <p className="text-muted-foreground text-xs uppercase tracking-wider">
                    {phase === 'eruption' ? 'Erupted!' : phase === 'waiting' ? 'Invest Now!' : 'Current'}
                  </p>
                  <motion.p 
                    className="neon-text text-2xl font-bold drop-shadow-lg sm:text-3xl md:text-4xl"
                    key={totalInvested}
                    initial={{ scale: 1.1, opacity: 0.8 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.2 }}
                  >
                    {formatCurrency(totalInvested)}
                  </motion.p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    of {formatCurrency(vaultTarget)}
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
                  strokeDasharray={`${fillPercent * 2.83} 283`}
                  initial={{ strokeDasharray: '0 283' }}
                  animate={{ strokeDasharray: `${fillPercent * 2.83} 283` }}
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
          animate={fillPercent > 80 ? { scale: [1, 1.1, 1] } : {}}
          transition={{ duration: 0.5, repeat: fillPercent > 80 ? Infinity : 0 }}
        >
          <span className={`text-sm font-bold ${fillPercent > 80 ? 'neon-text' : ''}`}>
            {fillPercent.toFixed(1)}%
          </span>
        </motion.div>

        {/* Investment status badge */}
        <motion.div 
          className={`absolute -left-2 top-4 rounded-full px-3 py-1 text-xs font-semibold shadow-lg backdrop-blur-sm ${
            canInvest 
              ? 'border border-[var(--neon-green)]/50 bg-[var(--neon-green)]/10 text-[var(--neon-green)]'
              : 'border border-[var(--warning)]/50 bg-[var(--warning)]/10 text-[var(--warning)]'
          }`}
          animate={{ opacity: [0.8, 1, 0.8] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          {canInvest ? 'OPEN' : 'LOCKED'}
        </motion.div>
      </div>

      {/* Countdown Timer - shown during waiting phase */}
      <AnimatePresence>
        {phase === 'waiting' && waitingTimeRemaining > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="bg-card/80 mb-6 rounded-2xl border border-[var(--neon-green)]/50 px-8 py-4 backdrop-blur-sm"
          >
            <div className="flex items-center gap-4">
              <Timer className="size-6 text-[var(--neon-green)]" />
              <div className="text-center">
                <p className="text-muted-foreground text-xs uppercase tracking-wider">Invest Before</p>
                <motion.p 
                  className="text-4xl font-bold text-[var(--neon-green)] tabular-nums"
                  key={waitingTimeRemaining}
                  initial={{ scale: 1.3 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  {waitingTimeRemaining}s
                </motion.p>
              </div>
              <div className="size-12">
                <svg viewBox="0 0 36 36" className="-rotate-90">
                  <circle
                    cx="18" cy="18" r="16"
                    fill="none"
                    stroke="var(--border)"
                    strokeWidth="3"
                  />
                  <motion.circle
                    cx="18" cy="18" r="16"
                    fill="none"
                    stroke="url(#countdownGradient)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray="100.5"
                    animate={{ 
                      strokeDashoffset: 100.5 - (100.5 * waitingTimeRemaining / 5)
                    }}
                    transition={{ duration: 0.3 }}
                  />
                  <defs>
                    <linearGradient id="countdownGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="var(--neon-green)" />
                      <stop offset="100%" stopColor="var(--neon-cyan)" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Eruption notification */}
      <AnimatePresence>
        {phase === 'eruption' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-6 rounded-2xl border border-[var(--neon-cyan)] bg-[var(--neon-cyan)]/20 px-8 py-4 text-center backdrop-blur-sm"
          >
            <motion.p 
              className="neon-text text-xl font-bold"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 0.5, repeat: Infinity }}
            >
              Vault Erupted! Paying Out...
            </motion.p>
            <p className="text-muted-foreground mt-1 text-sm">
              All investors receiving +{profitPercentage}% profit
            </p>
          </motion.div>
        )}
      </AnimatePresence>

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
            <p className="text-muted-foreground text-[10px] uppercase">Investors</p>
            <p className="text-sm font-bold">{investorCount}</p>
          </div>
        </motion.div>
        
        <motion.div 
          className={`bg-card/50 flex items-center gap-2 rounded-lg border px-4 py-2 ${
            canInvest ? 'border-[var(--neon-green)]/50' : 'border-[var(--border)]'
          }`}
          whileHover={{ scale: 1.05 }}
        >
          {canInvest ? (
            <Unlock className="size-4 text-[var(--neon-green)]" />
          ) : (
            <Lock className="size-4 text-[var(--warning)]" />
          )}
          <div>
            <p className="text-muted-foreground text-[10px] uppercase">Status</p>
            <p className={`text-sm font-bold ${canInvest ? 'text-[var(--neon-green)]' : 'text-[var(--warning)]'}`}>
              {canInvest ? 'Open' : 'Locked'}
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
