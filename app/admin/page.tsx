"use client"

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Users,
  CircleDollarSign,
  TrendingUp,
  ArrowDownToLine,
  RefreshCw,
  Play,
  Pause,
  SkipForward,
  DollarSign,
  Zap,
  Settings2,
  Bot,
  AlertTriangle,
  Clock,
  Activity,
  Lock,
  Unlock
} from 'lucide-react'
import { toast } from 'sonner'

interface GameState {
  phase: 'waiting' | 'filling' | 'eruption' | 'paused'
  phaseStartedAt: string
  vaultFillPercent: number
  totalInvested: number
  vaultTarget: number
  investorCount: number
  isPaused: boolean
  waitingTimeRemaining: number
}

interface Stats {
  totalUsers: number
  totalRounds: number
  currentRound: {
    id: string
    round_number: number
    vault_target: number
    profit_percentage: number
    total_invested: number
    status: string
    investor_count: number
    bot_investor_count: number
    real_investor_count: number
  } | null
  gameState: GameState
  pendingWithdrawals: number
  totalVolume: number
  todayVolume: number
  totalDeposits: number
  totalWithdrawals: number
}

interface SettingsData {
  minInvest: string
  maxInvest: string
  vaultTarget: string
  profitPercentage: string
  waitingDuration: string
  botsEnabled: boolean
  botActivityLevel: string
  minUsersForBotReduction: string
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [settings, setSettings] = useState<SettingsData>({
    minInvest: '50',
    maxInvest: '5000',
    vaultTarget: '10000',
    profitPercentage: '30',
    waitingDuration: '5',
    botsEnabled: true,
    botActivityLevel: 'medium',
    minUsersForBotReduction: '5'
  })

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

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/admin/settings')
      if (response.ok) {
        const data = await response.json()
        setSettings(data)
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error)
    }
  }

  useEffect(() => {
    fetchStats()
    fetchSettings()
    const interval = setInterval(fetchStats, 2000) // More frequent updates for live sync
    return () => clearInterval(interval)
  }, [])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await fetchStats()
    await fetchSettings()
    setIsRefreshing(false)
  }

  const handleGameAction = async (action: string) => {
    setActionLoading(action)
    try {
      const response = await fetch('/api/game/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        toast.success(data.message || `Action ${action} successful`)
        fetchStats()
      } else {
        toast.error(data.error || `Failed: ${action}`)
      }
    } catch {
      toast.error('Network error')
    } finally {
      setActionLoading(null)
    }
  }

  const handleSaveSettings = async () => {
    setActionLoading('save_settings')
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      })
      
      if (response.ok) {
        toast.success('Settings saved successfully')
      } else {
        toast.error('Failed to save settings')
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

  const getPhaseColor = (phase: string) => {
    switch (phase) {
      case 'waiting': return 'text-[var(--neon-green)]'
      case 'filling': return 'text-[var(--neon-cyan)]'
      case 'eruption': return 'text-[var(--neon-purple)]'
      case 'paused': return 'text-[var(--warning)]'
      default: return ''
    }
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
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">Full control over the Dossy World system</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-full bg-[var(--neon-green)]/10 px-3 py-1 text-xs text-[var(--neon-green)]">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--neon-green)] opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-[var(--neon-green)]" />
            </span>
            LIVE SYNC
          </div>
          <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`mr-2 size-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <Tabs defaultValue="control" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="control">Game Control</TabsTrigger>
          <TabsTrigger value="stats">Statistics</TabsTrigger>
          <TabsTrigger value="bots">Bot Settings</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
        </TabsList>

        {/* Game Control Tab */}
        <TabsContent value="control" className="space-y-6">
          {/* Live Game State */}
          <Card className="border-[var(--border)] bg-card/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="size-5 text-[var(--neon-cyan)]" />
                Live Game State
              </CardTitle>
              <CardDescription>All users see this same state in real-time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2">
                {/* Current Phase */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Current Phase</span>
                    <span className={`text-xl font-bold capitalize ${getPhaseColor(stats?.gameState?.phase || '')}`}>
                      {stats?.gameState?.phase || 'Unknown'}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Vault Fill</span>
                    <span className="text-xl font-bold">{stats?.gameState?.vaultFillPercent?.toFixed(1) || 0}%</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Total Invested</span>
                    <span className="text-xl font-bold">{formatCurrency(stats?.gameState?.totalInvested || 0)}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Investors</span>
                    <span className="text-xl font-bold">{stats?.gameState?.investorCount || 0}</span>
                  </div>

                  {stats?.gameState?.phase === 'waiting' && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Time Remaining</span>
                      <span className="text-xl font-bold text-[var(--neon-green)]">
                        {stats?.gameState?.waitingTimeRemaining || 0}s
                      </span>
                    </div>
                  )}
                </div>

                {/* Progress Bar */}
                <div className="space-y-4">
                  <div>
                    <p className="text-muted-foreground mb-2 text-sm">Vault Progress</p>
                    <div className="bg-muted h-6 overflow-hidden rounded-full">
                      <motion.div 
                        className="h-full bg-gradient-to-r from-[var(--neon-cyan)] to-[var(--neon-green)] transition-all duration-500"
                        style={{ width: `${Math.min(stats?.gameState?.vaultFillPercent || 0, 100)}%` }}
                      />
                    </div>
                    <p className="text-muted-foreground mt-1 text-xs text-right">
                      {formatCurrency(stats?.gameState?.totalInvested || 0)} / {formatCurrency(stats?.gameState?.vaultTarget || 10000)}
                    </p>
                  </div>

                  <div>
                    <p className="text-muted-foreground mb-2 text-sm">Round Info</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="bg-muted/50 rounded p-2">
                        <p className="text-muted-foreground text-xs">Round</p>
                        <p className="font-bold">#{stats?.currentRound?.round_number || '—'}</p>
                      </div>
                      <div className="bg-muted/50 rounded p-2">
                        <p className="text-muted-foreground text-xs">Profit</p>
                        <p className="font-bold text-[var(--neon-green)]">+{stats?.currentRound?.profit_percentage || 30}%</p>
                      </div>
                      <div className="bg-muted/50 rounded p-2">
                        <p className="text-muted-foreground text-xs">Real Users</p>
                        <p className="font-bold">{stats?.currentRound?.real_investor_count || 0}</p>
                      </div>
                      <div className="bg-muted/50 rounded p-2">
                        <p className="text-muted-foreground text-xs">Bots</p>
                        <p className="font-bold">{stats?.currentRound?.bot_investor_count || 0}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Control Actions */}
          <Card className="border-[var(--border)] bg-card/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="size-5 text-[var(--neon-purple)]" />
                Quick Actions
              </CardTitle>
              <CardDescription>Control the game flow in real-time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {/* Pause/Resume */}
                {stats?.gameState?.phase === 'paused' ? (
                  <Button
                    onClick={() => handleGameAction('resume')}
                    disabled={actionLoading !== null}
                    className="h-24 flex-col gap-2 bg-gradient-to-r from-[var(--neon-green)] to-[var(--neon-cyan)]"
                  >
                    {actionLoading === 'resume' ? (
                      <RefreshCw className="size-8 animate-spin" />
                    ) : (
                      <Play className="size-8" />
                    )}
                    <span>Resume System</span>
                  </Button>
                ) : (
                  <Button
                    variant="destructive"
                    onClick={() => handleGameAction('pause')}
                    disabled={actionLoading !== null}
                    className="h-24 flex-col gap-2"
                  >
                    {actionLoading === 'pause' ? (
                      <RefreshCw className="size-8 animate-spin" />
                    ) : (
                      <Pause className="size-8" />
                    )}
                    <span>Pause System</span>
                  </Button>
                )}

                {/* Force Eruption */}
                <Button
                  onClick={() => handleGameAction('force_eruption')}
                  disabled={actionLoading !== null || stats?.gameState?.phase !== 'filling'}
                  className="h-24 flex-col gap-2 bg-gradient-to-r from-[var(--neon-purple)] to-[var(--neon-cyan)]"
                >
                  {actionLoading === 'force_eruption' ? (
                    <RefreshCw className="size-8 animate-spin" />
                  ) : (
                    <DollarSign className="size-8" />
                  )}
                  <span>Force Eruption</span>
                </Button>

                {/* Extend Waiting */}
                <Button
                  variant="outline"
                  onClick={() => handleGameAction('extend_waiting')}
                  disabled={actionLoading !== null}
                  className="h-24 flex-col gap-2"
                >
                  {actionLoading === 'extend_waiting' ? (
                    <RefreshCw className="size-8 animate-spin" />
                  ) : (
                    <Clock className="size-8" />
                  )}
                  <span>Extend Waiting</span>
                </Button>

                {/* New Round */}
                <Button
                  onClick={() => handleGameAction('new_round')}
                  disabled={actionLoading !== null}
                  className="h-24 flex-col gap-2 bg-gradient-to-r from-[var(--neon-cyan)] to-[var(--neon-purple)]"
                >
                  {actionLoading === 'new_round' ? (
                    <RefreshCw className="size-8 animate-spin" />
                  ) : (
                    <SkipForward className="size-8" />
                  )}
                  <span>New Round</span>
                </Button>
              </div>

              <div className="mt-6 rounded-lg border border-[var(--warning)]/30 bg-[var(--warning)]/10 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 size-5 text-[var(--warning)]" />
                  <div>
                    <p className="font-medium text-[var(--warning)]">Admin Actions</p>
                    <p className="text-muted-foreground mt-1 text-sm">
                      These actions affect ALL users in real-time. Force eruption will immediately pay out all investors.
                      Pausing will stop all investments and the vault fill.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Statistics Tab */}
        <TabsContent value="stats" className="space-y-6">
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
                  <p className="text-muted-foreground text-xs">Registered investors</p>
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
                  <CardTitle className="text-muted-foreground text-sm font-medium">Completed Rounds</CardTitle>
                  <CircleDollarSign className="text-muted-foreground size-5" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.totalRounds || 0}</div>
                  <p className="text-muted-foreground text-xs">Successful eruptions</p>
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
                  <p className="text-muted-foreground text-xs">Total investments today</p>
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

          {/* Financial Overview */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-[var(--border)] bg-card/50">
              <CardHeader>
                <CardTitle className="text-muted-foreground text-sm font-medium">Total Volume</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="neon-text text-3xl font-bold">{formatCurrency(stats?.totalVolume || 0)}</div>
                <p className="text-muted-foreground text-sm">All time investment volume</p>
              </CardContent>
            </Card>

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
          </div>
        </TabsContent>

        {/* Bot Settings Tab */}
        <TabsContent value="bots" className="space-y-6">
          <Card className="border-[var(--border)] bg-card/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="size-5 text-[var(--neon-cyan)]" />
                Smart Bot Configuration
              </CardTitle>
              <CardDescription>
                Bots automatically fill the vault when there are few real users. They back off when more users join.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Bots</Label>
                  <p className="text-muted-foreground text-sm">
                    Turn bot activity on or off
                  </p>
                </div>
                <Switch
                  checked={settings.botsEnabled}
                  onCheckedChange={(checked) => setSettings({ ...settings, botsEnabled: checked })}
                />
              </div>

              <div className="space-y-2">
                <Label>Activity Level</Label>
                <div className="flex gap-2">
                  {['low', 'medium', 'high'].map((level) => (
                    <Button
                      key={level}
                      variant={settings.botActivityLevel === level ? 'default' : 'outline'}
                      onClick={() => setSettings({ ...settings, botActivityLevel: level })}
                      className="flex-1 capitalize"
                    >
                      {level}
                    </Button>
                  ))}
                </div>
                <p className="text-muted-foreground text-xs">
                  {settings.botActivityLevel === 'low' && 'Bots invest occasionally, smaller amounts'}
                  {settings.botActivityLevel === 'medium' && 'Balanced bot activity for steady filling'}
                  {settings.botActivityLevel === 'high' && 'Aggressive bot activity, faster vault fill'}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Bot Reduction Threshold</Label>
                <Input
                  type="number"
                  value={settings.minUsersForBotReduction}
                  onChange={(e) => setSettings({ ...settings, minUsersForBotReduction: e.target.value })}
                  placeholder="5"
                />
                <p className="text-muted-foreground text-xs">
                  When this many real users are investing, bot activity starts decreasing
                </p>
              </div>

              <div className="rounded-lg border border-[var(--neon-cyan)]/30 bg-[var(--neon-cyan)]/10 p-4">
                <p className="text-sm">
                  <strong>How smart bots work:</strong> Bots create realistic-looking activity with Kenyan names. 
                  When few users are investing, bots fill the vault faster. As more real users join, bots 
                  automatically reduce their activity to let users fill naturally. Bots never receive payouts.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Configuration Tab */}
        <TabsContent value="config" className="space-y-6">
          <Card className="border-[var(--border)] bg-card/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="size-5 text-[var(--neon-purple)]" />
                System Configuration
              </CardTitle>
              <CardDescription>Configure investment limits and game parameters</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Minimum Investment (KES)</Label>
                  <Input
                    type="number"
                    value={settings.minInvest}
                    onChange={(e) => setSettings({ ...settings, minInvest: e.target.value })}
                    placeholder="50"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Maximum Investment (KES)</Label>
                  <Input
                    type="number"
                    value={settings.maxInvest}
                    onChange={(e) => setSettings({ ...settings, maxInvest: e.target.value })}
                    placeholder="5000"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Vault Target (KES)</Label>
                  <Input
                    type="number"
                    value={settings.vaultTarget}
                    onChange={(e) => setSettings({ ...settings, vaultTarget: e.target.value })}
                    placeholder="10000"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Profit Percentage (%)</Label>
                  <Input
                    type="number"
                    value={settings.profitPercentage}
                    onChange={(e) => setSettings({ ...settings, profitPercentage: e.target.value })}
                    placeholder="30"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Waiting Duration (seconds)</Label>
                  <Input
                    type="number"
                    value={settings.waitingDuration}
                    onChange={(e) => setSettings({ ...settings, waitingDuration: e.target.value })}
                    placeholder="5"
                  />
                  <p className="text-muted-foreground text-xs">
                    How long the investment window stays open before vault starts filling
                  </p>
                </div>
              </div>

              <Button
                onClick={handleSaveSettings}
                disabled={actionLoading === 'save_settings'}
                className="w-full bg-gradient-to-r from-[var(--neon-cyan)] to-[var(--neon-purple)]"
              >
                {actionLoading === 'save_settings' ? (
                  <>
                    <RefreshCw className="mr-2 size-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Configuration'
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
