import { useEffect, useState } from 'react'
import { useLocation, Link } from 'wouter'
import { motion } from 'framer-motion'
import { LayoutDashboard, CircleDollarSign, Users, Settings, Bot, ArrowDownToLine, History, ScrollText, LogOut, Sparkles, Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface AdminUser { id: string; username: string; is_admin: boolean }

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/rounds', label: 'Rounds', icon: CircleDollarSign },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/withdrawals', label: 'Withdrawals', icon: ArrowDownToLine },
  { href: '/admin/bots', label: 'Bots', icon: Bot },
  { href: '/admin/history', label: 'History', icon: History },
  { href: '/admin/audit', label: 'Audit Log', icon: ScrollText },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
]

const apiBase = () => (import.meta as any).env.BASE_URL.replace(/\/$/, '')

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation()
  const [user, setUser] = useState<AdminUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch(`${apiBase()}/api/auth/me`)
        if (res.ok) {
          const data = await res.json()
          if (data.user?.is_admin) { setUser(data.user) }
          else navigate('/')
        } else navigate('/?redirect=/admin')
      } catch { navigate('/?redirect=/admin') }
      finally { setIsLoading(false) }
    }
    checkAuth()
  }, [navigate])

  const handleLogout = async () => {
    await fetch(`${apiBase()}/api/auth/logout`, { method: 'POST' })
    navigate('/')
  }

  if (isLoading) return (
    <div className="bg-background flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="size-12 animate-spin rounded-full border-4 border-[var(--neon-cyan)] border-t-transparent" />
        <p className="text-muted-foreground">Loading admin panel...</p>
      </div>
    </div>
  )
  if (!user) return null

  return (
    <div className="bg-background min-h-screen">
      <header className="bg-card/80 sticky top-0 z-50 flex h-16 items-center justify-between border-b border-[var(--border)] px-4 backdrop-blur-lg lg:hidden">
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--neon-cyan)] to-[var(--neon-purple)]">
            <Sparkles className="text-primary-foreground size-4" />
          </div>
          <span className="neon-text font-bold">Admin</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </Button>
      </header>

      <div className="flex">
        <aside className={cn('fixed inset-y-0 left-0 z-40 w-64 border-r border-[var(--border)] bg-[var(--sidebar)] transition-transform lg:translate-x-0', sidebarOpen ? 'translate-x-0' : '-translate-x-full')}>
          <div className="flex h-full flex-col">
            <div className="flex h-16 items-center gap-3 border-b border-[var(--border)] px-6">
              <div className="flex size-10 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--neon-cyan)] to-[var(--neon-purple)]">
                <Sparkles className="text-primary-foreground size-5" />
              </div>
              <div>
                <h1 className="neon-text font-bold">Dossy World</h1>
                <p className="text-muted-foreground text-xs">Admin Panel</p>
              </div>
            </div>
            <nav className="flex-1 space-y-1 p-4">
              {navItems.map((item) => {
                const isActive = item.exact ? location === item.href : location.startsWith(item.href)
                return (
                  <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)} className={cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all', isActive ? 'bg-[var(--sidebar-accent)] text-[var(--neon-cyan)]' : 'text-muted-foreground hover:bg-[var(--sidebar-accent)] hover:text-foreground')}>
                    <item.icon className="size-5" />
                    {item.label}
                    {isActive && <motion.div layoutId="activeNav" className="ml-auto size-1.5 rounded-full bg-[var(--neon-cyan)]" />}
                  </Link>
                )
              })}
            </nav>
            <div className="border-t border-[var(--border)] p-4">
              <div className="mb-3 flex items-center gap-3">
                <div className="bg-muted flex size-10 items-center justify-center rounded-full">
                  <span className="text-sm font-bold">{user.username.charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="truncate text-sm font-medium">{user.username}</p>
                  <p className="text-muted-foreground text-xs">Administrator</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => navigate('/')}>View Site</Button>
                <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={handleLogout}><LogOut className="size-4" /></Button>
              </div>
            </div>
          </div>
        </aside>

        {sidebarOpen && <div className="bg-background/80 fixed inset-0 z-30 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />}

        <main className="flex-1 lg:ml-64">
          <div className="p-4 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  )
}
