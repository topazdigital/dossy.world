import { NextRequest, NextResponse } from 'next/server'
import { isValidKenyanPhone, normalizePhone, requireAdmin } from '@/lib/auth'
import { initiateStkPush } from '@/lib/payhero'

// Admin-only: fire a test STK push to any phone (no DB transaction is created).
// Useful for sanity-checking the PayHero integration after activation.
export async function POST(request: NextRequest) {
  try {
    await requireAdmin()
    const body = await request.json()
    const phone: string = body?.phone || ''
    const amount: number = Number(body?.amount) || 0

    if (!phone || !isValidKenyanPhone(phone)) {
      return NextResponse.json(
        { error: 'Please enter a valid Kenyan phone number (e.g. 0712345678).' },
        { status: 400 },
      )
    }
    if (!Number.isFinite(amount) || amount < 1 || amount > 70_000) {
      return NextResponse.json(
        { error: 'Amount must be between KES 1 and 70,000 for the test push.' },
        { status: 400 },
      )
    }

    const stk = await initiateStkPush({
      phone: normalizePhone(phone),
      amount: Math.round(amount),
      accountReference: `TESTSTK${Date.now()}`,
      customerName: 'Dossy World Test',
    })

    if (!stk.success) {
      return NextResponse.json({ error: stk.error || 'STK push failed' }, { status: 502 })
    }

    return NextResponse.json({
      success: true,
      message: stk.customerMessage || 'STK push sent. Check the phone.',
      reference: stk.checkoutRequestId,
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Test STK push error:', error)
    return NextResponse.json({ error: 'Test STK push failed' }, { status: 500 })
  }
}
