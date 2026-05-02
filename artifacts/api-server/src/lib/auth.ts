import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import type { Request, Response } from 'express'
import { findUserById, type User } from './db.js'

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is required')
const SESSION_SHORT_DAYS = 1
const SESSION_LONG_DAYS = 30

export interface JWTPayload {
  userId: string
  username: string
  isAdmin: boolean
  iat?: number
  exp?: number
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function generateToken(user: User, rememberMe = false): string {
  const payload: JWTPayload = {
    userId: user.id,
    username: user.username,
    isAdmin: user.is_admin
  }
  const days = rememberMe ? SESSION_LONG_DAYS : SESSION_SHORT_DAYS
  return jwt.sign(payload, JWT_SECRET, { expiresIn: `${days}d` })
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload
  } catch {
    return null
  }
}

export function setAuthCookie(res: Response, token: string, rememberMe = false): void {
  const days = rememberMe ? SESSION_LONG_DAYS : SESSION_SHORT_DAYS
  res.cookie('auth_token', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: 1000 * 60 * 60 * 24 * days,
    path: '/'
  })
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie('auth_token', {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/'
  })
}

export function getAuthToken(req: Request): string | null {
  return req.cookies?.auth_token || null
}

export async function getCurrentUser(req: Request): Promise<User | null> {
  const token = getAuthToken(req)
  if (!token) return null
  const payload = verifyToken(token)
  if (!payload) return null
  const user = await findUserById(payload.userId)
  if (!user || user.is_banned) return null
  return user
}

export async function requireAuth(req: Request): Promise<User> {
  const user = await getCurrentUser(req)
  if (!user) throw new Error('Unauthorized')
  return user
}

export async function requireAdmin(req: Request): Promise<User> {
  const user = await getCurrentUser(req)
  if (!user || !user.is_admin) throw new Error('Unauthorized - Admin access required')
  return user
}

export function normalizePhone(phone: string): string {
  let normalized = phone.replace(/\D/g, '')
  if (normalized.startsWith('0')) {
    normalized = '254' + normalized.substring(1)
  } else if (normalized.startsWith('7') || normalized.startsWith('1')) {
    normalized = '254' + normalized
  } else if (normalized.startsWith('+254')) {
    normalized = normalized.substring(1)
  }
  return normalized
}

export function isValidKenyanPhone(phone: string): boolean {
  const normalized = normalizePhone(phone)
  return /^254[71]\d{8}$/.test(normalized)
}

export function isValidUsername(username: string): boolean {
  return /^[a-zA-Z][a-zA-Z0-9_]{2,19}$/.test(username)
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function isValidPassword(password: string): boolean {
  return password.length >= 6
}

export function getClientIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for']
  if (typeof fwd === 'string') return fwd.split(',')[0].trim()
  const real = req.headers['x-real-ip']
  if (typeof real === 'string') return real
  return req.socket?.remoteAddress || 'unknown'
}
