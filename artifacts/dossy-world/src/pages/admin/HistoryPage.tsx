import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { History, RefreshCw } from 'lucide-react'

interface Transaction { id: string; user_id: string; type: string; amount: number; balance_after: number; status: string; description: string | null; created_at: string; user?: { username: string } }

const apiBase = () => (import.meta as any).env.BASE_URL.replace(/\/$/, '')

export default function AdminHistoryPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all')

  const fetchTransactions = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase()}/api/admin/transactions`)
      if (res.ok) { const data = await res.json(); setTransactions(data.transactions) }
    } catch {} finally { setIsLoading(false) }
  }, [])

  useEffect(() => { fetchTransactions(); const i = setInterval(fetchTransactions, 5000); return () => clearInterval(i) }, [fetchTransactions])

  const fmtNum = (n: number) => new Intl.NumberFormat('en-KE').format(Math.abs(n))
  const fmtDate = (d: string) => new Date(d).toLocaleString('en-KE')

  const typeBadge = (type: string) => {
    const m: Record<string, string> = { deposit: 'bg-green-500/20 text-green-500', withdrawal: 'bg-red-500/20 text-red-500', buy: 'bg-blue-500/20 text-blue-500', payout: 'bg-purple-500/20 text-purple-500', refund: 'bg-yellow-500/20 text-yellow-500' }
    return <Badge className={`${m[type] || 'bg-gray-500/20'} capitalize`}>{type.replace('_', ' ')}</Badge>
  }

  const filtered = transactions.filter(t => activeTab === 'all' ? true : t.type === activeTab)

  if (isLoading) return <div className="flex min-h-[60vh] items-center justify-center"><div className="size-12 animate-spin rounded-full border-4 border-[var(--neon-cyan)] border-t-transparent" /></div>

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><h1 className="text-2xl font-bold flex items-center gap-2"><History className="size-6" />Transaction History</h1><p className="text-muted-foreground">All platform transactions</p></div>
        <Button variant="outline" onClick={fetchTransactions}><RefreshCw className="mr-2 size-4" />Refresh</Button>
      </div>
      <Card className="border-[var(--border)] bg-card/50">
        <CardHeader><CardTitle>Transactions ({transactions.length})</CardTitle></CardHeader>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="px-6 pb-6">
          <TabsList className="bg-muted mb-4"><TabsTrigger value="all">All</TabsTrigger><TabsTrigger value="deposit">Deposits</TabsTrigger><TabsTrigger value="withdrawal">Withdrawals</TabsTrigger><TabsTrigger value="buy">Buys</TabsTrigger><TabsTrigger value="payout">Payouts</TabsTrigger></TabsList>
          <TabsContent value={activeTab}>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow className="border-[var(--border)]"><TableHead>User</TableHead><TableHead>Type</TableHead><TableHead>Amount</TableHead><TableHead>Balance After</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
                <TableBody>
                  {filtered.length === 0 ? <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No transactions</TableCell></TableRow>
                    : filtered.map((tx, i) => (
                      <motion.tr key={tx.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }} className="border-[var(--border)]">
                        <TableCell className="font-medium">{tx.user?.username || 'Unknown'}</TableCell>
                        <TableCell>{typeBadge(tx.type)}</TableCell>
                        <TableCell className={tx.amount > 0 ? 'text-[var(--neon-green)] font-medium' : 'font-medium'}>{tx.amount > 0 ? '+' : '-'}KES {fmtNum(tx.amount)}</TableCell>
                        <TableCell>KES {fmtNum(tx.balance_after)}</TableCell>
                        <TableCell><Badge variant={tx.status === 'completed' ? 'default' : 'secondary'}>{tx.status}</Badge></TableCell>
                        <TableCell className="text-muted-foreground text-sm">{fmtDate(tx.created_at)}</TableCell>
                      </motion.tr>
                    ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  )
}
