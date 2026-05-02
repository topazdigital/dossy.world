
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/context/auth-context'
import { Loader2, User, Phone, Lock, Mail, ArrowRight, Sparkles } from 'lucide-react'

interface AuthModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (user: { id: string; username: string; is_admin: boolean }) => void
}

type AuthMode = 'login' | 'register'

const apiBase = () => (import.meta as any).env.BASE_URL.replace(/\/$/, '')

export function AuthModal({ open, onOpenChange, onSuccess }: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>('login')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [googleConfigured, setGoogleConfigured] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)

  const [identifier, setIdentifier] = useState('')
  const [username, setUsername] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const { login, register, refreshUser } = useAuth()

  useEffect(() => {
    fetch(`${apiBase()}/api/auth/google-status`)
      .then(r => r.json())
      .then(d => setGoogleConfigured(d.enabled))
      .catch(() => setGoogleConfigured(false))
  }, [])

  useEffect(() => {
    if (!open) return
    const params = new URLSearchParams(window.location.search)
    const authError = params.get('auth_error')
    if (authError) {
      setError(authError === 'account_banned' ? 'This account has been suspended.' : 'Google login failed. Please try again.')
      const url = new URL(window.location.href)
      url.searchParams.delete('auth_error')
      window.history.replaceState({}, '', url.toString())
    } else {
      refreshUser()
    }
  }, [open, refreshUser])

  const resetForm = () => {
    setIdentifier(''); setUsername(''); setPhone(''); setEmail(''); setPassword(''); setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    try {
      if (mode === 'login') {
        const result = await login(identifier, password, rememberMe)
        if (result.success) {
          resetForm(); onOpenChange(false)
          if (onSuccess) {
            const me = await fetch(`${apiBase()}/api/auth/me`).then(r => r.ok ? r.json() : null)
            if (me?.user) onSuccess(me.user)
          }
        } else setError(result.error || 'Login failed')
      } else {
        const result = await register({ username, phone: phone || undefined, email: email || undefined, password })
        if (result.success) { resetForm(); onOpenChange(false) }
        else setError(result.error || 'Registration failed')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogle = () => {
    window.location.href = `${apiBase()}/api/auth/google?remember=${rememberMe ? '1' : '0'}`
  }

  const switchMode = () => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-primary/20 bg-card sm:max-w-md overflow-hidden">
        <div className="bg-primary/10 pointer-events-none absolute -top-32 -right-32 h-64 w-64 rounded-full blur-3xl" />

        <DialogHeader className="relative">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex size-10 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--neon-cyan)] to-[var(--neon-purple)]">
              <Sparkles className="text-primary-foreground size-5" />
            </div>
            <span className="text-lg font-bold tracking-tight">Dossy World</span>
          </div>
          <DialogTitle className="text-2xl">
            {mode === 'login' ? 'Welcome Back' : 'Join the Game'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'login' ? 'Enter your credentials to continue playing' : 'Create an account to start winning'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="relative space-y-4">
          <AnimatePresence mode="wait">
            {error && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm">
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {googleConfigured && (
            <>
              <button type="button" onClick={handleGoogle} disabled={isLoading}
                className="flex w-full items-center justify-center gap-3 rounded-lg border border-border/60 bg-background/40 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-background/70 disabled:opacity-50">
                <GoogleIcon className="size-5" />
                {mode === 'login' ? 'Continue with Google' : 'Sign up with Google'}
              </button>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border/60" />
                or {mode === 'login' ? 'sign in with your details' : 'register with username & password'}
                <span className="h-px flex-1 bg-border/60" />
              </div>
            </>
          )}

          <AnimatePresence mode="wait">
            {mode === 'login' ? (
              <motion.div key="login" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-muted-foreground text-sm font-medium">Username, Email, or Phone</label>
                  <div className="relative">
                    <User className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
                    <Input type="text" placeholder="Enter your username, email, or phone" value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)} className="border-border/50 bg-background/50 pl-10" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-muted-foreground text-sm font-medium">Password</label>
                  <div className="relative">
                    <Lock className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
                    <Input type="password" placeholder="Enter your password" value={password}
                      onChange={(e) => setPassword(e.target.value)} className="border-border/50 bg-background/50 pl-10" required />
                  </div>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground select-none">
                  <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)}
                    className="size-4 cursor-pointer rounded border-border/60 bg-background/40 accent-[var(--neon-cyan)]" />
                  Remember me on this device for 30 days
                </label>
              </motion.div>
            ) : (
              <motion.div key="register" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-muted-foreground text-sm font-medium">Username <span className="text-destructive">*</span></label>
                  <div className="relative">
                    <User className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
                    <Input type="text" placeholder="Choose a unique username" value={username}
                      onChange={(e) => setUsername(e.target.value)} className="border-border/50 bg-background/50 pl-10" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-muted-foreground text-sm font-medium">Phone Number <span className="text-destructive">*</span></label>
                  <div className="relative">
                    <Phone className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
                    <Input type="tel" placeholder="0712 345 678" value={phone}
                      onChange={(e) => setPhone(e.target.value)} className="border-border/50 bg-background/50 pl-10" required />
                  </div>
                  <p className="text-xs text-muted-foreground">Your M-Pesa number. Each phone can only register one account.</p>
                </div>
                <div className="space-y-2">
                  <label className="text-muted-foreground text-sm font-medium">Email (optional)</label>
                  <div className="relative">
                    <Mail className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
                    <Input type="email" placeholder="you@example.com" value={email}
                      onChange={(e) => setEmail(e.target.value)} className="border-border/50 bg-background/50 pl-10" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-muted-foreground text-sm font-medium">Password <span className="text-destructive">*</span></label>
                  <div className="relative">
                    <Lock className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
                    <Input type="password" placeholder="Create a strong password" value={password}
                      onChange={(e) => setPassword(e.target.value)} className="border-border/50 bg-background/50 pl-10" required />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <Button type="submit" className="neon-text w-full bg-gradient-to-r from-[var(--neon-cyan)] to-[var(--neon-purple)] font-semibold" disabled={isLoading}>
            {isLoading ? (
              <><Loader2 className="size-4 animate-spin" />{mode === 'login' ? 'Signing in...' : 'Creating account...'}</>
            ) : (
              <>{mode === 'login' ? 'Sign In' : 'Create Account'}<ArrowRight className="size-4" /></>
            )}
          </Button>

          <div className="text-center">
            <button type="button" onClick={switchMode} className="text-muted-foreground hover:text-primary text-sm transition-colors">
              {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.5 6.5 29.5 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 18.9 13 24 13c3.1 0 5.9 1.2 8 3l5.7-5.7C34.5 6.5 29.5 4.5 24 4.5 16.3 4.5 9.6 8.8 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 43.5c5.3 0 10.2-2 13.9-5.3l-6.4-5.4c-2 1.4-4.6 2.2-7.5 2.2-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.4 39.1 16.1 43.5 24 43.5z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.4 5.7l6.4 5.4C40.8 36.7 43.5 31 43.5 24c0-1.2-.1-2.3-.4-3.5z" />
    </svg>
  )
}
