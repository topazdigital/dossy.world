"use client"

import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Sparkles, TrendingUp, Users, Flame } from 'lucide-react'

interface VaultAnimationProps {
  currentAmount: number
  vaultCap: number
  profitPercentage: number
  participantCount: number
  erupting?: boolean
  eruptionSeconds?: number
}

export function VaultAnimation({
  currentAmount,
  vaultCap,
  profitPercentage,
  participantCount,
  erupting = false,
  eruptionSeconds = 0,
}: VaultAnimationProps) {
  const fillPercentage = Math.min((currentAmount / vaultCap) * 100, 100)
  const [showCelebration, setShowCelebration] = useState(false)

  // Smooth count-up of the displayed amount so it never "jumps".
  const displayed = useMotionValue(currentAmount)
  const [smoothAmount, setSmoothAmount] = useState(currentAmount)
  useEffect(() => {
    const controls = animate(displayed, currentAmount, {
      duration: 0.9,
      ease: 'easeOut',
      onUpdate: v => setSmoothAmount(Math.round(v)),
    })
    return () => controls.stop()
  }, [currentAmount, displayed])
  void useTransform // referenced to keep tree-shaker honest

  useEffect(() => {
    if (erupting) {
      setShowCelebration(true)
      const t = setTimeout(() => setShowCelebration(false), 4000)
      return () => clearTimeout(t)
    }
  }, [erupting])

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)

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
                initial={{ x: '50%', y: '50%', scale: 0, opacity: 1 }}
                animate={{
                  x: `${Math.random() * 100}%`,
                  y: `${Math.random() * 100}%`,
                  scale: [0, 1, 0],
                  opacity: [1, 1, 0],
                }}
                transition={{ duration: 2, delay: i * 0.1, ease: 'easeOut' }}
              >
                <Sparkles className="size-6 text-[var(--neon-cyan)]" />
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* Vault Container */}
      <div className="relative mb-6">
        <motion.div
          className="absolute -inset-4 rounded-full bg-gradient-to-r from-[var(--neon-cyan)] via-[var(--neon-purple)] to-[var(--neon-green)] opacity-30 blur-xl"
          animate={{
            scale: erupting ? [1, 1.2, 1] : 1,
            opacity: erupting ? [0.3, 0.8, 0.3] : 0.3,
          }}
          transition={{ duration: 1.5, repeat: erupting ? Infinity : 0 }}
        />

        <div className="relative size-64 rounded-full border-4 border-[var(--neon-cyan)]/30 p-2 sm:size-72 md:size-80">
          <div className="relative size-full rounded-full border-2 border-[var(--neon-purple)]/20 bg-gradient-to-b from-[var(--card)] to-[var(--background)] p-3">
            <div className="relative size-full overflow-hidden rounded-full border border-[var(--border)]">
              <motion.div
                className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[var(--neon-cyan)] via-[var(--neon-cyan)]/70 to-[var(--neon-cyan)]/30"
                initial={{ height: '0%' }}
                animate={{ height: `${fillPercentage}%` }}
                transition={{ duration: 0.9, ease: 'easeOut' }}
              >
                <motion.div
                  className="bg-primary/20 absolute -left-1/2 top-0 h-4 w-[200%] rounded-[100%]"
                  animate={{ x: ['-25%', '0%', '-25%'] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                />
              </motion.div>

              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <motion.div
                  className="text-center"
                  animate={erupting ? { scale: [1, 1.08, 1] } : {}}
                  transition={{ duration: 0.6, repeat: erupting ? Infinity : 0 }}
                >
                  <p className="text-muted-foreground text-xs uppercase tracking-wider">
                    {erupting ? 'Erupting' : 'In the Vault'}
                  </p>
                  <p className="neon-text text-2xl font-bold drop-shadow-lg tabular-nums sm:text-3xl md:text-4xl">
                    {formatCurrency(smoothAmount)}
                  </p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    of {formatCurrency(vaultCap)}
                  </p>
                </motion.div>
              </div>

              <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" stroke="var(--border)" strokeWidth="2" />
                <motion.circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="url(#gradient)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  initial={{ strokeDasharray: '0 283' }}
                  animate={{ strokeDasharray: `${fillPercentage * 2.83} 283` }}
                  transition={{ duration: 0.9, ease: 'easeOut' }}
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

      {/* Eruption / cooldown caption */}
      <AnimatePresence>
        {erupting && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="mb-6 flex items-center gap-3 rounded-2xl border border-[var(--neon-cyan)]/50 bg-card/80 px-6 py-3 backdrop-blur-sm"
          >
            <Flame className="size-5 text-[var(--neon-cyan)]" />
            <div className="text-center">
              <p className="text-muted-foreground text-[10px] uppercase tracking-wider">
                Previous vault paying out
              </p>
              <p className="neon-text text-xl font-bold tabular-nums">
                {eruptionSeconds > 0 ? `${eruptionSeconds}s` : 'now'}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats row */}
      <div className="flex w-full max-w-md justify-center gap-4">
        <div className="bg-card/50 flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2">
          <TrendingUp className="size-4 text-[var(--neon-green)]" />
          <div>
            <p className="text-muted-foreground text-[10px] uppercase">Profit</p>
            <p className="neon-text-green text-sm font-bold">+{profitPercentage}%</p>
          </div>
        </div>
        <div className="bg-card/50 flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2">
          <Users className="size-4 text-[var(--neon-cyan)]" />
          <div>
            <p className="text-muted-foreground text-[10px] uppercase">Players</p>
            <p className="text-sm font-bold">{participantCount}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
