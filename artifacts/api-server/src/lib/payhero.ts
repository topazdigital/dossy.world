// PayHero payments integration for Dossy World.
// PayHero is an aggregator that lets us trigger M-Pesa STK Push to a customer's
// phone, and the funds settle into our merchant till. Docs:
//   https://backend.payhero.co.ke/api/v2/payments
//
// All credentials are read from environment variables — never hard-coded:
//   PAYHERO_BASIC_AUTH   - Basic <base64(username:password)> string from PayHero
//   PAYHERO_CHANNEL_ID   - Numeric channel ID configured in your PayHero dashboard
//                          (this is what links payments to your till 9867233).
//   PAYHERO_TILL_NUMBER  - Display-only till number shown to users.
//   PAYHERO_CALLBACK_URL - Public HTTPS URL of /api/wallet/callback. Optional.
//   APP_BASE_URL         - Public origin used to build the callback URL when
//                          PAYHERO_CALLBACK_URL is not set.

import { normalizePhone } from './auth.js'
import { getSetting } from './db.js'

const PAYHERO_BASE_URL = 'https://backend.payhero.co.ke/api/v2'

async function getAuthHeader(): Promise<string> {
  const auth = (await getSetting('payhero_basic_auth')) || process.env.PAYHERO_BASIC_AUTH || ''
  if (!auth) return ''
  return auth.startsWith('Basic ') ? auth : `Basic ${auth}`
}

async function getChannelId(): Promise<number> {
  const id = (await getSetting('payhero_channel_id')) || process.env.PAYHERO_CHANNEL_ID || ''
  return Number(id) || 0
}

async function getCallbackUrl(): Promise<string> {
  const override = (await getSetting('payhero_callback_url')) || process.env.PAYHERO_CALLBACK_URL || ''
  if (override) return override
  const base =
    (await getSetting('app_base_url')) ||
    process.env.APP_BASE_URL ||
    (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : '') ||
    'https://dossy.world'
  return `${base.replace(/\/$/, '')}/api/wallet/callback`
}

async function isConfigured(): Promise<boolean> {
  const auth = (await getSetting('payhero_basic_auth')) || process.env.PAYHERO_BASIC_AUTH || ''
  const channelId = (await getSetting('payhero_channel_id')) || process.env.PAYHERO_CHANNEL_ID || ''
  return Boolean(auth && channelId)
}

export interface StkPushRequest {
  phone: string
  amount: number
  accountReference: string
  customerName?: string
}

export interface StkPushResponse {
  success: boolean
  checkoutRequestId?: string
  reference?: string
  status?: string
  error?: string
  customerMessage?: string
}

