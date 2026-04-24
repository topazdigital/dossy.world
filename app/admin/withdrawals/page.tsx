"use client"

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  ArrowDownToLine,
  RefreshCw,
  Check,
  X,
  Eye,
  AlertCircle
} from 'lucide-react'
import { toast } from 'sonner'

interface WithdrawalRequest {
  id: string
  user_id: string
  amount: number
  phone: string
  status: string
  admin_notes: string | null
  processed_by: string | null
  mpesa_receipt: string | null
  processed_at: string | null
  created_at: string
  user?: {
    username: string
    balance: number
  }
}

export default function AdminWithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedRequest, setSelectedRequest] = useState<WithdrawalRequest | null>(null)
  const [mpesaReceipt, setMpesaReceipt] = useState('')
  const [adminNotes, setAdminNotes] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [activeTab, setActiveTab] = useState('pending')

  const fetchWithdrawals = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/withdrawals')
      if (response.ok) {
        const data = await response.json()
        setWithdrawals(data.withdrawals)
      }
    } catch (error) {
      console.error('Failed to fetch withdrawals:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchWithdrawals()
    const interval = setInterval(fetchWithdrawals, 3000)
    return () => clearInterval(interval)
  }, [fetchWithdrawals])

  const handleProcess = async (action: 'approve' | 'reject') => {
    if (!selectedRequest) return
    
    setIsProcessing(true)
    try {
      const response = await fetch('/api/admin/withdrawals/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: selectedRequest.id,
          action,
          mpesaReceipt: action === 'approve' ? mpesaReceipt : undefined,
          adminNotes
        })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        toast.success(data.message)
        setSelectedRequest(null)
        setMpesaReceipt('')
        setAdminNotes('')
        fetchWithdrawals()
      } else {
        toast.error(data.error)
      }
    } catch {
      toast.error('Network error')
    } finally {
      setIsProcessing(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE').format(amount)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-KE')
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      pending: 'bg-yellow-500/20 text-yellow-500',
      approved: 'bg-blue-500/20 text-blue-500',
      processing: 'bg-purple-500/20 text-purple-500',
      completed: 'bg-green-500/20 text-green-500',
      rejected: 'bg-red-500/20 text-red-500',
      failed: 'bg-red-500/20 text-red-500'
    }
    return (
      <Badge className={`${variants[status] || 'bg-gray-500/20'} capitalize`}>
        {status}
      </Badge>
    )
  }

  const filteredWithdrawals = withdrawals.filter(w => {
    if (activeTab === 'pending') return w.status === 'pending'
    if (activeTab === 'completed') return w.status === 'completed'
    if (activeTab === 'rejected') return ['rejected', 'failed'].includes(w.status)
    return true
  })

  const pendingCount = withdrawals.filter(w => w.status === 'pending').length
  const pendingTotal = withdrawals
    .filter(w => w.status === 'pending')
    .reduce((sum, w) => sum + w.amount, 0)

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
          <h1 className="text-2xl font-bold">Withdrawal Requests</h1>
          <p className="text-muted-foreground">Process user withdrawal requests</p>
        </div>
        <Button variant="outline" onClick={fetchWithdrawals}>
          <RefreshCw className="mr-2 size-4" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-[var(--border)] bg-card/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Pending Requests</p>
                <p className="text-2xl font-bold">{pendingCount}</p>
              </div>
              <AlertCircle className="size-8 text-[var(--warning)]" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-[var(--border)] bg-card/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Pending Amount</p>
                <p className="text-2xl font-bold">KES {formatCurrency(pendingTotal)}</p>
              </div>
              <ArrowDownToLine className="size-8 text-[var(--neon-cyan)]" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs and Table */}
      <Card className="border-[var(--border)] bg-card/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowDownToLine className="size-5 text-[var(--neon-cyan)]" />
            Withdrawal Requests
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-muted mb-4">
              <TabsTrigger value="pending">
                Pending {pendingCount > 0 && `(${pendingCount})`}
              </TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
              <TabsTrigger value="rejected">Rejected</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab}>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-[var(--border)]">
                      <TableHead>User</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredWithdrawals.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-8 text-center">
                          <p className="text-muted-foreground">No withdrawal requests</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredWithdrawals.map((request, index) => (
                        <motion.tr
                          key={request.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.03 }}
                          className="border-[var(--border)]"
                        >
                          <TableCell className="font-medium">
                            {request.user?.username || 'Unknown'}
                          </TableCell>
                          <TableCell className="font-medium text-[var(--neon-green)]">
                            KES {formatCurrency(request.amount)}
                          </TableCell>
                          <TableCell>{request.phone}</TableCell>
                          <TableCell>{getStatusBadge(request.status)}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {formatDate(request.created_at)}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setSelectedRequest(request)
                                  setMpesaReceipt('')
                                  setAdminNotes('')
                                }}
                              >
                                <Eye className="size-4" />
                              </Button>
                              {request.status === 'pending' && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-green-500"
                                    onClick={() => {
                                      setSelectedRequest(request)
                                      setMpesaReceipt('')
                                      setAdminNotes('')
                                    }}
                                  >
                                    <Check className="size-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-red-500"
                                    onClick={() => {
                                      setSelectedRequest(request)
                                      setAdminNotes('')
                                    }}
                                  >
                                    <X className="size-4" />
                                  </Button>
                                </>
                              )}
                            </div>
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

      {/* Process Dialog */}
      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent className="bg-card border-[var(--border)]">
          <DialogHeader>
            <DialogTitle>Withdrawal Request</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">User</p>
                  <p className="font-medium">{selectedRequest.user?.username}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Amount</p>
                  <p className="font-medium text-[var(--neon-green)]">KES {formatCurrency(selectedRequest.amount)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Phone</p>
                  <p className="font-medium">{selectedRequest.phone}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  {getStatusBadge(selectedRequest.status)}
                </div>
                <div>
                  <p className="text-muted-foreground">Requested</p>
                  <p className="font-medium">{formatDate(selectedRequest.created_at)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">User Balance</p>
                  <p className="font-medium">KES {formatCurrency(selectedRequest.user?.balance || 0)}</p>
                </div>
              </div>

              {selectedRequest.status === 'pending' && (
                <div className="space-y-4 border-t border-[var(--border)] pt-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">M-Pesa Receipt (for approval)</label>
                    <Input
                      placeholder="Enter M-Pesa receipt code"
                      value={mpesaReceipt}
                      onChange={(e) => setMpesaReceipt(e.target.value)}
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Admin Notes</label>
                    <Textarea
                      placeholder="Optional notes..."
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      className="bg-background"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      onClick={() => handleProcess('approve')}
                      disabled={isProcessing}
                    >
                      {isProcessing ? (
                        <RefreshCw className="mr-2 size-4 animate-spin" />
                      ) : (
                        <Check className="mr-2 size-4" />
                      )}
                      Approve
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1"
                      onClick={() => handleProcess('reject')}
                      disabled={isProcessing}
                    >
                      {isProcessing ? (
                        <RefreshCw className="mr-2 size-4 animate-spin" />
                      ) : (
                        <X className="mr-2 size-4" />
                      )}
                      Reject
                    </Button>
                  </div>
                </div>
              )}

              {selectedRequest.mpesa_receipt && (
                <div className="border-t border-[var(--border)] pt-4">
                  <p className="text-muted-foreground text-sm">M-Pesa Receipt</p>
                  <p className="font-mono font-medium">{selectedRequest.mpesa_receipt}</p>
                </div>
              )}

              {selectedRequest.admin_notes && (
                <div className="border-t border-[var(--border)] pt-4">
                  <p className="text-muted-foreground text-sm">Admin Notes</p>
                  <p className="font-medium">{selectedRequest.admin_notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
