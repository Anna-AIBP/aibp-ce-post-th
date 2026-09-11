import { NextRequest, NextResponse } from 'next/server'

// Blocks direct/public access to /api/* (e.g. someone typing my.aibp.sg/api/sponsors
// into a browser, or a bare curl/script request) while leaving the app's own
// same-origin fetch() calls completely unaffected.
//
// The app's root layout (app/layout.tsx) runs a beforeInteractive script that
// stamps every same-origin /api/* fetch() call with this header — a marker we
// fully control, not a browser-implemented security feature. Any browser able
// to run this app's JS at all (required for it to function regardless) sends
// it identically, so this carries no browser-compatibility risk.
const APP_TOKEN = 'ceth26-app-v1'

export function middleware(req: NextRequest) {
  if (req.headers.get('x-ceid26-app') === APP_TOKEN) {
    return NextResponse.next()
  }
  return new NextResponse('Not Found', { status: 404 })
}

export const config = {
  matcher: '/api/:path*',
}
