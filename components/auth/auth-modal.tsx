"use client"

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/context/auth-context'
import { Loader2, User, Phone, Lock, Mail, ArrowRight, Sparkles } from 'lucide-react'

interface AuthModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type AuthMode = 'login' | 'register'

export function AuthModal({ open, onOpenChange }: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>('login')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  
  // Form fields
  const [identifier, setIdentifier] = useState('')
  const [username, setUsername] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  
  const { login, register } = useAuth()

  const resetForm = () => {
    setIdentifier('')
    setUsername('')
    setPhone('')
    setEmail('')
    setPassword('')
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      if (mode === 'login') {
        const result = await login(identifier, password)
        if (result.success) {
          resetForm()
          onOpenChange(false)
        } else {
          setError(result.error || 'Login failed')
        }
      } else {
        const result = await register({
          username,
          phone: phone || undefined,
          email: email || undefined,
          password
        })
        if (result.success) {
          resetForm()
          onOpenChange(false)
        } else {
          setError(result.error || 'Registration failed')
        }
      }
    } finally {
      setIsLoading(false)
    }
  }

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login')
    setError('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-primary/20 bg-card sm:max-w-md overflow-hidden">
        {/* Glow effect */}
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
            {mode === 'login' 
              ? 'Enter your credentials to continue playing' 
              : 'Create an account to start winning'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="relative space-y-4">
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {mode === 'login' ? (
              <motion.div
                key="login"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <label className="text-muted-foreground text-sm font-medium">
                    Username, Email, or Phone
                  </label>
                  <div className="relative">
                    <User className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
                    <Input
                      type="text"
                      placeholder="Enter your username, email, or phone"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      className="border-border/50 bg-background/50 pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-muted-foreground text-sm font-medium">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
                    <Input
                      type="password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="border-border/50 bg-background/50 pl-10"
                      required
                    />
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="register"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <label className="text-muted-foreground text-sm font-medium">
                    Username <span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <User className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
                    <Input
                      type="text"
                      placeholder="Choose a unique username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="border-border/50 bg-background/50 pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-muted-foreground text-sm font-medium">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
                    <Input
                      type="tel"
                      placeholder="0712 345 678"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="border-border/50 bg-background/50 pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-muted-foreground text-sm font-medium">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="border-border/50 bg-background/50 pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-muted-foreground text-sm font-medium">
                    Password <span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
                    <Input
                      type="password"
                      placeholder="Create a strong password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="border-border/50 bg-background/50 pl-10"
                      required
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <Button
            type="submit"
            className="neon-text w-full bg-gradient-to-r from-[var(--neon-cyan)] to-[var(--neon-purple)] font-semibold"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {mode === 'login' ? 'Signing in...' : 'Creating account...'}
              </>
            ) : (
              <>
                {mode === 'login' ? 'Sign In' : 'Create Account'}
                <ArrowRight className="size-4" />
              </>
            )}
          </Button>

          <div className="text-center">
            <button
              type="button"
              onClick={switchMode}
              className="text-muted-foreground hover:text-primary text-sm transition-colors"
            >
              {mode === 'login' 
                ? "Don't have an account? Sign up" 
                : 'Already have an account? Sign in'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
