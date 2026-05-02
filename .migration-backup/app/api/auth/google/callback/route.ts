import { NextRequest, NextResponse } from 'next/server'
import {
  createUser,
  findUserByEmail,
  findUserByGoogleId,
  findUserByUsername,
  updateUser,
} from '@/lib/db'
import { generateToken, hashPassword, setAuthCookie } from '@/lib/auth'
import { randomBytes } from 'crypto'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const stateFromGoogle = url.searchParams.get('state')
  const errorParam = url.searchParams.get('error')

  const storedState = request.cookies.get('g_oauth_state')?.value
  const rememberMe = request.cookies.get('g_oauth_remember')?.value === '1'
  const next = request.cookies.get('g_oauth_next')?.value || '/'

  const clearHelpers = (res: NextResponse) => {
    res.cookies.delete('g_oauth_state')
    res.cookies.delete('g_oauth_remember')
    res.cookies.delete('g_oauth_next')
    return res
  }

  if (errorParam) {
    return clearHelpers(NextResponse.redirect(buildRedirect(request, '/?auth=google_cancelled')))
  }

  if (!code || !stateFromGoogle || !storedState || stateFromGoogle !== storedState) {
    return clearHelpers(NextResponse.redirect(buildRedirect(request, '/?auth=google_invalid')))
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return clearHelpers(NextResponse.redirect(buildRedirect(request, '/?auth=google_unconfigured')))
  }

  const baseUrl = getBaseUrl(request)
  const redirectUri = `${baseUrl}/api/auth/google/callback`

  try {
    // Exchange auth code for an access token.
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })
    const tokenData = await tokenRes.json()
    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('Google token exchange failed:', tokenData)
      return clearHelpers(NextResponse.redirect(buildRedirect(request, '/?auth=google_failed')))
    }

    // Load profile.
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })
    const profile = await profileRes.json()
    if (!profile?.sub) {
      return clearHelpers(NextResponse.redirect(buildRedirect(request, '/?auth=google_failed')))
    }

    // Look up or create the user.
    let user = await findUserByGoogleId(profile.sub)
    if (!user && profile.email) {
      // Link to an existing email-based account if one exists.
      user = await findUserByEmail(profile.email)
      if (user) {
        await updateUser(user.id, { google_id: profile.sub, avatar_url: profile.picture || null })
        user = { ...user, google_id: profile.sub, avatar_url: profile.picture || null }
      }
    }

    if (!user) {
      const username = await pickAvailableUsername(profile)
      const passwordHash = await hashPassword(randomBytes(24).toString('hex'))
      user = await createUser({
        username,
        email: profile.email || null,
        phone: null,
        password_hash: passwordHash,
        google_id: profile.sub,
        avatar_url: profile.picture || null,
      })
    }

    if (user.is_banned) {
      return clearHelpers(NextResponse.redirect(buildRedirect(request, '/?auth=banned')))
    }

    const token = generateToken(user, rememberMe)
    await setAuthCookie(token, rememberMe)

    return clearHelpers(NextResponse.redirect(buildRedirect(request, next || '/')))
  } catch (error) {
    console.error('Google OAuth callback error:', error)
    return clearHelpers(NextResponse.redirect(buildRedirect(request, '/?auth=google_failed')))
  }
}

async function pickAvailableUsername(profile: {
  email?: string
  given_name?: string
  name?: string
}): Promise<string> {
  const seedRaw =
    (profile.given_name || profile.name || profile.email?.split('@')[0] || 'player').toString()
  const base = seedRaw
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .replace(/^[^a-z]+/, '')
    .slice(0, 16) || 'player'

  let candidate = base
  let suffix = 0
  // Cap attempts so this can't loop forever.
  while (suffix < 50 && (await findUserByUsername(candidate))) {
    suffix += 1
    const tail = Math.floor(Math.random() * 9000 + 1000).toString()
    candidate = `${base}${tail}`.slice(0, 20)
  }
  return candidate
}

function getBaseUrl(request: NextRequest): string {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL.replace(/\/$/, '')
  const url = new URL(request.url)
  const proto = request.headers.get('x-forwarded-proto') || url.protocol.replace(':', '')
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || url.host
  return `${proto}://${host}`
}

function buildRedirect(request: NextRequest, path: string): string {
  return `${getBaseUrl(request)}${path.startsWith('/') ? path : `/${path}`}`
}