// Initiate STK Push via PayHero.
export async function initiateStkPush(req: StkPushRequest): Promise<StkPushResponse> {
  const phoneNumber = normalizePhone(req.phone)
  const amount = Math.max(1, Math.round(req.amount))

  // Demo mode if PayHero is not configured — let local development still work.
  if (!(await isConfigured())) {
    const fakeId = `DEMO_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    console.log('[PayHero Demo] STK Push to', phoneNumber, 'KES', amount, '→', fakeId)
    return {
      success: true,
      checkoutRequestId: fakeId,
      reference: req.accountReference,
      status: 'QUEUED',
      customerMessage: 'Demo mode — payment auto-completes in a few seconds.',
    }
  }

  try {
    const payload = {
      amount,
      phone_number: phoneNumber,
      channel_id: await getChannelId(),
      provider: 'm-pesa',
      external_reference: req.accountReference,
      customer_name: req.customerName || 'Dossy World Player',
      callback_url: await getCallbackUrl(),
    }

    const response = await fetch(`${PAYHERO_BASE_URL}/payments`, {
      method: 'POST',
      headers: {
        Authorization: await getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok || data?.success === false) {
      return {
        success: false,
        error:
          data?.error_message ||
          data?.message ||
          data?.error ||
          `PayHero STK push failed (HTTP ${response.status})`,
      }
    }

    // PayHero typically returns { success: true, status, reference, CheckoutRequestID }
    return {
      success: true,
      checkoutRequestId:
        data?.CheckoutRequestID || data?.checkout_request_id || data?.reference || req.accountReference,
      reference: data?.reference || req.accountReference,
      status: data?.status || 'QUEUED',
      customerMessage: 'Check your phone and enter your M-Pesa PIN to complete the payment.',
    }
  } catch (error) {
    console.error('PayHero STK push error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to initiate payment',
    }
  }
}

// Query the status of a previously initiated STK push.
export interface StkQueryResponse {
  success: boolean
  status?: string
  resultDesc?: string
  error?: string
}

export async function queryStkStatus(reference: string): Promise<StkQueryResponse> {
  if (!(await isConfigured())) {
    return { success: true, status: 'SUCCESS', resultDesc: 'Demo mode' }
  }

  try {
    const response = await fetch(
      `${PAYHERO_BASE_URL}/transaction-status?reference=${encodeURIComponent(reference)}`,
      {
        method: 'GET',
        headers: { Authorization: await getAuthHeader() },
      },
    )
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      return { success: false, error: data?.error_message || `HTTP ${response.status}` }
    }
    return {
      success: true,
      status: data?.status,
      resultDesc: data?.ResultDesc || data?.result_desc,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Status query failed',
    }
  }
}

// B2C / withdrawal payout via PayHero.
export interface PayoutRequest {
  phone: string
  amount: number
  reference: string
  remarks?: string
}

export interface PayoutResponse {
  success: boolean
  reference?: string
  status?: string
  error?: string
}

export async function initiatePayout(req: PayoutRequest): Promise<PayoutResponse> {
  const phoneNumber = normalizePhone(req.phone)
  const amount = Math.max(1, Math.round(req.amount))

  if (!(await isConfigured())) {
    return { success: true, reference: req.reference, status: 'QUEUED' }
  }

  try {
    const payload = {
      amount,
      phone_number: phoneNumber,
      channel_id: await getChannelId(),
      external_reference: req.reference,
      callback_url: await getCallbackUrl(),
      remarks: req.remarks || 'Dossy World withdrawal',
    }
    const response = await fetch(`${PAYHERO_BASE_URL}/withdraw`, {
      method: 'POST',
      headers: {
        Authorization: await getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok || data?.success === false) {
      return {
        success: false,
        error: data?.error_message || data?.message || `HTTP ${response.status}`,
      }
    }
    return {
      success: true,
      reference: data?.reference || req.reference,
      status: data?.status || 'QUEUED',
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Payout failed',
    }
  }
}

// Parse a PayHero callback payload. PayHero sends one of two shapes depending
// on the integration; we handle both.
export interface PayHeroCallbackData {
  reference: string | null
  checkoutRequestId: string | null
  status: string
  resultCode: number
  resultDesc: string
  amount?: number
  receiptNumber?: string
  phoneNumber?: string
}

export function parseCallback(body: unknown): PayHeroCallbackData | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = body as any
    const payload = raw?.response || raw?.Body?.stkCallback || raw

    if (!payload) return null

    const status: string = String(payload.Status || payload.status || '').toUpperCase()
    const resultCode = Number(payload.ResultCode ?? payload.result_code ?? (status === 'SUCCESS' ? 0 : 1))
    const resultDesc: string = payload.ResultDesc || payload.result_desc || payload.message || status || 'Unknown'

    const result: PayHeroCallbackData = {
      reference:
        payload.ExternalReference ||
        payload.external_reference ||
        payload.reference ||
        raw?.external_reference ||
        null,
      checkoutRequestId:
        payload.CheckoutRequestID ||
        payload.checkout_request_id ||
        payload.MerchantRequestID ||
        null,
      status: status || (resultCode === 0 ? 'SUCCESS' : 'FAILED'),
      resultCode,
      resultDesc,
      amount: Number(payload.Amount ?? payload.amount) || undefined,
      receiptNumber: payload.MpesaReceiptNumber || payload.mpesa_receipt_number || payload.receipt || undefined,
      phoneNumber: payload.Phone || payload.phone_number || payload.phone || undefined,
    }

    // Also support the classic Safaricom callback metadata array.
    const metaItems = payload?.CallbackMetadata?.Item
    if (Array.isArray(metaItems)) {
      for (const item of metaItems) {
        switch (item.Name) {
          case 'Amount':
            result.amount = Number(item.Value) || result.amount
            break
          case 'MpesaReceiptNumber':
            result.receiptNumber = String(item.Value)
            break
          case 'PhoneNumber':
            result.phoneNumber = String(item.Value)
            break
        }
      }
    }

    return result
  } catch (error) {
    console.error('Failed to parse PayHero callback:', error)
    return null
  }
}
