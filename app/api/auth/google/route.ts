import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'

// Kicks off Google OAuth. We send the user to Google's consent page and
// store an anti-CSRF "state" + "rememberMe" preference in short-lived cookies
// that the callback route reads back.
export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) {
    return NextResponse.json(
      { error: 'Google sign-in is not configured yet. Please try again later.' },
      { status: 503 },
    )
  }

  const url = new URL(request.url)
  const rememberMe = url.searchParams.get('remember') === '1'
  const redirectAfter = url.searchParams.get('next') || '/'

  const baseUrl = getBaseUrl(request)
  const redirectUri = `${baseUrl}/api/auth/google/callback`
  const state = randomBytes(24).toString('hex')

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', 'openid email profile')
  authUrl.searchParams.set('access_type', 'online')
  authUrl.searchParams.set('include_granted_scopes', 'true')
  authUrl.searchParams.set('prompt', 'select_account')
  authUrl.searchParams.set('state', state)

  const response = NextResponse.redirect(authUrl.toString())
  // Short-lived helper cookies (10 min) — sameSite:'none' so they survive the
  // round-trip to Google when the app is served inside an iframe.
  const cookieOpts = {
    httpOnly: true,
    secure: true,
    sameSite: 'none' as const,
    maxAge: 60 * 10,
    path: '/',
  }
  response.cookies.set('g_oauth_state', state, cookieOpts)
  response.cookies.set('g_oauth_remember', rememberMe ? '1' : '0', cookieOpts)
  response.cookies.set('g_oauth_next', redirectAfter, cookieOpts)
  return response
}

function getBaseUrl(request: NextRequest): string {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL.replace(/\/$/, '')
  const url = new URL(request.url)
  // Honour the proxy headers if present (Replit / Vercel use these).
  const proto = request.headers.get('x-forwarded-proto') || url.protocol.replace(':', '')
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || url.host
  return `${proto}://${host}`
}
