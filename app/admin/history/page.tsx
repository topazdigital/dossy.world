"use client"

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  History,
  RefreshCw,
  ArrowUpRight,
  ArrowDownLeft
} from 'lucide-react'

interface Transaction {
  id: string
  user_id: string
  type: string
  amount: number
  balance_after: number
  status: string
  description: string | null
  created_at: string
  user?: {
    username: string
  }
}

export default function AdminHistoryPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all')

  const fetchTransactions = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/transactions')
      if (response.ok) {
        const data = await response.json()
        setTransactions(data.transactions)
      }
    } catch (error) {
      console.error('Failed to fetch transactions:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTransactions()
    const interval = setInterval(fetchTransactions, 4000)
    return () => clearInterval(interval)
  }, [fetchTransactions])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE').format(Math.abs(amount))
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-KE')
  }

  const getTypeBadge = (type: string) => {
    const config: Record<string, { color: string; label: string }> = {
      deposit: { color: 'bg-green-500/20 text-green-500', label: 'Deposit' },
      withdrawal: { color: 'bg-red-500/20 text-red-500', label: 'Withdrawal' },
      buy: { color: 'bg-blue-500/20 text-blue-500', label: 'Buy' },
      payout: { color: 'bg-cyan-500/20 text-cyan-500', label: 'Payout' },
      refund: { color: 'bg-yellow-500/20 text-yellow-500', label: 'Refund' },
      admin_credit: { color: 'bg-purple-500/20 text-purple-500', label: 'Admin Credit' },
      admin_debit: { color: 'bg-orange-500/20 text-orange-500', label: 'Admin Debit' }
    }
    const { color, label } = config[type] || { color: 'bg-gray-500/20 text-gray-500', label: type }
    return <Badge className={color}>{label}</Badge>
  }

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      completed: 'bg-green-500/20 text-green-500',
      pending: 'bg-yellow-500/20 text-yellow-500',
      failed: 'bg-red-500/20 text-red-500',
      cancelled: 'bg-gray-500/20 text-gray-500'
    }
    return <Badge className={`${colors[status] || 'bg-gray-500/20'} capitalize`}>{status}</Badge>
  }

  const filteredTransactions = transactions.filter(t => {
    if (activeTab === 'all') return true
    if (activeTab === 'deposits') return t.type === 'deposit'
    if (activeTab === 'withdrawals') return t.type === 'withdrawal'
    if (activeTab === 'buys') return t.type === 'buy'
    if (activeTab === 'payouts') return t.type === 'payout'
    return true
  })

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
          <h1 className="text-2xl font-bold">Transaction History</h1>
          <p className="text-muted-foreground">View all financial transactions</p>
        </div>
        <Button variant="outline" onClick={fetchTransactions}>
          <RefreshCw className="mr-2 size-4" />
          Refresh
        </Button>
      </div>

      {/* Transactions Table */}
      <Card className="border-[var(--border)] bg-card/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="size-5 text-[var(--neon-cyan)]" />
            All Transactions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-muted mb-4">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="deposits">Deposits</TabsTrigger>
              <TabsTrigger value="withdrawals">Withdrawals</TabsTrigger>
              <TabsTrigger value="buys">Buys</TabsTrigger>
              <TabsTrigger value="payouts">Payouts</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab}>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-[var(--border)]">
                      <TableHead>Type</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Balance After</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-8 text-center">
                          <p className="text-muted-foreground">No transactions</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredTransactions.map((tx, index) => (
                        <motion.tr
                          key={tx.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.02 }}
                          className="border-[var(--border)]"
                        >
                          <TableCell>{getTypeBadge(tx.type)}</TableCell>
                          <TableCell className="font-medium">
                            {tx.user?.username || 'System'}
                          </TableCell>
                          <TableCell>
                            <div className={`flex items-center gap-1 font-medium ${
                              tx.amount >= 0 ? 'text-[var(--neon-green)]' : 'text-red-500'
                            }`}>
                              {tx.amount >= 0 ? (
                                <ArrowDownLeft className="size-4" />
                              ) : (
                                <ArrowUpRight className="size-4" />
                              )}
                              KES {formatCurrency(tx.amount)}
                            </div>
                          </TableCell>
                          <TableCell>KES {formatCurrency(tx.balance_after)}</TableCell>
                          <TableCell>{getStatusBadge(tx.status)}</TableCell>
                          <TableCell className="text-muted-foreground max-w-[200px] truncate text-sm">
                            {tx.description || '-'}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {formatDate(tx.created_at)}
                          </TableCell>
                        </motion.tr>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
