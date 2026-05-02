import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { CircleDollarSign, RefreshCw, Eye } from 'lucide-react'

interface Round { id: string; round_number: number; vault_cap: number; profit_percentage: number; current_amount: number; status: string; will_fill?: boolean; bot_target_pct?: number; started_at: string | null; filled_at: string | null; paid_at: string | null; created_at: string; buy_count?: number }

const apiBase = () => (import.meta as any).env.BASE_URL.replace(/\/$/, '')

export default function AdminRoundsPage() {
  const [rounds, setRounds] = useState<Round[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedRound, setSelectedRound] = useState<Round | null>(null)

  const fetchRounds = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase()}/api/admin/rounds`)
      if (res.ok) { const data = await res.json(); setRounds(data.rounds) }
    } catch {} finally { setIsLoading(false) }
  }, [])

  useEffect(() => { fetchRounds(); const i = setInterval(fetchRounds, 3000); return () => clearInterval(i) }, [fetchRounds])

  const fmtNum = (n: number) => new Intl.NumberFormat('en-KE').format(n)
  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleString('en-KE') : '-'

  const statusBadge = (s: string) => {
    const m: Record<string, string> = { waiting: 'bg-yellow-500/20 text-yellow-500', active: 'bg-green-500/20 text-green-500', filled: 'bg-cyan-500/20 text-cyan-500', paid: 'bg-blue-500/20 text-blue-500', expired: 'bg-zinc-500/20 text-zinc-300' }
    return <Badge className={`${m[s] || 'bg-gray-500/20'} capitalize`}>{s}</Badge>
  }

  if (isLoading) return <div className="flex min-h-[60vh] items-center justify-center"><div className="size-12 animate-spin rounded-full border-4 border-[var(--neon-cyan)] border-t-transparent" /></div>

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><h1 className="text-2xl font-bold">Rounds</h1><p className="text-muted-foreground">All game rounds history</p></div>
        <Button variant="outline" onClick={fetchRounds}><RefreshCw className="mr-2 size-4" />Refresh</Button>
      </div>
      <Card className="border-[var(--border)] bg-card/50">
        <CardHeader><CardTitle className="flex items-center gap-2"><CircleDollarSign className="size-5 text-[var(--neon-cyan)]" />All Rounds ({rounds.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow className="border-[var(--border)]"><TableHead>Round</TableHead><TableHead>Status</TableHead><TableHead>Outcome</TableHead><TableHead>Progress</TableHead><TableHead>Profit %</TableHead><TableHead>Buys</TableHead><TableHead>Created</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {rounds.length === 0 ? <TableRow><TableCell colSpan={8} className="py-8 text-center text-muted-foreground">No rounds yet</TableCell></TableRow>
                  : rounds.map((round, i) => (
                    <motion.tr key={round.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="border-[var(--border)]">
                      <TableCell className="font-medium">#{round.round_number}</TableCell>
                      <TableCell>{statusBadge(round.status)}</TableCell>
                      <TableCell>
                        {round.will_fill != null && (round.will_fill
                          ? <Badge className="bg-[var(--neon-green)]/15 text-[var(--neon-green)]">Pay-out</Badge>
                          : <Badge className="bg-[var(--neon-cyan)]/15 text-[var(--neon-cyan)]">House</Badge>)}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="text-sm">KES {fmtNum(round.current_amount)} / {fmtNum(round.vault_cap)}</p>
                          <div className="bg-muted h-2 w-28 overflow-hidden rounded-full"><div className="h-full bg-gradient-to-r from-[var(--neon-cyan)] to-[var(--neon-green)]" style={{ width: `${Math.min((round.current_amount / round.vault_cap) * 100, 100)}%` }} /></div>
                        </div>
                      </TableCell>
                      <TableCell className="text-[var(--neon-green)]">+{round.profit_percentage}%</TableCell>
                      <TableCell>{round.buy_count ?? 0}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{fmtDate(round.created_at)}</TableCell>
                      <TableCell><Button size="sm" variant="ghost" onClick={() => setSelectedRound(round)}><Eye className="size-4" /></Button></TableCell>
                    </motion.tr>
                  ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <Dialog open={!!selectedRound} onOpenChange={() => setSelectedRound(null)}>
        <DialogContent className="bg-card max-w-lg border-[var(--border)]">
          <DialogHeader><DialogTitle>Round #{selectedRound?.round_number} Details</DialogTitle></DialogHeader>
          {selectedRound && (
            <div className="grid grid-cols-2 gap-4 pt-4 text-sm">
              {[['Status', selectedRound.status], ['Profit', `+${selectedRound.profit_percentage}%`], ['Progress', `KES ${fmtNum(selectedRound.current_amount)}`], ['Cap', `KES ${fmtNum(selectedRound.vault_cap)}`], ['Started', fmtDate(selectedRound.started_at)], ['Filled', fmtDate(selectedRound.filled_at)], ['Paid', fmtDate(selectedRound.paid_at)], ['Created', fmtDate(selectedRound.created_at)]].map(([k, v]) => (
                <div key={k}><p className="text-muted-foreground">{k}</p><p className="font-medium">{v}</p></div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
