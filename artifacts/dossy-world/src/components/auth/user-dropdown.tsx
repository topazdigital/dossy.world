
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/context/auth-context'
import { User, Wallet, Edit, Phone, LogOut, ChevronDown, Shield, Loader2, ArrowDownToLine, TrendingUp, Bitcoin } from 'lucide-react'
import { Link } from 'wouter'

interface UserDropdownProps {
  onDeposit?: () => void
}

interface UpcomingPayout {
  round_id: string
  staked: number
  expected_payout: number
  profit_percentage: number
  fill_percentage: number
}

const apiBase = () => (import.meta as any).env.BASE_URL.replace(/\/$/, '')

export function UserDropdown({ onDeposit }: UserDropdownProps) {
  const { user, logout, updateProfile } = useAuth()
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editField, setEditField] = useState<'username' | 'phone'>('username')
  const [editValue, setEditValue] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState('')
  const [upcoming, setUpcoming] = useState<UpcomingPayout | null>(null)

  useEffect(() => {
    if (!user) return
    const fetchUpcoming = async () => {
      try {
        const res = await fetch(`${apiBase()}/api/user/upcoming-payout`)
        if (res.ok) {
          const data = await res.json()
          setUpcoming(data.upcoming)
        }
      } catch {}
    }
    fetchUpcoming()
    const interval = setInterval(fetchUpcoming, 5000)
    return () => clearInterval(interval)
  }, [user])

  if (!user) return null

  const openEdit = (field: 'username' | 'phone') => {
    setEditField(field)
    setEditValue(field === 'username' ? user.username : user.phone || '')
    setError('')
    setIsEditOpen(true)
  }

  const handleUpdate = async () => {
    setError('')
    setIsUpdating(true)
    try {
      const result = await updateProfile({ [editField]: editValue })
      if (result.success) { setIsEditOpen(false) }
      else { setError(result.error || 'Update failed') }
    } finally {
      setIsUpdating(false)
    }
  }

  const formatBalance = (amount: number) =>
    new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="border-primary/30 bg-card/50 hover:bg-card hover:border-primary/50 gap-2 px-3">
            <div className="flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-[var(--neon-cyan)] to-[var(--neon-purple)]">
              <User className="text-primary-foreground size-4" />
            </div>
            <div className="flex flex-col items-start">
              <span className="text-xs font-medium">{user.username}</span>
              <span className="neon-text-green text-xs font-bold">{formatBalance(user.balance)}</span>
            </div>
            <ChevronDown className="text-muted-foreground size-4" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="border-primary/20 bg-card w-64">
          <DropdownMenuLabel className="flex flex-col">
            <span className="font-semibold">{user.username}</span>
            <span className="text-muted-foreground text-xs font-normal">{user.email || user.phone || 'No contact info'}</span>
          </DropdownMenuLabel>

          <DropdownMenuSeparator className="bg-border/50" />

          <div className="border-primary/20 mx-2 my-2 rounded-lg border bg-gradient-to-r from-[var(--neon-cyan)]/10 to-[var(--neon-purple)]/10 p-3">
            <div className="flex items-center gap-2 mb-3">
              <Wallet className="text-primary size-5" />
              <div>
                <p className="text-muted-foreground text-xs">Balance</p>
                <p className="neon-text text-xl font-bold">{formatBalance(user.balance)}</p>
              </div>
            </div>
            <Button size="sm" className="w-full bg-[var(--neon-green)] text-xs hover:bg-[var(--neon-green)]/80 mb-2" onClick={onDeposit}>
              <ArrowDownToLine className="mr-1 size-3" />
              Deposit via M-Pesa
            </Button>
            {upcoming ? (
              <div className="rounded-lg border border-[var(--neon-cyan)]/30 bg-[var(--neon-cyan)]/5 p-2 text-xs">
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingUp className="size-3 text-[var(--neon-cyan)]" />
                  <span className="font-semibold text-[var(--neon-cyan)]">Upcoming Payout</span>
                  <span className="ml-auto text-muted-foreground">{upcoming.fill_percentage}% full</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Staked: {formatBalance(upcoming.staked)}</span>
                  <span className="text-[var(--neon-green)] font-semibold">→ {formatBalance(upcoming.expected_payout)}</span>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-center text-xs py-1">No active buy in this round</p>
            )}
          </div>

          <DropdownMenuSeparator className="bg-border/50" />

          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => openEdit('username')}>
              <Edit className="size-4" />Edit Username
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openEdit('phone')}>
              <Phone className="size-4" />{user.phone ? 'Change Phone' : 'Add Phone'}
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/crypto" className="flex items-center gap-2 cursor-pointer">
                <Bitcoin className="size-4" />Crypto Deposits
              </Link>
            </DropdownMenuItem>
          </DropdownMenuGroup>

          {user.is_admin && (
            <>
              <DropdownMenuSeparator className="bg-border/50" />
              <DropdownMenuItem asChild>
                <Link href="/admin" className="text-primary flex items-center">
                  <Shield className="size-4" />Admin Dashboard
                </Link>
              </DropdownMenuItem>
            </>
          )}

          <DropdownMenuSeparator className="bg-border/50" />
          <DropdownMenuItem variant="destructive" onClick={() => logout()}>
            <LogOut className="size-4" />Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="border-primary/20 bg-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editField === 'username' ? 'Edit Username' : 'Update Phone Number'}</DialogTitle>
            <DialogDescription>
              {editField === 'username' ? 'Choose a new username for your account' : 'Update your phone number for M-Pesa transactions'}
            </DialogDescription>
          </DialogHeader>
          <AnimatePresence mode="wait">
            {error && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm">{error}</motion.div>
            )}
          </AnimatePresence>
          <div className="space-y-4">
            <div className="relative">
              {editField === 'username' ? (
                <User className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
              ) : (
                <Phone className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
              )}
              <Input type={editField === 'phone' ? 'tel' : 'text'} placeholder={editField === 'username' ? 'New username' : '0712 345 678'}
                value={editValue} onChange={(e) => setEditValue(e.target.value)} className="border-border/50 bg-background/50 pl-10" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={isUpdating || !editValue.trim()}
              className="bg-gradient-to-r from-[var(--neon-cyan)] to-[var(--neon-purple)]">
              {isUpdating ? <><Loader2 className="size-4 animate-spin" />Updating...</> : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
