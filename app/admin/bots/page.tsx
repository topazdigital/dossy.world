"use client"

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
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
  Bot,
  RefreshCw,
  Play,
  Settings2,
  Zap
} from 'lucide-react'
import { toast } from 'sonner'

interface BotName {
  id: number
  first_name: string
  last_name: string
  used_count: number
  is_active: boolean
}

interface CurrentRound {
  id: string
  round_number: number
  status: string
  current_amount: number
  vault_cap: number
  bot_count: number
}

export default function AdminBotsPage() {
  const [botNames, setBotNames] = useState<BotName[]>([])
  const [currentRound, setCurrentRound] = useState<CurrentRound | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [botCount, setBotCount] = useState(5)
  const [isTriggering, setIsTriggering] = useState(false)
  const [isBurstTriggering, setIsBurstTriggering] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const [botsRes, roundRes] = await Promise.all([
        fetch('/api/admin/bots'),
        fetch('/api/game/current-round')
      ])
      
      if (botsRes.ok) {
        const data = await botsRes.json()
        setBotNames(data.botNames)
      }
      
      if (roundRes.ok) {
        const data = await roundRes.json()
        setCurrentRound(data.round)
      }
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleTriggerBots = async () => {
    if (!currentRound || currentRound.status !== 'active') {
      toast.error('No active round')
      return
    }
    
    setIsTriggering(true)
    try {
      const response = await fetch('/api/admin/bots/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          roundId: currentRound.id, 
          count: botCount 
        })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        toast.success(`Scheduled ${data.scheduledCount} bot buys`)
        fetchData()
      } else {
        toast.error(data.error)
      }
    } catch {
      toast.error('Network error')
    } finally {
      setIsTriggering(false)
    }
  }

  const handleBurstBots = async () => {
    if (!currentRound || currentRound.status !== 'active') {
      toast.error('No active round')
      return
    }
    
    setIsBurstTriggering(true)
    try {
      const response = await fetch('/api/admin/bots/burst', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roundId: currentRound.id })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        toast.success(`Burst executed: ${data.successfulBuys} buys`)
        fetchData()
      } else {
        toast.error(data.error)
      }
    } catch {
      toast.error('Network error')
    } finally {
      setIsBurstTriggering(false)
    }
  }

  const toggleBotName = async (id: number, currentActive: boolean) => {
    try {
      const response = await fetch('/api/admin/bots/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, active: !currentActive })
      })
      
      if (response.ok) {
        fetchData()
      }
    } catch (error) {
      console.error('Toggle error:', error)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE').format(amount)
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="size-12 animate-spin rounded-full border-4 border-[var(--neon-cyan)] border-t-transparent" />
      </div>
    )
  }

  const activeNames = botNames.filter(b => b.is_active)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Bot Management</h1>
          <p className="text-muted-foreground">Control bot activity and names</p>
        </div>
        <Button variant="outline" onClick={fetchData}>
          <RefreshCw className="mr-2 size-4" />
          Refresh
        </Button>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-[var(--border)] bg-card/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="size-5 text-[var(--neon-cyan)]" />
              Trigger Bot Buys
            </CardTitle>
            <CardDescription>
              Schedule bot buys for the current round
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentRound ? (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Current Round:</span>
                  <span className="font-medium">#{currentRound.round_number}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge className={
                    currentRound.status === 'active' 
                      ? 'bg-green-500/20 text-green-500' 
                      : 'bg-yellow-500/20 text-yellow-500'
                  }>
                    {currentRound.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Progress:</span>
                  <span className="font-medium">
                    KES {formatCurrency(currentRound.current_amount)} / {formatCurrency(currentRound.vault_cap)}
                  </span>
                </div>
                
                <div className="space-y-2 border-t border-[var(--border)] pt-4">
                  <Label>Number of Bots</Label>
                  <Input
                    type="number"
                    value={botCount}
                    onChange={(e) => setBotCount(parseInt(e.target.value) || 0)}
                    min={1}
                    max={20}
                    className="bg-background"
                  />
                </div>
                
                <Button
                  className="w-full bg-gradient-to-r from-[var(--neon-cyan)] to-[var(--neon-purple)]"
                  onClick={handleTriggerBots}
                  disabled={isTriggering || currentRound.status !== 'active'}
                >
                  {isTriggering ? (
                    <>
                      <RefreshCw className="mr-2 size-4 animate-spin" />
                      Scheduling...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 size-4" />
                      Trigger Bots
                    </>
                  )}
                </Button>
              </>
            ) : (
              <p className="text-muted-foreground py-4 text-center">No active round</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-[var(--border)] bg-card/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="size-5 text-[var(--warning)]" />
              Burst Activity
            </CardTitle>
            <CardDescription>
              Trigger multiple rapid bot buys instantly
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Burst mode will trigger 3-6 rapid bot buys in quick succession, 
              creating a sense of activity and urgency.
            </p>
            
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg border border-[var(--border)] p-3 text-center">
                <p className="text-muted-foreground">Active Names</p>
                <p className="text-xl font-bold">{activeNames.length}</p>
              </div>
              <div className="rounded-lg border border-[var(--border)] p-3 text-center">
                <p className="text-muted-foreground">Total Names</p>
                <p className="text-xl font-bold">{botNames.length}</p>
              </div>
            </div>
            
            <Button
              className="w-full"
              variant="outline"
              onClick={handleBurstBots}
              disabled={isBurstTriggering || !currentRound || currentRound.status !== 'active'}
            >
              {isBurstTriggering ? (
                <>
                  <RefreshCw className="mr-2 size-4 animate-spin" />
                  Executing Burst...
                </>
              ) : (
                <>
                  <Zap className="mr-2 size-4" />
                  Execute Burst
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Bot Names */}
      <Card className="border-[var(--border)] bg-card/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="size-5 text-[var(--neon-cyan)]" />
            Bot Names ({activeNames.length} active)
          </CardTitle>
          <CardDescription>
            Manage the pool of bot names used for fake activity
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-[var(--border)]">
                  <TableHead>Name</TableHead>
                  <TableHead>Used Count</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {botNames.map((bot, index) => (
                  <motion.tr
                    key={bot.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02 }}
                    className="border-[var(--border)]"
                  >
                    <TableCell className="font-medium">
                      {bot.first_name} {bot.last_name}
                    </TableCell>
                    <TableCell>{bot.used_count}</TableCell>
                    <TableCell>
                      <Badge className={bot.is_active ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}>
                        {bot.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={bot.is_active}
                        onCheckedChange={() => toggleBotName(bot.id, bot.is_active)}
                      />
                    </TableCell>
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
