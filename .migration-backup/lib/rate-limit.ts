// Tiny in-memory sliding-window rate limiter and per-key counter.
// Resets on server restart — sufficient for an early-stage single-server app.

import type { NextRequest } from 'next/server'

interface Hit {
  count: number
  resetAt: number
}

const buckets = new Map<string, Hit>()
const counters = new Map<string, number>()

export function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  const real = req.headers.get('x-real-ip')
  if (real) return real
  return 'unknown'
}

// Returns { ok, remaining, retryInSeconds }. ok=false means caller should
// reject with 429.
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: boolean; remaining: number; retryInSeconds: number } {
  const now = Date.now()
  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, remaining: limit - 1, retryInSeconds: Math.ceil(windowMs / 1000) }
  }
  if (bucket.count >= limit) {
    return { ok: false, remaining: 0, retryInSeconds: Math.ceil((bucket.resetAt - now) / 1000) }
  }
  bucket.count += 1
  return {
    ok: true,
    remaining: limit - bucket.count,
    retryInSeconds: Math.ceil((bucket.resetAt - now) / 1000),
  }
}

// Per-key incremental counter. Used for "how much KES has IP X staked in
// round Y" — caller decides how to key. No expiry; cleared on server restart
// or via clearCounter.
export function addToCounter(key: string, delta: number): number {
  const next = (counters.get(key) || 0) + delta
  counters.set(key, next)
  return next
}
export function getCounter(key: string): number {
  return counters.get(key) || 0
}
export function clearCounter(key: string): void {
  counters.delete(key)
}
// Periodic best-effort cleanup of round counters older than ~1h.
const counterCreatedAt = new Map<string, number>()
export function touchCounter(key: string) {
  if (!counterCreatedAt.has(key)) counterCreatedAt.set(key, Date.now())
}
setInterval(() => {
  const cutoff = Date.now() - 60 * 60 * 1000
  for (const [k, t] of counterCreatedAt) {
    if (t < cutoff) {
      counters.delete(k)
      counterCreatedAt.delete(k)
    }
  }
}, 10 * 60 * 1000).unref?.()
