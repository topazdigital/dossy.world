// M-Pesa STK Push Integration for Dossy World
// Placeholder implementation - replace credentials in production

import { normalizePhone } from './auth'

// M-Pesa configuration (use environment variables in production)
const MPESA_CONFIG = {
  consumerKey: process.env.MPESA_CONSUMER_KEY || 'YOUR_CONSUMER_KEY',
  consumerSecret: process.env.MPESA_CONSUMER_SECRET || 'YOUR_CONSUMER_SECRET',
  shortcode: process.env.MPESA_SHORTCODE || '174379', // Sandbox shortcode
  passkey: process.env.MPESA_PASSKEY || 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919', // Sandbox passkey
  callbackUrl: process.env.MPESA_CALLBACK_URL || 'https://dossy.world/api/wallet/callback',
  environment: process.env.MPESA_ENVIRONMENT || 'sandbox' // 'sandbox' or 'production'
}

const BASE_URL = MPESA_CONFIG.environment === 'production' 
  ? 'https://api.safaricom.co.ke'
  : 'https://sandbox.safaricom.co.ke'

// Generate access token
async function getAccessToken(): Promise<string> {
  const auth = Buffer.from(`${MPESA_CONFIG.consumerKey}:${MPESA_CONFIG.consumerSecret}`).toString('base64')
  
  try {
    const response = await fetch(`${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`
      }
    })
    
    if (!response.ok) {
      throw new Error('Failed to get M-Pesa access token')
    }
    
    const data = await response.json()
    return data.access_token
  } catch (error) {
    console.error('M-Pesa auth error:', error)
    // Return mock token for demo
    return 'MOCK_ACCESS_TOKEN'
  }
}

// Generate password for STK Push
function generatePassword(): { password: string; timestamp: string } {
  const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14)
  const password = Buffer.from(`${MPESA_CONFIG.shortcode}${MPESA_CONFIG.passkey}${timestamp}`).toString('base64')
  return { password, timestamp }
}

export interface StkPushRequest {
  phone: string
  amount: number
  accountReference: string
  transactionDesc: string
}

export interface StkPushResponse {
  success: boolean
  checkoutRequestId?: string
  merchantRequestId?: string
  responseCode?: string
  responseDescription?: string
  customerMessage?: string
  error?: string
}

// Initiate STK Push (Lipa na M-Pesa Online)
export async function initiateStkPush(request: StkPushRequest): Promise<StkPushResponse> {
  const normalizedPhone = normalizePhone(request.phone)
  const { password, timestamp } = generatePassword()
  
  // Check if using placeholder credentials (demo mode)
  if (MPESA_CONFIG.consumerKey === 'YOUR_CONSUMER_KEY') {
    // Demo mode - simulate successful STK push
    console.log('[Demo Mode] Simulating STK Push to:', normalizedPhone, 'Amount:', request.amount)
    
    return {
      success: true,
      checkoutRequestId: `DEMO_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      merchantRequestId: `DEMO_MR_${Date.now()}`,
      responseCode: '0',
      responseDescription: 'Success. Request accepted for processing',
      customerMessage: 'Success. Request accepted for processing'
    }
  }
  
  try {
    const accessToken = await getAccessToken()
    
    const payload = {
      BusinessShortCode: MPESA_CONFIG.shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.round(request.amount),
      PartyA: normalizedPhone,
      PartyB: MPESA_CONFIG.shortcode,
      PhoneNumber: normalizedPhone,
      CallBackURL: MPESA_CONFIG.callbackUrl,
      AccountReference: request.accountReference || 'DossyWorld',
      TransactionDesc: request.transactionDesc || 'Deposit to Dossy World'
    }
    
    const response = await fetch(`${BASE_URL}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })
    
    const data = await response.json()
    
    if (data.ResponseCode === '0') {
      return {
        success: true,
        checkoutRequestId: data.CheckoutRequestID,
        merchantRequestId: data.MerchantRequestID,
        responseCode: data.ResponseCode,
        responseDescription: data.ResponseDescription,
        customerMessage: data.CustomerMessage
      }
    } else {
      return {
        success: false,
        responseCode: data.ResponseCode,
        responseDescription: data.ResponseDescription,
        error: data.errorMessage || 'STK Push failed'
      }
    }
  } catch (error) {
    console.error('STK Push error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to initiate payment'
    }
  }
}

