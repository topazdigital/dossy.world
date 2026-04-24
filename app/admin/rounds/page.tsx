"use client"

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  CircleDollarSign,
  Plus,
  RefreshCw,
  Play,
  Bot,
  Eye
} from 'lucide-react'
import { toast } from 'sonner'

interface Round {
  id: string
  round_number: number
  vault_cap: number
  profit_percentage: number
  current_amount: number
  status: string
  bot_count: number
  will_fill?: boolean
  bot_target_pct?: number
  expires_at?: string | null
  expired_at?: string | null
  started_at: string | null
  filled_at: string | null
  paid_at: string | null
  created_at: string
  buy_count?: number
  total_payout?: number
}

export default function AdminRoundsPage() {
  const [rounds, setRounds] = useState<Round[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [selectedRound, setSelectedRound] = useState<Round | null>(null)
  
  const [newRound, setNewRound] = useState({
    vaultCap: 10000,
    profitPercentage: 30,
    botCount: 5
  })

  const fetchRounds = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/rounds')
      if (response.ok) {
        const data = await response.json()
        setRounds(data.rounds)
      }
    } catch (error) {
      console.error('Failed to fetch rounds:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRounds()
    const interval = setInterval(fetchRounds, 2000)
    return () => clearInterval(interval)
  }, [fetchRounds])

  const handleCreateRound = async () => {
    setIsCreating(true)
    try {
      const response = await fetch('/api/admin/round/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'new',
          ...newRound
        })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        toast.success(`Round #${data.round.round_number} created!`)
        setCreateDialogOpen(false)
        fetchRounds()
      } else {
        toast.error(data.error || 'Failed to create round')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setIsCreating(false)
    }
  }

  const handleStartRound = async (roundId: string) => {
    try {
      const response = await fetch('/api/admin/round/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        toast.success(data.message)
        fetchRounds()
      } else {
        toast.error(data.error)
      }
    } catch {
      toast.error('Network error')
    }
  }

  const handleTriggerBots = async (roundId: string, count: number) => {
    try {
      const response = await fetch('/api/admin/bots/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roundId, count })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        toast.success(`Triggered ${data.scheduledCount} bot buys`)
        fetchRounds()
      } else {
        toast.error(data.error)
      }
    } catch {
      toast.error('Network error')
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE').format(amount)
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleString('en-KE')
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      waiting: 'bg-yellow-500/20 text-yellow-500',
      active: 'bg-green-500/20 text-green-500',
      filled: 'bg-cyan-500/20 text-cyan-500',
      paying: 'bg-purple-500/20 text-purple-500',
      paid: 'bg-blue-500/20 text-blue-500',
      expired: 'bg-zinc-500/20 text-zinc-300',
      cancelled: 'bg-red-500/20 text-red-500'
    }
    return (
      <Badge className={`${variants[status] || 'bg-gray-500/20'} capitalize`}>
        {status}
      </Badge>
    )
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
          <h1 className="text-2xl font-bold">Rounds Management</h1>
          <p className="text-muted-foreground">Create and manage game rounds</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchRounds}>
            <RefreshCw className="mr-2 size-4" />
            Refresh
          </Button>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-[var(--neon-cyan)] to-[var(--neon-purple)]">
                <Plus className="mr-2 size-4" />
                New Round
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-[var(--border)]">
              <DialogHeader>
                <DialogTitle>Create New Round</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Vault Cap (KES)</Label>
                  <Input
                    type="number"
                    value={newRound.vaultCap}
                    onChange={(e) => setNewRound(prev => ({ ...prev, vaultCap: parseInt(e.target.value) || 0 }))}
                    className="bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Profit Percentage (%)</Label>
                  <Input
                    type="number"
                    value={newRound.profitPercentage}
                    onChange={(e) => setNewRound(prev => ({ ...prev, profitPercentage: parseInt(e.target.value) || 0 }))}
                    className="bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Bot Count (for this round)</Label>
                  <Input
                    type="number"
                    value={newRound.botCount}
                    onChange={(e) => setNewRound(prev => ({ ...prev, botCount: parseInt(e.target.value) || 0 }))}
                    className="bg-background"
                  />
                </div>
                <Button
                  className="w-full bg-gradient-to-r from-[var(--neon-cyan)] to-[var(--neon-purple)]"
                  onClick={handleCreateRound}
                  disabled={isCreating}
                >
                  {isCreating ? (
                    <>
                      <RefreshCw className="mr-2 size-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 size-4" />
                      Create Round
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Rounds Table */}
      <Card className="border-[var(--border)] bg-card/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CircleDollarSign className="size-5 text-[var(--neon-cyan)]" />
            All Rounds
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-[var(--border)]">
                  <TableHead>Round</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Profit %</TableHead>
                  <TableHead>Real buys</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rounds.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center">
                      <p className="text-muted-foreground">No rounds yet</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  rounds.map((round, index) => (
                    <motion.tr
                      key={round.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="border-[var(--border)]"
                    >
                      <TableCell className="font-medium">#{round.round_number}</TableCell>
                      <TableCell>{getStatusBadge(round.status)}</TableCell>
                      <TableCell>
                        {round.will_fill ? (
                          <Badge className="bg-[var(--neon-green)]/15 text-[var(--neon-green)]">
                            Pay-out
                          </Badge>
                        ) : (
                          <Badge className="bg-[var(--neon-cyan)]/15 text-[var(--neon-cyan)]">
                            House (cap {round.bot_target_pct ?? '?'}%)
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="text-sm">
                            KES {formatCurrency(round.current_amount)} / {formatCurrency(round.vault_cap)}
                          </p>
                          <div className="bg-muted h-2 w-28 overflow-hidden rounded-full">
                            <div
                              className="h-full bg-gradient-to-r from-[var(--neon-cyan)] to-[var(--neon-green)]"
                              style={{ width: `${Math.min((round.current_amount / round.vault_cap) * 100, 100)}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-[var(--neon-green)]">+{round.profit_percentage}%</TableCell>
                      <TableCell>{round.buy_count ?? 0}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(round.created_at)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {round.status === 'waiting' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleStartRound(round.id)}
                            >
                              <Play className="size-4" />
                            </Button>
                          )}
                          {round.status === 'active' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleTriggerBots(round.id, round.bot_count || 5)}
                            >
                              <Bot className="size-4" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedRound(round)}
                          >
                            <Eye className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </motion.tr>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Round Details Dialog */}
      <Dialog open={!!selectedRound} onOpenChange={() => setSelectedRound(null)}>
        <DialogContent className="bg-card max-w-lg border-[var(--border)]">
          <DialogHeader>
            <DialogTitle>Round #{selectedRound?.round_number} Details</DialogTitle>
          </DialogHeader>
          {selectedRound && (
            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <p className="font-medium capitalize">{selectedRound.status}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Profit</p>
                  <p className="font-medium text-[var(--neon-green)]">+{selectedRound.profit_percentage}%</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Current Amount</p>
                  <p className="font-medium">KES {formatCurrency(selectedRound.current_amount)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Vault Cap</p>
                  <p className="font-medium">KES {formatCurrency(selectedRound.vault_cap)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Bot Count</p>
                  <p className="font-medium">{selectedRound.bot_count}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Fill %</p>
                  <p className="font-medium">{((selectedRound.current_amount / selectedRound.vault_cap) * 100).toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Created</p>
                  <p className="font-medium">{formatDate(selectedRound.created_at)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Started</p>
                  <p className="font-medium">{formatDate(selectedRound.started_at)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Filled</p>
                  <p className="font-medium">{formatDate(selectedRound.filled_at)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Paid</p>
                  <p className="font-medium">{formatDate(selectedRound.paid_at)}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
