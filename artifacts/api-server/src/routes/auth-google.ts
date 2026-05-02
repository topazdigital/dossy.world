import { Router } from 'express'
import { createUser, findUserByGoogleId, findUserByEmail, updateUser, getSetting } from '../lib/db.js'
import { generateToken, setAuthCookie } from '../lib/auth.js'

const router = Router()

async function getGoogleClientId(): Promise<string> {
  return (await getSetting('google_client_id')) || process.env.GOOGLE_CLIENT_ID || ''
}

async function getGoogleClientSecret(): Promise<string> {
  return (await getSetting('google_client_secret')) || process.env.GOOGLE_CLIENT_SECRET || ''
}

async function getFrontendUrl(): Promise<string> {
  return (await getSetting('app_base_url')) || process.env.FRONTEND_URL || process.env.APP_BASE_URL || '/'
}

async function getCallbackUrl(): Promise<string> {
  const base = (await getSetting('app_base_url')) ||
    process.env.APP_BASE_URL ||
    (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : '')
  return `${base.replace(/\/$/, '')}/api/auth/google/callback`
}

router.get('/auth/google', async (req, res) => {
  const clientId = await getGoogleClientId()
  if (!clientId) {
    return res.status(503).json({ error: 'Google login is not configured' })
  }
  const state = req.query.remember === '1' ? 'remember' : 'noremember'
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: await getCallbackUrl(),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'online',
    prompt: 'select_account',
  })
  return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`)
})

router.get('/auth/google/callback', async (req, res) => {
  const { code, state } = req.query as Record<string, string>
  const frontendUrl = await getFrontendUrl()
  const clientId = await getGoogleClientId()
  const clientSecret = await getGoogleClientSecret()

  if (!code || !clientId || !clientSecret) {
    return res.redirect(`${frontendUrl}?auth_error=google_not_configured`)
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: await getCallbackUrl(),
        grant_type: 'authorization_code',
      }).toString(),
    })

    if (!tokenRes.ok) {
      return res.redirect(`${frontendUrl}?auth_error=token_exchange_failed`)
    }

    const tokens = await tokenRes.json() as { access_token?: string; id_token?: string }
    if (!tokens.access_token) {
      return res.redirect(`${frontendUrl}?auth_error=no_access_token`)
    }

    const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })

    if (!profileRes.ok) {
      return res.redirect(`${frontendUrl}?auth_error=profile_fetch_failed`)
    }

    const profile = await profileRes.json() as {
      sub: string
      email?: string
      name?: string
      picture?: string
    }

    let user = await findUserByGoogleId(profile.sub)

    if (!user && profile.email) {
      user = await findUserByEmail(profile.email)
      if (user) {
        await updateUser(user.id, { google_id: profile.sub, avatar_url: profile.picture || null })
        user = { ...user, google_id: profile.sub }
      }
    }

    if (!user) {
      const rawName = (profile.name || profile.email || 'user').replace(/[^a-zA-Z0-9_]/g, '')
      const baseUsername = rawName.slice(0, 16) || 'user'
      const username = `${baseUsername}${Math.floor(Math.random() * 9000) + 1000}`

      user = await createUser({
        username,
        email: profile.email || null,
        phone: null,
        password_hash: '',
        google_id: profile.sub,
        avatar_url: profile.picture || null,
      })
    }

    if (user.is_banned) {
      return res.redirect(`${frontendUrl}?auth_error=account_banned`)
    }

    const rememberMe = state === 'remember'
    const token = generateToken(user, rememberMe)
    setAuthCookie(res, token, rememberMe)

    return res.redirect(frontendUrl)
  } catch (err) {
    console.error('Google OAuth error:', err)
    return res.redirect(`${frontendUrl}?auth_error=unknown`)
  }
})

export default router
