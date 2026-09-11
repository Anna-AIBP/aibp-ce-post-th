import { NextResponse } from 'next/server'

// Deliberately separate from GAS_URL — the report backend is its own
// standalone Apps Script project/deployment (gas/Report.gs), independent
// from the main CE app's GAS project, so it can never be affected by (or
// affect) the live app.
const REPORT_GAS_URL = process.env.REPORT_GAS_URL || ''

export async function GET() {
  if (!REPORT_GAS_URL) {
    return NextResponse.json({ error: 'no_gas_url' })
  }

  try {
    const res = await fetch(`${REPORT_GAS_URL}?action=getReport`, {
      next: { revalidate: 300 },
    })
    if (!res.ok) throw new Error(`GAS ${res.status}`)
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'request_failed' })
  }
}
