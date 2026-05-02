"use client"

import { motion, AnimatePresence } from 'framer-motion'
import { User, ArrowRight } from 'lucide-react'

export interface FeedItem {
  id: string
  username: string
  amount: number
  isBot: boolean
  createdAt: string
}

interface LiveFeedProps {
  items: FeedItem[]
  maxItems?: number
}

export function LiveFeed({ items, maxItems = 10 }: LiveFeedProps) {
  const displayItems = items.slice(0, maxItems)

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE').format(amount)
  }

  const getTimeAgo = (dateString: string) => {
    const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000)
    if (seconds < 60) return 'just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    return `${Math.floor(seconds / 86400)}d ago`
  }

  const getDisplayName = (username: string) => {
    // Convert bot username like "james_mwangi_123" to "James M."
    const parts = username.split('_')
    if (parts.length >= 2) {
      const firstName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1)
      const lastInitial = parts[1].charAt(0).toUpperCase()
      return `${firstName} ${lastInitial}.`
    }
    return username
  }

  return (
    <div className="bg-card/30 w-full max-w-md rounded-2xl border border-[var(--border)] p-4 backdrop-blur-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--neon-green)] opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-[var(--neon-green)]" />
          </span>
          Live Activity
        </h3>
        <span className="text-muted-foreground text-xs">{items.length} buys</span>
      </div>

      <div className="space-y-2 overflow-hidden">
        <AnimatePresence mode="popLayout">
          {displayItems.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-muted-foreground py-8 text-center text-sm"
            >
              No buys yet. Be the first!
            </motion.div>
          ) : (
            displayItems.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -20, height: 0 }}
                animate={{ opacity: 1, x: 0, height: 'auto' }}
                exit={{ opacity: 0, x: 20, height: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className="flex items-center justify-between rounded-lg border border-[var(--border)]/50 bg-[var(--background)]/50 px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-[var(--neon-cyan)]/20 to-[var(--neon-purple)]/20">
                    <User className="text-primary size-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{getDisplayName(item.username)}</p>
                    <p className="text-muted-foreground text-xs">{getTimeAgo(item.createdAt)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <ArrowRight className="size-3 text-[var(--neon-green)]" />
                  <span className="font-semibold text-[var(--neon-green)]">
                    KES {formatCurrency(item.amount)}
                  </span>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
