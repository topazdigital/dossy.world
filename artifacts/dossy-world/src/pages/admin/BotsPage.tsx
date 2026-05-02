import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Bot, RefreshCw, Play, Settings2, Zap } from 'lucide-react'
import { toast } from 'sonner'

interface BotName { id: number; first_name: string; last_name: string; used_count: number; is_active: boolean }
interface LiveRound { id: string; round_number?: number; status?: string; current_amount?: number; vault_cap?: number }

const apiBase = () => (import.meta as any).env.BASE_URL.replace(/\/$/, '')

export default function AdminBotsPage() {
  const [botNames, setBotNames] = useState<BotName[]>([])
  const [liveRound, setLiveRound] = useState<LiveRound | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [botCount, setBotCount] = useState(5)
  const [isTriggering, setIsTriggering] = useState(false)
  const [isBursting, setIsBursting] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const [botsRes, roundRes] = await Promise.all([fetch(`${apiBase()}/api/admin/bots`), fetch(`${apiBase()}/api/game/current-round`)])
      if (botsRes.ok) { const d = await botsRes.json(); setBotNames(d.botNames) }
      if (roundRes.ok) { const d = await roundRes.json(); setLiveRound(d.active || null) }
    } catch {} finally { setIsLoading(false) }
  }, [])

  useEffect(() => { fetchData(); const i = setInterval(fetchData, 3000); return () => clearInterval(i) }, [fetchData])

  const triggerBots = async () => {
    if (!liveRound) return toast.error('No active round')
    setIsTriggering(true)
    try {
      const res = await fetch(`${apiBase()}/api/admin/bots/trigger`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roundId: liveRound.id, count: botCount }) })
      const data = await res.json()
      if (res.ok) { toast.success(`Scheduled ${data.scheduledCount} bot buys`); fetchData() } else { toast.error(data.error) }
    } catch { toast.error('Network error') } finally { setIsTriggering(false) }
  }

  const burstBots = async () => {
    if (!liveRound) return toast.error('No active round')
    setIsBursting(true)
    try {
      const res = await fetch(`${apiBase()}/api/admin/bots/burst`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roundId: liveRound.id }) })
      const data = await res.json()
      if (res.ok) { toast.success(`Burst: ${data.successfulBuys} buys`); fetchData() } else { toast.error(data.error) }
    } catch { toast.error('Network error') } finally { setIsBursting(false) }
  }

  const toggleBotName = async (id: number, isActive: boolean) => {
    const res = await fetch(`${apiBase()}/api/admin/bots/toggle`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, active: !isActive }) })
    if (res.ok) fetchData()
  }

  const fmtNum = (n: number) => new Intl.NumberFormat('en-KE').format(n)
  const activeNames = botNames.filter(b => b.is_active)
  const roundStatus = liveRound?.status

  if (isLoading) return <div className="flex min-h-[60vh] items-center justify-center"><div className="size-12 animate-spin rounded-full border-4 border-[var(--neon-cyan)] border-t-transparent" /></div>

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><h1 className="text-2xl font-bold">Bot Management</h1><p className="text-muted-foreground">Control bot activity and names</p></div>
        <Button variant="outline" onClick={fetchData}><RefreshCw className="mr-2 size-4" />Refresh</Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-[var(--border)] bg-card/50">
          <CardHeader><CardTitle className="flex items-center gap-2"><Bot className="size-5 text-[var(--neon-cyan)]" />Trigger Bot Buys</CardTitle><CardDescription>Schedule bot buys for the current round</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            {liveRound ? (
              <>
                <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Status:</span><Badge className={roundStatus === 'active' ? 'bg-green-500/20 text-green-500' : 'bg-yellow-500/20 text-yellow-500'}>{roundStatus}</Badge></div>
                {liveRound.vault_cap && <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Progress:</span><span>KES {fmtNum(liveRound.current_amount || 0)} / {fmtNum(liveRound.vault_cap)}</span></div>}
                <div className="space-y-2 border-t border-[var(--border)] pt-4"><Label>Number of Bots</Label><Input type="number" value={botCount} onChange={e => setBotCount(parseInt(e.target.value) || 0)} min={1} max={20} className="bg-background" /></div>
                <Button className="w-full bg-gradient-to-r from-[var(--neon-cyan)] to-[var(--neon-purple)]" onClick={triggerBots} disabled={isTriggering || roundStatus !== 'active'}>
                  {isTriggering ? <><RefreshCw className="mr-2 size-4 animate-spin" />Scheduling...</> : <><Play className="mr-2 size-4" />Trigger Bots</>}
                </Button>
              </>
            ) : <p className="text-muted-foreground py-4 text-center">No active round</p>}
          </CardContent>
        </Card>
        <Card className="border-[var(--border)] bg-card/50">
          <CardHeader><CardTitle className="flex items-center gap-2"><Zap className="size-5 text-[var(--warning)]" />Burst Activity</CardTitle><CardDescription>Trigger multiple rapid bot buys instantly</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm">Burst mode triggers 3-6 rapid bot buys in quick succession.</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg border border-[var(--border)] p-3 text-center"><p className="text-muted-foreground">Active Names</p><p className="text-xl font-bold">{activeNames.length}</p></div>
              <div className="rounded-lg border border-[var(--border)] p-3 text-center"><p className="text-muted-foreground">Total Names</p><p className="text-xl font-bold">{botNames.length}</p></div>
            </div>
            <Button className="w-full" variant="outline" onClick={burstBots} disabled={isBursting || !liveRound || roundStatus !== 'active'}>
              {isBursting ? <><RefreshCw className="mr-2 size-4 animate-spin" />Executing...</> : <><Zap className="mr-2 size-4" />Execute Burst</>}
            </Button>
          </CardContent>
        </Card>
      </div>
      <Card className="border-[var(--border)] bg-card/50">
        <CardHeader><CardTitle className="flex items-center gap-2"><Settings2 className="size-5 text-[var(--neon-cyan)]" />Bot Names ({activeNames.length} active)</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow className="border-[var(--border)]"><TableHead>Name</TableHead><TableHead>Used Count</TableHead><TableHead>Status</TableHead><TableHead>Active</TableHead></TableRow></TableHeader>
              <TableBody>
                {botNames.map((bot, i) => (
                  <motion.tr key={bot.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }} className="border-[var(--border)]">
                    <TableCell className="font-medium">{bot.first_name} {bot.last_name}</TableCell>
                    <TableCell>{bot.used_count}</TableCell>
                    <TableCell><Badge className={bot.is_active ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}>{bot.is_active ? 'Active' : 'Inactive'}</Badge></TableCell>
                    <TableCell><Switch checked={bot.is_active} onCheckedChange={() => toggleBotName(bot.id, bot.is_active)} /></TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
