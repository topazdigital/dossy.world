// Authentication utilities for Dossy World
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { findUserById, type User } from './db'

const JWT_SECRET = process.env.JWT_SECRET || 'dossy-world-super-secret-key-change-in-production'
const SESSION_SHORT_DAYS = 1   // default session length (no "remember me")
const SESSION_LONG_DAYS = 30   // when the user ticks "remember me"

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

export async function setAuthCookie(token: string, rememberMe = false): Promise<void> {
  const cookieStore = await cookies()
  // sameSite: 'none' + secure makes the cookie work both on a regular HTTPS
  // production domain AND inside the Replit workspace preview iframe.
  const days = rememberMe ? SESSION_LONG_DAYS : SESSION_SHORT_DAYS
  cookieStore.set('auth_token', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: 60 * 60 * 24 * days,
    path: '/'
  })
}

export async function clearAuthCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete('auth_token')
}

export async function getAuthToken(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get('auth_token')?.value || null
}

export async function getCurrentUser(): Promise<User | null> {
  const token = await getAuthToken()
  if (!token) return null
  
  const payload = verifyToken(token)
  if (!payload) return null
  
  const user = await findUserById(payload.userId)
  if (!user || user.is_banned) return null
  
  return user
}

export async function requireAuth(): Promise<User> {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('Unauthorized')
  }
  return user
}

export async function requireAdmin(): Promise<User> {
  const user = await getCurrentUser()
  if (!user || !user.is_admin) {
    throw new Error('Unauthorized - Admin access required')
  }
  return user
}

// Normalize phone number to format: 254XXXXXXXXX
export function normalizePhone(phone: string): string {
  let normalized = phone.replace(/\D/g, '')
  
  // Handle different formats
  if (normalized.startsWith('0')) {
    normalized = '254' + normalized.substring(1)
  } else if (normalized.startsWith('7') || normalized.startsWith('1')) {
    normalized = '254' + normalized
  } else if (normalized.startsWith('+254')) {
    normalized = normalized.substring(1)
  }
  
  return normalized
}

// Validate Kenyan phone number
export function isValidKenyanPhone(phone: string): boolean {
  const normalized = normalizePhone(phone)
  // Kenyan numbers: 254 + 7/1 + 8 digits
  return /^254[71]\d{8}$/.test(normalized)
}

// Validate username
export function isValidUsername(username: string): boolean {
  // 3-20 chars, alphanumeric + underscore, must start with letter
  return /^[a-zA-Z][a-zA-Z0-9_]{2,19}$/.test(username)
}

// Validate email
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// Validate password
export function isValidPassword(password: string): boolean {
  // At least 6 characters
  return password.length >= 6
}
