"use client"

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Users,
  CircleDollarSign,
  TrendingUp,
  ArrowDownToLine,
  RefreshCw,
  Play,
  Pause,
  SkipForward,
  DollarSign
} from 'lucide-react'
import { toast } from 'sonner'

interface Stats {
  totalUsers: number
  totalRounds: number
  activeRound: {
    id: string
    round_number: number
    vault_cap: number
    profit_percentage: number
    current_amount: number
    status: string
    bot_count: number
  } | null
  pendingWithdrawals: number
  totalVolume: number
  todayVolume: number
  totalDeposits: number
  totalWithdrawals: number
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/admin/stats')
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 5000)
    return () => clearInterval(interval)
  }, [])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await fetchStats()
    setIsRefreshing(false)
  }

  const handleRoundAction = async (action: 'start' | 'end' | 'payout' | 'new') => {
    setActionLoading(action)
    try {
      const response = await fetch('/api/admin/round/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        toast.success(data.message || `Round ${action} successful`)
        fetchStats()
      } else {
        toast.error(data.error || `Failed to ${action} round`)
      }
    } catch {
      toast.error('Network error')
    } finally {
      setActionLoading(null)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0
    }).format(amount)
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="size-12 animate-spin rounded-full border-4 border-[var(--neon-cyan)] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back, Administrator</p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
          <RefreshCw className={`mr-2 size-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="border-[var(--border)] bg-card/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-muted-foreground text-sm font-medium">Total Users</CardTitle>
              <Users className="text-muted-foreground size-5" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
              <p className="text-muted-foreground text-xs">Registered players</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="border-[var(--border)] bg-card/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-muted-foreground text-sm font-medium">Total Rounds</CardTitle>
              <CircleDollarSign className="text-muted-foreground size-5" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalRounds || 0}</div>
              <p className="text-muted-foreground text-xs">Completed rounds</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="border-[var(--border)] bg-card/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-muted-foreground text-sm font-medium">Today&apos;s Volume</CardTitle>
              <TrendingUp className="size-5 text-[var(--neon-green)]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats?.todayVolume || 0)}</div>
              <p className="text-muted-foreground text-xs">Total buys today</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="border-[var(--border)] bg-card/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-muted-foreground text-sm font-medium">Pending Withdrawals</CardTitle>
              <ArrowDownToLine className="size-5 text-[var(--warning)]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.pendingWithdrawals || 0}</div>
              <p className="text-muted-foreground text-xs">Awaiting approval</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Current Round Control */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Card className="border-[var(--border)] bg-card/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CircleDollarSign className="size-5 text-[var(--neon-cyan)]" />
              Current Round Control
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.activeRound ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-6">
                  <div>
                    <p className="text-muted-foreground text-sm">Round</p>
                    <p className="text-xl font-bold">#{stats.activeRound.round_number}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">Status</p>
                    <p className={`text-xl font-bold capitalize ${
                      stats.activeRound.status === 'active' ? 'text-[var(--neon-green)]' :
                      stats.activeRound.status === 'filled' ? 'text-[var(--neon-cyan)]' :
                      stats.activeRound.status === 'waiting' ? 'text-[var(--warning)]' :
                      ''
                    }`}>{stats.activeRound.status}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">Progress</p>
                    <p className="text-xl font-bold">
                      {formatCurrency(stats.activeRound.current_amount)} / {formatCurrency(stats.activeRound.vault_cap)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">Fill %</p>
                    <p className="text-xl font-bold">
                      {((stats.activeRound.current_amount / stats.activeRound.vault_cap) * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">Profit</p>
                    <p className="neon-text-green text-xl font-bold">+{stats.activeRound.profit_percentage}%</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">Bots</p>
                    <p className="text-xl font-bold">{stats.activeRound.bot_count}</p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="bg-muted h-4 overflow-hidden rounded-full">
                  <div 
                    className="h-full bg-gradient-to-r from-[var(--neon-cyan)] to-[var(--neon-green)] transition-all duration-500"
                    style={{ width: `${Math.min((stats.activeRound.current_amount / stats.activeRound.vault_cap) * 100, 100)}%` }}
                  />
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-3">
                  {stats.activeRound.status === 'waiting' && (
                    <Button
                      onClick={() => handleRoundAction('start')}
                      disabled={actionLoading !== null}
                      className="bg-gradient-to-r from-[var(--neon-green)] to-[var(--neon-cyan)]"
                    >
                      {actionLoading === 'start' ? (
                        <RefreshCw className="mr-2 size-4 animate-spin" />
                      ) : (
                        <Play className="mr-2 size-4" />
                      )}
                      Start Round
                    </Button>
                  )}

                  {stats.activeRound.status === 'active' && (
                    <Button
                      variant="destructive"
                      onClick={() => handleRoundAction('end')}
                      disabled={actionLoading !== null}
                    >
                      {actionLoading === 'end' ? (
                        <RefreshCw className="mr-2 size-4 animate-spin" />
                      ) : (
                        <Pause className="mr-2 size-4" />
                      )}
                      End Round
                    </Button>
                  )}

                  {stats.activeRound.status === 'filled' && (
                    <Button
                      onClick={() => handleRoundAction('payout')}
                      disabled={actionLoading !== null}
                      className="bg-gradient-to-r from-[var(--neon-cyan)] to-[var(--neon-purple)]"
                    >
                      {actionLoading === 'payout' ? (
                        <RefreshCw className="mr-2 size-4 animate-spin" />
                      ) : (
                        <DollarSign className="mr-2 size-4" />
                      )}
                      Process Payouts
                    </Button>
                  )}

                  {(stats.activeRound.status === 'paid' || stats.activeRound.status === 'cancelled') && (
                    <Button
                      onClick={() => handleRoundAction('new')}
                      disabled={actionLoading !== null}
                      className="bg-gradient-to-r from-[var(--neon-purple)] to-[var(--neon-cyan)]"
                    >
                      {actionLoading === 'new' ? (
                        <RefreshCw className="mr-2 size-4 animate-spin" />
                      ) : (
                        <SkipForward className="mr-2 size-4" />
                      )}
                      Start New Round
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-8 text-center">
                <p className="text-muted-foreground mb-4">No active round</p>
                <Button
                  onClick={() => handleRoundAction('new')}
                  disabled={actionLoading !== null}
                  className="bg-gradient-to-r from-[var(--neon-cyan)] to-[var(--neon-purple)]"
                >
                  {actionLoading === 'new' ? (
                    <RefreshCw className="mr-2 size-4 animate-spin" />
                  ) : (
                    <Play className="mr-2 size-4" />
                  )}
                  Create First Round
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Financial Overview */}
      <div className="grid gap-4 md:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Card className="border-[var(--border)] bg-card/50">
            <CardHeader>
              <CardTitle className="text-muted-foreground text-sm font-medium">Total Volume</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="neon-text text-3xl font-bold">{formatCurrency(stats?.totalVolume || 0)}</div>
              <p className="text-muted-foreground text-sm">All time buy volume</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <Card className="border-[var(--border)] bg-card/50">
            <CardHeader>
              <CardTitle className="text-muted-foreground text-sm font-medium">Net Flow</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${(stats?.totalDeposits || 0) - (stats?.totalWithdrawals || 0) >= 0 ? 'text-[var(--neon-green)]' : 'text-destructive'}`}>
                {formatCurrency((stats?.totalDeposits || 0) - (stats?.totalWithdrawals || 0))}
              </div>
              <p className="text-muted-foreground text-sm">
                Deposits: {formatCurrency(stats?.totalDeposits || 0)} | Withdrawals: {formatCurrency(stats?.totalWithdrawals || 0)}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
