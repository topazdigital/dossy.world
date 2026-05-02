import { Router } from 'express'
import {
  findUserByIdentifier,
  createUser,
  findUserByUsername,
  findUserByEmail,
  findUserByPhone,
} from '../lib/db.js'
import {
  verifyPassword,
  hashPassword,
  generateToken,
  setAuthCookie,
  clearAuthCookie,
  getCurrentUser,
  normalizePhone,
  isValidKenyanPhone,
  isValidUsername,
  isValidEmail,
  isValidPassword,
  getClientIp,
} from '../lib/auth.js'
import { rateLimit } from '../lib/rate-limit.js'

const router = Router()

router.post('/auth/login', async (req, res) => {
  try {
    const ip = getClientIp(req)
    const rl = rateLimit(`login:${ip}`, 10, 5 * 60 * 1000)
    if (!rl.ok) {
      return res.status(429).json({ error: `Too many attempts. Try again in ${rl.retryInSeconds}s.` })
    }
    const { identifier, password, rememberMe } = req.body
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Please provide your login details' })
    }
    const user = await findUserByIdentifier(identifier)
    if (!user) return res.status(401).json({ error: 'Invalid credentials' })
    if (user.is_banned) return res.status(403).json({ error: 'Your account has been suspended' })
    const isValid = await verifyPassword(password, user.password_hash)
    if (!isValid) return res.status(401).json({ error: 'Invalid credentials' })
    const token = generateToken(user, Boolean(rememberMe))
    setAuthCookie(res, token, Boolean(rememberMe))
    return res.json({
      success: true,
      user: { id: user.id, username: user.username, email: user.email, phone: user.phone, balance: user.balance, is_admin: user.is_admin }
    })
  } catch (err) {
    req.log.error(err)
    return res.status(500).json({ error: 'Login failed' })
  }
})

router.post('/auth/register', async (req, res) => {
  try {
    const { username, email, phone, password } = req.body
    if (!username || !password || !phone) {
      return res.status(400).json({ error: 'Username, phone number and password are all required' })
    }
    if (!isValidUsername(username)) {
      return res.status(400).json({ error: 'Username must be 3-20 characters, start with a letter, and contain only letters, numbers, and underscores' })
    }
    if (!isValidPassword(password)) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' })
    }
    if (email && !isValidEmail(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address' })
    }
    if (!isValidKenyanPhone(phone)) {
      return res.status(400).json({ error: 'Please enter a valid Kenyan phone number (e.g., 0712345678)' })
    }
    const normalizedPhone = normalizePhone(phone)
    const existingUsername = await findUserByUsername(username)
    if (existingUsername) return res.status(400).json({ error: 'This username is already taken' })
    if (email) {
      const existingEmail = await findUserByEmail(email)
      if (existingEmail) return res.status(400).json({ error: 'This email is already registered' })
    }
    const existingPhone = await findUserByPhone(normalizedPhone)
    if (existingPhone) return res.status(400).json({ error: 'This phone number is already registered' })
    const password_hash = await hashPassword(password)
    const user = await createUser({ username, email: email || null, phone: normalizedPhone, password_hash })
    const token = generateToken(user)
    setAuthCookie(res, token)
    return res.json({
      success: true,
      user: { id: user.id, username: user.username, email: user.email, phone: user.phone, balance: user.balance, is_admin: user.is_admin }
    })
  } catch (err) {
    req.log.error(err)
    return res.status(500).json({ error: 'Registration failed' })
  }
})

router.post('/auth/logout', async (req, res) => {
  clearAuthCookie(res)
  return res.json({ success: true })
})

router.get('/auth/google-status', (_req, res) => {
  return res.json({ enabled: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) })
})

router.get('/auth/me', async (req, res) => {
  try {
    const user = await getCurrentUser(req)
    if (!user) return res.status(401).json({ error: 'Not authenticated' })
    return res.json({
      user: { id: user.id, username: user.username, email: user.email, phone: user.phone, balance: user.balance, is_admin: user.is_admin }
    })
  } catch (err) {
    req.log.error(err)
    return res.status(500).json({ error: 'Authentication failed' })
  }
})

export default router
