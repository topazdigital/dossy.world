import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Users, CircleDollarSign, TrendingUp, ArrowDownToLine, RefreshCw, Flame, XCircle, Settings as SettingsIcon, ShieldCheck, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'

interface LiveVault {
  id: string; round_number: number; vault_cap: number; profit_percentage: number
  current_amount: number; will_fill: boolean; bot_target_pct: number
  seconds_until_expiry: number | null; real_user_stake: number; bot_stake: number; real_user_count: number
}
interface Stats {
  totalUsers: number; totalRounds: number; pendingWithdrawals: number; totalVolume: number
  todayVolume: number; totalDeposits: number; totalWithdrawals: number
  liveVault: LiveVault | null; tuning: { house_edge_percentage: number; vault_lifetime_seconds: number }
}

const apiBase = () => (import.meta as any).env.BASE_URL.replace(/\/$/, '')

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [defaultCap, setDefaultCap] = useState('')
  const [defaultProfit, setDefaultProfit] = useState('')
  const [houseEdge, setHouseEdge] = useState('')
  const [vaultLifetime, setVaultLifetime] = useState('')

  const fetchStats = async () => {
    try {
      const res = await fetch(`${apiBase()}/api/admin/stats`)
      if (res.ok) {
        const data = await res.json()
        setStats(data)
        if (!defaultCap && data.liveVault) setDefaultCap(String(data.liveVault.vault_cap))
        if (!defaultProfit && data.liveVault) setDefaultProfit(String(data.liveVault.profit_percentage))
        if (!houseEdge && data.tuning) setHouseEdge(String(data.tuning.house_edge_percentage))
        if (!vaultLifetime && data.tuning) setVaultLifetime(String(data.tuning.vault_lifetime_seconds))
      }
    } catch {}
    finally { setIsLoading(false) }
  }

  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 2000)
    return () => clearInterval(interval)
  }, [])

  const callRoundAction = async (action: string, body: Record<string, unknown> = {}) => {
    setActionLoading(action)
    try {
      const res = await fetch(`${apiBase()}/api/admin/round/control`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...body }),
      })
      const data = await res.json()
      if (res.ok) { toast.success(data.message || 'Done'); fetchStats() }
      else toast.error(data.error || 'Operation failed')
    } catch { toast.error('Network error') }
    finally { setActionLoading(null) }
  }

  const fmt = (n: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(n)

  if (isLoading) return <div className="flex min-h-[60vh] items-center justify-center"><div className="size-12 animate-spin rounded-full border-4 border-[var(--neon-cyan)] border-t-transparent" /></div>

  const live = stats?.liveVault
  const fillPct = live ? Math.min(100, (live.current_amount / live.vault_cap) * 100) : 0
  const targetPct = live?.bot_target_pct ?? 100
  const expectedHousePnL = live ? (live.will_fill ? -live.real_user_stake * (live.profit_percentage / 100) : live.real_user_stake) : 0

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><h1 className="text-2xl font-bold">Dashboard</h1><p className="text-muted-foreground">Welcome back, Administrator</p></div>
        <Button variant="outline" onClick={async () => { setIsRefreshing(true); await fetchStats(); setIsRefreshing(false) }} disabled={isRefreshing}>
          <RefreshCw className={`mr-2 size-4 ${isRefreshing ? 'animate-spin' : ''}`} />Refresh
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Total Users', value: stats?.totalUsers || 0, icon: Users, sub: 'Registered players' },
          { label: 'Total Vaults', value: stats?.totalRounds || 0, icon: Flame, sub: 'All-time (filled + expired)' },
          { label: "Today's Volume", value: fmt(stats?.todayVolume || 0), icon: TrendingUp, sub: 'Real-user buys today' },
          { label: 'Pending Withdrawals', value: stats?.pendingWithdrawals || 0, icon: ArrowDownToLine, sub: 'Awaiting approval' },
        ].map(({ label, value, icon: Icon, sub }) => (
          <Card key={label} className="border-[var(--border)] bg-card/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-muted-foreground text-sm font-medium">{label}</CardTitle>
              <Icon className="text-muted-foreground size-5" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{value}</div><p className="text-muted-foreground text-xs">{sub}</p></CardContent>
          </Card>
        ))}
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="border-[var(--border)] bg-card/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CircleDollarSign className="size-5 text-[var(--neon-cyan)]" />Live Vault
              {live && (live.will_fill
                ? <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-[var(--neon-green)]/40 bg-[var(--neon-green)]/10 px-2 py-0.5 text-xs font-semibold text-[var(--neon-green)]"><ShieldAlert className="size-3" />WILL PAY OUT</span>
                : <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-[var(--neon-cyan)]/40 bg-[var(--neon-cyan)]/10 px-2 py-0.5 text-xs font-semibold text-[var(--neon-cyan)]"><ShieldCheck className="size-3" />HOUSE WIN</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {live ? (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div><p className="text-muted-foreground text-xs uppercase">Progress</p><p className="text-lg font-bold">{fmt(live.current_amount)}<span className="text-muted-foreground"> / {fmt(live.vault_cap)}</span></p></div>
                  <div><p className="text-muted-foreground text-xs uppercase">Bot target</p><p className="text-lg font-bold">{targetPct}% of cap</p></div>
                  <div><p className="text-muted-foreground text-xs uppercase">Time left</p><p className="text-lg font-bold tabular-nums">{live.seconds_until_expiry == null ? '—' : `${live.seconds_until_expiry}s`}</p></div>
                  <div><p className="text-muted-foreground text-xs uppercase">Real users in</p><p className="text-lg font-bold">{live.real_user_count} <span className="text-muted-foreground text-sm">({fmt(live.real_user_stake)})</span></p></div>
                </div>
                <div className="relative">
                  <div className="bg-muted h-4 overflow-hidden rounded-full">
                    <div className="h-full bg-gradient-to-r from-[var(--neon-cyan)] to-[var(--neon-green)] transition-all duration-700 ease-out" style={{ width: `${fillPct}%` }} />
                  </div>
                  <div className="pointer-events-none absolute -top-1 h-6 w-px bg-[var(--neon-purple)]" style={{ left: `${targetPct}%` }} />
                </div>
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Fill: {fillPct.toFixed(1)}%</span><span className="text-[var(--neon-purple)]">Bots stop at {targetPct}%</span></div>
                <div className={`rounded-lg border px-4 py-3 text-sm ${expectedHousePnL >= 0 ? 'border-[var(--neon-green)]/30 bg-[var(--neon-green)]/5 text-[var(--neon-green)]' : 'border-destructive/30 bg-destructive/5 text-destructive'}`}>
                  Expected house P&amp;L: <strong>{fmt(expectedHousePnL)}</strong>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button onClick={() => callRoundAction('force_erupt')} disabled={actionLoading !== null} className="bg-gradient-to-r from-[var(--neon-cyan)] to-[var(--neon-purple)]">
                    {actionLoading === 'force_erupt' ? <RefreshCw className="mr-2 size-4 animate-spin" /> : <Flame className="mr-2 size-4" />}Force Erupt (pay out)
                  </Button>
                  <Button onClick={() => callRoundAction('force_expire')} disabled={actionLoading !== null} variant="destructive">
                    {actionLoading === 'force_expire' ? <RefreshCw className="mr-2 size-4 animate-spin" /> : <XCircle className="mr-2 size-4" />}Force Expire (no payout)
                  </Button>
                </div>
              </div>
            ) : <p className="text-muted-foreground py-6 text-center">Engine is initializing the vault…</p>}
          </CardContent>
        </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="border-[var(--border)] bg-card/50">
          <CardHeader><CardTitle className="flex items-center gap-2"><SettingsIcon className="size-5 text-[var(--neon-purple)]" />House Tuning &amp; Defaults</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div><Label>Vault cap (KES)</Label><Input type="number" value={defaultCap} onChange={e => setDefaultCap(e.target.value)} /></div>
              <div><Label>Profit %</Label><Input type="number" value={defaultProfit} onChange={e => setDefaultProfit(e.target.value)} /></div>
              <div><Label>House edge %</Label><Input type="number" min="0" max="95" value={houseEdge} onChange={e => setHouseEdge(e.target.value)} /><p className="text-muted-foreground mt-1 text-xs">% of vaults that silently expire.</p></div>
              <div><Label>Vault lifetime (s)</Label><Input type="number" min="15" value={vaultLifetime} onChange={e => setVaultLifetime(e.target.value)} /></div>
            </div>
            <Button onClick={() => callRoundAction('set_defaults', { vaultCap: parseInt(defaultCap || '0', 10) || undefined, profitPercentage: parseInt(defaultProfit || '0', 10) || undefined, houseEdge, vaultLifetimeSeconds: vaultLifetime })} disabled={actionLoading !== null} className="bg-gradient-to-r from-[var(--neon-purple)] to-[var(--neon-cyan)]">
              {actionLoading === 'set_defaults' ? <RefreshCw className="mr-2 size-4 animate-spin" /> : <SettingsIcon className="mr-2 size-4" />}Save for Upcoming Vaults
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
