// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { email, wallet } = await req.json()
    const entry = email || wallet
    if (!entry) return NextResponse.json({ error: 'Required' }, { status: 400 })

    const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN
    const AIRTABLE_BASE = process.env.AIRTABLE_BASE_ID

    if (AIRTABLE_TOKEN && AIRTABLE_BASE) {
      await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/Waitlist`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: { Entry: entry, Type: wallet ? 'wallet' : 'email', Source: 'trench-woad.vercel.app', Timestamp: new Date().toISOString() } })
      })
    }

    console.log(`[WAITLIST] ${new Date().toISOString()} — ${entry}`)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[WAITLIST ERROR]', err)
    return NextResponse.json({ success: true })
  }
}

export async function GET() {
  return NextResponse.json({ status: 'waitlist active' })
}
