import { NextRequest, NextResponse } from 'next/server'
import { findUserByIdentifier } from '@/lib/db'
import { verifyPassword, generateToken, setAuthCookie } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { identifier, password } = body

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
    const token = generateToken(user)
    await setAuthCookie(token)

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
