"use client"

import { useState, useEffect } from 'react'
import { useAuth } from '@/context/auth-context'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  ArrowLeft, 
  TrendingUp, 
  TrendingDown, 
  ArrowUpFromLine, 
  ArrowDownToLine,
  History,
  Wallet,
  Gamepad2,
  Loader2
} from 'lucide-react'
import Link from 'next/link'

interface Transaction {
  id: string
  type: 'deposit' | 'withdrawal' | 'buy' | 'payout' | 'refund' | 'admin_credit' | 'admin_debit'
  amount: number
  balance_after: number
  status: string
  description: string | null
  created_at: string
}

interface Buy {
  id: string
  round_id: string
  amount: number
  payout_amount: number | null
  is_paid: boolean
  created_at: string
  round?: {
    round_number: number
    profit_percentage: number
    status: string
  }
}

export default function HistoryPage() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [buys, setBuys] = useState<Buy[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/')
    }
  }, [authLoading, user, router])

  useEffect(() => {
    if (user) {
      fetchHistory()
    }
  }, [user])

  const fetchHistory = async () => {
    setIsLoading(true)
    try {
      const [txRes, buysRes] = await Promise.all([
        fetch('/api/user/transactions'),
        fetch('/api/user/buys')
      ])

      if (txRes.ok) {
        const txData = await txRes.json()
        setTransactions(txData.transactions || [])
      }

      if (buysRes.ok) {
        const buysData = await buysRes.json()
        setBuys(buysData.buys || [])
      }
    } catch (error) {
      console.error('Failed to fetch history:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0
    }).format(amount)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-KE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'deposit':
      case 'admin_credit':
        return <ArrowDownToLine className="size-4 text-[var(--neon-green)]" />
      case 'withdrawal':
      case 'admin_debit':
        return <ArrowUpFromLine className="size-4 text-[var(--warning)]" />
      case 'buy':
        return <Gamepad2 className="size-4 text-[var(--neon-cyan)]" />
      case 'payout':
        return <TrendingUp className="size-4 text-[var(--neon-green)]" />
      default:
        return <Wallet className="size-4 text-muted-foreground" />
    }
  }

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="text-primary size-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-[var(--border)]/50 bg-[var(--background)]/80 backdrop-blur-lg">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-4 px-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <History className="text-primary size-5" />
            <h1 className="text-lg font-semibold">History</h1>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-3xl px-4 py-6">
        {/* Balance Summary */}
        <Card className="border-primary/20 bg-card/50 mb-6">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-muted-foreground text-sm">Current Balance</p>
              <p className="neon-text text-2xl font-bold">{formatAmount(user.balance)}</p>
            </div>
            <div className="flex size-12 items-center justify-center rounded-full bg-gradient-to-br from-[var(--neon-cyan)]/20 to-[var(--neon-purple)]/20">
              <Wallet className="text-primary size-6" />
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="transactions" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="buys">Game History</TabsTrigger>
          </TabsList>

          <TabsContent value="transactions" className="space-y-3">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="text-primary size-6 animate-spin" />
              </div>
            ) : transactions.length === 0 ? (
              <Card className="border-border/50 bg-card/50">
                <CardContent className="py-8 text-center">
                  <History className="text-muted-foreground mx-auto mb-2 size-8" />
                  <p className="text-muted-foreground">No transactions yet</p>
                </CardContent>
              </Card>
            ) : (
              <AnimatePresence>
                {transactions.map((tx, index) => (
                  <motion.div
                    key={tx.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="border-border/50 bg-card/50">
                      <CardContent className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex size-10 items-center justify-center rounded-full bg-background">
                            {getTransactionIcon(tx.type)}
                          </div>
                          <div>
                            <p className="font-medium capitalize">{tx.type.replace('_', ' ')}</p>
                            <p className="text-muted-foreground text-xs">
                              {tx.description || formatDate(tx.created_at)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-semibold ${
                            tx.amount > 0 ? 'text-[var(--neon-green)]' : 'text-foreground'
                          }`}>
                            {tx.amount > 0 ? '+' : ''}{formatAmount(tx.amount)}
                          </p>
                          <Badge 
                            variant={tx.status === 'completed' ? 'default' : 'secondary'}
                            className="text-[10px]"
                          >
                            {tx.status}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </TabsContent>

          <TabsContent value="buys" className="space-y-3">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="text-primary size-6 animate-spin" />
              </div>
            ) : buys.length === 0 ? (
              <Card className="border-border/50 bg-card/50">
                <CardContent className="py-8 text-center">
                  <Gamepad2 className="text-muted-foreground mx-auto mb-2 size-8" />
                  <p className="text-muted-foreground">No game history yet</p>
                </CardContent>
              </Card>
            ) : (
              <AnimatePresence>
                {buys.map((buy, index) => (
                  <motion.div
                    key={buy.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="border-border/50 bg-card/50">
                      <CardContent className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-[var(--neon-cyan)]/20 to-[var(--neon-purple)]/20">
                            <Gamepad2 className="text-primary size-5" />
                          </div>
                          <div>
                            <p className="font-medium">
                              Round #{buy.round?.round_number || '?'}
                            </p>
                            <p className="text-muted-foreground text-xs">
                              Buy: {formatAmount(buy.amount)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          {buy.is_paid && buy.payout_amount ? (
                            <>
                              <p className="font-semibold text-[var(--neon-green)]">
                                +{formatAmount(buy.payout_amount - buy.amount)}
                              </p>
                              <Badge className="bg-[var(--neon-green)]/20 text-[10px] text-[var(--neon-green)]">
                                Paid
                              </Badge>
                            </>
                          ) : (
                            <>
                              <p className="text-muted-foreground font-semibold">
                                Pending
                              </p>
                              <Badge variant="secondary" className="text-[10px]">
                                In Progress
                              </Badge>
                            </>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
