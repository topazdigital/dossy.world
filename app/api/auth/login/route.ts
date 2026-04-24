import { NextRequest, NextResponse } from 'next/server'
import { findUserByIdentifier } from '@/lib/db'
import { verifyPassword, generateToken, setAuthCookie } from '@/lib/auth'
import { getClientIp, rateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    // Brute-force protection: 10 login attempts / 5 min / IP.
    const ip = getClientIp(request)
    const rl = rateLimit(`login:${ip}`, 10, 5 * 60 * 1000)
    if (!rl.ok) {
      return NextResponse.json(
        { error: `Too many attempts. Try again in ${rl.retryInSeconds}s.` },
        { status: 429 },
      )
    }

    const body = await request.json()
    const { identifier, password, rememberMe } = body

    if (!identifier || !password) {
      return NextResponse.json(
        { error: 'Please provide your login details' },
        { status: 400 }
      )
    }

    // Find user by username, email, or phone
    const user = await findUserByIdentifier(identifier)

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    if (user.is_banned) {
      return NextResponse.json(
        { error: 'Your account has been suspended' },
        { status: 403 }
      )
    }

    // Verify password
    const isValid = await verifyPassword(password, user.password_hash)

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    // Generate token and set cookie
    const token = generateToken(user, Boolean(rememberMe))
    await setAuthCookie(token, Boolean(rememberMe))

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        balance: user.balance,
        is_admin: user.is_admin
      }
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 }
    )
  }
}