export interface StkQueryRequest {
  checkoutRequestId: string
}

export interface StkQueryResponse {
  success: boolean
  resultCode?: string
  resultDesc?: string
  error?: string
}

// Query STK Push status
export async function queryStkStatus(request: StkQueryRequest): Promise<StkQueryResponse> {
  const { password, timestamp } = generatePassword()
  
  // Demo mode
  if (MPESA_CONFIG.consumerKey === 'YOUR_CONSUMER_KEY') {
    return {
      success: true,
      resultCode: '0',
      resultDesc: 'The service request is processed successfully.'
    }
  }
  
  try {
    const accessToken = await getAccessToken()
    
    const payload = {
      BusinessShortCode: MPESA_CONFIG.shortcode,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: request.checkoutRequestId
    }
    
    const response = await fetch(`${BASE_URL}/mpesa/stkpushquery/v1/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })
    
    const data = await response.json()
    
    return {
      success: data.ResultCode === '0',
      resultCode: data.ResultCode,
      resultDesc: data.ResultDesc
    }
  } catch (error) {
    console.error('STK Query error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to query status'
    }
  }
}

export interface B2CRequest {
  phone: string
  amount: number
  remarks: string
  occasion?: string
}

export interface B2CResponse {
  success: boolean
  conversationId?: string
  originatorConversationId?: string
  responseCode?: string
  responseDescription?: string
  error?: string
}

// B2C (Business to Customer) - for withdrawals
export async function initiateB2C(request: B2CRequest): Promise<B2CResponse> {
  const normalizedPhone = normalizePhone(request.phone)
  
  // Demo mode
  if (MPESA_CONFIG.consumerKey === 'YOUR_CONSUMER_KEY') {
    console.log('[Demo Mode] Simulating B2C to:', normalizedPhone, 'Amount:', request.amount)
    
    return {
      success: true,
      conversationId: `DEMO_B2C_${Date.now()}`,
      originatorConversationId: `DEMO_ORIG_${Date.now()}`,
      responseCode: '0',
      responseDescription: 'Accept the service request successfully.'
    }
  }
  
  // Note: B2C requires additional configuration (initiator name, security credential, etc.)
  // This is a placeholder for the actual implementation
  try {
    const accessToken = await getAccessToken()
    
    // B2C configuration would go here
    // This requires:
    // - InitiatorName
    // - SecurityCredential (encrypted with M-Pesa public key)
    // - CommandID (BusinessPayment, SalaryPayment, PromotionPayment)
    // - PartyA (organization shortcode)
    // - PartyB (phone number)
    // - Remarks
    // - QueueTimeOutURL
    // - ResultURL
    // - Occasion (optional)
    
    return {
      success: false,
      error: 'B2C not configured. Please set up B2C credentials.'
    }
  } catch (error) {
    console.error('B2C error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to initiate B2C'
    }
  }
}

// Parse callback data from M-Pesa
export interface MpesaCallbackData {
  merchantRequestId: string
  checkoutRequestId: string
  resultCode: number
  resultDesc: string
  amount?: number
  mpesaReceiptNumber?: string
  transactionDate?: string
  phoneNumber?: string
}

export function parseCallback(body: unknown): MpesaCallbackData | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = body as any
    const stkCallback = data?.Body?.stkCallback
    
    if (!stkCallback) return null
    
    const result: MpesaCallbackData = {
      merchantRequestId: stkCallback.MerchantRequestID,
      checkoutRequestId: stkCallback.CheckoutRequestID,
      resultCode: stkCallback.ResultCode,
      resultDesc: stkCallback.ResultDesc
    }
    
    // Parse callback metadata if payment was successful
    if (stkCallback.ResultCode === 0 && stkCallback.CallbackMetadata) {
      const items = stkCallback.CallbackMetadata.Item || []
      
      for (const item of items) {
        switch (item.Name) {
          case 'Amount':
            result.amount = item.Value
            break
          case 'MpesaReceiptNumber':
            result.mpesaReceiptNumber = item.Value
            break
          case 'TransactionDate':
            result.transactionDate = String(item.Value)
            break
          case 'PhoneNumber':
            result.phoneNumber = String(item.Value)
            break
        }
      }
    }
    
    return result
  } catch (error) {
    console.error('Failed to parse M-Pesa callback:', error)
    return null
  }
}
