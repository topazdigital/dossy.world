import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, isValidUsername, isValidKenyanPhone, normalizePhone } from '@/lib/auth'
import { updateUser, findUserByUsername, findUserByPhone } from '@/lib/db'

export async function GET() {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    return NextResponse.json({
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
    console.error('Profile fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { username, phone } = body
    const updates: { username?: string; phone?: string } = {}

    // Validate and check username if provided
    if (username && username !== user.username) {
      if (!isValidUsername(username)) {
        return NextResponse.json(
          { error: 'Username must be 3-20 characters, start with a letter, and contain only letters, numbers, and underscores' },
          { status: 400 }
        )
      }

      const existingUser = await findUserByUsername(username)
      if (existingUser && existingUser.id !== user.id) {
        return NextResponse.json(
          { error: 'This username is already taken' },
          { status: 400 }
        )
      }

      updates.username = username
    }

    // Validate and check phone if provided
    if (phone !== undefined) {
      if (phone === '') {
        updates.phone = ''
      } else if (phone !== user.phone) {
        if (!isValidKenyanPhone(phone)) {
          return NextResponse.json(
            { error: 'Please enter a valid Kenyan phone number' },
            { status: 400 }
          )
        }

        const normalizedPhone = normalizePhone(phone)
        const existingUser = await findUserByPhone(normalizedPhone)
        if (existingUser && existingUser.id !== user.id) {
          return NextResponse.json(
            { error: 'This phone number is already registered' },
            { status: 400 }
          )
        }

        updates.phone = normalizedPhone
      }
    }

    // Update user if there are changes
    if (Object.keys(updates).length > 0) {
      const updatedUser = await updateUser(user.id, updates)
      
      if (!updatedUser) {
        return NextResponse.json(
          { error: 'Failed to update profile' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        user: {
          id: updatedUser.id,
          username: updatedUser.username,
          email: updatedUser.email,
          phone: updatedUser.phone,
          balance: updatedUser.balance,
          is_admin: updatedUser.is_admin
        }
      })
    }

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
    console.error('Profile update error:', error)
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    )
  }
}
