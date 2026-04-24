"use client"

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PartyPopper, Trophy } from 'lucide-react'

interface PayoutCelebrationProps {
  show: boolean
  vaultCap: number
  profitPercentage: number
  participantCount: number
}

function formatKES(amount: number): string {
  return `KES ${amount.toLocaleString('en-KE')}`
}

const CASH_EMOJIS = ['💵', '💰', '💸', '🤑', '💴', '💶', '💷', '🪙']
const CONFETTI_COLORS = [
  '#22d3ee', // cyan
  '#a855f7', // purple
  '#22c55e', // green
  '#facc15', // yellow
  '#f472b6', // pink
  '#fb7185', // rose
]

export function PayoutCelebration({
  show,
  vaultCap,
  profitPercentage,
  participantCount,
}: PayoutCelebrationProps) {
  const [internalShow, setInternalShow] = useState(false)

  useEffect(() => {
    if (!show) return
    setInternalShow(true)
    const t = setTimeout(() => setInternalShow(false), 6000)
    return () => clearTimeout(t)
  }, [show])

  // Pre-compute random positions/timings so they don't reshuffle on every render.
  const billPieces = useMemo(
    () =>
      Array.from({ length: 36 }).map((_, i) => ({
        id: i,
        emoji: CASH_EMOJIS[i % CASH_EMOJIS.length],
        left: Math.random() * 100,
        delay: Math.random() * 1.8,
        duration: 2.6 + Math.random() * 2.4,
        rotateStart: Math.random() * 360,
        rotateEnd: Math.random() * 720 - 360,
        size: 22 + Math.random() * 28,
        drift: (Math.random() - 0.5) * 160,
      })),
    [internalShow],
  )

  const confettiPieces = useMemo(
    () =>
      Array.from({ length: 60 }).map((_, i) => ({
        id: i,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        left: Math.random() * 100,
        delay: Math.random() * 1.2,
        duration: 2.2 + Math.random() * 2.2,
        rotateEnd: Math.random() * 1080 - 540,
        width: 6 + Math.random() * 6,
        height: 10 + Math.random() * 14,
        drift: (Math.random() - 0.5) * 220,
      })),
    [internalShow],
  )

  const totalPayout = Math.round(vaultCap * (1 + profitPercentage / 100))
  const perPlayer = participantCount > 0 ? Math.round(totalPayout / participantCount) : totalPayout

  return (
    <AnimatePresence>
      {internalShow && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
        >
          {/* Radial gold flash */}
          <motion.div
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: [0, 0.7, 0], scale: [0.6, 1.4, 1.8] }}
            transition={{ duration: 1.6, ease: 'easeOut' }}
            className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#facc15_0%,_#a855f7_30%,_transparent_60%)] opacity-40"
          />

          {/* Falling money */}
          {billPieces.map(bill => (
            <motion.div
              key={`bill-${bill.id}`}
              initial={{
                y: '-10vh',
                x: 0,
                rotate: bill.rotateStart,
                opacity: 0,
              }}
              animate={{
                y: '110vh',
                x: bill.drift,
                rotate: bill.rotateEnd,
                opacity: [0, 1, 1, 0.9, 0],
              }}
              transition={{
                duration: bill.duration,
                delay: bill.delay,
                ease: 'easeIn',
              }}
              style={{
                position: 'absolute',
                top: 0,
                left: `${bill.left}%`,
                fontSize: `${bill.size}px`,
                filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.4))',
              }}
            >
              {bill.emoji}
            </motion.div>
          ))}

          {/* Confetti ribbons */}
          {confettiPieces.map(c => (
            <motion.div
              key={`conf-${c.id}`}
              initial={{ y: '-10vh', x: 0, rotate: 0, opacity: 0 }}
              animate={{
                y: '110vh',
                x: c.drift,
                rotate: c.rotateEnd,
                opacity: [0, 1, 1, 0],
              }}
              transition={{
                duration: c.duration,
                delay: c.delay,
                ease: 'easeIn',
              }}
              style={{
                position: 'absolute',
                top: 0,
                left: `${c.left}%`,
                width: c.width,
                height: c.height,
                background: c.color,
                borderRadius: 2,
                boxShadow: `0 0 8px ${c.color}88`,
              }}
            />
          ))}

          {/* Center jackpot card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.4, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.6, y: -20 }}
            transition={{
              type: 'spring',
              stiffness: 220,
              damping: 18,
              delay: 0.15,
            }}
            className="absolute inset-0 flex items-center justify-center px-4"
          >
            <div className="relative max-w-md w-full rounded-3xl border-2 border-[var(--neon-cyan)]/60 bg-gradient-to-br from-[#0a0a0f]/95 via-[#1a0b2e]/95 to-[#0a0a0f]/95 p-6 text-center shadow-[0_0_60px_rgba(34,211,238,0.5)] backdrop-blur-xl sm:p-8">
              {/* Pulsing glow border */}
              <motion.div
                animate={{
                  boxShadow: [
                    '0 0 30px rgba(168,85,247,0.4)',
                    '0 0 60px rgba(34,211,238,0.6)',
                    '0 0 30px rgba(34,197,94,0.4)',
                    '0 0 60px rgba(168,85,247,0.6)',
                  ],
                }}
                transition={{ duration: 2.5, repeat: Infinity }}
                className="pointer-events-none absolute inset-0 rounded-3xl"
              />

              <motion.div
                animate={{ rotate: [0, -8, 8, -4, 4, 0] }}
                transition={{ duration: 1.2, repeat: Infinity }}
                className="mx-auto mb-3 flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-yellow-400 via-orange-500 to-pink-500 shadow-lg shadow-yellow-500/40"
              >
                <Trophy className="size-9 text-white drop-shadow" />
              </motion.div>

              <div className="mb-1 flex items-center justify-center gap-2 text-xs uppercase tracking-[0.25em] text-[var(--neon-cyan)]">
                <PartyPopper className="size-3.5" />
                Vault Erupted
                <PartyPopper className="size-3.5" />
              </div>

              <motion.h2
                initial={{ scale: 0.8 }}
                animate={{ scale: [0.8, 1.15, 1] }}
                transition={{ duration: 0.8, delay: 0.3 }}
                className="bg-gradient-to-r from-yellow-300 via-[var(--neon-cyan)] to-[var(--neon-purple)] bg-clip-text text-4xl font-extrabold text-transparent sm:text-5xl"
              >
                {formatKES(totalPayout)}
              </motion.h2>

              <p className="text-muted-foreground mt-2 text-sm">
                Jackpot disbursed to{' '}
                <span className="font-semibold text-foreground">{participantCount}</span>{' '}
                {participantCount === 1 ? 'player' : 'players'}
              </p>

              <div className="mt-5 grid grid-cols-2 gap-3 text-left">
                <div className="rounded-xl border border-[var(--border)] bg-card/40 p-3">
                  <p className="text-muted-foreground text-[10px] uppercase tracking-wider">
                    Vault filled
                  </p>
                  <p className="font-semibold">{formatKES(vaultCap)}</p>
                </div>
                <div className="rounded-xl border border-[var(--border)] bg-card/40 p-3">
                  <p className="text-muted-foreground text-[10px] uppercase tracking-wider">
                    Profit boost
                  </p>
                  <p className="font-semibold text-[var(--neon-green)]">
                    +{profitPercentage}%
                  </p>
                </div>
              </div>

              {participantCount > 0 && (
                <p className="mt-4 text-xs text-muted-foreground">
                  Avg payout per player ≈{' '}
                  <span className="font-semibold text-[var(--neon-green)]">
                    {formatKES(perPlayer)}
                  </span>
                </p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
