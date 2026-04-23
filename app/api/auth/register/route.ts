import { NextRequest, NextResponse } from 'next/server'
import { createUser, findUserByUsername, findUserByEmail, findUserByPhone } from '@/lib/db'
import { 
  hashPassword, 
  generateToken, 
  setAuthCookie,
  isValidUsername,
  isValidEmail,
  isValidKenyanPhone,
  isValidPassword,
  normalizePhone
} from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, email, phone, password } = body

    // Validate required fields
    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      )
    }

    // Validate username
    if (!isValidUsername(username)) {
      return NextResponse.json(
        { error: 'Username must be 3-20 characters, start with a letter, and contain only letters, numbers, and underscores' },
        { status: 400 }
      )
    }

    // Validate password
    if (!isValidPassword(password)) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      )
    }

    // Validate email if provided
    if (email && !isValidEmail(email)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address' },
        { status: 400 }
      )
    }

    // Validate phone if provided
    if (phone && !isValidKenyanPhone(phone)) {
      return NextResponse.json(
        { error: 'Please enter a valid Kenyan phone number (e.g., 0712345678)' },
        { status: 400 }
      )
    }

    // Check if username is taken
    const existingUsername = await findUserByUsername(username)
    if (existingUsername) {
      return NextResponse.json(
        { error: 'This username is already taken' },
        { status: 400 }
      )
    }

    // Check if email is taken
    if (email) {
      const existingEmail = await findUserByEmail(email)
      if (existingEmail) {
        return NextResponse.json(
          { error: 'This email is already registered' },
          { status: 400 }
        )
      }
    }

    // Check if phone is taken
    if (phone) {
      const existingPhone = await findUserByPhone(phone)
      if (existingPhone) {
        return NextResponse.json(
          { error: 'This phone number is already registered' },
          { status: 400 }
        )
      }
    }

    // Hash password and create user
    const passwordHash = await hashPassword(password)
    
    const user = await createUser({
      username,
      email: email || null,
      phone: phone ? normalizePhone(phone) : null,
      password_hash: passwordHash
    })

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
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: 'Registration failed' },
      { status: 500 }
    )
  }
}
