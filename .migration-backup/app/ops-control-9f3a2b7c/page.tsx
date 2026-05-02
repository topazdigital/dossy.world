"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ShieldCheck, Lock, Loader2, AlertCircle } from 'lucide-react'

export default function AdminGatewayPage() {
  const router = useRouter()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function checkSession() {
      try {
        const res = await fetch('/api/auth/me')
        if (!cancelled && res.ok) {
          const data = await res.json()
          if (data.user?.is_admin) {
            router.replace('/admin')
            return
          }
        }
      } catch {}
      if (!cancelled) setChecking(false)
    }
    checkSession()
    return () => { cancelled = true }
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Invalid credentials')
        setIsSubmitting(false)
        return
      }
      if (!data.user?.is_admin) {
        await fetch('/api/auth/logout', { method: 'POST' })
        setError('This account does not have administrator privileges.')
        setIsSubmitting(false)
        return
      }
      router.replace('/admin')
    } catch {
      setError('Network error. Please try again.')
      setIsSubmitting(false)
    }
  }

  if (checking) {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-[var(--neon-cyan)]" />
      </div>
    )
  }

  return (
    <div className="bg-background relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--neon-purple)_0%,_transparent_45%),radial-gradient(ellipse_at_bottom,_var(--neon-cyan)_0%,_transparent_45%)] opacity-20" />
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative w-full max-w-md"
      >
        <Card className="border-[var(--border)] bg-card/80 backdrop-blur-xl">
          <CardHeader className="space-y-3 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--neon-cyan)] to-[var(--neon-purple)]">
              <ShieldCheck className="text-primary-foreground size-7" />
            </div>
            <CardTitle className="text-2xl">
              <span className="neon-text">Operator Console</span>
            </CardTitle>
            <p className="text-muted-foreground text-sm">
              Restricted area. Authorized personnel only.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="identifier">Username or email</Label>
                <Input
                  id="identifier"
                  type="text"
                  autoComplete="username"
                  required
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  placeholder="admin"
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={isSubmitting}
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-gradient-to-r from-[var(--neon-cyan)] to-[var(--neon-purple)]"
              >
                {isSubmitting ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Lock className="mr-2 size-4" />
                )}
                Sign in to Console
              </Button>

              <p className="text-muted-foreground pt-2 text-center text-xs">
                All access attempts are logged.
              </p>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
