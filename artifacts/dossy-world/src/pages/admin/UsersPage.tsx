import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Users, Search, RefreshCw, Eye, Ban, CircleDollarSign, Plus, Minus } from 'lucide-react'
import { toast } from 'sonner'

interface User { id: string; username: string; email: string | null; phone: string | null; balance: number; is_admin: boolean; is_bot: boolean; is_banned: boolean; created_at: string }

const apiBase = () => (import.meta as any).env.BASE_URL.replace(/\/$/, '')

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [filteredUsers, setFilteredUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [adjustAmount, setAdjustAmount] = useState('')
  const [adjustType, setAdjustType] = useState<'credit' | 'debit'>('credit')
  const [isAdjusting, setIsAdjusting] = useState(false)

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase()}/api/admin/users`)
      if (res.ok) { const data = await res.json(); setUsers(data.users); setFilteredUsers(data.users) }
    } catch {} finally { setIsLoading(false) }
  }, [])

  useEffect(() => { fetchUsers(); const i = setInterval(fetchUsers, 5000); return () => clearInterval(i) }, [fetchUsers])
  useEffect(() => {
    if (searchQuery) setFilteredUsers(users.filter(u => u.username.toLowerCase().includes(searchQuery.toLowerCase()) || u.email?.toLowerCase().includes(searchQuery.toLowerCase()) || u.phone?.includes(searchQuery)))
    else setFilteredUsers(users)
  }, [searchQuery, users])

  const handleBanToggle = async (userId: string, isBanned: boolean) => {
    const res = await fetch(`${apiBase()}/api/admin/users/ban`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, banned: !isBanned }) })
    const data = await res.json()
    if (res.ok) { toast.success(data.message); fetchUsers() } else { toast.error(data.error) }
  }

  const handleAdjustBalance = async () => {
    if (!selectedUser || !adjustAmount) return
    const amount = parseFloat(adjustAmount)
    if (isNaN(amount) || amount <= 0) return toast.error('Invalid amount')
    setIsAdjusting(true)
    try {
      const res = await fetch(`${apiBase()}/api/admin/users/balance`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: selectedUser.id, amount: adjustType === 'credit' ? amount : -amount, type: adjustType }) })
      const data = await res.json()
      if (res.ok) { toast.success(data.message); setSelectedUser(null); setAdjustAmount(''); fetchUsers() } else { toast.error(data.error) }
    } catch { toast.error('Network error') } finally { setIsAdjusting(false) }
  }

  const fmtNum = (n: number) => new Intl.NumberFormat('en-KE').format(n)
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-KE')

  if (isLoading) return <div className="flex min-h-[60vh] items-center justify-center"><div className="size-12 animate-spin rounded-full border-4 border-[var(--neon-cyan)] border-t-transparent" /></div>

  const realUsers = filteredUsers.filter(u => !u.is_bot)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><h1 className="text-2xl font-bold">Users Management</h1><p className="text-muted-foreground">Manage players and their balances</p></div>
        <Button variant="outline" onClick={fetchUsers}><RefreshCw className="mr-2 size-4" />Refresh</Button>
      </div>
      <div className="relative max-w-md"><Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" /><Input placeholder="Search by username, email, or phone..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="bg-background pl-10" /></div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-[var(--border)] bg-card/50"><CardContent className="flex items-center justify-between pt-6"><div><p className="text-muted-foreground text-sm">Total Users</p><p className="text-2xl font-bold">{realUsers.length}</p></div><Users className="size-8 text-[var(--neon-cyan)]" /></CardContent></Card>
        <Card className="border-[var(--border)] bg-card/50"><CardContent className="flex items-center justify-between pt-6"><div><p className="text-muted-foreground text-sm">Banned</p><p className="text-2xl font-bold">{realUsers.filter(u => u.is_banned).length}</p></div><Ban className="size-8 text-red-400" /></CardContent></Card>
        <Card className="border-[var(--border)] bg-card/50"><CardContent className="flex items-center justify-between pt-6"><div><p className="text-muted-foreground text-sm">Total Balance</p><p className="text-2xl font-bold">KES {fmtNum(realUsers.reduce((s, u) => s + u.balance, 0))}</p></div><CircleDollarSign className="size-8 text-[var(--neon-green)]" /></CardContent></Card>
      </div>
      <Card className="border-[var(--border)] bg-card/50">
        <CardHeader><CardTitle className="flex items-center gap-2"><Users className="size-5 text-[var(--neon-cyan)]" />All Users</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow className="border-[var(--border)]"><TableHead>Username</TableHead><TableHead>Contact</TableHead><TableHead>Balance</TableHead><TableHead>Status</TableHead><TableHead>Joined</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {realUsers.length === 0 ? <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No users found</TableCell></TableRow>
                  : realUsers.map((user, i) => (
                    <motion.tr key={user.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="border-[var(--border)]">
                      <TableCell className="font-medium">{user.username}{user.is_admin && <Badge className="ml-2 bg-purple-500/20 text-purple-500">Admin</Badge>}</TableCell>
                      <TableCell><div className="text-muted-foreground text-sm">{user.phone && <p>{user.phone}</p>}{user.email && <p>{user.email}</p>}</div></TableCell>
                      <TableCell className="font-medium">KES {fmtNum(user.balance)}</TableCell>
                      <TableCell>{user.is_banned ? <Badge className="bg-red-500/20 text-red-500">Banned</Badge> : <Badge className="bg-green-500/20 text-green-500">Active</Badge>}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{fmtDate(user.created_at)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => { setSelectedUser(user); setAdjustAmount(''); setAdjustType('credit') }}><Eye className="size-4" /></Button>
                          {!user.is_admin && <Button size="sm" variant="ghost" className={user.is_banned ? 'text-green-500' : 'text-red-500'} onClick={() => handleBanToggle(user.id, user.is_banned)}><Ban className="size-4" /></Button>}
                        </div>
                      </TableCell>
                    </motion.tr>
                  ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent className="bg-card border-[var(--border)]">
          <DialogHeader><DialogTitle>User: {selectedUser?.username}</DialogTitle></DialogHeader>
          {selectedUser && (
            <div className="space-y-6 pt-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-muted-foreground">Email</p><p className="font-medium">{selectedUser.email || '-'}</p></div>
                <div><p className="text-muted-foreground">Phone</p><p className="font-medium">{selectedUser.phone || '-'}</p></div>
                <div><p className="text-muted-foreground">Balance</p><p className="font-medium text-[var(--neon-green)]">KES {fmtNum(selectedUser.balance)}</p></div>
                <div><p className="text-muted-foreground">Status</p><p className="font-medium">{selectedUser.is_banned ? 'Banned' : 'Active'}</p></div>
              </div>
              <div className="border-t border-[var(--border)] pt-4">
                <h4 className="mb-3 font-medium">Adjust Balance</h4>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Button size="sm" variant={adjustType === 'credit' ? 'default' : 'outline'} onClick={() => setAdjustType('credit')} className={adjustType === 'credit' ? 'bg-green-600' : ''}><Plus className="mr-1 size-4" />Credit</Button>
                    <Button size="sm" variant={adjustType === 'debit' ? 'default' : 'outline'} onClick={() => setAdjustType('debit')} className={adjustType === 'debit' ? 'bg-red-600' : ''}><Minus className="mr-1 size-4" />Debit</Button>
                  </div>
                  <div className="flex gap-2">
                    <Input type="number" placeholder="Amount in KES" value={adjustAmount} onChange={e => setAdjustAmount(e.target.value)} className="bg-background" />
                    <Button onClick={handleAdjustBalance} disabled={isAdjusting || !adjustAmount}>{isAdjusting ? <RefreshCw className="size-4 animate-spin" /> : 'Apply'}</Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
